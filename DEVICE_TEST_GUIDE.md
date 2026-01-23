# Device Connection and Registration Test Guide

## Quick Start

You have two options to test your device connection to Firebase:

### Option 1: Using the Python Test Script (Recommended)

I've created `test_device_registration.py` which comprehensively tests your device:

1. **Connect to Firebase** using serviceAccountKey.json credentials
2. **Generate unique device ID** and gather system information
3. **Register device** in the `devices` collection
4. **Submit a test sensor reading** to verify the subcollection works
5. **Verify all data** was written correctly

**To run:**
```powershell
cd c:\Users\SUDIPTA\Downloads\Sensor_app
python test_device_registration.py
```

**Expected Results:**
- ✅ Device registered with unique ID
- ✅ Test reading submitted
- ✅ `device_id.txt` file created with your device ID
- ✅ You should see success messages

### Option 2: Using Existing Test Scripts

You already have two test files:

**test_devices.py** - Simpler test that writes a device entry:
```powershell
python test_devices.py
```

**simple_test.py** - Basic connectivity test:
```powershell
python simple_test.py
```

---

## What Gets Tested

### Device Registration (`devices` collection)
```
devices/
  ├── {device_id}/
  │   ├── deviceId: UUID
  │   ├── name: hostname
  │   ├── platform: OS info
  │   ├── ipAddress: network address
  │   ├── status: connected
  │   ├── registeredAt: timestamp
  │   └── lastSeen: timestamp
```

### Sensor Readings (subcollection)
```
devices/{device_id}/readings/
  ├── {reading_id}/
  │   ├── sensorType: string
  │   ├── value: number
  │   ├── unit: string
  │   ├── timestamp: datetime
  │   └── deviceId: reference
```

---

## Troubleshooting

### Firebase credentials not found
- **Error:** "Could not find serviceAccountKey.json"
- **Solution:** Make sure `serviceAccountKey.json` is in the same directory as the test script

### Permission denied / Access denied
- **Error:** Firestore permission errors
- **Solutions:**
  1. Check Firestore security rules in Firebase Console
  2. Verify serviceAccountKey.json has admin privileges
  3. Ensure `firebase-admin` package is installed: `pip install firebase-admin`

### Module not found (firebase_admin)
- **Error:** "ModuleNotFoundError: No module named 'firebase_admin'"
- **Solution:** Install the package:
  ```powershell
  pip install firebase-admin
  ```

### Connection timeout
- **Error:** Network/timeout errors
- **Solutions:**
  1. Check internet connection
  2. Verify Firebase project is active
  3. Check firewall/network restrictions

---

## Verifying in Firebase Console

After running the test, check Firebase Console:

1. Go to **Firebase Console** → Your Project → **Firestore Database**
2. Look for `devices` collection
3. You should see your device ID as a document
4. Expand it to see the registered data and subcollections

---

## Device Data Structure Reference

From your app (`sensor_app/db/testData.ts`), devices support:

- **Type:** sensor_device
- **Fields:**
  - userId (reference to current user)
  - createdAt (server timestamp)
  - updatedAt (server timestamp)
  - name (device/sensor name)
  - description (optional details)

---

## Integration with Your App

The test data structure matches what your React Native app expects. Your app includes:

- **Firebase Config:** `sensor_app/firebase/firebaseConfig.js`
- **Test Data Generator:** `sensor_app/db/testData.ts`
- **Firestore Client:** Already initialized in your app

Next steps after successful test:
1. Verify the device appears in Firebase Console
2. Test with your mobile app to pull this device data
3. Create sensors under this device
4. Submit real sensor readings

---

## Support Files

- `test_device_registration.py` - Full registration test with verification
- `test_devices.py` - Simple device write test
- `simple_test.py` - Basic connectivity check
- `device_id.txt` - Will contain your device ID after successful test

