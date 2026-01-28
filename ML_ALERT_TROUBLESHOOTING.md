# 🔧 ML Alert System - Troubleshooting Guide

## Before You Start

✅ Verify prerequisites:
- [ ] Device registered in Firestore: `192b7a8c-972d-4429-ac28-4bc73e9a8809`
- [ ] React Native app installed and logged in
- [ ] Firebase project ready: `sensor--app`
- [ ] Have access to Firebase Console

---

## Phase 1: Deployment Issues

### ❌ "Command not found: firebase"

**Error:**
```
firebase: command not found
```

**Solution:**
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Verify installation
firebase --version

# Then try deployment again
cd functions
firebase deploy --only functions
```

---

### ❌ "Authentication required"

**Error:**
```
Error: Not authenticated. Run firebase login
```

**Solution:**
```bash
# Login to Firebase
firebase login

# Verify login
firebase auth:list

# Try deployment again
firebase deploy --only functions
```

---

### ❌ "Cannot find module"

**Error:**
```
Error: Cannot find module 'firebase-functions'
```

**Solution:**
```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Try deployment again
firebase deploy --only functions
```

---

### ❌ Function deployment times out

**Error:**
```
Error: Deployment failed. Timeout waiting for operation
```

**Solution:**
```bash
# Try with verbose output to see where it's stuck
firebase deploy --only functions --debug

# If still failing:
# 1. Check internet connection
# 2. Try again (sometimes temporary)
# 3. Check Firebase Console for quota limits
# 4. Deploy from a different network
```

---

## Phase 2: Configuration Issues

### ❌ "Invalid USER_ID"

**Error in Python script:**
```
error: "User not found"
```

**Solution:**
1. Open [Firebase Console](https://console.firebase.google.com)
2. Select `sensor--app`
3. Go to **Authentication** tab
4. Click your user email
5. Copy exact **User UID** (not email)
6. Check for spaces/typos
7. Update `ml_alert_sender.py`:
```python
USER_ID = "PASTE_EXACT_UID_HERE"  # No spaces, exact copy
```

**Verify:**
```bash
python ml_alert_sender.py
# Should show your USER_ID correctly
```

---

### ❌ "Invalid ENDPOINT"

**Error:**
```
Error: Connection refused or 404 Not Found
```

**Solution:**
1. Firebase Console → **Functions**
2. Find `receiveMLAlert` function
3. Click on the function name
4. Copy exact **Trigger** URL
5. Update `ml_alert_sender.py`:
```python
ENDPOINT = "https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/receiveMLAlert"
```

**Verify:**
```bash
# Test endpoint with curl
curl -X POST YOUR_ENDPOINT -H 'Content-Type: application/json' -d '{}'
# Should return: {"error": "Missing required..."} (not 404)
```

---

### ❌ Python script won't run

**Error:**
```
ModuleNotFoundError: No module named 'requests'
```

**Solution:**
```bash
# Install requests library
pip install requests

# Or with pip3
pip3 install requests

# Verify installation
pip show requests

# Try script again
python ml_alert_sender.py
```

---

## Phase 3: FCM Token Issues

### ❌ "No FCM token registered"

**Error response:**
```json
{
  "error": "User has no FCM token registered"
}
```

**Solution:**
1. Open your React Native app on phone/tablet
2. Keep app open for 30 seconds (FCM token initialization)
3. Grant notification permissions when prompted
4. Check Firestore to verify token saved:
   - Firebase Console → Firestore
   - `users` collection
   - Click your user ID
   - Look for `fcmToken` field
5. If missing, reinstall app:
```bash
# Clear app cache
# Uninstall app
# Reinstall/rebuild app
# Accept all permissions
```

**Verify in code:**
Add temporary console log in dashboard.tsx:
```typescript
useEffect(() => {
  const token = await getExpoPushTokenAsync();
  console.log("FCM Token:", token);
}, []);
```

---

### ❌ "FCM token expired"

**Symptoms:**
- Worked before, stopped working
- Notifications not delivered

**Solution:**
```bash
# Restart the app
# This will refresh the FCM token

# Or check if token is stale in Firestore:
# Firebase Console → Firestore → users → {userID} → fcmToken

# If > 30 days old, clear and restart app
```

---

## Phase 4: Notification Issues

### ❌ "No notification received"

**Checklist:**
- [ ] App has notification permissions (check phone settings)
- [ ] App is running (foreground or background)
- [ ] FCM token exists in Firestore
- [ ] Cloud Function logs show success
- [ ] No errors in console

**Solution:**

```bash
# 1. Check Firebase Console logs
Firebase Console → Functions → Logs
# Look for your function execution

# 2. Verify alert was saved to Firestore
Firebase Console → Firestore → users → {userID} → mlAlerts
# Should see alert document

# 3. Check app permissions
Phone Settings → Apps → YourApp → Notifications
# Should be enabled

# 4. Restart app
# Sometimes helps with notification listeners

# 5. Restart phone
# As last resort
```

---

### ❌ "Notification received but alert not showing in app"

**Symptoms:**
- Notification banner appears
- But alert not in Alerts tab
- Or alert in Firestore but not visible

**Solution:**

1. **Reopen app:**
   - Close app completely
   - Wait 5 seconds
   - Reopen app
   - Check Alerts tab

2. **Check real-time listener:**
   - In `dashboard.tsx`, verify `listenToUserMLAlerts()` is active
   - Check browser console for errors
   - Look for logs like `"[Dashboard] ML Alerts updated: N"`

3. **Clear app cache:**
   ```bash
   # Close app
   # Phone Settings → Apps → YourApp → Storage → Clear Cache
   # Reopen app
   ```

4. **Check Firestore rules:**
   - Firebase Console → Firestore → Rules
   - Verify user can read from `mlAlerts` collection
   - Expected rule:
   ```
   allow read: if request.auth.uid == userId
   allow write: if request.auth.uid == userId
   ```

---

### ❌ "Notification delivered but can't tap it"

**Solution:**
1. Check if notification action is configured in app
2. Update `setupNotificationListeners()` in notifications.ts
3. Ensure notification handler is registered on app startup

---

## Phase 5: Data Issues

### ❌ "Alert in Firestore but not displaying correctly"

**Symptoms:**
- Alert appears but shows wrong info
- Device name shows "Unknown Device"
- Objects show as empty array

**Solution:**

Check your JSON payload:
```json
{
  "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",  // Must match device ID
  "userId": "YOUR_USER_ID",                            // Must be exact
  "deviceIdentifier": "LAPTOP-14678VIP",               // Optional but recommended
  "detectedObjects": ["person"],                       // Optional, use array
  "riskLabel": "high",                                 // Optional, valid: critical/high/medium/low
  "confidenceScore": 0.92                              // Optional, 0-1 range
}
```

**Verify each field:**
```bash
# Test with curl
curl -X POST YOUR_ENDPOINT \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "192b7a8c-972d-4429-ac28-4bc73e9a8809",
    "userId": "YOUR_USER_ID",
    "deviceIdentifier": "LAPTOP-14678VIP",
    "detectedObjects": ["person"],
    "riskLabel": "high",
    "confidenceScore": 0.92
  }'
```

---

### ❌ "Confidence score showing 0%"

**Issue:**
- Alert displays but confidence is always 0

**Solution:**
Check your JSON:
```python
# WRONG - confidence as percentage
"confidenceScore": 92  # ❌ Will show as 9200%

# CORRECT - confidence as decimal
"confidenceScore": 0.92  # ✓ Shows as 92%
```

---

### ❌ "Risk label color wrong"

**Issue:**
- Alert showing wrong color (e.g., yellow instead of red)

**Solution:**
Valid risk labels (case-insensitive):
```python
"riskLabel": "critical"  # 🔴 Red
"riskLabel": "high"      # 🟠 Orange
"riskLabel": "medium"    # 🟡 Yellow (default)
"riskLabel": "low"       # 🟢 Green
```

Use lowercase in JSON:
```json
{
  "riskLabel": "critical"  // ✓ Correct
  // NOT "Critical" or "CRITICAL"
}
```

---

## Phase 6: Performance Issues

### ❌ "Alert takes too long to appear"

**Normal timing:**
- Device → Function: < 500ms
- Firestore save: < 500ms
- Notification: < 1 second
- App display: < 2 seconds
- **Total: ~4 seconds max**

**If slower:**

1. Check network:
```bash
ping 8.8.8.8
# Should be < 100ms
```

2. Check FCM quota:
- Firebase Console → Cloud Messaging
- Check daily quota usage

3. Check Firestore metrics:
- Firebase Console → Firestore → Database Metrics
- Look for slow write times

4. Restart Cloud Function:
```bash
firebase deploy --only functions
```

---

### ❌ "Function execution timeout"

**Error:**
```
Error: 504 Timeout
```

**Solution:**
1. Check function logs for slow operations
2. Optimize Firestore queries
3. Reduce data size in payload
4. Increase function timeout (in functions/src/index.js)

---

## Phase 7: Testing Issues

### ❌ Python tests fail immediately

**Error:**
```
ConnectionError: Failed to establish connection
```

**Solution:**
```bash
# 1. Verify endpoint URL
python -c "import requests; print(requests.get('YOUR_ENDPOINT'))"

# 2. Check if endpoint is public (CORS enabled)
# Should return 405 Method Not Allowed (not Connection Error)

# 3. Verify network connectivity
ping google.com

# 4. Try with verbose output
python -u ml_alert_sender.py 2>&1 | tee test.log
```

---

### ❌ Test runs but "error: User not found"

**Error:**
```
❌ Error sending alert: User not found
```

**Solution:**
1. Verify USER_ID in Python script
2. Check user exists in Firebase Auth console
3. Make sure you copied the UID, not email
4. No spaces or special characters in UID

---

### ❌ Test sends but no notification

**Error:**
```
✅ Alert sent successfully!
[But no notification on phone]
```

**Solution:**

Check in order:
1. FCM token exists in Firestore
2. App has notification permissions
3. App is running (or background enabled)
4. Check Firebase Console → Cloud Messaging logs
5. Verify device ID matches
6. Verify user ID matches

---

## Phase 8: Batch Issues

### ❌ "Batch endpoint not working"

**Error:**
```
error: "Invalid alerts array"
```

**Solution:**
Correct format:
```json
{
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
}
```

---

## Quick Diagnosis Script

```bash
# Run this to check all components

echo "=== Checking Firebase CLI ==="
firebase --version

echo "=== Checking Python ==="
python --version

echo "=== Checking requests library ==="
python -c "import requests; print('requests OK')"

echo "=== Checking Cloud Function ==="
# Replace with your endpoint
curl -I https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/receiveMLAlert

echo "=== Checking Firestore connectivity ==="
# Go to Firebase Console and verify Firestore loads

echo "=== All checks complete ==="
```

---

## Common Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `User not found` | Wrong USER_ID | Copy exact UID from Firebase Auth |
| `No FCM token` | App didn't register | Open app, wait 30s, grant permissions |
| `Only POST allowed` | Used GET instead | Change to POST request |
| `Missing required` | Missing deviceId/userId | Check JSON payload |
| `Connection refused` | Invalid endpoint | Copy exact URL from Functions console |
| `404 Not Found` | Function not deployed | Run `firebase deploy --only functions` |
| `PERMISSION_DENIED` | Firestore rules issue | Check rules in Firestore console |
| `Network timeout` | Internet/firewall issue | Check connectivity, try again |

---

## Debug Logging

### Enable detailed logging in Python script:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# This will show all HTTP requests and responses
```

### Enable logging in dashboard.tsx:

```typescript
useEffect(() => {
  const unsubscribe = listenToUserMLAlerts((data) => {
    console.log("[DEBUG] ML Alerts updated:", data);  // Add this
    console.log("[DEBUG] Alert count:", data.length);  // Add this
    setMLAlerts(data);
  });
  return unsubscribe;
}, []);
```

### Check Firebase Functions logs:

```bash
# In terminal
firebase functions:log

# Or in Firebase Console
# → Functions → View Logs
```

---

## Getting Help

If stuck:

1. **Check logs:**
   - Firebase Console → Functions → Logs
   - Look for error messages

2. **Verify configuration:**
   - Correct USER_ID and ENDPOINT
   - Device registered in Firestore
   - Firebase rules configured

3. **Test individual components:**
   - Use cURL to test endpoint directly
   - Check Firestore has data
   - Verify app has permissions

4. **Search documentation:**
   - [ML_ALERT_IMPLEMENTATION_COMPLETE.md](ML_ALERT_IMPLEMENTATION_COMPLETE.md)
   - [ML_ALERT_PAYLOAD_EXAMPLES.md](ML_ALERT_PAYLOAD_EXAMPLES.md)
   - [ML_ALERT_VISUAL_GUIDE.md](ML_ALERT_VISUAL_GUIDE.md)

---

**Still having issues? Check the logs and configuration files above!**

