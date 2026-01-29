# Admin Portal Deployment Fix - Railway

## Problem
The admin portal is **not deployed to Railway**. The URL you're trying to access (`https://sensorappbackend-production.up.railway.app/`) is the **sensor backend**, not the admin portal. They are two separate services.

---

## Solution: Deploy Admin Portal to Railway

### Option A: Deploy to Same Railway Project (Recommended)

#### Step 1: Check Your Current Railway Setup

First, check if your admin portal is already in a Railway service:

```bash
cd admin-portal
railway link  # This will show your project if linked
```

If you see a project ID, you're linked. If not, continue below.

#### Step 2: Add Admin Portal Service to Existing Railway Project

```bash
# From your workspace root
cd admin-portal

# Link to your existing Railway project
railway link
# Select: Your existing sensor-app-production project

# Set root directory to admin-portal
railway service add --rootDirectory admin-portal
```

#### Step 3: Configure Environment Variables in Railway Dashboard

Go to **Railway Dashboard** → Your **sensor-app-production** project → **Services** → **admin-portal** → **Variables**

Add these environment variables:

```env
# Use the same PostgreSQL as sensor backend
DATABASE_URL=${DATABASE_URL}

# Firebase Configuration
FIREBASE_DATABASE_URL=https://sensor-app-2a69b.firebaseio.com

# Paste your entire Firebase service account JSON as one line
# Get this from your serviceAccountKey.json
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"sensor-app-2a69b",...}

# Security
NODE_ENV=production
PORT=4000
SESSION_SECRET=your-long-random-secret-32-chars-here
API_KEY=test-api-key-123
SETUP_KEY=setup123

# Admin Portal URL (Railway will provide this)
ADMIN_PORTAL_URL=https://your-admin-portal-url.railway.app
```

#### Step 4: Deploy the Admin Portal

```bash
# From admin-portal directory
railway up
```

Or deploy from Railway dashboard:
- Push to GitHub
- Railway will auto-deploy

---

### Option B: Deploy to New Separate Railway Project

If you prefer the admin portal in a separate project:

```bash
cd admin-portal

# Create new Railway project
railway init

# Configure variables (same as above)
railway variables set NODE_ENV production
railway variables set PORT 4000
railway variables set SESSION_SECRET your-secret-here
# ... set all other variables

# Deploy
railway up
```

---

## Step 5: Get Your Admin Portal URL

After deployment, Railway provides a URL like:
- `https://admin-portal-production.railway.app` (if separate project)
- Or check your Railway dashboard for the actual URL

Update your `.env` files with this URL.

---

## Step 6: Create the First Admin User

Once deployed, create your admin account:

```bash
ADMIN_PORTAL_URL="https://your-admin-portal.railway.app"
SETUP_KEY="setup123"  # From your env vars

curl -X POST ${ADMIN_PORTAL_URL}/api/setup/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "YourSecurePassword123!",
    "fullName": "Admin User",
    "setupKey": "'${SETUP_KEY}'"
  }'
```

---

## Step 7: Test Your Admin Portal

1. Open browser: `https://your-admin-portal.railway.app/login`
2. Login with: 
   - Email: `admin@example.com`
   - Password: `YourSecurePassword123!`
3. You should see the dashboard

---

## If Admin Portal Still Doesn't Load

### Check 1: Verify Database Connection

```bash
# Test the connection
curl https://your-admin-portal.railway.app/health
```

Should return: `{"status":"ok","service":"admin-portal"}`

### Check 2: Check Railway Logs

In Railway Dashboard:
1. Go to admin-portal service
2. Click "Logs"
3. Look for error messages

### Check 3: Common Issues

**Issue: "Database connection failed"**
- Ensure `DATABASE_URL` is set in admin-portal service
- It should be the same as the backend's

**Issue: "Cannot find module"**
- Run `npm install` in admin-portal directory
- Make sure `node_modules` is committed or rebuild is triggered

**Issue: "Firebase errors"**
- Verify `FIREBASE_SERVICE_ACCOUNT` is the full JSON object
- Check `FIREBASE_DATABASE_URL` matches your Firebase project

**Issue: Firebase service account JSON too long**
- In Railway, select "Raw Editor" for Variables
- Paste the full JSON as-is (including newlines)

---

## Step 8: Link Sensor Backend to Admin Portal

Update your sensor backend's environment variables:

In Railway **sensor-backend** service → **Variables**:

```env
ADMIN_PORTAL_URL=https://your-admin-portal.railway.app
API_KEY=test-api-key-123  # Must match admin-portal's API_KEY
```

---

## Architecture After Fix

```
┌─────────────────────────────────────┐
│      Railway Project                │
├─────────────────────────────────────┤
│                                     │
│  Service 1: sensor-backend          │
│  ├─ URL: sensor-app-backend.*.app   │
│  ├─ Port: 3000                      │
│  └─ Database: PostgreSQL ────┐      │
│                              │      │
│  Service 2: admin-portal     │      │
│  ├─ URL: admin-portal.*.app  │      │
│  ├─ Port: 4000               │      │
│  └─ Database: PostgreSQL ─────      │
│                                     │
└─────────────────────────────────────┘
```

---

## Next Steps

After fixing the admin portal deployment:

1. ✅ Admin portal loads at `https://your-admin-portal.railway.app/login`
2. ✅ Backend can access admin portal for access control checks
3. ✅ Create additional admin users as needed
4. ✅ Configure device and user access permissions
5. ✅ Test end-to-end mobile app → backend → admin portal flow

---

## Quick Reference

| Service | URL | Port | Purpose |
|---------|-----|------|---------|
| Sensor Backend | `https://sensorappbackend-production.up.railway.app/` | 3000 | API & data |
| Admin Portal | `https://your-admin.railway.app` | 4000 | User management |
| PostgreSQL | Railway internal | 5432 | Database |

