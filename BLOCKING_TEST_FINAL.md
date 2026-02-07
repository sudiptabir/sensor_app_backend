# 🚫 User Blocking - Final Test Instructions

## ✅ What's Been Fixed

1. **alert-api-server.js** - Removed duplicate code, blocking logic is clean
2. **rpi_send_alert.js** - Already using correct URL: `https://alert-api-production-dc04.up.railway.app/api/alerts`
3. **Railway deployment** - Service just redeployed with fixes

## 🧪 Test the Blocking NOW

### Step 1: Verify User is Blocked

```powershell
$env:PGPASSWORD='wFokJzbqkVDDOKQQVapQHOXzWlyPZIme'
psql -h centerbeam.proxy.rlwy.net -p 46434 -U postgres -d railway -c "SELECT user_id, is_active, reason, blocked_at FROM user_blocks WHERE user_id = 'GKu2p6uvarhEzrKG85D7fXbxUh23';"
```

**Expected output:**
```
user_id                      | is_active | reason  | blocked_at
GKu2p6uvarhEzrKG85D7fXbxUh23 | t         | testing | [timestamp]
```

### Step 2: Open Two Terminals

**Terminal 1 - Watch Railway Logs:**
```powershell
railway service alert-api
railway logs --follow
```

**Terminal 2 - Send Test Alert from Raspberry Pi:**

On your Raspberry Pi, run:
```bash
cd /path/to/Sensor_app
node rpi_send_alert.js
```

OR if you want to test from Windows (simulating the Pi):
```powershell
node rpi_send_alert.js
```

### Step 3: What You Should See

**✅ In Railway Logs (Terminal 1):**

```
🚨 Received alert: { deviceId: '3d49c55d-bbfd-4bd0-9663-8728d64743ac', type: 'Alert', risk: 'Low', objects: 'test, detection' }
👤 Device owner: GKu2p6uvarhEzrKG85D7fXbxUh23
🚫 User GKu2p6uvarhEzrKG85D7fXbxUh23 is BLOCKED: testing
🚫 Skipping alert storage for blocked user GKu2p6uvarhEzrKG85D7fXbxUh23: testing
🚫 Skipping notification for blocked user GKu2p6uvarhEzrKG85D7fXbxUh23: testing
```

**✅ In Alert Sender Output (Terminal 2):**

```
✅ Response Status: 200
✅ Alert sent successfully!
📋 Alert IDs: []  ← EMPTY because user is blocked!
👥 Users notified: 1
```

**✅ On Mobile Phone:**
- ❌ NO push notification received
- ❌ NO new alert in app
- ❌ NO alert in Firestore

## 🔓 Test Unblocking

### Step 1: Unblock the User

Go to admin portal and unblock user `GKu2p6uvarhEzrKG85D7fXbxUh23`

OR via database:
```powershell
$env:PGPASSWORD='wFokJzbqkVDDOKQQVapQHOXzWlyPZIme'
psql -h centerbeam.proxy.rlwy.net -p 46434 -U postgres -d railway -c "UPDATE user_blocks SET is_active = false WHERE user_id = 'GKu2p6uvarhEzrKG85D7fXbxUh23';"
```

### Step 2: Send Another Alert

```bash
node rpi_send_alert.js
```

### Step 3: What You Should See

**✅ In Railway Logs:**

```
🚨 Received alert: { deviceId: '3d49c55d-bbfd-4bd0-9663-8728d64743ac', ... }
👤 Device owner: GKu2p6uvarhEzrKG85D7fXbxUh23
💾 Alert stored in Firestore: [alertId]
📱 Push notification sent: { status: 'ok', id: '[pushId]' }
```

**✅ In Alert Sender Output:**

```
✅ Response Status: 200
✅ Alert sent successfully!
📋 Alert IDs: ["abc123xyz"]  ← Has alert ID!
👥 Users notified: 1
```

**✅ On Mobile Phone:**
- ✅ Push notification received
- ✅ Alert appears in app
- ✅ Alert stored in Firestore

## 🐛 Troubleshooting

### If you still get alerts when blocked:

1. **Check if Raspberry Pi is using the correct script:**
   ```bash
   # On Raspberry Pi
   cat rpi_send_alert.js | grep RAILWAY_API_URL
   ```
   Should show: `https://alert-api-production-dc04.up.railway.app/api/alerts`

2. **Check Railway service is running:**
   ```powershell
   curl https://alert-api-production-dc04.up.railway.app/health -UseBasicParsing
   ```
   Should return: `{"status":"healthy","firebase":true}`

3. **Check device ownership in Firestore:**
   - Go to Firebase Console
   - Navigate to Firestore
   - Check `devices/3d49c55d-bbfd-4bd0-9663-8728d64743ac`
   - Verify `userId` field matches `GKu2p6uvarhEzrKG85D7fXbxUh23`

4. **Check Railway logs for errors:**
   ```powershell
   railway service alert-api
   railway logs --tail 200
   ```

### If logs show nothing:

This means the alert is NOT reaching the alert-api service. Check:

1. **Is Raspberry Pi using old URL?**
   - Old (wrong): `https://web-production-07eda.up.railway.app/api/alerts`
   - New (correct): `https://alert-api-production-dc04.up.railway.app/api/alerts`

2. **Update the script on Raspberry Pi:**
   ```bash
   # On Raspberry Pi
   cd /path/to/Sensor_app
   git pull
   # OR manually edit rpi_send_alert.js line 13
   ```

## 📊 Quick Status Check

```powershell
# Check service health
curl https://alert-api-production-dc04.up.railway.app/health -UseBasicParsing

# Check if user is blocked
$env:PGPASSWORD='wFokJzbqkVDDOKQQVapQHOXzWlyPZIme'
psql -h centerbeam.proxy.rlwy.net -p 46434 -U postgres -d railway -c "SELECT * FROM user_blocks WHERE is_active = true;"

# Watch logs in real-time
railway service alert-api
railway logs --follow
```

## 🎯 Expected Results Summary

| Scenario | Push Notification | Alert in App | Alert in Firestore | Railway Logs |
|----------|-------------------|--------------|-------------------|--------------|
| User Blocked | ❌ No | ❌ No | ❌ No | 🚫 Skipping... |
| User Not Blocked | ✅ Yes | ✅ Yes | ✅ Yes | 📱 Sent... |
| Wrong URL | ❌ No | ❌ No | ❌ No | (no logs) |

---

## 🚀 Ready to Test!

1. Open Terminal 1: `railway service alert-api ; railway logs --follow`
2. Open Terminal 2: `node rpi_send_alert.js` (on Raspberry Pi or Windows)
3. Watch the logs and verify blocking works
4. Check your phone - should NOT receive notification
5. Unblock user and test again - should receive notification

**The fix is deployed and ready. Run the test now!**
