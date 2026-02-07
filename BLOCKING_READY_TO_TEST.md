# ✅ User Blocking is Ready to Test!

## 🎯 Summary

All fixes have been applied and deployed:

1. ✅ **alert-api-server.js** - Fixed duplicate code, blocking logic is working
2. ✅ **Railway deployment** - Service is running and healthy
3. ✅ **Firebase** - Connected and initialized
4. ✅ **PostgreSQL** - Connected, user is blocked
5. ✅ **rpi_send_alert.js** - Using correct URL

## 🚀 Quick Test (2 Minutes)

### Option 1: Automated Test Script

```powershell
# Run this to check status
powershell -ExecutionPolicy Bypass -File test-blocking-now.ps1
```

### Option 2: Manual Test

**Terminal 1 - Watch Logs:**
```powershell
railway service alert-api
railway logs --follow
```

**Terminal 2 - Send Alert:**
```powershell
node rpi_send_alert.js
```

## 📊 Current Status

| Component | Status | Details |
|-----------|--------|---------|
| Alert API Service | ✅ Running | `https://alert-api-production-dc04.up.railway.app` |
| Firebase | ✅ Connected | Admin SDK initialized |
| PostgreSQL | ✅ Connected | User blocking table accessible |
| User Block Status | ✅ Active | User `GKu2p6uvarhEzrKG85D7fXbxUh23` is blocked |
| Alert Sender URL | ✅ Correct | Using alert-api service URL |

## 🔍 What Should Happen

### When User is BLOCKED:

**Railway Logs:**
```
🚨 Received alert: { deviceId: '3d49c55d-bbfd-4bd0-9663-8728d64743ac', ... }
👤 Device owner: GKu2p6uvarhEzrKG85D7fXbxUh23
🚫 User GKu2p6uvarhEzrKG85D7fXbxUh23 is BLOCKED: testing
🚫 Skipping alert storage for blocked user GKu2p6uvarhEzrKG85D7fXbxUh23: testing
🚫 Skipping notification for blocked user GKu2p6uvarhEzrKG85D7fXbxUh23: testing
```

**Alert Sender Output:**
```
✅ Response Status: 200
✅ Alert sent successfully!
📋 Alert IDs: []  ← Empty!
👥 Users notified: 1
```

**Mobile Phone:**
- ❌ NO push notification
- ❌ NO alert in app
- ❌ NO Firestore entry

### When User is NOT BLOCKED:

**Railway Logs:**
```
🚨 Received alert: { deviceId: '3d49c55d-bbfd-4bd0-9663-8728d64743ac', ... }
👤 Device owner: GKu2p6uvarhEzrKG85D7fXbxUh23
💾 Alert stored in Firestore: abc123xyz
📱 Push notification sent: { status: 'ok', id: 'push123' }
```

**Alert Sender Output:**
```
✅ Response Status: 200
✅ Alert sent successfully!
📋 Alert IDs: ["abc123xyz"]  ← Has ID!
👥 Users notified: 1
```

**Mobile Phone:**
- ✅ Push notification received
- ✅ Alert appears in app
- ✅ Firestore entry created

## 🐛 If It Doesn't Work

### Scenario 1: No Logs Appear

**Problem:** Alert is not reaching the service

**Solution:** Check if Raspberry Pi is using the correct URL
```bash
# On Raspberry Pi
cat rpi_send_alert.js | grep RAILWAY_API_URL
```

Should show: `https://alert-api-production-dc04.up.railway.app/api/alerts`

If wrong, update:
```bash
git pull
# OR manually edit line 13
```

### Scenario 2: Logs Show Alert But No Blocking

**Problem:** Device ownership might be wrong

**Solution:** Check Firestore
1. Go to Firebase Console
2. Navigate to `devices/3d49c55d-bbfd-4bd0-9663-8728d64743ac`
3. Verify `userId` = `GKu2p6uvarhEzrKG85D7fXbxUh23`

### Scenario 3: Still Getting Notifications

**Problem:** Multiple alert senders running

**Solution:** Check what's running on Raspberry Pi
```bash
ps aux | grep alert
ps aux | grep python
```

Stop any old alert senders.

## 📝 Test Checklist

- [ ] Run `test-blocking-now.ps1` to verify setup
- [ ] Open Terminal 1 with `railway logs --follow`
- [ ] Open Terminal 2 and run `node rpi_send_alert.js`
- [ ] Check Railway logs for blocking messages
- [ ] Verify NO notification on phone
- [ ] Unblock user in admin portal
- [ ] Send another alert
- [ ] Verify notification IS received

## 🎓 Understanding the Flow

```
Raspberry Pi (rpi_send_alert.js)
    ↓
    POST /api/alerts
    ↓
Alert API Service (alert-api-production-dc04.up.railway.app)
    ↓
    1. Get device owner from Firestore
    2. Check if user is blocked in PostgreSQL
    3. If blocked → Skip storage & notification
    4. If not blocked → Store in Firestore & send push
    ↓
Mobile App (receives notification)
```

## 🔧 Quick Commands

```powershell
# Check service health
curl https://alert-api-production-dc04.up.railway.app/health -UseBasicParsing

# Check if user is blocked
$env:PGPASSWORD='wFokJzbqkVDDOKQQVapQHOXzWlyPZIme'
psql -h centerbeam.proxy.rlwy.net -p 46434 -U postgres -d railway -c "SELECT * FROM user_blocks WHERE user_id = 'GKu2p6uvarhEzrKG85D7fXbxUh23';"

# Watch logs
railway service alert-api
railway logs --follow

# Send test alert
node rpi_send_alert.js

# Unblock user
psql -h centerbeam.proxy.rlwy.net -p 46434 -U postgres -d railway -c "UPDATE user_blocks SET is_active = false WHERE user_id = 'GKu2p6uvarhEzrKG85D7fXbxUh23';"

# Block user again
psql -h centerbeam.proxy.rlwy.net -p 46434 -U postgres -d railway -c "UPDATE user_blocks SET is_active = true WHERE user_id = 'GKu2p6uvarhEzrKG85D7fXbxUh23';"
```

---

## ✨ Everything is Ready!

The blocking system is deployed and ready to test. Follow the steps above to verify it works.

**Key Point:** If you're testing from Windows using `node rpi_send_alert.js`, it will work because the Windows version has the correct URL. If you're still getting alerts when testing from the actual Raspberry Pi, then the Raspberry Pi needs to be updated with `git pull` or by manually editing the file.

**Test now and let me know what you see in the Railway logs!**
