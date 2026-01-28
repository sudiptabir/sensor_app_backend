# 🚀 ML Alert Push Messaging - Setup & Testing

## Overview

Your app is now set up to receive ML alerts from remote devices via Firebase Cloud Messaging. When your device sends an alert JSON, it will:

1. ✅ Save the alert to Firestore
2. ✅ Send a push notification to your phone/tablet
3. ✅ Display in the **Alerts** tab
4. ✅ Show detailed information with user rating capability

---

## Prerequisites

Before testing, you need:

1. **Firebase Project Setup** ✓ (Already done)
2. **Cloud Functions Deployed** (Step 1 below)
3. **Your User ID** (Step 2 below)
4. **Your Device ID** ✓ (Already have: `192b7a8c-972d-4429-ac28-4bc73e9a8809`)

---

## Step 1: Deploy Cloud Functions

### Using Firebase CLI

```bash
# Go to functions directory
cd functions

# Deploy the ML alert functions
firebase deploy --only functions:receiveMLAlert,functions:receiveMLAlertBatch
```

After deployment, you'll see output like:
```
✔  Deploy complete!
Function URL (receiveMLAlert): https://us-central1-sensor--app.cloudfunctions.net/receiveMLAlert
```

**Save this URL** - you'll need it for testing.

### Or: Manual Deploy via Firebase Console

1. Go to https://console.firebase.google.com
2. Select `sensor--app` project
3. Go to **Functions**
4. New functions will appear after you deploy

---

## Step 2: Get Your User ID

1. Open https://console.firebase.google.com
2. Select `sensor--app` project
3. Go to **Authentication** → **Users**
4. Click on your user email
5. Copy the **User UID** at the top

Example: `abc123def456ghi789jkl0123456789`

---

## Step 3: Test with Python Script

### Install Dependencies

```bash
pip install requests
```

### Edit the Python Script

Edit `ml_alert_sender.py` and update:

```python
USER_ID = "YOUR_USER_ID_HERE"  # ← Replace with your User ID from Step 2
DEVICE_ID = "192b7a8c-972d-4429-ac28-4bc73e9a8809"  # ← Your device
ENDPOINT = "https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/receiveMLAlert"  # ← Your function URL
```

Example:
```python
USER_ID = "abc123def456ghi789jkl0123456789"
DEVICE_ID = "192b7a8c-972d-4429-ac28-4bc73e9a8809"
ENDPOINT = "https://us-central1-sensor--app.cloudfunctions.net/receiveMLAlert"
```

### Run the Tests

```bash
python ml_alert_sender.py
```

Select option **1** to run automated tests.

**Expected Output:**
```
🤖 ML Alert Testing System
============================================================
Device ID: 192b7a8c-972d-4429-ac28-4bc73e9a8809
User ID: abc123def456ghi789jkl0123456789
Device Name: LAPTOP-14678VIP
Endpoint: https://us-central1-sensor--app.cloudfunctions.net/receiveMLAlert
============================================================

[Test 1] High Risk - Person Detected
📤 Sending alert...
   Objects: person
   Risk: HIGH
   Confidence: 92%
✅ Alert sent successfully!
   Alert ID: abc123def456
   Message ID: cXg2Z...

✅ All tests completed!
```

---

## Step 4: Check Your App

After running tests:

1. **Check your phone/tablet** - You should see **push notifications**
2. **Open the app** - Go to **Alerts** tab
3. **You should see**:
   - 🤖 HIGH - LAPTOP-14678VIP
   - 🔍 Detected: person
   - 📊 92% confidence
   - Click to see full details

---

## Step 5: Send Custom Alerts

### Option A: Using Python Script

```bash
python ml_alert_sender.py
```

Select option **2** for custom alert and follow the prompts.

### Option B: Using cURL

```bash
curl -X POST \
  https://us-central1-sensor--app.cloudfunctions.net/receiveMLAlert \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
    "userId": "YOUR_USER_ID",
    "deviceIdentifier": "LAPTOP-14678VIP",
    "detectedObjects": ["person", "car"],
    "riskLabel": "high",
    "description": ["Suspicious activity detected"],
    "screenshots": [],
    "confidenceScore": 0.87
  }'
```

### Option C: Using Your ML Model/Script

```python
import requests

endpoint = "https://us-central1-sensor--app.cloudfunctions.net/receiveMLAlert"

# After your ML model detects something
alert_data = {
    "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
    "userId": "YOUR_USER_ID",
    "deviceIdentifier": "LAPTOP-14678VIP",
    "detectedObjects": ["person"],
    "riskLabel": "high",
    "description": ["Person detected at entrance"],
    "screenshots": ["https://example.com/screenshot.jpg"],
    "confidenceScore": 0.92
}

response = requests.post(endpoint, json=alert_data)
print(response.json())
```

---

## Alert JSON Format

### Required Fields:
```json
{
  "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
  "userId": "YOUR_USER_ID"
}
```

### Optional Fields:
```json
{
  "deviceIdentifier": "LAPTOP-14678VIP",
  "detectedObjects": ["person", "car"],
  "riskLabel": "high",
  "description": ["Alert description"],
  "screenshots": ["https://example.com/image.jpg"],
  "confidenceScore": 0.87
}
```

### Risk Levels:
- `critical` - 🔴 Red
- `high` - 🟠 Orange
- `medium` - 🟡 Yellow
- `low` - 🟢 Green

---

## Batch Alerts

Send multiple alerts at once:

```bash
curl -X POST \
  https://us-central1-sensor--app.cloudfunctions.net/receiveMLAlertBatch \
  -H 'Content-Type: application/json' \
  -d '{
    "alerts": [
      {
        "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
        "userId": "YOUR_USER_ID",
        "detectedObjects": ["person"],
        "riskLabel": "high",
        "confidenceScore": 0.92
      },
      {
        "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
        "userId": "YOUR_USER_ID",
        "detectedObjects": ["vehicle"],
        "riskLabel": "medium",
        "confidenceScore": 0.78
      }
    ]
  }'
```

---

## What Happens When Alert is Received

```
┌─────────────────────────────────────┐
│ Your Device/ML Model                │
│ Sends JSON POST request             │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ Cloud Function (receiveMLAlert)     │
│ Validates data                      │
└────────────┬────────────────────────┘
             ├─→ Saves to Firestore (mlAlerts collection)
             ├─→ Gets user's FCM token from Firestore
             ├─→ Sends Firebase Cloud Messaging notification
             └─→ Returns JSON response
             ↓
┌─────────────────────────────────────┐
│ Your Phone/Tablet                   │
│ Receives push notification          │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ React Native App                    │
│ Real-time listener detects alert    │
│ Updates Alerts tab                  │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ User sees alert with:               │
│ - Device name                       │
│ - Detected objects                  │
│ - Risk level (color-coded)          │
│ - Confidence score                  │
│ - Tap to rate accuracy (1-10)       │
└─────────────────────────────────────┘
```

---

## Troubleshooting

### ❌ "User not found"
- ✓ Check USER_ID is correct (from Firebase Auth console)
- ✓ Make sure you're logged into the app with that account
- ✓ Copy the exact UID, don't paste from browser history

### ❌ "No FCM token registered"
- ✓ Open your app at least once to register FCM token
- ✓ Grant notification permissions when prompted
- ✓ Check Firestore: Users collection → your user → fcmToken field should exist

### ❌ Function URL not working / 404 error
- ✓ Run `firebase deploy --only functions` again
- ✓ Wait 30 seconds for deployment to complete
- ✓ Check the exact URL from Firebase Console → Functions

### ❌ No notification received
- ✓ Check app is running or in background
- ✓ Verify notifications are enabled on your device
- ✓ Check Firebase Console → Cloud Messaging tab
- ✓ Look at Firebase Functions logs for errors

### ❌ Alert appears in Firestore but not in app
- ✓ Close and reopen the app
- ✓ Check that you're on the Alerts tab
- ✓ Verify the alerts listener is active in dashboard.tsx
- ✓ Check browser console for errors

---

## Next: Integration with Your ML Model

Once testing works, integrate with your actual ML model:

1. **Capture detection** from your ML model
2. **Format as JSON** using the structure above
3. **Send POST request** to your Cloud Function endpoint
4. **Monitor alerts** in Firestore and your app

Example integration:

```python
# Your ML detection code
if detected_person_confidence > 0.8:
    alert = {
        "deviceId": "YOUR_DEVICE_ID",
        "userId": "YOUR_USER_ID",
        "detectedObjects": ["person"],
        "riskLabel": "high",
        "confidenceScore": detected_person_confidence,
        "description": [f"Person detected with {detected_person_confidence:.0%} confidence"]
    }
    
    # Send to Firebase
    requests.post(
        "https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/receiveMLAlert",
        json=alert
    )
```

---

## Files Reference

- 📄 [ML_ALERT_PUSH_ENDPOINT.md](ML_ALERT_PUSH_ENDPOINT.md) - Detailed endpoint documentation
- 🐍 [ml_alert_sender.py](ml_alert_sender.py) - Python testing script
- 📁 [functions/src/index.js](functions/src/index.js) - Cloud Function code
- 📱 [sensor_app/app/dashboard.tsx](sensor_app/app/dashboard.tsx) - Alerts display UI
- 🔧 [sensor_app/db/firestore.ts](sensor_app/db/firestore.ts) - Firestore operations

---

**Ready to go! 🚀**

```bash
curl -X POST "https://YOUR_PROJECT.cloudfunctions.net/receiveMLAlert" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "test_device_001",
    "deviceIdentifier": "Test Camera",
    "mlAlert": {
      "notification_type": "Alert",
      "detected_objects": ["cattle"],
      "risk_label": "High",
      "predicted_risk": "High",
      "description": ["5 cattle detected", "close to fence"],
      "screenshot": ["test.jpg"],
      "timestamp": '$(date +%s%3N)',
      "confidence_score": 0.95
    }
  }'
```

### 3. Register Your Remote Device

Before sending alerts, your device must be registered:

```bash
# Via Firebase SDK or REST API
POST /databases/projects/YOUR_PROJECT/documents/devices/your_device_id
{
  "label": "Camera Unit 1",
  "userId": "user_uid_here",
  "createdAt": "NOW"
}
```

### 4. Send Alerts from Your ML Model

See [ML_ALERT_INTEGRATION_GUIDE.md](ML_ALERT_INTEGRATION_GUIDE.md) for:
- Python, Node.js, and Bash examples
- Full API documentation
- Error handling and retry logic

---

## Alert Data Structure

```json
{
  "deviceId": "camera_01",
  "deviceIdentifier": "Raspberry Pi 1",
  "mlAlert": {
    "notification_type": "Alert",
    "detected_objects": ["cattle", "buffalo"],
    "risk_label": "High",                    // Critical, High, Medium, Low
    "predicted_risk": "High",
    "description": [
      "10 animals detected",
      "Aggressive behavior",
      "Close to fence"
    ],
    "screenshot": ["image1.jpg", "image2.jpg"],
    "timestamp": 1705977600000,              // Unix timestamp (ms)
    "model_version": "v2.1",
    "confidence_score": 0.95                 // 0-1 scale
  }
}
```

---

## Firestore Structure

Alerts are stored with this structure:

```
devices/
  └── {deviceId}/
      └── alerts/
          └── {alertId}
              ├── deviceId: string
              ├── deviceIdentifier: string
              ├── userId: string
              ├── notificationType: string
              ├── detectedObjects: array
              ├── riskLabel: string
              ├── predictedRisk: string
              ├── description: array
              ├── screenshots: array
              ├── timestamp: Timestamp
              ├── alertGeneratedAt: number
              ├── modelVersion: string
              ├── confidenceScore: number
              ├── acknowledged: boolean
              ├── rating: number (1-10)
              ├── ratingAccuracy: boolean
              └── additionalData: object
```

---

## Cloud Function Endpoints

### receiveMLAlert
- **URL**: `https://YOUR_PROJECT.cloudfunctions.net/receiveMLAlert`
- **Method**: POST
- **Response**: 
  - 201: Success
  - 400: Invalid request
  - 404: Device not found
  - 500: Server error

### Features:
- ✅ Validates device registration
- ✅ Stores alert in Firestore
- ✅ Sends push notification to device owner
- ✅ Automatic cleanup of alerts older than 30 days
- ✅ Handles errors gracefully

---

## User Experience Flow

1. **Alert Received** → Push notification sent to user's phone
2. **User Opens App** → ML Alerts tab shows all detected alerts
3. **User Views Alert** → Tap to see full details (objects, risk, images, etc.)
4. **User Rates Alert** → Mark as accurate/inaccurate + 1-10 score for ML model training feedback
5. **Feedback Stored** → Data sent back to improve model performance

---

## Monitoring

### Check Alerts in Firebase Console

1. Go to Firestore Database
2. Navigate to: `devices` → `{deviceId}` → `alerts`
3. View recent alerts and their ratings

### Check Cloud Function Logs

1. Go to Cloud Functions in Firebase Console
2. Click on `receiveMLAlert`
3. View Logs tab for request/response history

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Alert not received | Check device is registered with valid userId |
| No push notification | Verify user opened app and granted permissions |
| 404 Device not found | Verify deviceId matches exactly in Firestore |
| Connection timeout | Check remote device internet connectivity |
| Auth errors | Ensure Firestore security rules allow device creation |

---

## Configuration

### Environment Variables (for remote devices)

```bash
# .env on remote device
CLOUD_FUNCTION_URL=https://YOUR_PROJECT.cloudfunctions.net/receiveMLAlert
DEVICE_ID=camera_01
DEVICE_IDENTIFIER=Raspberry Pi 1
MODEL_VERSION=v2.1
```

### Firestore Security Rules

Ensure your security rules allow device document writes:

```javascript
match /devices/{deviceId} {
  allow read, write: if request.auth != null;
  allow read, write: if request.auth.uid == resource.data.userId;
  
  match /alerts/{alertId} {
    allow read: if request.auth.uid == resource.data.userId;
    allow write: if request.auth != null;
  }
}
```

---

## Next Steps

1. ✅ Deploy Cloud Functions
2. ✅ Test with sample alert using cURL
3. ✅ Register your remote device in Firestore
4. ✅ Integrate ML model with the remote device script
5. ✅ Set up alert sending from your ML pipeline
6. ✅ Test end-to-end push notifications
7. ✅ Monitor Firestore for alert storage
8. ✅ Collect user feedback ratings for model improvement

---

## API Rate Limiting

Recommended alert frequency:
- **High Priority Alerts**: Every 10 seconds
- **Medium Priority**: Every 30 seconds
- **Low Priority**: Every 60 seconds

Implement local debouncing to avoid overwhelming the system.

---

## Support

For detailed implementation examples and troubleshooting, see:
- 📖 [ML_ALERT_INTEGRATION_GUIDE.md](ML_ALERT_INTEGRATION_GUIDE.md)
- 💻 Python/Node.js/Bash code examples
- 🔧 Retry logic and error handling
- 📊 Performance considerations

---

## Changelog

### v1.0 - Production Release (Jan 24, 2025)

**Added:**
- ML Alert system with real-time push notifications
- Dedicated ML Alerts tab in dashboard
- Alert detail modal with full information display
- User feedback and rating system (1-10 scale)
- Cloud Function endpoint for receiving alerts from remote devices
- Firestore integration for alert storage and retrieval
- TypeScript types for ML alerts
- Comprehensive integration guide for remote devices

**Removed:**
- Test notification button (replaced with production system)

**Changed:**
- Updated notifications system to handle ML alert format
- Enhanced dashboard UI with new ML Alerts tab
- Expanded Firestore schema for device alerts

---

## Production Checklist

Before going live:

- [ ] Cloud Functions deployed
- [ ] Firestore security rules updated
- [ ] Remote device code tested
- [ ] Push notifications working end-to-end
- [ ] Error handling implemented on remote device
- [ ] Rate limiting configured
- [ ] Logs monitored for errors
- [ ] User feedback collection tested
- [ ] Documentation shared with team

---

**Ready to go!** Your app now has a production-grade ML alert system. 🎉
