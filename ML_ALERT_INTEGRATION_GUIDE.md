# 🤖 ML Alert Integration Guide

## Overview

This guide explains how to integrate your remote ML models with the Sensor App to send real-time alerts via push notifications.

## Architecture

```
Remote Device (Raspberry Pi, etc)
    ↓ (sends ML detection JSON)
    ↓
Cloud Function Endpoint (receiveMLAlert)
    ↓ (validates & stores)
    ↓
Firestore Database (devices/{deviceId}/alerts)
    ↓ (triggers real-time listener)
    ↓
Mobile App
    ↓ (receives push notification)
    ↓
User's Phone
```

---

## Step 1: Register Your Remote Device

Before sending alerts, your remote device must be registered in Firestore.

### A. Register Device via API

Make a request to create a device (use your Firebase configuration):

```javascript
// Example: Node.js/Python script on remote device
const axios = require('axios');

const deviceData = {
  label: "Raspberry Pi 1",        // Human-readable name
  deviceId: "rpi_camera_01",      // Unique identifier
};

// POST to your Firebase REST API or custom endpoint
// This should create a document at: /devices/{deviceId}
```

### B. Register Device via Dashboard

Users can also manually add devices through the mobile app's "Add Device" button.

---

## Step 2: Send ML Alerts

Once registered, your remote device can send ML detection alerts using the Cloud Function endpoint.

### Endpoint Information

**URL:** `https://YOUR_FIREBASE_PROJECT.cloudfunctions.net/receiveMLAlert`

**Method:** POST

**Headers:**
```
Content-Type: application/json
```

### Request Body Format

```json
{
  "deviceId": "rpi_camera_01",
  "deviceIdentifier": "Raspberry Pi 1",
  "mlAlert": {
    "notification_type": "Alert",
    "detected_objects": ["cattle", "buffalo"],
    "risk_label": "High",
    "predicted_risk": "High",
    "description": [
      "10 buffalo detected",
      "Close proximity to camera",
      "Aggressive motion detected"
    ],
    "screenshot": [
      "2025-01-24_080120_0001.jpeg",
      "2025-01-24_080120_0002.jpeg"
    ],
    "timestamp": 1705977600000,
    "model_version": "v2.1",
    "confidence_score": 0.95,
    "additional_data": {
      "location": "north_fence",
      "temperature": 28.5
    }
  }
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deviceId` | string | ✅ | Firestore device ID (matches registered device) |
| `deviceIdentifier` | string | ✅ | Human-readable device name (e.g., "Raspberry Pi 1") |
| `notification_type` | string | ❌ | Alert type (default: "Alert") |
| `detected_objects` | array | ✅ | List of detected objects (e.g., ["cattle", "buffalo"]) |
| `risk_label` | string | ✅ | Risk level: "Critical", "High", "Medium", or "Low" |
| `predicted_risk` | string | ✅ | Model's predicted risk level |
| `description` | array | ❌ | Array of description strings with details |
| `screenshot` | array | ❌ | Array of screenshot/image filenames |
| `timestamp` | number | ❌ | Unix timestamp in milliseconds (uses current time if omitted) |
| `model_version` | string | ❌ | Version of ML model used |
| `confidence_score` | number | ❌ | Confidence score (0-1, e.g., 0.95) |
| `additional_data` | object | ❌ | Any additional custom data |

---

## Step 3: Example Implementations

### Python (Raspberry Pi)

```python
import requests
import json
import time
from datetime import datetime

# Configuration
CLOUD_FUNCTION_URL = "https://sensor-app-2a69b.cloudfunctions.net/receiveMLAlert"
DEVICE_ID = "rpi_camera_01"
DEVICE_IDENTIFIER = "Raspberry Pi Camera Unit 1"

def send_ml_alert(detected_objects, risk_label, description, screenshots):
    """
    Send ML detection alert to cloud function
    """
    payload = {
        "deviceId": DEVICE_ID,
        "deviceIdentifier": DEVICE_IDENTIFIER,
        "mlAlert": {
            "notification_type": "Alert",
            "detected_objects": detected_objects,
            "risk_label": risk_label,
            "predicted_risk": risk_label,
            "description": description,
            "screenshot": screenshots,
            "timestamp": int(time.time() * 1000),  # Current time in milliseconds
            "model_version": "v2.1",
            "confidence_score": 0.92,
        }
    }
    
    try:
        response = requests.post(
            CLOUD_FUNCTION_URL,
            json=payload,
            timeout=10,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 201:
            print(f"✅ Alert sent successfully: {response.json()}")
            return response.json()
        else:
            print(f"❌ Error sending alert: {response.status_code}")
            print(response.text)
            return None
            
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return None

# Example usage - simulate ML detection
if __name__ == "__main__":
    # Example: Cattle detected near fence
    detected_objects = ["cattle", "buffalo"]
    risk_label = "High"
    description = [
        "10 buffalo detected",
        "Close proximity to camera",
        "Aggressive motion detected",
        "Area: North boundary fence"
    ]
    screenshots = [
        f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_0001.jpeg",
        f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_0002.jpeg"
    ]
    
    result = send_ml_alert(detected_objects, risk_label, description, screenshots)
```

### Node.js

```javascript
const axios = require('axios');

const CLOUD_FUNCTION_URL = "https://sensor-app-2a69b.cloudfunctions.net/receiveMLAlert";
const DEVICE_ID = "rpi_camera_01";
const DEVICE_IDENTIFIER = "Raspberry Pi Camera Unit 1";

async function sendMLAlert(detectedObjects, riskLabel, description, screenshots) {
  const payload = {
    deviceId: DEVICE_ID,
    deviceIdentifier: DEVICE_IDENTIFIER,
    mlAlert: {
      notification_type: "Alert",
      detected_objects: detectedObjects,
      risk_label: riskLabel,
      predicted_risk: riskLabel,
      description: description,
      screenshot: screenshots,
      timestamp: Date.now(),
      model_version: "v2.1",
      confidence_score: 0.92,
    }
  };

  try {
    const response = await axios.post(CLOUD_FUNCTION_URL, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000
    });

    console.log("✅ Alert sent successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error sending alert:", error.message);
    return null;
  }
}

// Example usage
sendMLAlert(
  ["cattle", "buffalo"],
  "High",
  ["10 buffalo detected", "Close proximity", "Aggressive motion"],
  ["capture_001.jpg", "capture_002.jpg"]
);
```

### Bash/cURL

```bash
#!/bin/bash

CLOUD_FUNCTION_URL="https://sensor-app-2a69b.cloudfunctions.net/receiveMLAlert"
DEVICE_ID="rpi_camera_01"
DEVICE_IDENTIFIER="Raspberry Pi Camera Unit 1"
TIMESTAMP=$(date +%s%3N)

curl -X POST "$CLOUD_FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "'$DEVICE_ID'",
    "deviceIdentifier": "'$DEVICE_IDENTIFIER'",
    "mlAlert": {
      "notification_type": "Alert",
      "detected_objects": ["cattle", "buffalo"],
      "risk_label": "High",
      "predicted_risk": "High",
      "description": [
        "10 buffalo detected",
        "Close proximity",
        "Aggressive motion"
      ],
      "screenshot": ["image_001.jpg", "image_002.jpg"],
      "timestamp": '$TIMESTAMP',
      "model_version": "v2.1",
      "confidence_score": 0.92
    }
  }'
```

---

## Step 4: Response Handling

### Success Response (201 Created)

```json
{
  "success": true,
  "alertId": "abc123def456",
  "message": "Alert received, stored, and push notification sent"
}
```

### Partial Success (201 Created)

Alert stored but push notification couldn't be sent (user may not have registered their device yet):

```json
{
  "success": true,
  "alertId": "abc123def456",
  "message": "Alert stored successfully",
  "warning": "Push notification failed to send"
}
```

### Error Response (400/404/500)

```json
{
  "success": false,
  "error": "Invalid device ID or missing required fields"
}
```

---

## Step 5: Integration Checklist

- [ ] Device is registered in Firestore (`/devices/{deviceId}`)
- [ ] Device has a valid `userId` (claimed by a user)
- [ ] User has granted push notification permissions in the mobile app
- [ ] ML model outputs JSON in the required format
- [ ] Remote device has internet connectivity
- [ ] Cloud Function endpoint is deployed and accessible
- [ ] Testing with sample alerts works correctly
- [ ] Screenshots are stored locally or provided as filenames

---

## Testing

### Test Alert

```bash
# Send a test alert
curl -X POST "https://sensor-app-2a69b.cloudfunctions.net/receiveMLAlert" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "rpi_camera_01",
    "deviceIdentifier": "Test Device",
    "mlAlert": {
      "notification_type": "Alert",
      "detected_objects": ["test_object"],
      "risk_label": "Medium",
      "predicted_risk": "Medium",
      "description": ["This is a test alert"],
      "screenshot": ["test_image.jpg"],
      "timestamp": '$(date +%s%3N)',
      "confidence_score": 0.88
    }
  }'
```

Check the mobile app - you should receive a push notification with the alert details.

---

## Risk Labels and Emojis

The app uses color-coding for risk levels:

| Risk Level | Emoji | Color | Meaning |
|-----------|-------|-------|---------|
| Critical | 🔴 | Red (#FF0000) | Immediate danger, urgent action needed |
| High | 🟠 | Orange (#FF6B00) | High risk, immediate attention needed |
| Medium | 🟡 | Yellow (#FFD700) | Moderate risk, should monitor |
| Low | 🟢 | Green (#00AA00) | Low risk, for information only |

---

## Performance Considerations

- **Alert Frequency**: Implement rate limiting on remote devices to avoid overwhelming the system
- **Screenshot Storage**: Store full resolution screenshots separately; only send filenames in the alert
- **Network Retry**: Implement exponential backoff for failed requests
- **Batch Alerts**: Consider batching multiple detections if they occur within a short time window

### Example Retry Logic (Python)

```python
import time

def send_with_retry(alert_data, max_retries=3, base_delay=1):
    """
    Send alert with exponential backoff retry
    """
    for attempt in range(max_retries):
        try:
            response = requests.post(CLOUD_FUNCTION_URL, json=alert_data, timeout=10)
            if response.status_code == 201:
                return response.json()
        except Exception as e:
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)  # Exponential backoff
                print(f"Retry {attempt + 1}/{max_retries} in {delay}s...")
                time.sleep(delay)
            else:
                print(f"Failed after {max_retries} attempts")
                return None
    return None
```

---

## Troubleshooting

### Alert Not Appearing

1. **Check Device Registration**
   - Verify device exists in Firestore: `db.collection("devices").doc(deviceId)`
   - Verify device has `userId` (claimed by user)

2. **Check Push Token**
   - User must have opened the mobile app at least once
   - Permissions must be granted for notifications
   - Token should be stored in: `db.collection("users").doc(userId)`

3. **Check Logs**
   - View Cloud Function logs in Firebase Console
   - Look for errors in Firestore security rules

### Device Not Found

- Ensure `deviceId` matches exactly with the ID in Firestore
- Device IDs are case-sensitive

### Missing Push Notification

- User hasn't opened the app (no push token)
- Device doesn't support push notifications
- Invalid or expired push token

---

## Security

### Best Practices

1. **Device Authentication**
   - Validate device ownership before accepting alerts
   - Store device API keys securely on remote devices

2. **Rate Limiting**
   - Implement server-side rate limiting per device
   - Prevent alert spam

3. **Data Validation**
   - Validate all required fields on server-side
   - Sanitize object names and descriptions

4. **HTTPS Only**
   - All requests must use HTTPS
   - Cloud Functions enforce this automatically

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs in Firebase Console
3. Test with sample data using cURL
4. Verify network connectivity and firewall rules

---

## Version History

- **v1.0** (Jan 2025): Initial ML Alert Integration Guide
  - Support for basic ML detection alerts
  - Push notification integration
  - Real-time Firestore storage
  - User feedback/rating system
