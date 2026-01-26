/**
 * 🔐 Admin Portal Server
 * Railway-hosted admin dashboard for device and user management
 */

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const admin = require('firebase-admin');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ============================================
// FIREBASE ADMIN SETUP
// ============================================

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore();

// ============================================
// POSTGRESQL CONNECTION
// ============================================

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  pool.on('error', (err) => {
    console.error('[Database] Unexpected error on idle client:', err);
  });

  // Test connection
  pool.query('SELECT 1', (err) => {
    if (err) {
      console.error('[Database] Connection failed:', err);
      console.log('[Database] ⚠️  Continuing without database');
      pool = null;
    } else {
      console.log('[Database] ✅ Connected to cloud database');
    }
  });
} else {
  console.log('[Database] ⚠️  Running without PostgreSQL (Firebase-only mode)');
}

// Initialize database schema
async function initDatabase() {
  if (!pool) {
    console.log('[Database] Skipping schema initialization (no database configured)');
    return;
  }
  
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
    `CREATE TABLE IF NOT EXISTS user_blocks (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      blocked_by VARCHAR(255) NOT NULL,
      blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reason TEXT,
      is_active BOOLEAN DEFAULT true
    )`,
    `CREATE TABLE IF NOT EXISTS admin_logs (
      id SERIAL PRIMARY KEY,
      admin_email VARCHAR(255),
      action VARCHAR(255),
      target_type VARCHAR(50),
      target_id VARCHAR(255),
      details JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_device_access ON device_access_control(device_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_blocks ON user_blocks(user_id, is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_admin_logs ON admin_logs(created_at DESC)`
  ];

  for (const query of queries) {
    await pool.query(query);
  }
  console.log('[Database] ✅ Schema initialized');
}

initDatabase().catch(console.error);

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick)
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
    },
  },
}));

app.use(cors({
  origin: process.env.ADMIN_PORTAL_URL || 'http://localhost:4000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'admin-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  proxy: true, // Trust Railway proxy
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Required for Railway HTTPS
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

function requireAuth(req, res, next) {
  if (req.session && req.session.adminEmail) {
    return next();
  }
  res.redirect('/login');
}

function logAction(adminEmail, action, targetType, targetId, details, ipAddress) {
  pool.query(
    'INSERT INTO admin_logs (admin_email, action, target_type, target_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
    [adminEmail, action, targetType, targetId, JSON.stringify(details), ipAddress]
  ).catch(err => console.error('[Logging] Error:', err));
}

// ============================================
// ROUTES - AUTHENTICATION
// ============================================

app.get('/login', (req, res) => {
  if (req.session.adminEmail) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
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
    
    logAction(admin.email, 'LOGIN', 'admin', admin.id, {}, req.ip);
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('[Login] Error:', error);
    res.render('login', { error: 'Login failed. Please try again.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ============================================
// ROUTES - DASHBOARD
// ============================================

app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const [devicesSnapshot, appUsersSnapshot, blockedUsers, recentLogs] = await Promise.all([
      db.collection('devices').get(),
      db.collection('users').get(),
      pool.query('SELECT COUNT(*) FROM user_blocks WHERE is_active = true'),
      pool.query('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 10')
    ]);
    
    res.render('dashboard', {
      adminName: req.session.adminName,
      stats: {
        totalDevices: devicesSnapshot.size,
        totalUsers: appUsersSnapshot.size,
        blockedUsers: blockedUsers.rows[0].count,
        recentActivity: recentLogs.rows.length
      },
      recentLogs: recentLogs.rows
    });
  } catch (error) {
    console.error('[Dashboard] Error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// ============================================
// ROUTES - DEVICE MANAGEMENT
// ============================================

app.get('/devices', requireAuth, async (req, res) => {
  try {
    const devicesSnapshot = await db.collection('devices').get();
    const devices = [];
    
    devicesSnapshot.forEach(doc => {
      devices.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.render('devices', {
      adminName: req.session.adminName,
      devices
    });
  } catch (error) {
    console.error('[Devices] Error:', error);
    res.status(500).send('Error loading devices');
  }
});

app.get('/devices/:deviceId/access', requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const [deviceDoc, accessControl] = await Promise.all([
      db.collection('devices').doc(deviceId).get(),
      pool.query('SELECT * FROM device_access_control WHERE device_id = $1', [deviceId])
    ]);
    
    if (!deviceDoc.exists) {
      return res.status(404).send('Device not found');
    }
    
    res.render('device-access', {
      adminName: req.session.adminName,
      device: { id: deviceDoc.id, ...deviceDoc.data() },
      accessList: accessControl.rows
    });
  } catch (error) {
    console.error('[Device Access] Error:', error);
    res.status(500).send('Error loading device access');
  }
});

// ============================================
// ROUTES - USER MANAGEMENT
// ============================================

app.get('/users', requireAuth, async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = [];
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const blockStatus = await pool.query(
        'SELECT * FROM user_blocks WHERE user_id = $1 AND is_active = true',
        [doc.id]
      );
      
      users.push({
        id: doc.id,
        ...userData,
        isBlocked: blockStatus.rows.length > 0,
        blockReason: blockStatus.rows[0]?.reason
      });
    }
    
    res.render('users', {
      adminName: req.session.adminName,
      users
    });
  } catch (error) {
    console.error('[Users] Error:', error);
    res.status(500).send('Error loading users');
  }
});

// ============================================
// API ROUTES - USER ACCESS CONTROL
// ============================================

app.post('/api/users/:userId/block', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    if (!pool) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    await pool.query(
      'INSERT INTO user_blocks (user_id, blocked_by, reason) VALUES ($1, $2, $3)',
      [userId, req.session.adminEmail, reason]
    );
    
    logAction(req.session.adminEmail, 'BLOCK_USER', 'user', userId, { reason }, req.ip);
    
    res.json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    console.error('[Block User] Error:', error);
    res.status(500).json({ error: 'Failed to block user', details: error.message });
  }
});

app.post('/api/users/:userId/unblock', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!pool) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    await pool.query(
      'UPDATE user_blocks SET is_active = false WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    
    logAction(req.session.adminEmail, 'UNBLOCK_USER', 'user', userId, {}, req.ip);
    
    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    console.error('[Unblock User] Error:', error);
    res.status(500).json({ error: 'Failed to unblock user', details: error.message });
  }
});

// ============================================
// API ROUTES - DEVICE ACCESS CONTROL
// ============================================

app.post('/api/devices/:deviceId/grant-access', requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { userId, accessLevel, expiresAt } = req.body;
    
    await pool.query(
      `INSERT INTO device_access_control (device_id, user_id, access_level, granted_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (device_id, user_id) 
       DO UPDATE SET access_level = $3, granted_by = $4, expires_at = $5, is_blocked = false`,
      [deviceId, userId, accessLevel, req.session.adminEmail, expiresAt || null]
    );
    
    logAction(req.session.adminEmail, 'GRANT_ACCESS', 'device', deviceId, { userId, accessLevel }, req.ip);
    
    res.json({ success: true, message: 'Access granted successfully' });
  } catch (error) {
    console.error('[Grant Access] Error:', error);
    res.status(500).json({ error: 'Failed to grant access' });
  }
});

app.post('/api/devices/:deviceId/revoke-access', requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { userId, reason } = req.body;
    
    await pool.query(
      'UPDATE device_access_control SET is_blocked = true, reason = $3 WHERE device_id = $1 AND user_id = $2',
      [deviceId, userId, reason]
    );
    
    logAction(req.session.adminEmail, 'REVOKE_ACCESS', 'device', deviceId, { userId, reason }, req.ip);
    
    res.json({ success: true, message: 'Access revoked successfully' });
  } catch (error) {
    console.error('[Revoke Access] Error:', error);
    res.status(500).json({ error: 'Failed to revoke access' });
  }
});

// ============================================
// API - CHECK ACCESS (for mobile app/backend)
// ============================================

app.get('/api/check-access/:userId/:deviceId', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  
  try {
    const { userId, deviceId } = req.params;
    
    // Check if user is globally blocked
    const userBlock = await pool.query(
      'SELECT * FROM user_blocks WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    
    if (userBlock.rows.length > 0) {
      return res.json({
        hasAccess: false,
        reason: 'User is blocked',
        details: userBlock.rows[0].reason
      });
    }
    
    // Check device-specific access
    const deviceAccess = await pool.query(
      `SELECT * FROM device_access_control 
       WHERE device_id = $1 AND user_id = $2 
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [deviceId, userId]
    );
    
    if (deviceAccess.rows.length === 0) {
      return res.json({ hasAccess: true, accessLevel: 'default' });
    }
    
    const access = deviceAccess.rows[0];
    
    if (access.is_blocked) {
      return res.json({
        hasAccess: false,
        reason: 'Access blocked for this device',
        details: access.reason
      });
    }
    
    res.json({
      hasAccess: true,
      accessLevel: access.access_level,
      grantedBy: access.granted_by,
      expiresAt: access.expires_at
    });
    
  } catch (error) {
    console.error('[Check Access] Error:', error);
    res.status(500).json({ error: 'Failed to check access' });
  }
});

// ============================================
// API - ADMIN CREATION (First-time setup)
// ============================================

app.post('/api/setup/create-admin', async (req, res) => {
  try {
    const { email, password, fullName, setupKey } = req.body;
    
    // Verify setup key (change this in production!)
    if (setupKey !== process.env.SETUP_KEY) {
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
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'admin-portal' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║  🔐 Admin Portal Server Running            ║
║  Port: ${PORT}                             ║
║  Environment: ${process.env.NODE_ENV || 'development'}      ║
╚════════════════════════════════════════════╝
  `);
});

module.exports = app;
