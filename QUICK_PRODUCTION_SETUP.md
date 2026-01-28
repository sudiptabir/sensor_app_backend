# Quick Production Migration (30 Minutes)

## Overview
This is the fastest path to get your app production-ready, removing test code and deploying to cloud.

---

## Step 1: Prepare (5 minutes)

### Create project structure
```bash
cd c:\Users\SUDIPTA\Downloads\Sensor_app

# Create production folder
mkdir production
cd production

# Copy essential files
cp ../schema.sql .
cp ../sensor-backend-production.js ./backend.js
cp ../sensor_app/hooks/useSensorData-production.ts ./useSensorData.ts
```

### Install dependencies
```bash
npm install dotenv cors jsonwebtoken pg
```

---

## Step 2: Cloud Database (10 minutes)

### Option A: Use Heroku PostgreSQL (Easiest)
```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-sensor-app

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Get database URL
heroku config | grep DATABASE_URL
# Copy this URL - you'll need it

# Import schema
heroku pg:psql < schema.sql
```

### Option B: Use TimescaleDB Cloud
```
1. Go to https://www.timescale.com/cloud
2. Create account and project
3. Note the connection string
4. Run: psql <connection-string> < schema.sql
```

---

## Step 3: Deploy Backend (10 minutes)

### Option A: Heroku (Recommended)
```bash
# Create Procfile
echo "web: node backend.js" > Procfile

# Create package.json
cat > package.json << 'EOF'
{
  "name": "sensor-backend",
  "version": "1.0.0",
  "main": "backend.js",
  "scripts": {
    "start": "node backend.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "jsonwebtoken": "^9.0.0",
    "pg": "^8.10.0"
  }
}
EOF

# Set environment variables
heroku config:set API_KEY=your-super-secret-key-32-chars-minimum
heroku config:set JWT_SECRET=your-jwt-secret-32-chars-minimum
heroku config:set CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Deploy
git init
git add .
git commit -m "Initial production backend"
heroku git:remote -a your-sensor-app
git push heroku main

# Get your backend URL
heroku apps:info
# Backend URL: https://your-sensor-app.herokuapp.com
```

### Option B: Firebase Cloud Functions
```bash
firebase init functions
# Copy backend code to functions/index.js
firebase deploy --only functions

# Get URL from Firebase console
```

---

## Step 4: Update Mobile App (5 minutes)

### Create .env file
```bash
cd ../sensor_app

cat > .env << 'EOF'
# Replace with your actual backend URL
EXPO_PUBLIC_API_URL=https://your-sensor-app.herokuapp.com
EXPO_PUBLIC_API_KEY=your-super-secret-key-32-chars-minimum

# Firebase (keep your existing values)
EXPO_PUBLIC_FIREBASE_API_KEY=your-existing-firebase-key
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-existing-project
EOF
```

### Update hooks
```bash
# Backup old hook
cp hooks/useSensorData.ts hooks/useSensorData-backup.ts

# Copy production hook
cp ../production/useSensorData.ts hooks/
```

### Rebuild app
```bash
npx expo start --clear
```

---

## Step 5: Delete Test Code (2 minutes)

### Delete test files
```bash
cd c:\Users\SUDIPTA\Downloads\Sensor_app

# Test data generators
rm -f sensor-test-generator.js

# Test scripts
rm -f test_*.js test_*.py simple_test.py check_firebase_status.js

# Test camera servers
rm -f camera-server*.js mjpeg-camera-server.js webrtc-camera-server*.js

# Test documentation
rm -f DEVICE_TEST_GUIDE.md DEVICE_REGISTRATION_TEST_STATUS.md DEVICE_CONNECTION_TEST_REPORT.md
rm -f README_DEVICE_TESTS.md RASPBERRY_PI_SETUP.md PI_CAMERA_STREAMING*.md
rm -f QUICK_START_REMOTE_WEBRTC.md README_REMOTE_WEBRTC.md TROUBLESHOOTING_REMOTE_WEBRTC.md
rm -f WEBRTC_SETUP_GUIDE.md VISUAL_GUIDE_REMOTE_WEBRTC.md CONFIG_TEMPLATE_REMOTE_WEBRTC.md
```

---

## Step 6: Test (5 minutes)

### Check backend health
```bash
curl https://your-sensor-app.herokuapp.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-25T...",
  "uptime": 123,
  "environment": "production"
}
```

### Test device registration
```bash
curl -X POST https://your-sensor-app.herokuapp.com/api/devices/register \
  -H "x-api-key: your-super-secret-key-32-chars-minimum" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "test-device-001",
    "device_name": "Test Device",
    "device_type": "PC",
    "location": "Office"
  }'
```

### Test with mobile app
1. Launch app
2. Login with Firebase
3. Tap "Devices" tab
4. Should see devices from backend API (not local hardcoded)

---

## Step 7: Setup Domain (Optional but Recommended)

### Get free domain (No-IP.com)
```
1. Go to https://www.noip.com
2. Create account
3. Create hostname: api.yourdomain.com
4. Point to your Heroku app URL
```

### Or use your own domain
```
1. Buy domain (GoDaddy, Namecheap, etc.)
2. Point DNS to Heroku:
   - CNAME: api.yourdomain.com -> your-sensor-app.herokuapp.com
3. Wait 24 hours for DNS propagation
```

### Update .env with custom domain
```bash
# In production backend
API_URL=https://api.yourdomain.com

# In mobile app .env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## Production Checklist

- [ ] Backend deployed to cloud ✓
- [ ] Database created and schema imported ✓
- [ ] Environment variables set ✓
- [ ] Backend health endpoint working ✓
- [ ] Device registration endpoint working ✓
- [ ] Mobile app updated with new API_URL ✓
- [ ] Mobile app rebuilt ✓
- [ ] Test device registers successfully ✓
- [ ] Sensor data flows correctly ✓
- [ ] Test code deleted ✓
- [ ] HTTPS verified ✓
- [ ] CORS working ✓

---

## What Now Works

✅ **Device from Network A** → `api.yourdomain.com` → Registers, sends data
✅ **Device from Network B** → `api.yourdomain.com` → Registers, sends data
✅ **Device from Network C** → `api.yourdomain.com` → Registers, sends data
✅ **Mobile App from Any Network** → `api.yourdomain.com` → Sees all devices, gets data

**No IP addresses needed. Works anywhere.**

---

## Troubleshooting Quick Fixes

### "Can't reach backend"
```bash
# Check DNS
ping api.yourdomain.com

# Check SSL
curl -v https://api.yourdomain.com/health

# Check Heroku logs
heroku logs --tail
```

### "Unauthorized" error
```bash
# Verify API key in .env matches backend
echo $API_KEY

# Verify header is being sent
curl -v -H "x-api-key: your-key" https://api.yourdomain.com/health
```

### "Database connection failed"
```bash
# Verify DATABASE_URL
heroku config | grep DATABASE_URL

# Test connection
heroku pg:psql

# Check schema exists
heroku pg:psql
> \dt  (should show tables)
```

---

## Next (After 30 minutes)

1. **Backup**: `git commit -m "Production migration"`
2. **Monitor**: Setup error logging (Sentry, Papertrail)
3. **Scale**: Add more devices, test performance
4. **Secure**: Rotate API keys regularly
5. **Automate**: Setup CD/CI pipeline
6. **Document**: Update README with new architecture

---

## That's It!

You now have:
- ✅ Production-ready backend
- ✅ Cloud database
- ✅ HTTPS encrypted API
- ✅ Mobile app working across networks
- ✅ No test code
- ✅ Scalable architecture
- ✅ Enterprise-ready

**Time to celebrate! 🎉**

---

## Important Notes

- Keep `.env` files private (never commit to git)
- Rotate API keys every 90 days
- Monitor database performance
- Setup backups
- Keep dependencies updated
- Test regularly from different networks

---

## Cost Summary

```
Heroku:      $7/month (backend)
PostgreSQL:  $9/month (database)
Domain:      $1/month (if using No-IP)
Total:       ~$17/month
```

Or free tier: ~$0/month (first year of free Heroku hours)

---

## Support Files

- `PRODUCTION_READY_SUMMARY.md` - Full details
- `ENVIRONMENT_CONFIGURATION.md` - Configuration reference
- `sensor-backend-production.js` - Backend code
- `useSensorData-production.ts` - Frontend hooks
- `PRODUCTION_MIGRATION_GUIDE.md` - Architecture guide
