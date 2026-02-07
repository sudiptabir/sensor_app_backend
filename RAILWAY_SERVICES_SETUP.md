# Railway Services Setup - Sensor App Architecture

Your application is deployed as **3 independent services** on Railway, each with its own configuration.

## 📊 Service Overview

### 1. **Main Sensor Backend** 🚀 (Primary Service)
- **Directory**: Root project folder
- **Entry Point**: `railway-server.js`
- **Config Files**: 
  - `package.json` - Dependencies
  - `railway.json` - Railway deployment config
  - `Procfile` - Process definition
- **Key Dependencies**: Express, Firebase Admin, PostgreSQL, Socket.io
- **Environment Variables Needed**:
  - `PORT` (default: 3000)
  - `DATABASE_URL` - PostgreSQL connection
  - `FIREBASE_PRIVATE_KEY` - Firebase auth
  - `FIREBASE_CLIENT_EMAIL` - Firebase auth
  - `NODE_ENV=production`

### 2. **Alert API Service** 🚨 (Separate Service)
- **Directory**: `alert-api-v2/`
- **Entry Point**: `server.js`
- **Config Files**:
  - `alert-api-v2/package.json` - Dependencies
  - `alert-api-v2/railway.json` - Railway deployment config
  - `alert-api-v2/Procfile` - Process definition
- **Key Dependencies**: Express, Firebase Admin, PostgreSQL, uuid
- **Environment Variables Needed**:
  - `PORT` (default: 3000)
  - `DATABASE_URL` - PostgreSQL connection (for user blocking checks)
  - `FIREBASE_PRIVATE_KEY` - Firebase push notifications
  - `FIREBASE_CLIENT_EMAIL` - Firebase auth
  - `NODE_ENV=production`

### 3. **Admin Portal** 👨‍💼 (Optional)
- **Directory**: `admin-portal/`
- **Entry Point**: `server.js`
- **Config Files**:
  - `admin-portal/package.json` - Dependencies
  - `admin-portal/railway.json` - Railway deployment config
  - `admin-portal/Procfile` - Process definition
- **Purpose**: Web interface for managing sensors and users
- **Environment Variables Needed**:
  - `PORT` (default: 4000)
  - `DATABASE_URL` - PostgreSQL connection
  - Various session & auth variables

## 🔧 Recent Fixes

### Main Backend (Root)
✅ Fixed `railway.json` to start correct server:
```json
"startCommand": "node railway-server.js"
```

### Alert API (alert-api-v2/)
✅ Added missing `pg` dependency for PostgreSQL
✅ Fixed `Procfile` to point to correct server:
```
web: node server.js
```

## 📋 Deployment Structure

```
Sensor_app/
├── railway.json .................. Main backend config
├── Procfile ...................... Main backend process
├── package.json .................. Main backend dependencies
├── railway-server.js ............. Main backend server ✅
├── alert-api-v2/
│   ├── railway.json .............. Alert API config
│   ├── Procfile .................. Alert API process
│   ├── package.json .............. Alert API dependencies
│   └── server.js ................. Alert API server ✅
└── admin-portal/
    ├── railway.json .............. Admin portal config
    ├── Procfile .................. Admin portal process
    ├── package.json .............. Admin portal dependencies
    └── server.js ................. Admin portal server
```

## 🚀 How to Deploy

### Deploy Main Backend to Railway
```bash
# At root level
git add .
git commit -m "Deploy: Main sensor backend"
git push

# Railway auto-detects railway.json and deploys
```

### Deploy Alert API to Railway (Separate Service)
```bash
# Option 1: Push as part of main repo
# Railway will detect alert-api-v2/railway.json
# Create separate Railway service from alert-api-v2 directory

# Option 2: Separate Git repo
cd alert-api-v2
git init
git remote add railway https://railway.app/...
git push railway main
```

### Deploy Admin Portal to Railway
```bash
cd admin-portal
git add .
git commit -m "Deploy: Admin portal"
git push

# Or if separate: railway up
```

## 🔗 Service Communication

```
Mobile App
   ↓
   ├─→ Main Backend (railway-server.js:3000)
   │   ├─ Device control
   │   ├─ Sensor queries
   │   └─ User management
   │
   └─→ Alert API (alert-api-v2/server.js:3000)
       └─ Send push notifications
       └─ Check user blocking

Admin Portal
   └─→ Main Backend Database
       └─ Manage devices & users
```

## 📝 Environment Variables by Service

### Main Backend (.env or Railway Variables)
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PROJECT_ID=sensor-app-2a69b
FIREBASE_CLIENT_ID=...
FIREBASE_CLIENT_CERT_URL=...
```

### Alert API (alert-api-v2/.env)
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://... (same database)
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PROJECT_ID=sensor-app-2a69b
```

### Admin Portal (admin-portal/.env)
```
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
SESSION_SECRET=your-secret-key
FIREBASE_PROJECT_ID=sensor-app-2a69b
```

## ✅ Checklist Before Deploying

- [ ] All environment variables set in Railway dashboard
- [ ] PostgreSQL database is running and accessible
- [ ] Firebase credentials are correct
- [ ] All three services have unique ports (or configured properly)
- [ ] `.gitignore` excludes `.env` files
- [ ] `package-lock.json` is committed
- [ ] Railway health check paths are correct

## 🔍 Verifying Deployments

### Check Main Backend
```bash
curl https://your-main-backend.up.railway.app/health
```

### Check Alert API
```bash
curl https://your-alert-api.up.railway.app/health
```

### Check Admin Portal
```bash
curl https://your-admin-portal.up.railway.app/health
```

## 📊 Current Status After Fixes

| Service | Status | Issue | Fixed |
|---------|--------|-------|-------|
| Main Backend | ✅ Ready | Start command mismatch | Yes |
| Alert API | ✅ Ready | Missing pg dependency, wrong Procfile | Yes |
| Admin Portal | ✅ Ready | None identified | N/A |

## 🚢 Next Steps

1. Push changes to Git:
```bash
git add .
git commit -m "Fix: Railway service configurations"
git push
```

2. In Railway Dashboard:
   - Verify each service detects the correct `railway.json`
   - Confirm environment variables are set
   - Trigger manual deployments if needed

3. Monitor deployment logs for any new errors

4. Run health checks to confirm services are online
