# ML Alert Payload Examples

## Quick Reference for Different Scenarios

### 1. **Person Detected - High Risk**

```json
{
  "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
  "userId": "YOUR_USER_ID",
  "deviceIdentifier": "LAPTOP-14678VIP",
  "detectedObjects": ["person"],
  "riskLabel": "high",
  "description": ["Unauthorized person at entrance"],
  "screenshots": ["https://example.com/person.jpg"],
  "confidenceScore": 0.92
}
```

**Expected Notification:**
```
🟠 HIGH - LAPTOP-14678VIP
Detected: person
```

---

### 2. **Vehicle in Restricted Area - Medium Risk**

```json
{
  "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
  "userId": "YOUR_USER_ID",
  "deviceIdentifier": "LAPTOP-14678VIP",
  "detectedObjects": ["vehicle"],
  "riskLabel": "medium",
  "description": ["Vehicle detected in parking area"],
  "screenshots": [],
  "confidenceScore": 0.78
}
```

**Expected Notification:**
```
🟡 MEDIUM - LAPTOP-14678VIP
Detected: vehicle
```

---

### 3. **Multiple Threats - Critical**

```json
{
  "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
  "userId": "YOUR_USER_ID",
  "deviceIdentifier": "LAPTOP-14678VIP",
  "detectedObjects": ["person", "weapon", "vehicle"],
  "riskLabel": "critical",
  "description": ["CRITICAL: Suspicious activity with multiple threats"],
  "screenshots": [
    "https://example.com/threat1.jpg",
    "https://example.com/threat2.jpg"
  ],
  "confidenceScore": 0.96
}
```

**Expected Notification:**
```
🔴 CRITICAL - LAPTOP-14678VIP
Detected: person, weapon, vehicle
```

---

### 4. **Low Risk - Normal Activity**

```json
{
  "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
  "userId": "YOUR_USER_ID",
  "deviceIdentifier": "LAPTOP-14678VIP",
  "detectedObjects": ["person", "bicycle"],
  "riskLabel": "low",
  "description": ["Normal pedestrian activity detected"],
  "screenshots": [],
  "confidenceScore": 0.85
}
```

**Expected Notification:**
```
🟢 LOW - LAPTOP-14678VIP
Detected: person, bicycle
```

---

### 5. **Minimal Alert (Required Fields Only)**

```json
{
  "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
  "userId": "YOUR_USER_ID"
}
```

**Expected Notification:**
```
🟡 ALERT - Unknown Device
Detected: Object detection
```

---

## Batch Request Example

Send 3 alerts at once:

```json
{
  "alerts": [
    {
      "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
      "userId": "YOUR_USER_ID",
      "deviceIdentifier": "LAPTOP-14678VIP",
      "detectedObjects": ["person"],
      "riskLabel": "high",
      "description": ["Person at entrance"],
      "screenshots": [],
      "confidenceScore": 0.90
    },
    {
      "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
      "userId": "YOUR_USER_ID",
      "deviceIdentifier": "LAPTOP-14678VIP",
      "detectedObjects": ["vehicle"],
      "riskLabel": "medium",
      "description": ["Vehicle passing by"],
      "screenshots": [],
      "confidenceScore": 0.82
    },
    {
      "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
      "userId": "YOUR_USER_ID",
      "deviceIdentifier": "LAPTOP-14678VIP",
      "detectedObjects": ["animal"],
      "riskLabel": "low",
      "description": ["Cat detected"],
      "screenshots": [],
      "confidenceScore": 0.75
    }
  ]
}
```

---

## cURL Examples

### Send Single Alert
```bash
curl -X POST \
  https://us-central1-sensor--app.cloudfunctions.net/receiveMLAlert \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
    "userId": "YOUR_USER_ID",
    "deviceIdentifier": "LAPTOP-14678VIP",
    "detectedObjects": ["person"],
    "riskLabel": "high",
    "description": ["Person detected"],
    "screenshots": [],
    "confidenceScore": 0.92
  }'
```

### Send Batch Alerts
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

## Python Examples

### Simple Alert
```python
import requests

response = requests.post(
    "https://us-central1-sensor--app.cloudfunctions.net/receiveMLAlert",
    json={
        "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
        "userId": "YOUR_USER_ID",
        "detectedObjects": ["person"],
        "riskLabel": "high",
        "confidenceScore": 0.92
    }
)

print(response.json())
```

### With Error Handling
```python
import requests
import json

def send_alert(objects, risk_label, confidence):
    try:
        response = requests.post(
            "https://us-central1-sensor--app.cloudfunctions.net/receiveMLAlert",
            json={
                "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
                "userId": "YOUR_USER_ID",
                "deviceIdentifier": "LAPTOP-14678VIP",
                "detectedObjects": objects,
                "riskLabel": risk_label,
                "confidenceScore": confidence
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Alert sent: {result['alertId']}")
            return result
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return None

# Usage
send_alert(["person"], "high", 0.92)
```

### Batch with Loop
```python
import requests

alerts = [
    {"objects": ["person"], "risk": "high", "conf": 0.90},
    {"objects": ["vehicle"], "risk": "medium", "conf": 0.82},
    {"objects": ["animal"], "risk": "low", "conf": 0.75},
]

alert_data = {
    "alerts": [
        {
            "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
            "userId": "YOUR_USER_ID",
            "deviceIdentifier": "LAPTOP-14678VIP",
            "detectedObjects": alert["objects"],
            "riskLabel": alert["risk"],
            "confidenceScore": alert["conf"]
        }
        for alert in alerts
    ]
}

response = requests.post(
    "https://us-central1-sensor--app.cloudfunctions.net/receiveMLAlertBatch",
    json=alert_data
)

print(response.json())
```

---

## Response Examples

### Success Response
```json
{
  "success": true,
  "alertId": "abc123def456ghi789",
  "messageId": "0:1234567890123456789",
  "message": "ML alert received and notification sent"
}
```

### Batch Success Response
```json
{
  "success": true,
  "processed": 3,
  "results": [
    {
      "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
      "success": true,
      "alertId": "abc123def456ghi789"
    },
    {
      "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
      "success": true,
      "alertId": "def456ghi789abc123"
    },
    {
      "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
      "success": true,
      "alertId": "ghi789abc123def456"
    }
  ]
}
```

### Error Response
```json
{
  "error": "User not found"
}
```

---

## Field Details

### Required Fields
| Field | Type | Example |
|-------|------|---------|
| `deviceId` | string | `"192b7a8c-972d-4429-ac28-4bc73e9a8809"` |
| `userId` | string | `"abc123def456ghi789jkl0123456789"` |

### Optional Fields
| Field | Type | Default | Example |
|-------|------|---------|---------|
| `deviceIdentifier` | string | `"Unknown Device"` | `"LAPTOP-14678VIP"` |
| `detectedObjects` | string[] | `[]` | `["person", "car"]` |
| `riskLabel` | string | `"medium"` | `"high"` |
| `description` | string[] | `[]` | `["Person at entrance"]` |
| `screenshots` | string[] | `[]` | `["https://example.com/img.jpg"]` |
| `confidenceScore` | number | `0` | `0.92` |

### Risk Labels
```
"critical" → 🔴 Red    (Highest priority)
"high"     → 🟠 Orange 
"medium"   → 🟡 Yellow (Default)
"low"      → 🟢 Green  (Lowest priority)
```

### Confidence Score
```
0.0 = 0%   (No confidence)
0.5 = 50%  (Medium confidence)
1.0 = 100% (Maximum confidence)

Displays as percentage in app: 0.92 → "92%"
```

---

## Testing Checklist

- [ ] Cloud Function deployed
- [ ] User ID obtained from Firebase Auth
- [ ] Cloud Function endpoint URL copied
- [ ] Python script updated with User ID and endpoint
- [ ] `pip install requests` run
- [ ] Python tests executed successfully
- [ ] Push notification received on device
- [ ] Alert appears in app's Alerts tab
- [ ] Alert shows correct device name, objects, and risk level
- [ ] Can tap alert to see full details
- [ ] Can rate alert accuracy

---

## Troubleshooting

**Alert saved but no notification?**
- Check FCM token exists in Firestore for your user
- Verify notifications are enabled in app settings
- Check Firebase Console → Cloud Messaging quotas

**Different device IDs?**
- Use same `deviceId` from Firestore (`192b7a8c-972d-4429-ac28-4bc73e9a8809`)
- Alerts can come from multiple devices, all will show in one tab

**Want to test with different user?**
- Get different user's UID from Firebase Auth
- Send alert with that `userId`
- Alert will appear in their app instead

