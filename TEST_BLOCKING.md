# Test User Blocking - Final Steps

## Current Status
✅ alert-api service is deployed and running
✅ Firebase initialized
✅ PostgreSQL connected
✅ User `GKu2p6uvarhEzrKG85D7fXbxUh23` is blocked in database
✅ Service has blocking code with getUsersForDevice function

## Test the Blocking

### Step 1: Open Two Terminal Windows

**Terminal 1 - Watch Railway Logs:**
```powershell
railway service alert-api
railway logs --follow
```

**Terminal 2 - Send Test Alert:**
```powershell
node rpi_send_alert.js
```

### Step 2: What to Look For

**In Railway Logs (Terminal 1), you should see:**

```
🚨 Received alert: { deviceId: '3d49c55d-bbfd-4bd0-9663-8728d64743ac', ... }
👤 Device owner: GKu2p6uvarhEzrKG85D7fXbxUh23
🚫 User GKu2p6uvarhEzrKG85D7fXbxUh23 is BLOCKED: testing
🚫 Skipping alert storage for blocked user GKu2p6uvarhEzrKG85D7fXbxUh23: testing
🚫 Skipping notification for blocked user GKu2p6uvarhEzrKG85D7fXbxUh23: testing
```

**In Alert Sender Output (Terminal 2):**

```
✅ Response Status: 200
✅ Alert sent successfully!
📋 Alert IDs: []  ← Empty because user is blocked!
👥 Users notified: 1  ← But notification was skipped
```

### Step 3: Verify in Mobile App

**Blocked user should NOT:**
- ❌ Receive push notification
- ❌ See new alert in app
- ❌ Have alert in Firestore collection

### Step 4: Test Unblocking

**Unblock the user in admin portal:**
1. Go to admin portal
2. Find user `GKu2p6uvarhEzrKG85D7fXbxUh23`
3. Click "Unblock"

**Send another alert:**
```powershell
node rpi_send_alert.js
```

**Now the user SHOULD:**
- ✅ Receive push notification
- ✅ See alert in mobile app
- ✅ Have alert stored in Firestore

## Troubleshooting

### If blocking doesn't work:

1. **Check database:**
```powershell
$env:PGPASSWORD='wFokJzbqkVDDOKQQVapQHOXzWlyPZIme'
psql -h centerbeam.proxy.rlwy.net -p 46434 -U postgres -d railway -c "SELECT * FROM user_blocks WHERE user_id = 'GKu2p6uvarhEzrKG85D7fXbxUh23';"
```

Should show: `is_active = t`

2. **Check device ownership:**
```powershell
# In Railway logs, look for:
👤 Device owner: [userId]
```

Make sure the userId matches the blocked user.

3. **Check logs for errors:**
```powershell
railway logs --tail 100
```

Look for any error messages.

## Quick Test Commands

```powershell
# Terminal 1 - Watch logs
railway service alert-api ; railway logs --follow

# Terminal 2 - Send alert
node rpi_send_alert.js

# Check if user is blocked
$env:PGPASSWORD='wFokJzbqkVDDOKQQVapQHOXzWlyPZIme' ; psql -h centerbeam.proxy.rlwy.net -p 46434 -U postgres -d railway -c "SELECT user_id, is_active, reason FROM user_blocks;"

# Check service health
curl https://alert-api-production-dc04.up.railway.app/health -UseBasicParsing
```

## Expected Behavior Summary

| User Status | Push Notification | Alert in App | Alert in Firestore | Logs Show |
|-------------|-------------------|--------------|-------------------|-----------|
| Blocked     | ❌ No             | ❌ No        | ❌ No             | 🚫 Skipping... |
| Not Blocked | ✅ Yes            | ✅ Yes       | ✅ Yes            | 📱 Sent... |

---

**Ready to test!** Run the commands above and let me know what you see in the logs.
