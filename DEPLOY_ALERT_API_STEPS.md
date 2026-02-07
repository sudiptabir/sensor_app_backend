# Deploy Alert API Server to Railway - Step by Step

## Quick Steps

### 1. Create Service via Railway Dashboard

**Go to**: https://railway.app/dashboard

1. Select project: **joyful-rebirth**
2. Click **"+ New"** button
3. Select **"GitHub Repo"**
4. Choose repository: **sensor_app_backend**
5. Railway will create a new service

### 2. Configure the Service

Click on the new service, then:

**Settings → General:**
- Service Name: `alert-api`
- Start Command: `node alert-api-server.js`

**Settings → Variables:**

Add these environment variables (copy from your "web" service):

```
DATABASE_URL=postgresql://postgres:wFokJzbqkVDDOKQQVapQHOXzWlyPZIme@centerbeam.proxy.rlwy.net:46434/railway

FIREBASE_PRIVATE_KEY=(copy from web service)

FIREBASE_CLIENT_EMAIL=(copy from web service)

FIREBASE_PROJECT_ID=sensor-app-2a69b

NODE_ENV=production
```

### 3. Deploy

Railway will automatically deploy after you save the variables.

### 4. Get Service URL

In the service settings:
- Go to **Settings → Networking**
- Click **"Generate Domain"**
- Copy the URL (e.g., `https://alert-api-production-xxxx.up.railway.app`)

### 5. Verify Deployment

Test the health endpoint:
```bash
curl https://your-alert-api-url.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-...",
  "firebase": true
}
```

### 6. Check Logs

```bash
railway service alert-api
railway logs
```

Look for:
```
✅ Firebase Admin SDK initialized
🔌 PostgreSQL connection initialized for user blocking checks
🚀 Server running on port 3001
```

## Alternative: CLI Method

If you prefer using CLI:

```powershell
# 1. Link to project
railway link

# 2. List current services
railway status

# 3. Create new service
railway service create alert-api

# 4. Switch to new service
railway service alert-api

# 5. Set variables (one by one)
railway variables set DATABASE_URL="your-database-url"
railway variables set FIREBASE_PRIVATE_KEY="your-private-key"
railway variables set FIREBASE_CLIENT_EMAIL="your-email"
railway variables set FIREBASE_PROJECT_ID="sensor-app-2a69b"
railway variables set NODE_ENV="production"

# 6. Deploy
railway up

# 7. Generate domain
railway domain

# 8. Check logs
railway logs
```

## Get Variables from Existing Service

```powershell
# Switch to web service
railway service web

# List all variables
railway variables

# Copy the output, then switch back to alert-api
railway service alert-api

# Set each variable
```

## Troubleshooting

### Service won't start

**Check logs:**
```bash
railway logs --service alert-api
```

**Common issues:**
- Missing `package.json` dependencies → Add to `alert-api-package.json`
- Wrong start command → Should be `node alert-api-server.js`
- Missing environment variables → Check all variables are set

### Firebase initialization failed

**Check:**
- `FIREBASE_PRIVATE_KEY` is set correctly (with `\n` for newlines)
- `FIREBASE_CLIENT_EMAIL` matches your service account
- `FIREBASE_PROJECT_ID` is correct

### Database connection failed

**Check:**
- `DATABASE_URL` is correct
- PostgreSQL service is running
- SSL settings are correct (should have `ssl: { rejectUnauthorized: false }`)

## Update After Deployment

When you make changes to `alert-api-server.js`:

```bash
git add alert-api-server.js
git commit -m "Update alert API"
git push
```

Railway will automatically redeploy.

## Service URLs

After deployment, you'll have:
- **Web Service**: `https://web-production-3d9a.up.railway.app` (existing)
- **Alert API**: `https://alert-api-production-xxxx.up.railway.app` (new)

Update your ML alert sender to use the new Alert API URL!
