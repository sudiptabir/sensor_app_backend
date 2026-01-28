# Production Migration Guide - Network-Independent Architecture

## Overview
Migrate from local IP-based testing to production-ready cloud architecture where devices across networks can discover and communicate via a central server.

---

## Architecture Changes

### Before (Test/Development)
```
Mobile App ──(192.168.43.211:3000)──┐
                                     ├─→ Local Backend (Node.js)
Remote Device ──(192.168.43.211)──┐ │
                                  └─→ TimescaleDB (Local Docker)
```

**Problems:**
- ❌ Requires all devices on same network
- ❌ IPs change when devices/networks change
- ❌ No discovery mechanism
- ❌ No scalability

### After (Production)
```
Mobile App ──(api.yourdomain.com)──┐
                                    ├─→ Cloud Backend (Firebase/AWS/GCP)
Remote Device ──(api.yourdomain.com)──┤    + Cloud Database (FirebaseDB/Cloud SQL)
                                    └──────────────────────────────┘
                                    (All via HTTPS DNS)
```

**Benefits:**
- ✅ Works across any network
- ✅ IP-address independent
- ✅ Automatic device discovery
- ✅ Scalable and secure
- ✅ HTTPS encrypted communication

---

## Step 1: Remove Test Code

### Files to Delete
```
- sensor-test-generator.js (test data)
- camera-server*.js (test servers)
- test_device_registration.js (test script)
- test_device_registration.py (test script)
- test_devices.py (test script)
- simple_test.py (test script)
- check_firebase_status.js (test script)
- rpi_firestore*.py (test scripts)
- DEVICE_TEST_GUIDE.md (test documentation)
- DEVICE_CONNECTION_TEST_REPORT.md (test report)
```

---

## Step 2: Environment Configuration

### Create `.env` file (Backend)
```env
# Production Backend Configuration
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@cloud-db.example.com:5432/sensor_db
DATABASE_SSL=true

# API
API_URL=https://api.yourdomain.com
API_KEY=your-secure-api-key

# Firebase (for Firestore/Auth)
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY=your-key
FIREBASE_CLIENT_EMAIL=your-email

# Security
JWT_SECRET=your-jwt-secret
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com,https://yourdomain.com
```

### Create `.env` file (Mobile App)
```env
# Production Mobile App Configuration
API_URL=https://api.yourdomain.com
API_KEY=your-mobile-api-key

# Firebase
FIREBASE_API_KEY=your-firebase-key
FIREBASE_PROJECT_ID=your-project
FIREBASE_APP_ID=your-app-id
```

---

## Step 3: Production Backend Deployment

### Option A: Firebase Cloud Functions (Recommended for Firebase users)
**Advantages:** Serverless, auto-scaling, integrates with Firebase

**Setup:**
```bash
npm install -g firebase-tools
firebase init functions
firebase deploy --only functions
```

### Option B: Cloud Platforms
- **Google Cloud Run:** Containerized, serverless
- **AWS Lambda + API Gateway:** Pay-per-use
- **Azure Functions:** Microsoft ecosystem
- **Heroku:** Simple deployment
- **DigitalOcean App Platform:** Affordable VPS

### Option C: Self-Hosted with DNS
```
Get domain: yourdomain.com
Get SSL certificate: Let's Encrypt (free)
Deploy backend: Any VPS
Setup DNS: Point yourdomain.com to server IP
```

---

## Step 4: Database Migration

### From Local Docker → Cloud Database

**Options:**
1. **Firebase Firestore** - NoSQL, real-time, auto-scaling
2. **Google Cloud SQL** - PostgreSQL managed
3. **Amazon RDS** - PostgreSQL managed
4. **TimescaleDB Cloud** - TimescaleDB as managed service
5. **Azure Database for PostgreSQL** - PostgreSQL

**Migration Steps:**
```bash
# Backup local database
pg_dump -U postgres sensor_db > backup.sql

# Connect to cloud database
psql -h cloud-db.example.com -U postgres -d sensor_db < backup.sql

# Update connection string in backend
DATABASE_URL=postgresql://user:pass@cloud-db.example.com/sensor_db
```

---

## Step 5: Update Backend Code

### Remove Hardcoded IPs

**Before:**
```javascript
const API_BASE = 'http://192.168.43.211:3000';
```

**After:**
```javascript
const API_BASE = process.env.API_URL || 'https://api.yourdomain.com';
const API_KEY = process.env.API_KEY;

// All requests include API key for security
const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};
```

### Add Security (HTTPS + API Keys)

```javascript
// Middleware for authentication
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// HTTPS enforcement
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
});
```

---

## Step 6: Update Mobile App

### Remove Local IP References

**Before:**
```typescript
const API_URL = 'http://192.168.43.211:3000';
```

**After:**
```typescript
const API_URL = process.env.API_URL || 'https://api.yourdomain.com';
const API_KEY = process.env.API_KEY;

// Include auth headers
const response = await fetch(`${API_URL}/api/devices`, {
  headers: {
    'x-api-key': API_KEY,
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Step 7: Device Discovery (No IP Needed)

### Current Device Registration
```
Device: "LAPTOP-14678VIP" 
Location: Local database
IP: 192.168.43.211 (CHANGES!)
```

### Production Device Registration
```
Device: "LAPTOP-14678VIP"
Device ID: 192b7a8c-972d-4429-ac28-4bc73e9a8809
Status: Online/Offline
Last Seen: Timestamp
Location: Cloud database

Mobile App:
1. Authenticates to api.yourdomain.com
2. Queries /api/devices
3. Gets list of registered devices with status
4. Connects to device via cloud API (no direct IP)
```

### Device Auto-Registration Endpoint

```javascript
/**
 * POST /api/devices/register
 * Device calls this when it comes online
 * Returns device metadata and secure token
 */
app.post('/api/devices/register', async (req, res) => {
  try {
    const { device_id, device_name, device_type } = req.body;
    
    // Update device status to online
    const result = await pool.query(
      `INSERT INTO device_metadata (device_id, device_name, device_type, is_online, last_online)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (device_id) 
       DO UPDATE SET is_online = true, last_online = NOW()
       RETURNING *`,
      [device_id, device_name, device_type]
    );
    
    // Return secure token for device authentication
    const token = generateDeviceToken(device_id);
    
    res.json({
      success: true,
      device: result.rows[0],
      token: token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Step 8: Remove Test Code from Codebase

### Mobile App Cleanup

**Delete:**
- Remove hardcoded API_URL constants
- Remove test data generators
- Remove device registration test files
- Clean up environment-specific code

**Update:**
```typescript
// useSensorData.ts - Environment-based API
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.yourdomain.com';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

export async function useSensors(deviceId?: string) {
  const url = `${API_URL}/api/sensors${deviceId ? `?deviceId=${deviceId}` : ''}`;
  const response = await fetch(url, {
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    }
  });
  // ... rest of code
}
```

### Backend Cleanup

**Delete test files:**
```bash
rm sensor-test-generator.js
rm camera-server*.js
rm test_*.js
rm test_*.py
rm check_firebase_status.js
```

**Update sensor-backend.js:**
- Add environment variable support
- Add API key authentication
- Add HTTPS enforcement
- Add CORS configuration
- Add error logging
- Remove console.log debug statements

---

## Step 9: Security Checklist

- [ ] All endpoints require authentication (API key + JWT)
- [ ] HTTPS enforced (no HTTP)
- [ ] CORS restricted to known domains
- [ ] Database credentials in environment variables
- [ ] API keys rotated regularly
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (use parameterized queries)
- [ ] Sensitive data not logged

---

## Step 10: Monitoring & Logging

### Add Production Logging

```javascript
// Use structured logging (not console.log)
const logger = require('winston');

logger.info('Device registered', {
  device_id: device_id,
  timestamp: new Date(),
  ip: req.ip
});

logger.error('Database error', {
  error: error.message,
  endpoint: '/api/devices',
  timestamp: new Date()
});
```

### Health Check Endpoint

```javascript
/**
 * GET /api/health
 * Cloud monitoring checks this
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});
```

---

## Deployment Checklist

- [ ] Remove all test files
- [ ] Remove hardcoded IPs
- [ ] Create .env files with production values
- [ ] Setup cloud database
- [ ] Deploy backend to cloud
- [ ] Setup DNS and SSL certificate
- [ ] Update mobile app with new API_URL
- [ ] Test device registration
- [ ] Test sensor data flow
- [ ] Setup monitoring/alerting
- [ ] Setup backup/recovery
- [ ] Document new architecture

---

## Example: Complete Flow (Production)

### 1. Device Startup (Any Network)
```
Device boots up
→ Calls api.yourdomain.com/api/devices/register
→ Backend authenticates device
→ Database updated: device is ONLINE
→ Device gets secure token
→ Device can now send sensor data
```

### 2. Mobile App Login
```
User launches app (Any Network)
→ Authenticates with Firebase
→ Calls api.yourdomain.com/api/devices
→ Gets list of ONLINE devices
→ User selects device
→ Calls api.yourdomain.com/api/sensors?deviceId=...
→ Gets real-time sensor data
```

### 3. Sensor Data Flow
```
Remote Device → api.yourdomain.com/api/readings/batch
                      ↓
              Cloud Database (Cloud SQL/Firestore)
                      ↓
Mobile App ← api.yourdomain.com/api/readings/sensor-id
```

**No direct IPs, everything via HTTPS DNS!**

---

## Next Steps

1. Choose cloud platform (Firebase Cloud Functions recommended)
2. Setup cloud database
3. Deploy backend with environment variables
4. Update mobile app configuration
5. Delete test files
6. Test complete flow end-to-end
7. Setup monitoring and logging
8. Document new architecture

---

## Support Files

- `PRODUCTION_BACKEND.md` - Production backend setup
- `CLOUD_DEPLOYMENT.md` - Cloud platform guides
- `SECURITY_SETUP.md` - Security configuration
- `ENVIRONMENT_CONFIG.md` - Environment variable setup
