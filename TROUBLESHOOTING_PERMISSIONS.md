# Device Registration Permission Error - Troubleshooting Guide

## Status
✅ **Connected to Firebase** - The device connects successfully
✅ **Rules Deployed** - Firestore security rules are deployed
❌ **Permission Denied** - Service account lacks write permissions

---

## Root Causes & Solutions

### 1. Service Account Missing Permissions (Most Likely)

The `serviceAccountKey.json` service account might not have Editor role in Google Cloud.

**Fix:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **sensor-app-2a69b**
3. Go to **IAM & Admin** → **Roles** → **Editor**
4. Find your service account (usually `firebase-adminsdk-xxxxx@sensor-app-2a69b.iam.gserviceaccount.com`)
5. Ensure it has **Editor** or **Cloud Datastore User** role
6. If missing, add the role by clicking **Grant Access** → search service account → select **Editor**

---

### 2. Firestore Database Not Activated

The Firestore database might not be properly activated in your project.

**Fix:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select **sensor-app-2a69b** project
3. Go to **Firestore Database**
4. If you see "Create Database" button, click it
5. Select **Start in test mode** (for development)
6. Choose region (e.g., `us-central1`)
7. Click **Create**

---

### 3. Using Wrong Credentials

The `serviceAccountKey.json` might be from a different project.

**Fix:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select **sensor-app-2a69b** project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Replace your `serviceAccountKey.json` with the downloaded file

---

## Quick Verification Steps

Run these checks:

### Check 1: Verify Firebase Project ID
```powershell
cd c:\Users\SUDIPTA\Downloads\Sensor_app
cat firebaseConfig.js | grep projectId
```

Expected output: `projectId: "sensor-app-2a69b"`

### Check 2: Verify Service Account Project
```powershell
cat serviceAccountKey.json | grep project_id
```

Expected output should contain: `"project_id": "sensor-app-2a69b"`

### Check 3: Test with Google Cloud CLI
```powershell
npm install -g google-cloud-firestore
firebase login
firebase projects:list
```

Should show `sensor-app-2a69b` as available project

---

## Testing After Fix

Once you fix the permissions:

1. Redeploy rules:
```powershell
firebase deploy --only firestore:rules
```

2. Run the test:
```powershell
node test_device_registration.js
```

3. Expected success output:
```
✅ Device registered with ID: [UUID]
✅ Device successfully registered and verified!
✅ Sensor reading successfully stored!
✅ SUCCESS - DEVICE REGISTRATION TEST PASSED!
```

---

## Alternative: Test with Your Mobile App

Instead of the service account, test with your mobile app which uses web authentication:

1. Open your React Native app (`sensor_app/`)
2. Log in with a Firebase user account
3. Navigate to add/register a device
4. This should work because user auth is properly configured

---

## Get Help

If you're still stuck:

1. Check Firebase Console → **Logs** for more details
2. Verify `.firebaserc` has correct project ID:
   ```
   cat .firebaserc
   ```
3. Clear cache and retry:
   ```powershell
   rm -r node_modules/.cache
   node test_device_registration.js
   ```

---

## Next Steps

Once device registration works:
1. ✅ Device connects to Firebase
2. ✅ Device registers in `devices` collection
3. ✅ Device can submit readings
4. ⏭️ **TODO:** Test with mobile app
5. ⏭️ **TODO:** Set up Firestore alerts
6. ⏭️ **TODO:** Configure Realtime Database

