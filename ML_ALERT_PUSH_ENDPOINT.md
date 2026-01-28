# ML Alert Push Messaging Endpoint

This guide explains how to send ML alerts from your device to Firebase Cloud Messaging, which will generate alerts in the app.

## 1. Deploy Cloud Function for ML Alerts

Add this function to `functions/src/index.js`:

```javascript
/**
 * 🤖 HTTP endpoint to receive ML alerts from remote devices
 * POST request with ML alert data
 */
exports.receiveMLAlert = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return res.status(400).json({ error: "Only POST requests allowed" });
  }

  try {
    const { deviceId, deviceIdentifier, detectedObjects, riskLabel, description, screenshots, confidenceScore, userId } = req.body;

    // Validate required fields
    if (!deviceId || !userId) {
      return res.status(400).json({ error: "Missing required: deviceId, userId" });
    }

    console.log("[ML Alert] Received alert from device:", deviceId);

    // Get user document to fetch FCM token
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.log("[ML Alert] User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log("[ML Alert] No FCM token for user:", userId);
      return res.status(400).json({ error: "User has no FCM token registered" });
    }

    // Create alert document in Firestore
    const alertRef = db.collection("users").doc(userId).collection("mlAlerts").doc();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const alertData = {
      id: alertRef.id,
      deviceId,
      deviceIdentifier: deviceIdentifier || "Unknown Device",
      detectedObjects: detectedObjects || [],
      riskLabel: riskLabel || "medium",
      description: description || [],
      screenshots: screenshots || [],
      confidenceScore: confidenceScore || 0,
      timestamp,
      acknowledged: false,
      userRating: null,
      accuracyFeedback: null,
    };

    // Save to Firestore
    await alertRef.set(alertData);
    console.log("[ML Alert] Saved alert to Firestore:", alertRef.id);

    // Send push notification via FCM
    const message = {
      token: fcmToken,
      notification: {
        title: `🤖 ${riskLabel?.toUpperCase() || "ALERT"} - ${deviceIdentifier || "Unknown Device"}`,
        body: `Detected: ${detectedObjects?.join(", ") || "Object detection"}`,
      },
      data: {
        alertId: alertRef.id,
        deviceId,
        riskLabel: riskLabel || "medium",
        confidenceScore: (confidenceScore * 100).toFixed(0).toString(),
        clickAction: "FLUTTER_NOTIFICATION_CLICK",
      },
      webpush: {
        notification: {
          title: `🤖 ${riskLabel?.toUpperCase() || "ALERT"} - ${deviceIdentifier || "Unknown Device"}`,
          body: `Detected: ${detectedObjects?.join(", ") || "Object detection"}`,
          icon: "https://firebaseapp.com/icon.png",
          tag: "ml-alert",
        },
      },
    };

    const messageId = await admin.messaging().send(message);
    console.log("[ML Alert] Push notification sent:", messageId);

    return res.status(200).json({
      success: true,
      alertId: alertRef.id,
      messageId,
      message: "ML alert received and notification sent",
    });
  } catch (error) {
    console.error("[ML Alert] Error:", error);
    return res.status(500).json({
      error: "Failed to process ML alert",
      details: error.message,
    });
  }
});

/**
 * 🔍 Batch endpoint to receive multiple ML alerts at once
 */
exports.receiveMLAlertBatch = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return res.status(400).json({ error: "Only POST requests allowed" });
  }

  try {
    const { alerts } = req.body;

    if (!Array.isArray(alerts) || alerts.length === 0) {
      return res.status(400).json({ error: "Invalid alerts array" });
    }

    const results = [];

    for (const alert of alerts) {
      try {
        const { deviceId, userId, deviceIdentifier, detectedObjects, riskLabel, description, screenshots, confidenceScore } = alert;

        if (!deviceId || !userId) {
          results.push({
            deviceId,
            success: false,
            error: "Missing required fields",
          });
          continue;
        }

        // Get user FCM token
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
          results.push({
            deviceId,
            success: false,
            error: "User not found",
          });
          continue;
        }

        const fcmToken = userDoc.data().fcmToken;
        if (!fcmToken) {
          results.push({
            deviceId,
            success: false,
            error: "No FCM token",
          });
          continue;
        }

        // Save alert
        const alertRef = db.collection("users").doc(userId).collection("mlAlerts").doc();
        const alertData = {
          id: alertRef.id,
          deviceId,
          deviceIdentifier: deviceIdentifier || "Unknown Device",
          detectedObjects: detectedObjects || [],
          riskLabel: riskLabel || "medium",
          description: description || [],
          screenshots: screenshots || [],
          confidenceScore: confidenceScore || 0,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          acknowledged: false,
          userRating: null,
          accuracyFeedback: null,
        };

        await alertRef.set(alertData);

        // Send notification
        const message = {
          token: fcmToken,
          notification: {
            title: `🤖 ${riskLabel?.toUpperCase() || "ALERT"} - ${deviceIdentifier || "Unknown Device"}`,
            body: `Detected: ${detectedObjects?.join(", ") || "Object detection"}`,
          },
          data: {
            alertId: alertRef.id,
            deviceId,
            riskLabel: riskLabel || "medium",
          },
        };

        await admin.messaging().send(message);

        results.push({
          deviceId,
          success: true,
          alertId: alertRef.id,
        });
      } catch (error) {
        results.push({
          deviceId: alert.deviceId,
          success: false,
          error: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("[ML Alert Batch] Error:", error);
    return res.status(500).json({
      error: "Failed to process batch",
      details: error.message,
    });
  }
});
```

## 2. Sample JSON Payload

### Single Alert:

```json
{
  "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
  "userId": "YOUR_USER_ID_HERE",
  "deviceIdentifier": "LAPTOP-14678VIP",
  "detectedObjects": ["person", "car"],
  "riskLabel": "high",
  "description": ["Suspicious activity detected near entrance"],
  "screenshots": [
    "https://example.com/screenshot1.jpg",
    "https://example.com/screenshot2.jpg"
  ],
  "confidenceScore": 0.87
}
```

### Batch Alert:

```json
{
  "alerts": [
    {
      "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
      "userId": "YOUR_USER_ID_HERE",
      "deviceIdentifier": "LAPTOP-14678VIP",
      "detectedObjects": ["person"],
      "riskLabel": "high",
      "description": ["Unauthorized access attempt"],
      "screenshots": [],
      "confidenceScore": 0.92
    },
    {
      "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
      "userId": "YOUR_USER_ID_HERE",
      "deviceIdentifier": "LAPTOP-14678VIP",
      "detectedObjects": ["vehicle"],
      "riskLabel": "low",
      "description": ["Vehicle in parking area"],
      "screenshots": [],
      "confidenceScore": 0.78
    }
  ]
}
```

## 3. How to Send Alert from Your Device

### Using Python:

```python
import requests
import json

# Firebase Cloud Function endpoint
# Replace YOUR_REGION with your region (e.g., us-central1)
ENDPOINT = "https://YOUR_REGION-sensor--app.cloudfunctions.net/receiveMLAlert"

# Your data
alert_data = {
    "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
    "userId": "YOUR_USER_ID_HERE",
    "deviceIdentifier": "LAPTOP-14678VIP",
    "detectedObjects": ["person", "car"],
    "riskLabel": "high",
    "description": ["Suspicious activity detected"],
    "screenshots": [],
    "confidenceScore": 0.87
}

response = requests.post(ENDPOINT, json=alert_data)
print("Response:", response.json())
```

### Using Node.js:

```javascript
const axios = require('axios');

const endpoint = 'https://YOUR_REGION-sensor--app.cloudfunctions.net/receiveMLAlert';

const alertData = {
  deviceId: '192b7a8c-972d-4429-ac28-4bc73e9a8809',
  userId: 'YOUR_USER_ID_HERE',
  deviceIdentifier: 'LAPTOP-14678VIP',
  detectedObjects: ['person', 'car'],
  riskLabel: 'high',
  description: ['Suspicious activity detected'],
  screenshots: [],
  confidenceScore: 0.87
};

axios.post(endpoint, alertData)
  .then(response => console.log('Success:', response.data))
  .catch(error => console.error('Error:', error.message));
```

### Using cURL:

```bash
curl -X POST \
  https://YOUR_REGION-sensor--app.cloudfunctions.net/receiveMLAlert \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
    "userId": "YOUR_USER_ID_HERE",
    "deviceIdentifier": "LAPTOP-14678VIP",
    "detectedObjects": ["person", "car"],
    "riskLabel": "high",
    "description": ["Suspicious activity detected"],
    "screenshots": [],
    "confidenceScore": 0.87
  }'
```

## 4. Find Your Cloud Function Endpoint

After deploying, your endpoint will be:
```
https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/receiveMLAlert
```

To find your details:
1. Go to Firebase Console → Functions
2. Look for `receiveMLAlert` function
3. Click on it to see the endpoint URL

## 5. Get Your User ID

To find your User ID:
1. Go to Firebase Console → Authentication
2. Click on your user email
3. Copy the **User UID** at the top

Alternatively, in your app, add this to check:
```typescript
import { getAuth } from "firebase/auth";

const auth = getAuth();
console.log("User ID:", auth.currentUser?.uid);
```

## 6. Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deviceId` | string | Yes | Device ID from Firestore |
| `userId` | string | Yes | User UID from Firebase Auth |
| `deviceIdentifier` | string | No | Human-readable device name |
| `detectedObjects` | string[] | No | Array of detected objects (e.g., "person", "car") |
| `riskLabel` | string | No | Risk level: "critical", "high", "medium", "low" |
| `description` | string[] | No | Alert description |
| `screenshots` | string[] | No | Array of screenshot URLs |
| `confidenceScore` | number (0-1) | No | Detection confidence (0.0 to 1.0) |

## 7. Flow Diagram

```
Your Device/ML Model
       ↓
   Send JSON POST
       ↓
Cloud Function (receiveMLAlert)
       ↓
   ├─ Save to Firestore (mlAlerts collection)
   └─ Send FCM Push Notification
       ↓
   App receives notification
       ↓
   Alert appears in "Alerts" tab
       ↓
   User sees notification + views alert details
```

## 8. Troubleshooting

**No alerts appearing?**
- Check Firebase Console → Functions logs for errors
- Verify FCM token is saved in Firestore for your user
- Ensure deviceId matches Firestore device document
- Check that userId is correct

**No notifications?**
- User must have notifications enabled in app
- FCM token must be valid and up-to-date
- Check Cloud Messaging quota hasn't been exceeded

**Function not found?**
- Run `firebase deploy --only functions` to deploy
- Verify function is in `functions/src/index.js`
- Check Firebase project ID is correct

