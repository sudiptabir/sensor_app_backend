# Deploy Firestore Rules to Fix Permission Error

## Problem
You're getting a `PERMISSION_DENIED` error when trying to write devices to Firestore. This means your Firestore security rules need to be updated.

## Solution

### Step 1: Ensure Firebase CLI is Installed
```powershell
npm install -g firebase-tools
```

### Step 2: Deploy the Updated Rules
```powershell
cd c:\Users\SUDIPTA\Downloads\Sensor_app
firebase login
firebase deploy --only firestore:rules
```

### Step 3: Verify Deployment
Go to [Firebase Console](https://console.firebase.google.com/):
1. Select your project: **sensor-app-2a69b**
2. Go to **Firestore Database**
3. Click **Rules** tab
4. Verify the rules were updated

---

## What Changed in the Rules

The updated `firestore.rules` file now allows:

✅ **Admin (service account) writes** - Your test scripts can write device data
✅ **Device collection** - `/devices/{deviceId}` documents
✅ **Readings subcollections** - `/devices/{deviceId}/readings/{readingId}`
✅ **Sensors collection** - `/sensors/{sensorId}` documents  
✅ **User-specific reads** - `/users/{userId}` for authenticated users

---

## Quick Deployment Command

```powershell
firebase deploy --only firestore:rules
```

Then retry the test:
```powershell
node test_device_registration.js
```

---

## Alternative: Use Firebase Console Directly

If you prefer the web interface:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project **sensor-app-2a69b**
3. Go to **Firestore Database** → **Rules**
4. Replace all content with the code from `firestore.rules`
5. Click **Publish**

---

## After Successful Deployment

Once the rules are deployed, run the test again:
```powershell
node test_device_registration.js
```

You should see:
```
✅ Device registered with ID: a71ef60c-f38c-4ab7-a224-a3a7df2b9171
✅ Device successfully registered and verified!
✅ Sensor reading successfully stored!
✅ SUCCESS - DEVICE REGISTRATION TEST PASSED!
```

---

## Need Help?

If deployment fails:
1. Ensure you're logged in: `firebase login`
2. Check Firebase CLI version: `firebase --version`
3. Verify project config: `firebase list`
4. Check `.firebaserc` file has correct project ID

