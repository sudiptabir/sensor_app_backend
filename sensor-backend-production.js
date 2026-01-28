/**
 * 🚀 Production-Ready Backend Server
 * Removes test code, adds security, environment-based configuration
 * Works across any network via HTTPS and DNS
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// DATABASE CONNECTION (Cloud-Based)
// ============================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[Database] Unexpected error on idle client:', err);
});

// Test connection
pool.query('SELECT 1', (err) => {
  if (err) {
    console.error('[Database] Connection failed:', err);
    process.exit(1);
  } else {
    console.log('[Database] ✅ Connected to cloud database');
  }
});

// ============================================
// MIDDLEWARE
// ============================================

// HTTPS Enforcement (if behind reverse proxy)
app.use((req, res, next) => {
  if (NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
});

// CORS Configuration - Only allow trusted origins
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || CORS_ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'), false);
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * Verify API Key for device/server authentication
 */
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }
  
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  
  next();
};

/**
 * Verify JWT Token for mobile app authentication
 */
const verifyJWT = (req, res, next) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ============================================
// HEALTH CHECK (For cloud monitoring)
// ============================================

/**
 * GET /health
 * Cloud platforms use this to check if backend is alive
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    environment: NODE_ENV,
  });
});

// ============================================
// DEVICE REGISTRATION & MANAGEMENT
// ============================================

/**
 * POST /api/devices/register
 * Device auto-registers when it comes online
 * Returns device metadata and authentication token
 * 
 * No IP tracking - device identified by device_id (UUID)
 */
app.post('/api/devices/register', verifyApiKey, async (req, res) => {
  try {
    const { device_id, device_name, device_type, location } = req.body;
    
    if (!device_id || !device_name) {
      return res.status(400).json({ error: 'Missing required fields: device_id, device_name' });
    }
    
    // Register/update device in database
    const result = await pool.query(
      `INSERT INTO device_metadata (device_id, device_name, device_type, location, is_online, last_online)
       VALUES ($1, $2, $3, $4, true, NOW())
       ON CONFLICT (device_id) 
       DO UPDATE SET is_online = true, last_online = NOW(), updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [device_id, device_name, device_type, location]
    );
    
    // Generate device authentication token (valid for 24 hours)
    const token = jwt.sign(
      { device_id, type: 'device' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log(`[Device] ${device_name} (${device_id}) registered successfully`);
    
    res.status(201).json({
      success: true,
      device: result.rows[0],
      token: token,
      message: `Device '${device_name}' registered successfully`
    });
  } catch (error) {
    console.error('[Device Registration] Error:', error.message);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

/**
 * GET /api/devices
 * Get all online devices (no IP addresses exposed)
 */
app.get('/api/devices', verifyJWT, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT device_id, device_name, device_type, location, is_online, last_online, created_at
       FROM device_metadata
       ORDER BY device_name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[Get Devices] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/devices/:deviceId
 * Get specific device details
 */
app.get('/api/devices/:deviceId', verifyJWT, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const result = await pool.query(
      `SELECT device_id, device_name, device_type, location, is_online, last_online, created_at
       FROM device_metadata
       WHERE device_id = $1`,
      [deviceId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Get Device] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/devices/heartbeat
 * Device sends heartbeat to stay marked as online
 */
app.post('/api/devices/heartbeat', verifyApiKey, async (req, res) => {
  try {
    const { device_id } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: 'Missing device_id' });
    }
    
    await pool.query(
      `UPDATE device_metadata
       SET last_online = NOW(), is_online = true
       WHERE device_id = $1`,
      [device_id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Heartbeat] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SENSOR MANAGEMENT (No IP references)
// ============================================

/**
 * GET /api/sensors
 * Get sensors (optionally filtered by device)
 */
app.get('/api/sensors', verifyJWT, async (req, res) => {
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
    console.error('[Get Sensors] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sensors
 * Create new sensor (requires device authentication)
 */
app.post('/api/sensors', verifyApiKey, async (req, res) => {
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
    console.error('[Create Sensor] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SENSOR READINGS
// ============================================

/**
 * GET /api/readings/:sensorId
 * Get sensor readings with time range
 * Query: ?hours=24&limit=1000
 */
app.get('/api/readings/:sensorId', verifyJWT, async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { hours = 24, limit = 1000 } = req.query;
    
    const result = await pool.query(
      `SELECT time, value, quality, created_at
       FROM sensor_readings
       WHERE sensor_id = $1 AND time > NOW() - INTERVAL '${parseInt(hours)} hours'
       ORDER BY time DESC
       LIMIT ${parseInt(limit)}`,
      [sensorId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('[Get Readings] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/readings
 * Add new sensor reading (device sends data)
 */
app.post('/api/readings', verifyApiKey, async (req, res) => {
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
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[Add Reading] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/readings/batch
 * Add multiple sensor readings at once
 */
app.post('/api/readings/batch', verifyApiKey, async (req, res) => {
  try {
    const { readings } = req.body;
    
    if (!Array.isArray(readings)) {
      return res.status(400).json({ error: 'readings must be an array' });
    }
    
    let count = 0;
    for (const reading of readings) {
      try {
        await pool.query(
          `INSERT INTO sensor_readings (time, sensor_id, value, quality)
           VALUES (NOW(), $1, $2, $3)`,
          [reading.sensor_id, reading.value, reading.quality || 100]
        );
        count++;
      } catch (err) {
        console.error(`[Batch Reading] Failed for sensor ${reading.sensor_id}:`, err.message);
      }
    }
    
    res.json({ success: true, inserted: count, total: readings.length });
  } catch (error) {
    console.error('[Batch Readings] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/readings/stats/:sensorId
 * Get sensor statistics (min, max, avg, etc.)
 * Query: ?hours=24
 */
app.get('/api/readings/stats/:sensorId', verifyJWT, async (req, res) => {
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
       WHERE sensor_id = $1 AND time > NOW() - INTERVAL '${parseInt(hours)} hours'`,
      [sensorId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Get Stats] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  res.status(500).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║        🚀 Production Backend Server                   ║
║                                                        ║
║  Environment: ${NODE_ENV}                          ║
║  Port: ${PORT}                                        ║
║  API URL: ${process.env.API_URL || 'Not configured'}   ║
║  Database: Cloud-based                                 ║
║  HTTPS: ${NODE_ENV === 'production' ? 'Enforced' : 'Development'}                              ║
║                                                        ║
║  Features:                                             ║
║  ✅ Device auto-registration                          ║
║  ✅ API Key authentication                            ║
║  ✅ JWT token verification                            ║
║  ✅ CORS security                                     ║
║  ✅ No hardcoded IPs                                  ║
║  ✅ Network-independent                              ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  pool.end();
  process.exit(0);
});

module.exports = app;
