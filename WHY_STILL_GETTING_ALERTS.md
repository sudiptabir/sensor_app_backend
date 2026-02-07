# 🤔 Why Am I Still Getting Alerts?

## The Problem

You blocked user `GKu2p6uvarhEzrKG85D7fXbxUh23` in the admin portal, but they're still receiving push notifications.

## The Root Cause

There are **TWO** possible reasons:

### Reason 1: Raspberry Pi Has Old Code ⚠️ MOST LIKELY

Your **Windows computer** has the updated `rpi_send_alert.js` with the correct URL, but your **Raspberry Pi** might still have the old version.

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR SETUP                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Windows Computer (Updated)                                 │
│  └─ rpi_send_alert.js                                       │
│     └─ URL: alert-api-production-dc04.up.railway.app ✅     │
│        └─ HAS blocking code                                 │
│                                                              │
│  Raspberry Pi (Might be OLD)                                │
│  └─ rpi_send_alert.js                                       │
│     └─ URL: web-production-07eda.up.railway.app ❌          │
│        └─ NO blocking code                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**The Fix:**
```bash
# On Raspberry Pi
cd /path/to/Sensor_app
git pull
```

### Reason 2: Multiple Alert Senders Running

You might have multiple scripts sending alerts:

```
Raspberry Pi Running:
├─ rpi_send_alert.js (Node.js) ← Using new URL with blocking
├─ rpi_send_alert.py (Python) ← Using old URL without blocking
├─ ml_alert_sender.py (ML model) ← Using old URL without blocking
└─ Some cron job ← Unknown URL
```

**The Fix:**
```bash
# On Raspberry Pi
ps aux | grep alert
ps aux | grep python
# Kill any old alert senders
```

## How to Diagnose

### Test 1: Send Alert from Windows

```powershell
# Terminal 1
railway service alert-api
railway logs --follow

# Terminal 2
node rpi_send_alert.js
```

**If you see blocking logs:**
```
🚫 User GKu2p6uvarhEzrKG85D7fXbxUh23 is BLOCKED: testing
```
✅ **Windows version works!** The problem is on Raspberry Pi.

**If you see NO logs:**
❌ **Service issue.** Check Railway deployment.

### Test 2: Check Raspberry Pi Script

```bash
# On Raspberry Pi
cat rpi_send_alert.js | grep RAILWAY_API_URL
```

**Should show:**
```javascript
const RAILWAY_API_URL = "https://alert-api-production-dc04.up.railway.app/api/alerts";
```

**If it shows:**
```javascript
const RAILWAY_API_URL = "https://web-production-07eda.up.railway.app/api/alerts";
```
❌ **This is the problem!** Update the script.

## The Complete Flow

### ✅ CORRECT Flow (With Blocking)

```
Raspberry Pi
    ↓
    rpi_send_alert.js
    ↓
    POST https://alert-api-production-dc04.up.railway.app/api/alerts
    ↓
Alert API Service
    ↓
    1. Get device owner: GKu2p6uvarhEzrKG85D7fXbxUh23
    2. Check PostgreSQL: Is user blocked? YES
    3. Skip storage ❌
    4. Skip notification ❌
    ↓
Mobile App: NO notification ✅
```

### ❌ WRONG Flow (Without Blocking)

```
Raspberry Pi
    ↓
    rpi_send_alert.js (OLD VERSION)
    ↓
    POST https://web-production-07eda.up.railway.app/api/alerts
    ↓
Web Service (sensor-backend-combined.js)
    ↓
    1. No blocking check
    2. Store in Firestore ✅
    3. Send notification ✅
    ↓
Mobile App: Receives notification ❌ (BAD!)
```

## Quick Fix Steps

### Step 1: Update Raspberry Pi

```bash
# SSH into Raspberry Pi
ssh pi@raspberrypi.local

# Navigate to project
cd /path/to/Sensor_app

# Pull latest code
git pull

# Verify URL is correct
cat rpi_send_alert.js | grep RAILWAY_API_URL
```

### Step 2: Test from Raspberry Pi

```bash
# On Raspberry Pi
node rpi_send_alert.js
```

### Step 3: Watch Railway Logs

```powershell
# On Windows
railway service alert-api
railway logs --follow
```

**You should see:**
```
🚨 Received alert: ...
👤 Device owner: GKu2p6uvarhEzrKG85D7fXbxUh23
🚫 User GKu2p6uvarhEzrKG85D7fXbxUh23 is BLOCKED: testing
🚫 Skipping alert storage...
🚫 Skipping notification...
```

### Step 4: Verify on Phone

- ❌ NO push notification
- ❌ NO alert in app

## Alternative: Manual Update

If `git pull` doesn't work, manually update the file:

```bash
# On Raspberry Pi
nano rpi_send_alert.js

# Find line 13:
# const RAILWAY_API_URL = "https://web-production-07eda.up.railway.app/api/alerts";

# Change to:
# const RAILWAY_API_URL = "https://alert-api-production-dc04.up.railway.app/api/alerts";

# Save: Ctrl+X, Y, Enter
```

## Verification Checklist

- [ ] Windows test shows blocking in logs
- [ ] Raspberry Pi has correct URL in script
- [ ] No old alert senders running on Pi
- [ ] Railway logs show blocking messages
- [ ] Mobile app does NOT receive notification
- [ ] User is blocked in database

## Still Not Working?

If you've done all the above and still getting alerts, check:

1. **Device ownership in Firestore:**
   - Device `3d49c55d-bbfd-4bd0-9663-8728d64743ac`
   - Should have `userId: GKu2p6uvarhEzrKG85D7fXbxUh23`

2. **User block status in database:**
   ```powershell
   $env:PGPASSWORD='wFokJzbqkVDDOKQQVapQHOXzWlyPZIme'
   psql -h centerbeam.proxy.rlwy.net -p 46434 -U postgres -d railway -c "SELECT * FROM user_blocks WHERE user_id = 'GKu2p6uvarhEzrKG85D7fXbxUh23';"
   ```
   Should show: `is_active = t`

3. **Railway service is running:**
   ```powershell
   curl https://alert-api-production-dc04.up.railway.app/health -UseBasicParsing
   ```
   Should return: `{"status":"healthy","firebase":true}`

---

## 🎯 Bottom Line

**Most likely:** Your Raspberry Pi has the old version of `rpi_send_alert.js` that's using the old URL without blocking code.

**Solution:** Run `git pull` on the Raspberry Pi or manually update the URL in the script.

**Test:** Send an alert and watch the Railway logs. If you see blocking messages, it's working!
