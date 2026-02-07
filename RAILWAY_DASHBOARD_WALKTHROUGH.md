# Railway Dashboard Walkthrough - Deploy Alert API Server

## Step-by-Step Visual Guide

### Step 1: Open Railway Dashboard

1. Open your browser
2. Go to: **https://railway.app/dashboard**
3. You should see your projects list
4. Click on project: **"joyful-rebirth"**

---

### Step 2: View Current Services

You should see your current services:
- **Postgres** (database)
- **web** (your main backend)
- Maybe **sensor_app_backend** (admin portal)

---

### Step 3: Create New Service

**Look for the "+ New" button** (usually purple/blue, top right area)

Click **"+ New"** and you'll see options:
- Empty Service
- Database
- **GitHub Repo** ← Click this one
- Template

---

### Step 4: Connect GitHub Repository

After clicking "GitHub Repo":

1. You'll see a list of your GitHub repositories
2. Find and click: **"sensor_app_backend"** (or whatever your repo is named)
3. Railway will ask: "Configure Service"
4. Click **"Add variables"** or **"Deploy"**

Railway will automatically:
- Detect it's a Node.js project
- Install dependencies from `package.json`
- Try to start the service

---

### Step 5: Configure Service Name

The new service will be created with a default name like "sensor-app-backend"

**To rename it:**
1. Click on the new service card
2. Click **"Settings"** tab (left sidebar)
3. Under **"Service Name"**, change it to: **`alert-api`**
4. Click outside the field to save

---

### Step 6: Set Start Command

Still in **Settings**:

1. Scroll down to **"Deploy"** section
2. Find **"Custom Start Command"**
3. Enter: **`node alert-api-server.js`**
4. Railway will save automatically

---

### Step 7: Add Environment Variables

Click **"Variables"** tab (left sidebar)

You'll see a button **"+ New Variable"** or **"RAW Editor"**

**Option A: Add One by One**

Click **"+ New Variable"** for each:

```
Variable Name: DATABASE_URL
Value: postgresql://postgres:wFokJzbqkVDDOKQQVapQHOXzWlyPZIme@centerbeam.proxy.rlwy.net:46434/railway
```

```
Variable Name: NODE_ENV
Value: production
```

```
Variable Name: FIREBASE_PROJECT_ID
Value: sensor-app-2a69b
```

**Option B: Use RAW Editor (Faster)**

1. Click **"RAW Editor"** button
2. Paste all variables at once:

```
DATABASE_URL=postgresql://postgres:wFokJzbqkVDDOKQQVapQHOXzWlyPZIme@centerbeam.proxy.rlwy.net:46434/railway
NODE_ENV=production
FIREBASE_PROJECT_ID=sensor-app-2a69b
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@sensor-app-2a69b.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n
```

3. Click **"Update Variables"**

---

### Step 8: Copy Variables from Existing Service

**To copy Firebase variables from your "web" service:**

1. Click on your **"web"** service card
2. Click **"Variables"** tab
3. Click **"RAW Editor"**
4. **Copy** the Firebase variables:
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PROJECT_ID`
   - Any other Firebase variables

5. Go back to your **"alert-api"** service
6. Click **"Variables"** tab
7. Click **"RAW Editor"**
8. **Paste** the copied variables
9. Click **"Update Variables"**

---

### Step 9: Trigger Deployment

After adding variables, Railway will automatically redeploy.

**To manually trigger deployment:**
1. Click **"Deployments"** tab (left sidebar)
2. Click **"Deploy"** button (top right)
3. Or click the three dots ⋮ on latest deployment → **"Redeploy"**

---

### Step 10: Generate Public URL

Your service needs a public URL to receive alerts:

1. Click **"Settings"** tab
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"** button
4. Railway will create a URL like: `https://alert-api-production-xxxx.up.railway.app`
5. **Copy this URL** - you'll need it for your ML alert sender

---

### Step 11: Check Deployment Status

Click **"Deployments"** tab:

You'll see:
- **Building** (installing dependencies)
- **Deploying** (starting the service)
- **Active** ✓ (service is running)

If it shows **"Crashed"** or **"Failed"**:
- Click on the deployment
- Check the **"Build Logs"** and **"Deploy Logs"**
- Look for error messages

---

### Step 12: View Logs

Click **"Logs"** tab (left sidebar)

You should see:
```
✅ Firebase Admin SDK initialized
🔌 PostgreSQL connection initialized for user blocking checks
🚨 Alert API Backend Server - Railway Deployment
🚀 Server running on port 3001
```

If you see errors, check:
- Environment variables are set correctly
- `DATABASE_URL` is correct
- Firebase credentials are valid

---

### Step 13: Test the Service

**Method 1: Browser**
Open: `https://your-alert-api-url.railway.app/health`

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2024-02-05T...",
  "firebase": true
}
```

**Method 2: PowerShell**
```powershell
curl https://your-alert-api-url.railway.app/health
```

**Method 3: Test Alert Endpoint**
```powershell
$body = @{
    deviceId = "test-device-123"
    alert = @{
        device_identifier = "Test Device"
        notification_type = "ml_detection"
        detected_objects = @("person", "car")
        risk_label = "medium"
        predicted_risk = 0.75
        description = @("Test alert")
        timestamp = (Get-Date).ToString("o")
        model_version = "1.0"
        confidence_score = 0.85
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "https://your-alert-api-url.railway.app/api/alerts" -Method Post -Body $body -ContentType "application/json"
```

---

## Visual Reference

### Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  Railway Dashboard                        [+ New]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Project: joyful-rebirth                           │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Postgres │  │   web    │  │alert-api │        │
│  │          │  │          │  │          │        │
│  │ Active ✓ │  │ Active ✓ │  │ Active ✓ │        │
│  └──────────┘  └──────────┘  └──────────┘        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Service View (when you click on alert-api)

```
┌─────────────────────────────────────────────────────┐
│  alert-api                              [Settings]  │
├─────────────────────────────────────────────────────┤
│  Sidebar:                                          │
│  • Deployments                                     │
│  • Logs                                            │
│  • Metrics                                         │
│  • Variables                                       │
│  • Settings                                        │
│                                                     │
│  Main Area:                                        │
│  [Shows logs, deployments, or settings]           │
└─────────────────────────────────────────────────────┘
```

---

## Troubleshooting Common Issues

### Issue 1: Service Keeps Crashing

**Check Logs:**
1. Click service → **"Logs"** tab
2. Look for error messages

**Common causes:**
- Missing environment variables
- Wrong start command
- Module not found (missing in package.json)

**Fix:**
- Add missing variables in **"Variables"** tab
- Update start command in **"Settings"** → **"Deploy"**
- Check `package.json` has all dependencies

---

### Issue 2: Can't Find Service After Creation

**Solution:**
1. Go back to project dashboard
2. Look for service with name like "sensor-app-backend"
3. Rename it to "alert-api" in Settings

---

### Issue 3: Build Fails

**Check Build Logs:**
1. Click **"Deployments"** tab
2. Click on failed deployment
3. Check **"Build Logs"**

**Common causes:**
- `package.json` not found
- npm install fails
- Node version mismatch

**Fix:**
- Make sure `package.json` is in root directory
- Check Node version in Settings → "Environment"

---

### Issue 4: Firebase Initialization Failed

**Check:**
1. **"Variables"** tab
2. Verify these are set:
   - `FIREBASE_PRIVATE_KEY` (with `\n` for newlines)
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PROJECT_ID`

**Fix:**
- Copy exact values from working "web" service
- Make sure private key has `\n` characters (not actual newlines)

---

### Issue 5: Database Connection Failed

**Check:**
1. `DATABASE_URL` is set correctly
2. PostgreSQL service is running (should show "Active ✓")

**Fix:**
- Copy `DATABASE_URL` from "web" service
- Or get it from Postgres service → "Connect" tab

---

## After Deployment Checklist

- [ ] Service shows "Active ✓" status
- [ ] Public URL generated
- [ ] Health endpoint returns `{"status": "healthy"}`
- [ ] Logs show "Firebase initialized"
- [ ] Logs show "PostgreSQL connection initialized"
- [ ] No error messages in logs
- [ ] Test alert endpoint works
- [ ] Update ML alert sender with new URL

---

## Next Steps

1. **Update ML Alert Sender**
   - Change URL to: `https://your-alert-api-url.railway.app/api/alerts`

2. **Test Blocking**
   - Block a user in admin portal
   - Send test alert
   - Verify user doesn't receive notification
   - Check logs for: `🚫 Skipping notification for blocked user`

3. **Monitor**
   - Check logs regularly
   - Monitor for errors
   - Verify alerts are being delivered

---

## Quick Reference

| Action | Location |
|--------|----------|
| View logs | Service → Logs tab |
| Add variables | Service → Variables tab |
| Change start command | Service → Settings → Deploy |
| Generate URL | Service → Settings → Networking |
| Redeploy | Service → Deployments → Deploy button |
| Copy variables | Service → Variables → RAW Editor |
| Check status | Project dashboard (service cards) |

---

## Support

If you get stuck:
1. Check the logs first
2. Verify all environment variables are set
3. Compare with working "web" service configuration
4. Check Railway status page: https://status.railway.app/

---

**You're all set! Follow these steps and your Alert API will be deployed to Railway.** 🚀
