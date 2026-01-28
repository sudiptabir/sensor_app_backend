# Production Environment Configuration

## Backend (.env file for sensor-backend-production.js)

```env
# Node Environment
NODE_ENV=production
PORT=3000

# ============================================
# DATABASE (Cloud-based PostgreSQL)
# ============================================
# Option 1: Google Cloud SQL PostgreSQL
DATABASE_URL=postgresql://user:password@cloud.example.com:5432/sensor_db

# Option 2: AWS RDS PostgreSQL
# DATABASE_URL=postgresql://user:password@rds.amazonaws.com:5432/sensor_db

# Option 3: TimescaleDB Cloud
# DATABASE_URL=postgresql://user:password@timescaledb.example.com:5432/sensor_db

# Option 4: Azure Database for PostgreSQL
# DATABASE_URL=postgresql://user:password@azure.postgresql.com:5432/sensor_db

DATABASE_SSL=true

# ============================================
# API CONFIGURATION
# ============================================
# Public API URL (without trailing slash)
API_URL=https://api.yourdomain.com

# API Key for device authentication
API_KEY=your-super-secure-api-key-min-32-chars-required

# JWT Secret for token signing
JWT_SECRET=your-jwt-secret-key-min-32-chars-required

# ============================================
# SECURITY & CORS
# ============================================
# Comma-separated list of allowed origins
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com,https://yourdomain.com,https://mobile.yourdomain.com

# ============================================
# LOGGING & MONITORING
# ============================================
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-key@sentry.io/project

# ============================================
# OPTIONAL: Firebase Integration
# ============================================
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_PRIVATE_KEY=your-firebase-private-key
FIREBASE_CLIENT_EMAIL=your-firebase-email@iam.gserviceaccount.com
```

---

## Mobile App (.env file for Expo)

```env
# Mobile app environment configuration
# File location: sensor_app/.env

# ============================================
# API CONFIGURATION
# ============================================
# Backend API URL (must match backend API_URL)
EXPO_PUBLIC_API_URL=https://api.yourdomain.com

# API Key (must match backend API_KEY)
EXPO_PUBLIC_API_KEY=your-super-secure-api-key-min-32-chars-required

# ============================================
# FIREBASE CONFIGURATION
# ============================================
# Same Firebase project as backend
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project
EXPO_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com

# ============================================
# APP CONFIGURATION
# ============================================
# Enable debug logging
EXPO_PUBLIC_DEBUG=false

# App version
EXPO_PUBLIC_APP_VERSION=1.0.0
```

---

## Device/Remote Server (.env file for remote devices)

```env
# Remote device environment configuration
# File location: /etc/sensor-device/.env

# ============================================
# BACKEND CONFIGURATION
# ============================================
# Central backend API URL
BACKEND_URL=https://api.yourdomain.com

# API Key for device authentication
API_KEY=your-super-secure-api-key-min-32-chars-required

# ============================================
# DEVICE IDENTIFICATION
# ============================================
# Unique device identifier (UUID)
DEVICE_ID=192b7a8c-972d-4429-ac28-4bc73e9a8809

# Friendly device name
DEVICE_NAME=LAPTOP-14678VIP

# Device type (PC, RaspberryPi, Arduino, IoT, etc.)
DEVICE_TYPE=PC

# Device location
DEVICE_LOCATION=Office

# ============================================
# SENSOR CONFIGURATION
# ============================================
# Comma-separated list of sensor types to monitor
SENSORS=cpu_temperature,memory_usage,disk_usage,gpu_temperature,battery_level

# Sampling interval (in seconds)
SAMPLE_INTERVAL=5

# ============================================
# HEARTBEAT
# ============================================
# Send heartbeat every N seconds to keep device marked as online
HEARTBEAT_INTERVAL=30

# ============================================
# OPTIONAL: Camera Streaming
# ============================================
# Camera stream enabled
CAMERA_ENABLED=false
# CAMERA_URL=rtsp://localhost:554/stream
```

---

## Setup Instructions

### 1. Backend Deployment

**Using Firebase Cloud Functions:**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize functions
cd c:\Users\SUDIPTA\Downloads\Sensor_app
firebase init functions

# Copy production backend code
cp sensor-backend-production.js functions/index.js

# Deploy
firebase deploy --only functions
```

**Using Heroku (Free tier):**
```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-app-name

# Create database
heroku addons:create heroku-postgresql:hobby-dev

# Deploy
git push heroku main

# Set environment variables
heroku config:set API_KEY=your-api-key
heroku config:set JWT_SECRET=your-secret
heroku config:set CORS_ALLOWED_ORIGINS=...
```

**Using DigitalOcean App Platform:**
```
1. Create DigitalOcean account
2. Link GitHub repository
3. Create App Platform application
4. Set environment variables from .env
5. Deploy
```

### 2. Database Setup

**Google Cloud SQL:**
```bash
# Create PostgreSQL instance
gcloud sql instances create sensor-db \
  --database-version=POSTGRES_13 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create sensor_db --instance=sensor-db

# Import schema
gcloud sql import sql sensor-db gs://your-bucket/schema.sql
```

**AWS RDS:**
```
1. Open RDS console
2. Create PostgreSQL instance
3. Configure security groups
4. Create database
5. Run schema.sql via psql
```

**TimescaleDB Cloud:**
```
1. Sign up at https://www.timescale.com/cloud
2. Create project
3. Get connection string
4. Import schema
```

### 3. DNS Setup

**Get a domain:**
- Use domain registrar (GoDaddy, Namecheap, etc.)
- Or use free domain from no-ip.com (dynamic DNS)

**Configure DNS:**
```
1. Point api.yourdomain.com to your backend server IP
2. Setup SSL certificate (Let's Encrypt - free)
3. Configure reverse proxy (Nginx/Apache)
```

**SSL Certificate (Let's Encrypt):**
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d api.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

### 4. Verify Configuration

**Check backend health:**
```bash
curl https://api.yourdomain.com/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-25T...",
  "uptime": 12345,
  "environment": "production"
}
```

**Test device registration:**
```bash
curl -X POST https://api.yourdomain.com/api/devices/register \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "test-device-123",
    "device_name": "Test Device",
    "device_type": "PC"
  }'
```

---

## Security Checklist

- [ ] API_KEY is strong (32+ characters)
- [ ] JWT_SECRET is strong (32+ characters)
- [ ] Database credentials are encrypted
- [ ] HTTPS enforced (no HTTP)
- [ ] CORS restricted to known domains only
- [ ] API keys rotated every 90 days
- [ ] Database backups enabled
- [ ] Monitoring/alerting configured
- [ ] Rate limiting enabled
- [ ] SQL injection protection verified

---

## Files to Remove (Test Code)

```bash
# Delete test data generators
rm sensor-test-generator.js

# Delete test camera servers
rm camera-server*.js

# Delete test scripts
rm test_device_registration.js
rm test_device_registration.py
rm test_devices.py
rm simple_test.py
rm check_firebase_status.js
rm rpi_firestore*.py

# Delete test documentation
rm DEVICE_TEST_GUIDE.md
rm DEVICE_REGISTRATION_TEST_STATUS.md
rm DEVICE_CONNECTION_TEST_REPORT.md

# Keep these files
# - sensor-backend-production.js (new production backend)
# - useSensorData-production.ts (new production hooks)
# - PRODUCTION_MIGRATION_GUIDE.md (this guide)
# - schema.sql (database schema)
```

---

## Next Steps

1. ✅ Create .env files with production values
2. ✅ Setup cloud database
3. ✅ Deploy backend to cloud
4. ✅ Setup DNS and SSL certificate
5. ✅ Update mobile app with API_URL
6. ✅ Delete test code and files
7. ✅ Test device registration via API
8. ✅ Test sensor data flow
9. ✅ Setup monitoring and alerting
10. ✅ Document and backup configuration

---

## Support

- Backend error logs: Check cloud platform console
- Database issues: Use cloud platform database admin
- SSL/DNS issues: Check DNS propagation
- API debugging: Use Postman or curl with debug headers
