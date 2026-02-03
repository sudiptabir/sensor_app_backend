# 🚨 Alert System Setup Guide

This system replaces the test notification functionality with a proper alert generation and API backend system.

## 📋 What Was Changed

### ✅ Removed from Mobile App
- **Test button** from devices tab in dashboard
- `handleSendTestNotification()` function
- `sendingTestNotification` state variable
- Direct test notification creation in Firestore

### ✅ Added New System
- **Alert Generator Script** (`alert-generator.js`) - Generates realistic alerts
- **API Backend Server** (`alert-api-server.js`) - Receives alerts and pushes to app
- **Proper notification flow** - External → API → Firebase → App

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Copy the package.json
cp alert-system-package.json package.json

# Install dependencies
npm install
```

### 2. Setup Firebase Service Account
```bash
# Make sure serviceAccountKey.json exists in the root directory
# (It should already be there from your existing setup)
ls -la serviceAccountKey.json
```

### 3. Start the API Server
```bash
# Start the alert API backend
npm start

# Or for development
npm run dev
```

The server will start on `http://localhost:3001`

### 4. Test the System

#### Option A: Generate Single Alert
```bash
# Generate and send 1 alert
npm run generate
```

#### Option B: Generate Multiple Alerts
```bash
# Generate 5 alerts with 3-second intervals
npm run generate-multiple
```

#### Option C: Manual API Test
```bash
# Test the API endpoint directly
npm run test-api
```

#### Option D: Health Check
```bash
# Check if server is running
npm run health
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file:
```bash
# API Configuration
PORT=3001
API_KEY=your-secure-api-key

# Alert Generator Configuration
ALERT_API_URL=http://localhost:3001/api/alerts
DEVICE_ID=raspberry_pi_001
USER_ID=your-firebase-user-id
```

### Firebase Configuration
The system uses your existing Firebase project:
- **Project**: `sensor-app-2a69b`
- **Service Account**: `serviceAccountKey.json`
- **Collections**: 
  - `users/{userId}/mlAlerts` - Where alerts are stored
  - `users/{userId}` - Where Expo push tokens are stored

## 📱 How It Works

### 1. Alert Generation Flow
```
Alert Generator Script
    ↓ (HTTP POST)
API Backend Server
    ↓ (Store in Firestore)
users/{userId}/mlAlerts/{alertId}
    ↓ (Real-time listener)
Mobile App Dashboard
    ↓ (Local notification)
User sees notification
```

### 2. Push Notification Flow
```
API Backend receives alert
    ↓
Generates notification content
    ↓
Gets user's Expo push token from Firestore
    ↓
Sends push notification via Expo Push API
    ↓
User receives notification on device
```

## 🎯 Alert Types Generated

The system generates realistic alerts:

1. **Critical Alerts**
   - Weapon detection
   - Fire hazards
   - Emergency situations

2. **High Risk Alerts**
   - Unauthorized access
   - Security breaches

3. **Medium Risk Alerts**
   - Traffic violations
   - Unattended packages

4. **Low Risk Alerts**
   - Loitering
   - Suspicious behavior

## 🔍 API Endpoints

### POST `/api/alerts`
Receive and process alerts
```json
{
  "userId": "firebase-user-id",
  "deviceId": "device-identifier", 
  "alert": {
    "notification_type": "Alert",
    "detected_objects": ["person", "weapon"],
    "risk_label": "Critical",
    "predicted_risk": "Critical",
    "description": ["Weapon detected"],
    "device_identifier": "camera_001",
    "timestamp": 1234567890,
    "model_version": "v2.1.0",
    "confidence_score": 0.95
  }
}
```

### GET `/health`
Server health check
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "firebase": true
}
```

### GET `/api/stats`
Server statistics
```json
{
  "server": "Alert API Backend",
  "version": "1.0.0",
  "uptime": 3600,
  "firebase": true,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 🛠️ Customization

### Adding New Alert Types
Edit `ALERT_TEMPLATES` in `alert-generator.js`:
```javascript
{
  notification_type: "Warning",
  detected_objects: ["custom", "object"],
  risk_label: "Medium",
  predicted_risk: "Medium",
  description: ["Custom alert description"],
  confidence_score: 0.85
}
```

### Changing Notification Content
Modify `generateNotificationContent()` in `alert-api-server.js`:
```javascript
const title = `Custom: ${alert.risk_label} - ${alert.device_identifier}`;
const body = `Custom body: ${alert.description[0]}`;
```

## 🔒 Security Features

- **Rate limiting**: 100 requests per 15 minutes per IP
- **Helmet.js**: Security headers
- **CORS**: Cross-origin request handling
- **Input validation**: Required field validation
- **Firebase Admin SDK**: Secure server-side Firebase access

## 🐛 Troubleshooting

### Server Won't Start
```bash
# Check if port is in use
lsof -i :3001

# Use different port
PORT=3002 npm start
```

### Firebase Errors
```bash
# Verify service account key exists
ls -la serviceAccountKey.json

# Check Firebase project ID in the key file
cat serviceAccountKey.json | grep project_id
```

### No Notifications Received
1. Check if user has Expo push token in Firestore
2. Verify Firebase real-time listeners are active in mobile app
3. Check server logs for push notification errors
4. Ensure mobile app has notification permissions

### Alert Generator Fails
```bash
# Check API server is running
curl http://localhost:3001/health

# Test with verbose output
DEBUG=* npm run generate
```

## 📊 Monitoring

### Server Logs
The server logs all important events:
- 🚨 Alert received
- 💾 Alert stored in Firestore  
- 📱 Push notification sent
- ❌ Errors and warnings

### Mobile App
Check the mobile app console for:
- Real-time listener updates
- Notification scheduling
- Alert processing

## 🚀 Production Deployment

For production deployment:

1. **Environment Variables**
   ```bash
   NODE_ENV=production
   PORT=3001
   API_KEY=secure-production-key
   ```

2. **Process Manager**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start alert-api-server.js --name "alert-api"
   ```

3. **Reverse Proxy**
   Configure nginx or similar for HTTPS and load balancing

4. **Monitoring**
   Add logging service (Winston, Morgan) and monitoring (New Relic, DataDog)

## ✅ Testing Checklist

- [ ] API server starts without errors
- [ ] Health endpoint returns 200
- [ ] Alert generator can send alerts
- [ ] Alerts appear in Firestore
- [ ] Mobile app receives real-time updates
- [ ] Push notifications are delivered
- [ ] Error handling works correctly