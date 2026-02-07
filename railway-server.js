#!/usr/bin/env node

/**
 * 🚨 Alert API Backend Server - Railway Deployment
 * Receives alerts from external sources and pushes notifications to mobile app
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Database connection pool
// Railway provides DATABASE_URL, local dev uses individual vars
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password123',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'sensor_db',
      }
);

// Test database connection
pool.on('error', (err) => {
  console.error('⚠️  Unexpected pool error:', err);
});

pool.connect((err, client, done) => {
  if (err) {
    console.error('⚠️  Database connection failed:', err);
    console.log('⚠️  Continuing without database access (sensors disabled)');
  } else {
    console.log('✅ Database connected successfully');
    done();
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
  try {
    if (!firebaseInitialized) {
      let serviceAccount;
      
      // Prioritize individual environment variables (more reliable for Railway)
      if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        serviceAccount = {
          type: "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID || "sensor-app-2a69b",
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
        };
        console.log('✅ Using individual Firebase environment variables');
      } 
      // Fallback to base64 encoded service account
      else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        const base64Data = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        const jsonString = Buffer.from(base64Data, 'base64').toString('utf8');
        serviceAccount = JSON.parse(jsonString);
        
        // Fix the private key - replace literal \n with actual newlines
        if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        
        console.log('✅ Using base64 encoded service account');
      } else {
        throw new Error('No Firebase credentials provided. Set either FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_BASE64');
      }
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://sensor-app-2a69b-default-rtdb.firebaseio.com"
      });
      
      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.log('⚠️  Server will continue without Firebase (notifications disabled)');
  }
}

// Initialize Firebase on startup
initializeFirebase();

/**
 * Generate notification content from alert data
 */
function generateNotificationContent(alert) {
  const riskEmojis = {
    'critical': '🔴',
    'high': '🟠', 
    'medium': '🟡',
    'low': '🟢'
  };

  const riskLevel = alert.risk_label.toLowerCase();
  const emoji = riskEmojis[riskLevel] || '🔵';
  
  const title = `${emoji} ${alert.risk_label} Alert - ${alert.device_identifier}`;
  const body = `${alert.detected_objects.join(', ')}: ${alert.description[0] || 'Alert detected'}`;

  return { title, body, emoji };
}

/**
 * Send push notification via Firebase
 */
async function sendPushNotification(userId, alert, notificationContent) {
  if (!firebaseInitialized) {
    console.log('⚠️  Firebase not initialized, skipping push notification');
    return null;
  }

  try {
    const db = admin.firestore();
    
    // Get user's Expo push token
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.expoPushToken) {
      console.log('⚠️  No Expo push token found for user:', userId);
      return null;
    }

    // Send notification via Expo Push API
    const message = {
      to: userData.expoPushToken,
      title: notificationContent.title,
      body: notificationContent.body,
      data: {
        type: 'mlAlert',
        deviceId: alert.device_identifier,
        alertId: alert.additional_data?.alert_id || uuidv4(),
        riskLabel: alert.risk_label,
        detectedObjects: alert.detected_objects.join(', '),
        timestamp: alert.timestamp.toString()
      },
      badge: 1,
      sound: 'default'
    };

    // Use Expo's push notification service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('📱 Push notification sent:', result);
    return result;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return null;
  }
}

/**
 * Store alert in Firestore
 */
async function storeAlertInFirestore(userId, deviceId, alert) {
  if (!firebaseInitialized) {
    console.log('⚠️  Firebase not initialized, skipping Firestore storage');
    return null;
  }

  try {
    const db = admin.firestore();
    
    // Create ML alert document
    const alertDoc = {
      deviceId: deviceId,
      deviceIdentifier: alert.device_identifier,
      userId: userId,
      notificationType: alert.notification_type,
      detectedObjects: alert.detected_objects,
      riskLabel: alert.risk_label,
      predictedRisk: alert.predicted_risk,
      description: alert.description,
      screenshots: alert.screenshot || [],
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      alertGeneratedAt: alert.timestamp,
      modelVersion: alert.model_version,
      confidenceScore: alert.confidence_score,
      acknowledged: false,
      rating: null,
      ratingAccuracy: null,
      additionalData: alert.additional_data || {}
    };

    // Store in user's mlAlerts collection
    const alertRef = await db
      .collection('users')
      .doc(userId)
      .collection('mlAlerts')
      .add(alertDoc);

    console.log('💾 Alert stored in Firestore:', alertRef.id);
    return alertRef.id;
  } catch (error) {
    console.error('❌ Error storing alert in Firestore:', error);
    return null;
  }
}

/**
 * API Routes
 */

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'Alert API Backend',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    firebase: firebaseInitialized,
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    firebase: firebaseInitialized
  });
});

// Receive and process alerts
app.post('/api/alerts', async (req, res) => {
  try {
    const { userId, deviceId, alert } = req.body;

    // Validate required fields
    if (!userId || !deviceId || !alert) {
      return res.status(400).json({
        error: 'Missing required fields: userId, deviceId, alert'
      });
    }

    if (!alert.detected_objects || !alert.risk_label) {
      return res.status(400).json({
        error: 'Invalid alert data: missing detected_objects or risk_label'
      });
    }

    console.log('🚨 Received alert:', {
      userId,
      deviceId,
      type: alert.notification_type,
      risk: alert.risk_label,
      objects: alert.detected_objects.join(', ')
    });

    // Generate notification content
    const notificationContent = generateNotificationContent(alert);

    // Store alert in Firestore (this will trigger real-time listeners in the app)
    const alertId = await storeAlertInFirestore(userId, deviceId, alert);

    // Send push notification
    const pushResult = await sendPushNotification(userId, alert, notificationContent);

    // Response
    res.json({
      success: true,
      message: 'Alert processed successfully',
      alertId,
      notification: {
        title: notificationContent.title,
        body: notificationContent.body,
        sent: !!pushResult
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error processing alert:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get server stats
app.get('/api/stats', (req, res) => {
  res.json({
    server: 'Alert API Backend',
    version: '1.0.0',
    uptime: process.uptime(),
    firebase: firebaseInitialized,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

/**
 * ============================================
 * SENSOR MANAGEMENT ENDPOINTS
 * ============================================
 */

/**
 * GET /api/sensors
 * List all active sensors, optionally filtered by deviceId
 */
app.get('/api/sensors', async (req, res) => {
  try {
    const { deviceId } = req.query;
    let query = 'SELECT * FROM sensors WHERE is_active = true';
    let params = [];
    
    if (deviceId) {
      query += ' AND device_id = $1';
      params.push(deviceId);
    }
    
    query += ' ORDER BY sensor_id DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.warn('⚠️  Error querying sensors:', error.message);
    // Return empty array if database not available
    res.json([]);
  }
});

/**
 * GET /api/sensors/:sensorId
 * Get specific sensor details
 */
app.get('/api/sensors/:sensorId', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const result = await pool.query(
      'SELECT * FROM sensors WHERE sensor_id = $1',
      [sensorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.warn('⚠️  Error querying sensor:', error.message);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * PUT /api/devices/:deviceId/metadata
 * Update device metadata (e.g., IP address for Raspberry Pi)
 */
app.put('/api/devices/:deviceId/metadata', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { ip_address, last_seen, status } = req.body;

    // Check if device exists
    const deviceCheck = await pool.query(
      'SELECT * FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Update device metadata
    const updateQuery = `
      UPDATE devices 
      SET 
        ip_address = COALESCE($1, ip_address),
        last_seen = COALESCE($2, CURRENT_TIMESTAMP),
        status = COALESCE($3, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE device_id = $4
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      ip_address || null,
      last_seen || null,
      status || null,
      deviceId
    ]);

    res.json({
      success: true,
      message: 'Device metadata updated',
      device: result.rows[0]
    });
  } catch (error) {
    console.warn('⚠️  Error updating device metadata:', error.message);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * GET /api/devices/:deviceId
 * Get device details
 */
app.get('/api/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const result = await pool.query(
      'SELECT * FROM devices WHERE device_id = $1',
      [deviceId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.warn('⚠️  Error querying device:', error.message);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * PUT /api/sensors/:sensorId/state
 * Update sensor enabled/disabled state with access control
 */
app.put('/api/sensors/:sensorId/state', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { enabled } = req.body;
    const userId = req.headers['x-user-id'];

    console.log(`[Sensor State] Request from user: ${userId} for sensor: ${sensorId}`);

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    // Check if user is blocked globally
    const userBlock = await pool.query(
      'SELECT * FROM user_blocks WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (userBlock.rows.length > 0) {
      console.log(`[Sensor State] User ${userId} is BLOCKED`);
      return res.status(403).json({
        error: 'Access denied',
        reason: 'User is blocked',
        details: userBlock.rows[0].reason
      });
    }

    // Get sensor's device_id for device-specific access check
    const sensorInfo = await pool.query(
      'SELECT device_id FROM sensors WHERE sensor_id = $1',
      [sensorId]
    );

    if (sensorInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    const deviceId = sensorInfo.rows[0].device_id;

    // Check device-specific access block
    const deviceAccess = await pool.query(
      'SELECT * FROM device_access_control WHERE device_id = $1 AND user_id = $2 AND is_blocked = true',
      [deviceId, userId]
    );

    if (deviceAccess.rows.length > 0) {
      console.log(`[Sensor State] User ${userId} blocked for device ${deviceId}`);
      return res.status(403).json({
        error: 'Access denied',
        reason: 'Access blocked for this device',
        details: deviceAccess.rows[0].reason
      });
    }

    // Update sensor state
    const result = await pool.query(
      `UPDATE sensors SET enabled = $1, updated_at = NOW() WHERE sensor_id = $2 RETURNING *`,
      [enabled, sensorId]
    );

    console.log(`[Sensor State] User ${userId} ${enabled ? 'enabled' : 'disabled'} sensor ${sensorId}`);
    res.json({
      success: true,
      message: `Sensor ${enabled ? 'enabled' : 'disabled'}`,
      sensor: result.rows[0]
    });
  } catch (error) {
    console.warn('⚠️  Error updating sensor state:', error.message);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * POST /api/sensors/:sensorId/control
 * Control sensor on/off via POST with access control
 */
app.post('/api/sensors/:sensorId/control', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { action } = req.body;
    const userId = req.headers['x-user-id'];

    console.log(`[Sensor Control] Request from user: ${userId} for sensor: ${sensorId}, action: ${action}`);

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!['on', 'off'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "on" or "off"' });
    }

    // Check if user is blocked globally
    const userBlock = await pool.query(
      'SELECT * FROM user_blocks WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (userBlock.rows.length > 0) {
      console.log(`[Sensor Control] User ${userId} is BLOCKED`);
      return res.status(403).json({
        error: 'Access denied',
        reason: 'User is blocked',
        details: userBlock.rows[0].reason
      });
    }

    // Get sensor's device_id for device-specific access check
    const sensorInfo = await pool.query(
      'SELECT device_id FROM sensors WHERE sensor_id = $1',
      [sensorId]
    );

    if (sensorInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    const deviceId = sensorInfo.rows[0].device_id;

    // Check device-specific access block
    const deviceAccess = await pool.query(
      'SELECT * FROM device_access_control WHERE device_id = $1 AND user_id = $2 AND is_blocked = true',
      [deviceId, userId]
    );

    if (deviceAccess.rows.length > 0) {
      console.log(`[Sensor Control] User ${userId} blocked for device ${deviceId}`);
      return res.status(403).json({
        error: 'Access denied',
        reason: 'Access blocked for this device',
        details: deviceAccess.rows[0].reason
      });
    }

    // Update sensor state
    const isActive = action === 'on';
    const result = await pool.query(
      `UPDATE sensors SET is_active = $1, updated_at = NOW() WHERE sensor_id = $2 RETURNING *`,
      [isActive, sensorId]
    );

    console.log(`[Sensor Control] User ${userId} turned sensor ${sensorId} ${action.toUpperCase()}`);
    res.json({
      success: true,
      message: `Sensor turned ${action.toUpperCase()}`,
      is_active: isActive,
      sensor_id: sensorId
    });
  } catch (error) {
    console.warn('⚠️  Error controlling sensor:', error.message);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * ============================================
 * USER ACCESS CONTROL ENDPOINTS
 * ============================================
 */

/**
 * POST /api/users/:userId/block
 * Block a user globally from accessing sensors
 */
app.post('/api/users/:userId/block', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!userId || !reason) {
      return res.status(400).json({ error: 'User ID and reason are required' });
    }

    // Check if already blocked
    const existing = await pool.query(
      'SELECT * FROM user_blocks WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User is already blocked' });
    }

    // Insert block record
    await pool.query(
      `INSERT INTO user_blocks (user_id, is_active, reason)
       VALUES ($1, true, $2)
       ON CONFLICT (user_id) DO UPDATE 
       SET is_active = true, reason = $2, blocked_at = NOW()`,
      [userId, reason]
    );

    console.log(`[User Block] User ${userId} blocked with reason: ${reason}`);
    res.json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    console.warn('⚠️  Error blocking user:', error.message);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

/**
 * POST /api/users/:userId/unblock
 * Unblock a user to allow access again
 */
app.post('/api/users/:userId/unblock', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Update block status
    const result = await pool.query(
      `UPDATE user_blocks SET is_active = false WHERE user_id = $1 RETURNING *`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User block not found' });
    }

    console.log(`[User Unblock] User ${userId} unblocked`);
    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    console.warn('⚠️  Error unblocking user:', error.message);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

/**
 * GET /api/users/:userId/status
 * Get user block status
 */
app.get('/api/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      'SELECT * FROM user_blocks WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    res.json({
      userId,
      isBlocked: result.rows.length > 0,
      reason: result.rows[0]?.reason || null,
      blockedAt: result.rows[0]?.blocked_at || null
    });
  } catch (error) {
    console.warn('⚠️  Error checking user status:', error.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚨 Alert API Backend Server - Railway Deployment');
  console.log('=================================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔥 Firebase initialized: ${firebaseInitialized}`);
  console.log(`📡 Alert endpoint: /api/alerts`);
  console.log(`🌍 Sensor endpoints: /api/sensors`);
  console.log(`💚 Health check: /health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('=================================================');
});

module.exports = app;