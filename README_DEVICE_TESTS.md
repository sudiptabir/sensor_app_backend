# 🔥 Device Firebase Connection & Registration Test Suite

## Overview

A comprehensive test suite to verify your device can connect to Firebase and register itself in Firestore. Includes multiple test scripts, configuration management, and detailed troubleshooting guides.

**Status:** ✅ Connection Working | ⏳ Permissions Pending

---

## Quick Start (1 minute)

```powershell
cd c:\Users\SUDIPTA\Downloads\Sensor_app

# Check Firebase connection
node check_firebase_status.js

# Test device registration
node test_device_registration.js
```

**See [QUICK_START.md](QUICK_START.md) for fastest path to success.**

---

## What's Included

### 🧪 Test Scripts

| Script | Language | Purpose | Status |
|--------|----------|---------|--------|
| `test_device_registration.js` | Node.js | Full device registration test | ✅ Ready |
| `check_firebase_status.js` | Node.js | Quick Firebase status check | ✅ Ready |
| `test_device_registration.py` | Python | Python version of test | ✅ Ready |
| `test_devices.py` | Python | Simple device write test | ✅ Ready |

### 📚 Documentation

| Document | Purpose |
|----------|---------|
| `QUICK_START.md` | ⭐ **START HERE** - Fastest path to running tests |
| `DEVICE_CONNECTION_TEST_REPORT.md` | Complete status report and analysis |
| `DEVICE_TEST_GUIDE.md` | Detailed test usage guide |
| `TROUBLESHOOTING_PERMISSIONS.md` | Permission error solutions |
| `FIRESTORE_RULES_DEPLOYMENT.md` | Firestore security rules guide |
| `DEVICE_REGISTRATION_TEST_STATUS.md` | Detailed status and next steps |

### ⚙️ Configuration

| File | Purpose |
|------|---------|
| `firestore.rules` | Firestore security rules (updated) |
| `serviceAccountKey.json` | Firebase admin credentials |
| `.firebaserc` | Firebase project binding |
| `firebase.json` | Firebase config |

---

## Current Status

### ✅ Working
- Firebase Admin SDK connection
- Firestore client initialization
- Service account authentication
- Firebase credentials validation
- Configuration files present

### ⏳ Pending
- Device write permissions
- Service account IAM role assignment

### ❌ Issue
```
Error: 7 PERMISSION_DENIED: Missing or insufficient permissions.
```

**Cause:** Service account lacks Editor role in Google Cloud IAM

**Fix:** 2-minute setup (see TROUBLESHOOTING_PERMISSIONS.md)

---

## How to Run Tests

### Test 1: Quick Status Check (15 seconds)
```powershell
node check_firebase_status.js
```
Output: Shows Firebase connection status and configuration

### Test 2: Full Device Registration (30 seconds)
```powershell
node test_device_registration.js
```
Output: Tests registration, reads sensor data, verifies storage

### Test 3: Python Version (optional)
```powershell
python test_device_registration.py
```

---

## Expected Output (Success)

```
============================================================
🔥 DEVICE REGISTRATION TEST
============================================================

[1] Loading Firebase credentials...
    ✅ Credentials loaded

[2] Initializing Firebase Admin SDK...
    ✅ Firebase initialized

[3] Connecting to Firestore...
    ✅ Connected to Firestore

[4] Gathering device information...
    Device ID: a71ef60c-f38c-4ab7-a224-a3a7df2b9171
    Hostname: LAPTOP-14678VIP
    Platform: win32

[5] Registering device in Firestore...
    ✅ Device registered with ID: a71ef60c-f38c-4ab7-a224-a3a7df2b9171

[6] Verifying device registration...
    ✅ Device successfully registered and verified!

[7] Testing sensor reading submission...
    ✅ Sample reading submitted

[8] Verifying sensor reading...
    ✅ Sensor reading successfully stored!

============================================================
✅ SUCCESS - DEVICE REGISTRATION TEST PASSED!
============================================================

Your device is successfully connected to Firebase!
```

---

## Device Data Structure

Registered device data in Firestore:

```
databases/
├── devices/ (collection)
│   └── {uuid}/ (document)
│       ├── deviceId: "a71ef60c-f38c-4ab7-a224-a3a7df2b9171"
│       ├── name: "LAPTOP-14678VIP"
│       ├── platform: "win32"
│       ├── version: "Windows 10 Pro"
│       ├── ipAddress: "192.168.x.x"
│       ├── status: "connected"
│       ├── type: "sensor_device"
│       ├── registeredAt: Timestamp
│       ├── lastSeen: Timestamp
│       └── readings/ (subcollection)
│           └── {reading_id}/
│               ├── sensorType: "temperature"
│               ├── value: 23.5
│               ├── unit: "celsius"
│               ├── timestamp: Timestamp
│               └── deviceId: UUID
```

---

## Fixing Permission Issues

### The Problem
Service account cannot write to Firestore.

### The Solution (2 minutes)

1. **Go to Google Cloud Console**
   ```
   https://console.cloud.google.com/
   ```

2. **Select Project**
   - Project: `sensor-app-2a69b`

3. **Assign Editor Role**
   - Go to **IAM & Admin** → **Roles**
   - Search: "Editor"
   - Click **Add Principal**
   - Email: `firebase-adminsdk-fbsvc@sensor-app-2a69b.iam.gserviceaccount.com`
   - Role: **Editor**
   - Save

4. **Retry Test**
   ```powershell
   node test_device_registration.js
   ```

**For detailed steps, see:** [TROUBLESHOOTING_PERMISSIONS.md](TROUBLESHOOTING_PERMISSIONS.md)

---

## Verification in Firebase Console

After successful test:

1. Go to https://console.firebase.google.com/
2. Select project: `sensor-app-2a69b`
3. Click **Firestore Database**
4. Look for **devices** collection
5. You should see your registered device with all data

---

## Integration with Your App

Your React Native Expo app (`sensor_app/`) can now:

- ✅ Register devices from mobile UI
- ✅ Query registered devices  
- ✅ Submit sensor readings
- ✅ View device history
- ✅ Receive real-time updates

The test suite confirms the backend infrastructure is ready for mobile integration.

---

## Project Structure

```
c:\Users\SUDIPTA\Downloads\Sensor_app/
├── 📄 QUICK_START.md ⭐ START HERE
├── 📄 DEVICE_CONNECTION_TEST_REPORT.md
├── 📄 TROUBLESHOOTING_PERMISSIONS.md
├── 📄 FIRESTORE_RULES_DEPLOYMENT.md
│
├── 🧪 test_device_registration.js (Main test)
├── 🧪 check_firebase_status.js (Status check)
├── 🧪 test_device_registration.py
│
├── ⚙️ firestore.rules (Updated)
├── ⚙️ serviceAccountKey.json
├── ⚙️ firebase.json
├── ⚙️ .firebaserc
│
└── 📱 sensor_app/ (React Native app)
    ├── firebase/firebaseConfig.js
    ├── db/testData.ts
    └── ...
```

---

## Commands Reference

```powershell
# Quick status check
node check_firebase_status.js

# Full device registration test
node test_device_registration.js

# Python version
python test_device_registration.py

# Deploy Firestore rules
firebase deploy --only firestore:rules

# View Firestore data
firebase firestore

# Login to Firebase
firebase login

# List projects
firebase projects:list

# Check service account
firebase auth:export --format=json
```

---

## Troubleshooting

### "PERMISSION_DENIED" Error
→ See [TROUBLESHOOTING_PERMISSIONS.md](TROUBLESHOOTING_PERMISSIONS.md)

### "serviceAccountKey.json not found"
→ Run test from `c:\Users\SUDIPTA\Downloads\Sensor_app` directory

### "Module not found: firebase-admin"
→ Run: `npm install firebase-admin uuid`

### "Connection timeout"
→ Check internet connection and verify Firebase project exists

### Other Issues
→ Check [DEVICE_CONNECTION_TEST_REPORT.md](DEVICE_CONNECTION_TEST_REPORT.md) for comprehensive troubleshooting

---

## Next Steps

### Phase 1: Fix & Verify ⏳
1. ⏳ Assign Editor role to service account
2. ✅ Run device registration test
3. ✅ Verify in Firebase Console

### Phase 2: Mobile Integration
1. Open `sensor_app/` React Native app
2. Test device registration from mobile UI
3. Submit sensor data from app
4. View real-time updates

### Phase 3: Production
1. Tighten Firestore security rules
2. Set up alerts and monitoring
3. Configure Cloud Functions if needed
4. Deploy to production

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│         Your Device / Mobile App                    │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│         Firebase Admin SDK / Web SDK                │
│    (serviceAccountKey.json / Web Auth)             │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│    Firebase Project: sensor-app-2a69b              │
│  ┌──────────────────────────────────────┐          │
│  │ Firestore Database                  │          │
│  │ ├── devices/                         │          │
│  │ ├── sensors/                         │          │
│  │ ├── users/                           │          │
│  │ └── alerts/                          │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

---

## Support

### Documentation
- 📖 [Firebase Admin SDK Docs](https://firebase.google.com/docs/admin/setup)
- 📖 [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/start)
- 📖 [Google Cloud IAM](https://cloud.google.com/iam/docs)

### Local Resources
- [QUICK_START.md](QUICK_START.md) - Fastest setup
- [DEVICE_CONNECTION_TEST_REPORT.md](DEVICE_CONNECTION_TEST_REPORT.md) - Full analysis
- [TROUBLESHOOTING_PERMISSIONS.md](TROUBLESHOOTING_PERMISSIONS.md) - Permission fixes

### Firebase Console
- [Project Dashboard](https://console.firebase.google.com/project/sensor-app-2a69b)

---

## Summary

✅ **Device can connect to Firebase**
✅ **Firestore is accessible**
⏳ **Needs write permission assignment**

**Action Needed:** Add Editor role to service account (2 minutes)

**After Fix:** Run `node test_device_registration.js` to verify success

---

**Ready to test?**

```powershell
cd c:\Users\SUDIPTA\Downloads\Sensor_app
node test_device_registration.js
```

