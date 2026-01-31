/**
 * 🚀 Sensor Data Backend Server
 * Handles sensor CRUD, real-time data streaming, and API endpoints
 * 
 * Install: npm install express pg cors dotenv socket.io
 * Run: node sensor-backend.js
 */

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const https = require('https');

// ============================================
// Configuration
// ============================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Admin Portal Configuration
const ADMIN_PORTAL_URL = process.env.ADMIN_PORTAL_URL || 'http://localhost:4000';
const API_KEY = process.env.API_KEY || 'test-api-key-123';

// Middleware
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 3000;

// ============================================
// Database Connection Test
// ============================================
pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

pool.connect((err, client, done) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  } else {
    console.log('✅ Database connected successfully');
    done();
  }
});

// ============================================
// ACCESS CONTROL MIDDLEWARE
// ============================================

/**
 * Check if user has access to device via admin portal
 */
async function checkUserAccess(userId, deviceId) {
  try {
    const url = `${ADMIN_PORTAL_URL}/api/check-access/${userId}/${deviceId}`;
    
    const response = await new Promise((resolve, reject) => {
      const client = ADMIN_PORTAL_URL.startsWith('https') ? https : http;
      const req = client.get(url, {
        headers: { 'X-API-Key': API_KEY }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ hasAccess: true }); // Default allow if parsing fails
          }
        });
      });
      
      req.on('error', (err) => {
        console.warn('[Access Control] Admin portal unreachable:', err.message);
        resolve({ hasAccess: true }); // Default allow if admin portal is down
      });
      
      req.setTimeout(2000, () => {
        req.destroy();
        resolve({ hasAccess: true }); // Default allow on timeout
      });
    });
    
    return response;
  } catch (error) {
    console.error('[Access Control] Error:', error);
    return { hasAccess: true }; // Graceful degradation
  }
}

/**
 * Express middleware to check access for sensor endpoints
 */
async function requireSensorAccess(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId;
  const sensorId = req.params.sensorId;
  
  // If no userId provided, skip access control (backward compatibility)
  if (!userId) {
    console.log('[Access Control] No userId provided, allowing access');
    return next();
  }
  
  if (!sensorId) {
    return next();
  }
  
  try {
    // Get device_id from sensor_id
    const sensorResult = await pool.query('SELECT device_id FROM sensors WHERE sensor_id = $1', [sensorId]);
    
    if (sensorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    
    const deviceId = sensorResult.rows[0].device_id;
    const { hasAccess, reason } = await checkUserAccess(userId, deviceId);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Access denied', 
        reason: reason || 'You do not have permission to access this device',
        blocked: true
      });
    }
    
    next();
  } catch (error) {
    console.error('[Access Control] Error:', error);
    next(); // Allow on error (graceful degradation)
  }
}

// ============================================
// ROUTES - Device Management
// ============================================

/**
 * GET /api/devices
 * Get all devices with their sensors
 */
app.get('/api/devices', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        d.*,
        COUNT(s.sensor_id) as sensor_count
      FROM device_metadata d
      LEFT JOIN sensors s ON d.device_id = s.device_id
      GROUP BY d.device_id
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/devices/:deviceId
 * Get specific device details
 */
app.get('/api/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const result = await pool.query(
      'SELECT * FROM device_metadata WHERE device_id = $1',
      [deviceId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/devices
 * Register new device
 */
app.post('/api/devices', async (req, res) => {
  try {
    const { device_id, device_name, device_type, location } = req.body;
    const result = await pool.query(
      `INSERT INTO device_metadata (device_id, device_name, device_type, location, is_online)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (device_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [device_id, device_name, device_type, location]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTES - Sensor Management
// ============================================

/**
 * GET /api/sensors
 * Get all sensors
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
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sensors/:sensorId
 * Get sensor details
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
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sensors
 * Create new sensor
 */
app.post('/api/sensors', async (req, res) => {
  try {
    const { device_id, sensor_name, sensor_type, location, unit, min_value, max_value } = req.body;
    const result = await pool.query(
      `INSERT INTO sensors (device_id, sensor_name, sensor_type, location, unit, min_value, max_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [device_id, sensor_name, sensor_type, location, unit, min_value, max_value]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTES - Sensor Readings
// ============================================

/**
 * GET /api/readings/:sensorId
 * Get sensor readings with time range
 * Query: ?hours=24&limit=1000
 */
app.get('/api/readings/:sensorId', requireSensorAccess, async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { hours = 24, limit = 1000 } = req.query;
    
    const result = await pool.query(
      `SELECT time, value, quality, created_at
       FROM sensor_readings
       WHERE sensor_id = $1 AND time > NOW() - INTERVAL '${hours} hours'
       ORDER BY time DESC
       LIMIT $2`,
      [sensorId, limit]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/readings
 * Add new sensor reading
 */
app.post('/api/readings', async (req, res) => {
  try {
    const { sensor_id, value, quality = 100 } = req.body;
    
    // Verify sensor exists
    const sensorCheck = await pool.query(
      'SELECT sensor_id FROM sensors WHERE sensor_id = $1',
      [sensor_id]
    );
    
    if (sensorCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    
    // Insert reading
    const result = await pool.query(
      `INSERT INTO sensor_readings (time, sensor_id, value, quality)
       VALUES (NOW(), $1, $2, $3)
       RETURNING *`,
      [sensor_id, value, quality]
    );
    
    // Broadcast to WebSocket clients
    io.emit('sensor_reading', {
      sensor_id,
      value,
      quality,
      timestamp: result.rows[0].time,
    });
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/readings/batch
 * Add multiple readings at once
 */
app.post('/api/readings/batch', async (req, res) => {
  try {
    const { readings } = req.body; // Array of {sensor_id, value, quality}
    
    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ error: 'Invalid readings array' });
    }
    
    const values = readings
      .map((r, i) => `(NOW(), $${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
      .join(',');
    
    const params = readings.flatMap(r => [
      r.sensor_id,
      r.value,
      r.quality || 100,
    ]);
    
    const result = await pool.query(
      `INSERT INTO sensor_readings (time, sensor_id, value, quality)
       VALUES ${values}
       RETURNING *`,
      params
    );
    
    // Broadcast each reading
    result.rows.forEach(row => {
      io.emit('sensor_reading', {
        sensor_id: row.sensor_id,
        value: row.value,
        timestamp: row.time,
      });
    });
    
    res.status(201).json({ inserted: result.rows.length, readings: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/readings/stats/:sensorId
 * Get statistics for a sensor
 */
app.get('/api/readings/stats/:sensorId', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { hours = 24 } = req.query;
    
    const result = await pool.query(
      `SELECT
        MIN(value) as min_value,
        MAX(value) as max_value,
        AVG(value) as avg_value,
        STDDEV(value) as stddev_value,
        COUNT(*) as reading_count,
        MIN(time) as oldest_reading,
        MAX(time) as latest_reading
       FROM sensor_readings
       WHERE sensor_id = $1 AND time > NOW() - INTERVAL '1 hours' * $2`,
      [sensorId, parseInt(hours) || 24]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTES - Health Check
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Sensor Data Backend',
    version: '1.0.0',
    endpoints: {
      devices: '/api/devices',
      sensors: '/api/sensors',
      readings: '/api/readings/:sensorId',
    },
  });
});

// ============================================
// WebSocket Events
// ============================================

io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  
  // Subscribe to sensor updates
  socket.on('subscribe_sensor', (sensorId) => {
    socket.join(`sensor_${sensorId}`);
    console.log(`📡 Client subscribed to sensor ${sensorId}`);
  });
  
  // Unsubscribe from sensor
  socket.on('unsubscribe_sensor', (sensorId) => {
    socket.leave(`sensor_${sensorId}`);
    console.log(`📡 Client unsubscribed from sensor ${sensorId}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// ============================================
// Error Handling
// ============================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// Start Server
// ============================================

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║         🚀 Sensor Backend Server Started             ║
║                                                       ║
║  📡 Server: http://localhost:${PORT}                      ║
║  🗄️  Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}        ║
║  📊 WebSocket: ws://localhost:${PORT}                     ║
║                                                       ║
║  API Docs: http://localhost:${PORT}/api              ║
║  Health: http://localhost:${PORT}/health             ║
╚═══════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, pool, io };
