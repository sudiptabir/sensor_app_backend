# Fix Alert-API Service - Quick Guide

## Problem
The alert-api service is running `sensor-backend.js` instead of `alert-api-server.js`, so blocking doesn't work.

## Solution: Update Start Command in Railway Dashboard

### Step 1: Go to Service Settings
1. Open: https://railway.app/dashboard
2. Click project: **joyful-rebirth**
3. Click service: **alert-api**
4. Click **Settings** tab (left sidebar)

### Step 2: Update Start Command
1. Scroll down to **"Deploy"** section
2. Find **"Custom Start Command"** field
3. Enter: **`node alert-api-server.js`**
4. Railway will auto-save

### Step 3: Redeploy
1. Click **"Deployments"** tab (left sidebar)
2. Click **"Deploy"** button (top right)
3. Wait for deployment to complete (~1-2 minutes)

### Step 4: Verify
Check logs should show:
```
🔌 PostgreSQL connection initialized for user blocking checks
✅ Firebase Admin SDK initialized
🚨 Alert API Backend Server
🚀 Server running on port 3001
```

Test health endpoint:
```powershell
curl https://alert-api-production-dc04.up.railway.app/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "firebase": true
}
```

## Alternative: Use Railway CLI

```powershell
railway service alert-api
railway logs
```

If you see it's running wrong file, manually redeploy from dashboard.

## After Fix

1. **Test blocking**:
   - Block user in admin portal
   - Run: `node rpi_send_alert.js`
   - User should NOT receive notification
   - Check logs for: `🚫 Skipping notification for blocked user`

2. **Update complete!**
   - `rpi_send_alert.js` now points to: `https://alert-api-production-dc04.up.railway.app/api/alerts`
   - This service has blocking code
   - Blocked users won't receive alerts
