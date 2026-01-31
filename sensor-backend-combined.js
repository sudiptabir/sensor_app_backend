/**
 * 🚀 Combined Sensor Backend + Admin Portal Server
 * Runs both services on the same application
 * Backend APIs on /api/...
 * Admin Portal on /admin/...
 */

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const https = require('https');
const session = require('express-session');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware for admin portal
app.use(session({
  secret: process.env.SESSION_SECRET || 'admin-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Set view engine for admin portal
app.set('view engine', 'ejs');
app.set('views', __dirname + '/admin-portal/views');
app.use(express.static(__dirname + '/admin-portal/public'));

// Database connection pool
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

// Initialize admin portal schema
async function initAdminDatabase() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255),
      role VARCHAR(50) DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS device_access_control (
      id SERIAL PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      access_level VARCHAR(50) DEFAULT 'viewer',
      granted_by VARCHAR(255),
      granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      is_blocked BOOLEAN DEFAULT false,
      reason TEXT,
      UNIQUE(device_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS admin_logs (
      id SERIAL PRIMARY KEY,
      admin_email VARCHAR(255),
      action VARCHAR(255),
      details JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const query of queries) {
    try {
      await pool.query(query);
    } catch (error) {
      console.warn('[Database] Schema initialization warning:', error.message);
    }
  }
  console.log('[Database] ✅ Admin schema ready');
}

initAdminDatabase().catch(console.error);

// ============================================
// ADMIN PORTAL - Authentication Middleware
// ============================================

function requireAuth(req, res, next) {
  if (req.session && req.session.adminEmail) {
    return next();
  }
  res.redirect('/admin/login');
}

// ============================================
// ADMIN PORTAL - Authentication Routes
// ============================================

app.get('/admin/login', (req, res) => {
  if (req.session.adminEmail) {
    return res.redirect('/admin/dashboard');
  }
  res.render('login', { error: null });
});

app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM admin_users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.render('login', { error: 'Invalid credentials' });
    }
    
    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    
    if (!validPassword) {
      return res.render('login', { error: 'Invalid credentials' });
    }
    
    req.session.adminEmail = admin.email;
    req.session.adminName = admin.full_name;
    req.session.adminRole = admin.role;
    
    await pool.query('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE email = $1', [email]);
    
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('[Login] Error:', error);
    res.render('login', { error: 'Login failed. Please try again.' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ============================================
// ADMIN PORTAL - Dashboard
// ============================================

app.get('/admin/', (req, res) => {
  res.redirect('/admin/dashboard');
});

app.get('/admin/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', {
    adminName: req.session.adminName,
  });
});

// ============================================
// ADMIN PORTAL - Setup (Create First Admin)
// ============================================

app.post('/admin/api/setup/create-admin', async (req, res) => {
  try {
    const { email, password, fullName, setupKey } = req.body;
    
    // Verify setup key
    if (setupKey !== process.env.SETUP_KEY && setupKey !== 'setup123') {
      return res.status(403).json({ error: 'Invalid setup key' });
    }
    
    // Check if admin already exists
    const existing = await pool.query('SELECT id FROM admin_users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Admin already exists' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    await pool.query(
      'INSERT INTO admin_users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
      [email, passwordHash, fullName, 'super_admin']
    );
    
    res.json({ success: true, message: 'Admin created successfully' });
  } catch (error) {
    console.error('[Create Admin] Error:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// ============================================
// ADMIN PORTAL - Health Check
// ============================================

app.get('/admin/health', (req, res) => {
  res.json({ status: 'ok', service: 'admin-portal' });
});

// ============================================
// SENSOR BACKEND - ACCESS CONTROL
// ============================================

async function checkUserAccess(userId, deviceId) {
  try {
    const result = await pool.query(
      'SELECT * FROM device_access_control WHERE user_id = $1 AND device_id = $2 AND is_blocked = false',
      [userId, deviceId]
    );
    
    if (result.rows.length === 0) {
      return { hasAccess: false, reason: 'No access granted' };
    }
    
    const access = result.rows[0];
    if (access.expires_at && new Date(access.expires_at) < new Date()) {
      return { hasAccess: false, reason: 'Access expired' };
    }
    
    return {
      hasAccess: true,
      accessLevel: access.access_level,
    };
  } catch (error) {
    console.warn('[Access Control] Error:', error.message);
    return { hasAccess: true };
  }
}

// ============================================
// SENSOR BACKEND - Device Management
// ============================================

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

/**
 * PUT /api/devices/:deviceId/metadata
 * Update device metadata (including IP address)
 */
app.put('/api/devices/:deviceId/metadata', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const metadata = req.body;
    
    // Get existing metadata
    const existing = await pool.query(
      'SELECT device_metadata FROM device_metadata WHERE device_id = $1',
      [deviceId]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Merge with existing metadata
    const currentMetadata = existing.rows[0].device_metadata || {};
    const updatedMetadata = { ...currentMetadata, ...metadata };
    
    // Update metadata
    const result = await pool.query(
      `UPDATE device_metadata 
       SET device_metadata = $1, updated_at = NOW() 
       WHERE device_id = $2 
       RETURNING *`,
      [JSON.stringify(updatedMetadata), deviceId]
    );
    
    console.log(`📝 Updated metadata for device ${deviceId}:`, metadata);
    
    res.json({
      message: 'Metadata updated',
      device_id: deviceId,
      metadata: updatedMetadata
    });
  } catch (error) {
    console.error('[Metadata Update] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SENSOR BACKEND - Sensor Management
// ============================================

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

app.post('/api/sensors', async (req, res) => {
  try {
    const { device_id, sensor_name, sensor_type, location, unit } = req.body;
    const result = await pool.query(
      `INSERT INTO sensors (device_id, sensor_name, sensor_type, location, unit)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [device_id, sensor_name, sensor_type, location, unit]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SENSOR BACKEND - Readings
// ============================================

app.get('/api/readings/:sensorId', async (req, res) => {
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
 * GET /api/readings/stats/:sensorId
 * Returns statistics (min, max, avg) for sensor readings
 */
app.get('/api/readings/stats/:sensorId', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { hours = 24 } = req.query;
    
    const result = await pool.query(
      `SELECT 
        COUNT(*) as count,
        MIN(CAST(value AS FLOAT)) as min_value,
        MAX(CAST(value AS FLOAT)) as max_value,
        AVG(CAST(value AS FLOAT)) as avg_value,
        MIN(created_at) as first_reading,
        MAX(created_at) as last_reading
       FROM sensor_readings
       WHERE sensor_id = $1 AND created_at > NOW() - INTERVAL '${hours} hours'`,
      [sensorId]
    );
    res.json(result.rows[0] || { count: 0, min_value: null, max_value: null, avg_value: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/readings', async (req, res) => {
  try {
    const { 
      device_id, 
      sensor_id, 
      temperature,
      humidity,
      value, 
      quality = 100,
      sensor_type = 'temperature'
    } = req.body;
    
    // Support both old format (value) and new DHT format (temperature/humidity)
    let insertTemp = value;
    let insertHumidity = null;
    
    if (temperature !== undefined) {
      insertTemp = temperature;
      insertHumidity = humidity;
    }
    
    if (!sensor_id) {
      return res.status(400).json({ error: 'sensor_id is required' });
    }
    
    const sensorCheck = await pool.query(
      'SELECT sensor_id, device_id FROM sensors WHERE sensor_id = $1',
      [sensor_id]
    );
    
    if (sensorCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    
    // Insert temperature reading
    const tempResult = await pool.query(
      `INSERT INTO sensor_readings (time, sensor_id, value, quality, data_type)
       VALUES (NOW(), $1, $2, $3, 'temperature')
       RETURNING *`,
      [sensor_id, insertTemp, quality]
    );
    
    // Insert humidity reading if provided
    let humidityResult = null;
    if (insertHumidity !== null) {
      humidityResult = await pool.query(
        `INSERT INTO sensor_readings (time, sensor_id, value, quality, data_type)
         VALUES (NOW(), $1, $2, $3, 'humidity')
         RETURNING *`,
        [sensor_id, insertHumidity, quality]
      );
    }
    
    // Emit to WebSocket subscribers
    io.emit('sensor_reading', {
      sensor_id,
      temperature: insertTemp,
      humidity: insertHumidity,
      quality,
      timestamp: tempResult.rows[0].time,
    });
    
    io.to(`sensor_${sensor_id}`).emit('sensor_update', {
      sensor_id,
      temperature: insertTemp,
      humidity: insertHumidity,
      timestamp: tempResult.rows[0].time,
    });
    
    res.status(201).json({
      temperature: insertTemp,
      humidity: insertHumidity,
      timestamp: tempResult.rows[0].time,
      quality
    });
  } catch (error) {
    console.error('Error saving reading:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SENSOR CONTROL ENDPOINTS
// ============================================

/**
 * GET /api/sensors/:sensorId/control?action=on|off
 * Control sensor on/off
 */
app.get('/api/sensors/:sensorId/control', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { action } = req.query;
    
    if (!['on', 'off'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "on" or "off"' });
    }
    
    const isActive = action === 'on';
    
    const result = await pool.query(
      `UPDATE sensors SET is_active = $1, updated_at = NOW() WHERE sensor_id = $2 RETURNING *`,
      [isActive, sensorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    
    console.log(`📡 Sensor ${sensorId} turned ${action.toUpperCase()}`);
    
    // Broadcast control event via WebSocket
    io.to(`sensor_${sensorId}`).emit('sensor_control', {
      sensor_id: sensorId,
      action: action,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      message: `Sensor turned ${action.toUpperCase()}`,
      sensor_id: sensorId,
      is_active: isActive
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sensors/:sensorId/control
 * Control sensor via POST
 */
app.post('/api/sensors/:sensorId/control', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { action } = req.body;
    
    if (!['on', 'off'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "on" or "off"' });
    }
    
    const isActive = action === 'on';
    
    // Update database
    const result = await pool.query(
      `UPDATE sensors SET is_active = $1, updated_at = NOW() WHERE sensor_id = $2 RETURNING *`,
      [isActive, sensorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    
    console.log(`📡 Sensor ${sensorId} turned ${action.toUpperCase()}`);
    
    // Get device IP from device_metadata
    const sensor = result.rows[0];
    const deviceResult = await pool.query(
      `SELECT device_metadata FROM device_metadata WHERE device_id = $1`,
      [sensor.device_id]
    );
    
    let controlSuccess = false;
    let controlError = null;
    
    if (deviceResult.rows.length > 0) {
      const metadata = deviceResult.rows[0].device_metadata;
      const deviceIp = metadata?.ip_address;
      
      if (deviceIp) {
        // Send control command to Raspberry Pi
        try {
          const controlUrl = `http://${deviceIp}:5000/sensor/control?action=${action}`;
          console.log(`🔌 Sending control to Pi at ${controlUrl}`);
          
          const axios = require('axios');
          const piResponse = await axios.get(controlUrl, { timeout: 5000 });
          
          if (piResponse.status === 200) {
            controlSuccess = true;
            console.log(`✅ Pi responded: ${JSON.stringify(piResponse.data)}`);
          }
        } catch (piError) {
          console.error(`⚠️  Failed to control Pi: ${piError.message}`);
          controlError = piError.message;
        }
      } else {
        console.log(`⚠️  No IP address found for device ${sensor.device_id}`);
        controlError = 'Device IP address not registered';
      }
    }
    
    // Broadcast control event via WebSocket
    io.to(`sensor_${sensorId}`).emit('sensor_control', {
      sensor_id: sensorId,
      action: action,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      message: `Sensor turned ${action.toUpperCase()}`,
      sensor_id: sensorId,
      is_active: isActive,
      device_control: controlSuccess ? 'success' : 'failed',
      device_error: controlError
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sensors/:sensorId/latest
 * Get latest temperature and humidity reading
 */
app.get('/api/sensors/:sensorId/latest', async (req, res) => {
  try {
    const { sensorId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        sensor_id,
        (SELECT value FROM sensor_readings 
         WHERE sensor_id = $1 AND data_type = 'temperature' 
         ORDER BY created_at DESC LIMIT 1) as temperature,
        (SELECT value FROM sensor_readings 
         WHERE sensor_id = $1 AND data_type = 'humidity' 
         ORDER BY created_at DESC LIMIT 1) as humidity,
        (SELECT MAX(created_at) FROM sensor_readings 
         WHERE sensor_id = $1) as timestamp
      FROM sensor_readings
      WHERE sensor_id = $1
      LIMIT 1
    `, [sensorId]);
    
    if (result.rows.length === 0 || (result.rows[0].temperature === null && result.rows[0].humidity === null)) {
      return res.status(404).json({ error: 'No readings found for this sensor' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'combined-backend-admin', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Sensor Data Backend + Admin Portal',
    version: '1.0.0',
    endpoints: {
      devices: '/api/devices',
      sensors: '/api/sensors',
      readings: '/api/readings/:sensorId',
      admin: '/admin/login',
      adminApi: '/admin/api/setup/create-admin',
    },
  });
});

// ============================================
// WebSocket
// ============================================

io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  
  socket.on('subscribe_sensor', (sensorId) => {
    socket.join(`sensor_${sensorId}`);
    console.log(`📡 Client subscribed to sensor ${sensorId}`);
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
╔════════════════════════════════════════════════════════╗
║  🚀 Combined Sensor Backend + Admin Portal             ║
║                                                        ║
║  📡 Backend: http://localhost:${PORT}                      ║
║  🔐 Admin Portal: http://localhost:${PORT}/admin/login    ║
║  📊 API Docs: http://localhost:${PORT}/api              ║
║  ✅ Health: http://localhost:${PORT}/health            ║
║                                                        ║
╚════════════════════════════════════════════════════════╝

🔧 To create your first admin account, run:

curl -X POST http://localhost:${PORT}/admin/api/setup/create-admin \\
  -H "Content-Type: application/json" \\
  -d '{
    "email":"admin@example.com",
    "password":"Test123!",
    "fullName":"Admin",
    "setupKey":"setup123"
  }'

Then login at: http://localhost:${PORT}/admin/login
  `);
});

module.exports = { app, pool, io };
