# Firebase Push Notifications Setup Guide

## Overview
This guide explains how to set up and deploy the Firestore-based push alert system using Firebase Cloud Functions and Expo Push Notifications.

## Architecture

```
Sensor Reading → Firestore Trigger → Cloud Function
                                   ↓
                         Check Alert Thresholds
                                   ↓
                         Get User's Expo Token
                                   ↓
                    Send via Expo Notification API
                                   ↓
                         Device Receives Alert
```

## Prerequisites

1. **Node.js 18+** installed
2. **Firebase CLI** installed: `npm install -g firebase-tools`
3. **Authenticated with Firebase**: `firebase login`
4. **Project ID**: `sensor-app-2a69b`

## Step 1: Enable Required APIs in Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project `sensor-app-2a69b`
3. Enable these APIs:
   - Cloud Functions API
   - Cloud Firestore API
   - Pub/Sub API
   - Service Usage API

## Step 2: Initialize Firebase Functions

```bash
cd functions
npm install
```

## Step 3: Deploy Cloud Functions

```bash
# From the functions directory
firebase deploy --only functions

# Or from root
firebase deploy --only functions
```

## Step 4: Update Firestore Security Rules

Add these rules to allow Cloud Function to access user tokens:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own document
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    // Sensors collection with alert thresholds
    match /sensors/{sensorId} {
      allow read, write: if request.auth.uid == resource.data.userId;
      
      // Readings subcollection
      match /readings/{readingId} {
        allow read, write: if request.auth.uid == get(/databases/$(database)/documents/sensors/$(sensorId)).data.userId;
      }

      // Alerts subcollection (historical records)
      match /alerts/{alertId} {
        allow read: if request.auth.uid == get(/databases/$(database)/documents/sensors/$(sensorId)).data.userId;
      }
    }
  }
}
```

## Step 5: How It Works

### 1. Register Device Token (App Side)

When user signs in, the app automatically:
```typescript
// In app initialization (_layout.tsx or App.tsx)
import { registerFCMToken } from './firebase/fcmService';

useEffect(() => {
  const setupNotifications = async () => {
    await initPushNotifications(); // Registers token automatically
  };
  setupNotifications();
}, []);
```

This saves the Expo Push Token to Firestore:
```
/users/{userId}
  - expoPushToken: "ExponentPushToken[...]"
  - tokenUpdatedAt: timestamp
```

### 2. Add Sensor with Alert Thresholds

```typescript
import { addSensor, updateSensorAlertThreshold } from './db/firestore';

// Create sensor
const sensorId = await addSensor({
  name: "Temperature Sensor",
  type: "temperature",
  location: "Living Room",
  unit: "°C",
  alertThreshold: { min: 15, max: 30 }
});

// Or update threshold later
await updateSensorAlertThreshold(sensorId, { min: 15, max: 30 });
```

### 3. Add Sensor Reading

```typescript
import { addSensorReadingData } from './db/firestore';

// When sensor reading comes in
await addSensorReadingData(sensorId, { value: 35 }); // Exceeds max
```

### 4. Cloud Function Triggers

When the reading is added:
1. Function checks if value exceeds alert thresholds
2. If yes, retrieves user's Expo Push Token from `/users/{userId}`
3. Sends notification via Expo Push Notification API
4. Logs alert to `/sensors/{sensorId}/alerts` for history

### 5. App Receives Alert

The app's notification handler displays the alert:
```typescript
// Automatically handled by initPushNotifications()
// User sees notification in notification center
// Tapping notification opens app and triggers data handler
```

## Configuration Examples

### Temperature Sensor
```typescript
alertThreshold: {
  min: 15,    // Alert if below 15°C
  max: 30     // Alert if above 30°C
}
```

### Humidity Sensor
```typescript
alertThreshold: {
  min: 30,    // Alert if below 30%
  max: 80     // Alert if above 80%
}
```

### Motion Sensor (Binary)
```typescript
alertThreshold: {
  min: 1,     // Alert if no motion (value = 0)
  max: 1      // Alert if motion detected (value = 1)
}
```

### Pressure Sensor
```typescript
alertThreshold: {
  min: 1000,  // Alert if below 1000 hPa
  max: 1030   // Alert if above 1030 hPa
}
```

## Testing the System

### Local Testing with Emulator

```bash
# Terminal 1: Start emulator
firebase emulators:start --only firestore,functions

# Terminal 2: Connect app to emulator
# Update firebase/firebaseConfig.js to use emulator
```

### Production Testing

1. Add sensor with alert thresholds via dashboard UI
2. Add reading that exceeds threshold:
   ```typescript
   await addSensorReadingData(sensorId, { value: 45 }); // If max is 30
   ```
3. Check device notification within 10 seconds
4. View alert history in Firestore: `/sensors/{sensorId}/alerts`

## Alert History

All triggered alerts are logged to:
```
/sensors/{sensorId}/alerts/{alertId}
  - type: "MAX_EXCEEDED" or "MIN_EXCEEDED"
  - value: 45
  - threshold: 30
  - severity: "error" or "warning"
  - message: "Exceeded maximum threshold: 45 > 30"
  - timestamp: 2025-01-14T10:30:00Z
  - sentToUser: true
```

## Deployment Steps

### First Time Deployment

```bash
# 1. Initialize Firebase in functions directory
cd functions
npm install

# 2. Set environment variables (optional)
firebase functions:config:set env.expo_api_url="https://exp.host/--/api/v2/push/send"

# 3. Deploy
firebase deploy --only functions

# 4. Check deployment
firebase functions:log
```

### Update Functions

```bash
# Make changes to src/index.js
# Deploy again
firebase deploy --only functions
```

### Monitor Logs

```bash
# Real-time logs
firebase functions:log

# Tail logs
firebase functions:log --follow

# Show last 100 lines
firebase functions:log --limit 100
```

## Troubleshooting

### Function Not Triggering
- Verify Cloud Functions API is enabled
- Check function deployment: `firebase functions:log`
- Ensure readings are added to correct path: `/sensors/{sensorId}/readings/{readingId}`

### Not Receiving Notifications
- Check Expo token is saved: View in Firestore `/users/{userId}/expoPushToken`
- Verify Expo Push Service is working (API status on status.expo.io)
- Check notification permissions on device
- View Cloud Function logs: `firebase functions:log`

### Wrong User Receiving Alert
- Verify `userId` field matches in sensors collection
- Check Firestore security rules allow access

### Alerts Not Stored
- Verify `/sensors/{sensorId}/alerts` subcollection exists
- Check Firestore rules allow Cloud Function to write

## API Reference

### App-Side Functions

```typescript
// Register device token automatically on app start
await initPushNotifications();

// Send FCM alert from Cloud Function
import { sendFCMAlert } from './utils/notifications';
await sendFCMAlert(
  "Sensor Name",
  35,        // Current value
  30,        // Threshold
  "error"    // Severity
);

// Update sensor alert thresholds
import { updateSensorAlertThreshold } from './db/firestore';
await updateSensorAlertThreshold(sensorId, { min: 15, max: 30 });
```

### Cloud Function Events

**Trigger**: When reading added to `/sensors/{sensorId}/readings/{readingId}`

**Data Flow**:
1. Read sensor config from `/sensors/{sensorId}`
2. Get user token from `/users/{userId}`
3. Send via Expo API
4. Log to `/sensors/{sensorId}/alerts`

## Cost Considerations

- **Cloud Functions**: ~$0.40 per 1M invocations
- **Firestore**: ~$0.06 per 100K reads/writes
- **Pub/Sub (scheduler)**: Free tier included
- **Expo**: Free tier for push notifications

## Environment Variables (Optional)

```bash
# Set in Firebase Console
firebase functions:config:set \
  expo.api_key="your_expo_api_key" \
  app.max_alerts_per_hour="10"
```

Then in Cloud Function:
```javascript
const functions = require("firebase-functions");
const config = functions.config();
const EXPO_API_KEY = config.expo?.api_key;
```

## Security Best Practices

1. ✅ Cloud Function service account has limited permissions
2. ✅ Firestore rules validate user ownership
3. ✅ Expo tokens stored per-user, encrypted at rest
4. ✅ No sensitive data in notification payload
5. ✅ Rate limiting can be added if needed

## Next Steps

1. ✅ Deploy functions: `firebase deploy --only functions`
2. ✅ Update app to call `registerFCMToken()`
3. ✅ Add alert thresholds to sensors
4. ✅ Test with sample reading
5. ✅ Monitor logs for errors
6. ✅ Deploy to production when ready
