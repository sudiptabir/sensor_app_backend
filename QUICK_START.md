# Device Connection Test - Quick Start Guide

## Status: ✅ Ready to Test

Your device can now be tested for Firebase connection and registration.

---

## Run the Test (30 seconds)

### Option 1: Full Test with Write Verification
```powershell
cd c:\Users\SUDIPTA\Downloads\Sensor_app
node test_device_registration.js
```

**What it tests:**
- ✅ Firebase connection
- ✅ Service account auth
- ✅ Device registration
- ✅ Sensor data submission
- ✅ Data verification

### Option 2: Connection Status Only (Fast)
```powershell
node check_firebase_status.js
```

**What it checks:**
- ✅ Credentials valid
- ✅ Firebase initialized
- ✅ Firestore connected
- ✅ Configuration files present

---

## Results

### If You See: ✅ SUCCESS ✅
Perfect! Your device can:
- Connect to Firebase
- Register itself in Firestore
- Submit sensor data

**Next Step:**
- Open [Firebase Console](https://console.firebase.google.com/) to verify the registered device
- Navigate to **Firestore Database** → **devices** collection
- You should see your device with all its info

### If You See: ❌ PERMISSION DENIED ❌
Your device connects but lacks write permissions.

**Fix (2 minutes):**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **sensor-app-2a69b**
3. Go to **IAM & Admin** → **Roles** → **Editor**
4. Click **Add Principal**
5. Enter: `firebase-adminsdk-fbsvc@sensor-app-2a69b.iam.gserviceaccount.com`
6. Select role: **Editor**
7. Save

Then retry:
```powershell
node test_device_registration.js
```

---

## What Gets Registered

Your device info that gets stored:
- **Device ID** - Unique identifier
- **Hostname** - Your computer name  
- **Platform** - Operating system (windows/linux/mac)
- **Status** - Connected/offline
- **Timestamp** - When registered
- **Sample Reading** - Temperature sensor data

---

## Files Created

### Scripts
- `test_device_registration.js` - Main test
- `check_firebase_status.js` - Status checker

### Docs
- `DEVICE_CONNECTION_TEST_REPORT.md` - Full report
- `TROUBLESHOOTING_PERMISSIONS.md` - Fix permission errors
- `DEVICE_TEST_GUIDE.md` - Detailed guide

---

## Verify in Firebase Console

After successful test:

1. Go to https://console.firebase.google.com/
2. Select **sensor-app-2a69b**
3. Click **Firestore Database**
4. You should see:
   ```
   devices/ (collection)
   └── [unique-device-id]/ (document)
       ├── deviceId
       ├── name
       ├── platform
       ├── status: "connected"
       └── readings/ (subcollection)
   ```

---

## Python Alternative

If you prefer Python:
```powershell
# Install dependencies (one time)
pip install firebase-admin

# Run test
python test_device_registration.py
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| `PERMISSION_DENIED` | Add Editor role to service account in Google Cloud IAM |
| `serviceAccountKey.json not found` | Run test from `c:\Users\SUDIPTA\Downloads\Sensor_app` |
| Module not found | Run `npm install firebase-admin uuid` first |
| Connection timeout | Check internet and verify Firebase project exists |

---

## Integration with Your App

After device registration works, your Expo app can:
- Register devices from mobile UI
- Query registered devices
- Submit sensor readings
- View device history

---

## Need Help?

Read these files:
1. `DEVICE_CONNECTION_TEST_REPORT.md` - Full status and troubleshooting
2. `TROUBLESHOOTING_PERMISSIONS.md` - Permission issues  
3. `DEVICE_TEST_GUIDE.md` - Detailed test guide

---

## One Command Test

```powershell
cd c:\Users\SUDIPTA\Downloads\Sensor_app && node test_device_registration.js && echo "Test Complete!"
```

---

**Ready to test?**

```powershell
node test_device_registration.js
```

