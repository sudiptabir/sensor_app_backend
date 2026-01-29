# Admin Portal Troubleshooting Guide

## Issue: "Cannot GET /" or Page Won't Load

### Root Cause
The root path (`/`) redirects to `/dashboard`, which requires login. If you're not logged in, it redirects to `/login`.

### Solution
1. Access the login page directly: `https://your-admin-portal.railway.app/login`
2. If no admin account exists, you need to create one first

---

## Issue: "Cannot access /login" - 404 or Blank Page

### Possible Causes

#### 1. Admin Portal Not Deployed
Check if the admin-portal service exists in Railway:
```bash
railway service list
```

Should show:
```
backend (Running)
admin-portal (Running)
```

**Fix:** Deploy admin-portal following the deployment guide

#### 2. Wrong URL
The URL should be your **admin-portal** service, not the backend service.
- ❌ `https://sensorappbackend-production.up.railway.app/`
- ✅ `https://admin-portal-production.up.railway.app/` (example)

**Fix:** Check Railway dashboard for the correct admin-portal URL

#### 3. Service Not Running
In Railway Dashboard:
1. Click admin-portal service
2. Check if status is "Running" (green)
3. If not running, check Logs for errors

**Fix:** Check logs and fix errors

---

## Issue: "Error loading dashboard" or Database Connection Failed

### Root Cause
The admin portal can't connect to PostgreSQL.

### Check Logs
```bash
# In Railway Dashboard:
1. Go to admin-portal service
2. Click "Logs"
3. Look for database connection errors
```

### Fix
**Step 1: Verify DATABASE_URL**
```bash
# In Railway Dashboard > admin-portal > Variables
# Check that DATABASE_URL is set
# Should look like: postgresql://user:pass@host:port/db
```

**Step 2: Use Same Database as Backend**
```
DATABASE_URL = (copy from your backend service variables)
```

**Step 3: Verify Schema Exists**
Connect to the database and check:
```bash
# Via Railway terminal or local psql
\dt
# Should show: admin_users, device_access_control, etc.
```

If tables are missing, run initialization:
```sql
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);
```

---

## Issue: "Invalid credentials" When Trying to Login

### Root Cause
No admin account has been created yet.

### Solution
Create admin account via setup endpoint:

```bash
ADMIN_URL="https://your-admin-portal.railway.app"
SETUP_KEY="setup123"  # From your env variables

curl -X POST ${ADMIN_URL}/api/setup/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!",
    "fullName": "Admin User",
    "setupKey": "'${SETUP_KEY}'"
  }'
```

Response should be:
```json
{"success": true, "message": "Admin created successfully"}
```

Now try logging in with those credentials.

---

## Issue: Setup API Returns "Invalid setup key"

### Root Cause
The `SETUP_KEY` in your request doesn't match the environment variable.

### Fix
1. Check your SETUP_KEY in Railway Variables
2. Use the exact same value in your curl request
3. Default is: `setup123`

---

## Issue: Firebase Service Account Error

### Root Cause
`FIREBASE_SERVICE_ACCOUNT` is not set or is malformed.

### Fix
**Option 1: Use Local serviceAccountKey.json (Easy)**
The admin-portal can read from local file if env var is not set.

**Option 2: Set as Environment Variable (Recommended)**
1. Download your `serviceAccountKey.json` from Firebase Console
2. Convert to single-line JSON:
   ```bash
   cat serviceAccountKey.json | jq -c .
   ```
3. Copy the output
4. In Railway Dashboard > admin-portal > Variables
5. Add variable: `FIREBASE_SERVICE_ACCOUNT`
6. In "Raw Editor", paste the JSON (keep newlines if it's readable)

---

## Issue: Session Not Persisting / Logout On Refresh

### Root Cause
Cookie configuration issue (usually in production).

### Check
In Railway logs, look for:
```
[Session] Using secure cookies: false
```

### Fix
Ensure in admin-portal/server.js:
```javascript
cookie: {
  secure: process.env.NODE_ENV === 'production',  // true on Railway
  httpOnly: true,
  sameSite: 'lax'
}
```

This should automatically work on Railway HTTPS.

---

## Issue: "Cannot GET /api/check-access/..." in Backend

### Root Cause
The backend is trying to call the admin-portal but it's not accessible.

### Check Logs
In backend logs, look for:
```
[Check Access] Error: connect ECONNREFUSED
```

### Fix
1. Update backend's `ADMIN_PORTAL_URL` environment variable:
   ```
   ADMIN_PORTAL_URL=https://your-admin-portal.railway.app
   ```
2. Ensure both services are running in Railway
3. Check firewall rules (Railway shouldn't have issues)

---

## Issue: "Module not found" or Node/npm Errors

### Root Cause
Dependencies not installed or node version mismatch.

### Fix
**Step 1: Check Railway Build Logs**
```bash
# In Railway Dashboard > admin-portal > Build Logs
# Look for npm install errors
```

**Step 2: Verify Procfile**
Check `Procfile` contains:
```
web: node server.js
```

**Step 3: Ensure package.json is correct**
```json
{
  "name": "sensor-admin-portal",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 4: Commit node_modules or ensure npm ci runs**
```bash
# Option A: Add to .gitignore and let Railway reinstall
echo "node_modules/" >> .gitignore

# Option B: Commit node_modules
git add node_modules -f
```

---

## Issue: Port Already in Use

### Root Cause
PORT environment variable not set or conflicts.

### Fix
Ensure in Railway Variables:
```
PORT=4000
```

The admin-portal should run on port 4000, backend on 3000.

---

## Issue: CORS Errors When Backend Calls Admin Portal

### Root Cause
CORS configuration mismatch.

### Check Backend Logs
```
CORS error when calling admin-portal
```

### Fix
In admin-portal/server.js, ensure CORS is configured:
```javascript
app.use(cors({
  origin: process.env.ADMIN_PORTAL_URL || 'http://localhost:4000',
  credentials: true
}));
```

Backend should call with proper headers:
```javascript
const response = await fetch(`${ADMIN_PORTAL_URL}/api/check-access/...`, {
  headers: {
    'X-API-Key': API_KEY
  }
});
```

---

## Quick Diagnostic Checklist

- [ ] Is admin-portal service deployed? (`railway service list`)
- [ ] Is service running? (Railway dashboard shows green status)
- [ ] Can you access `/login`? (Visit in browser)
- [ ] Does `/health` endpoint work? (`curl https://url/health`)
- [ ] Is DATABASE_URL set? (Check variables)
- [ ] Does admin user exist? (Try login or create via API)
- [ ] Is SESSION_SECRET set? (Check variables)
- [ ] Is FIREBASE_DATABASE_URL set? (Check variables)
- [ ] Are backend and admin-portal on same database? (Check DATABASE_URL matches)

---

## Emergency Reset

If everything is broken:

### 1. Reset Admin Portal Service
```bash
cd admin-portal

# Clear cache and redeploy
railway up --force
```

### 2. Check Logs
```bash
railway logs --follow
```

### 3. Verify All Variables
```bash
railway variables
```

### 4. Rerun Setup API
```bash
curl -X POST https://your-admin-portal.railway.app/api/setup/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Test123!",
    "fullName": "Admin",
    "setupKey": "setup123"
  }'
```

---

## Still Having Issues?

Check the logs in detail:
```bash
# Via Railway CLI
railway logs --follow -o admin-portal

# Via Railway Dashboard
1. Click admin-portal service
2. Click "Logs" tab
3. Search for "error" or specific error messages
```

Common errors and solutions:
- `ECONNREFUSED` → Database not accessible
- `Module not found` → npm install failed
- `Firebase error` → FIREBASE_SERVICE_ACCOUNT malformed
- `Timeout` → Database too slow or unreachable

