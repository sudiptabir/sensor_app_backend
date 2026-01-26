# 🚀 Quick Railway Deployment (5 Minutes)

## Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Verify your email

## Step 2: Deploy Sensor Backend

### Option A: Deploy from GitHub (Recommended)
1. **Push code to GitHub:**
   ```bash
   cd C:\Users\SUDIPTA\Downloads\Sensor_app
   git init
   git add .
   git commit -m "Initial deployment"
   gh repo create sensor-iot-backend --public --source=. --remote=origin --push
   ```

2. **Deploy on Railway:**
   - Go to https://railway.app/new
   - Click "Deploy from GitHub repo"
   - Select `sensor-iot-backend`
   - Railway auto-deploys!

### Option B: Deploy via Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize and deploy
railway init
railway up
```

## Step 3: Add PostgreSQL Database

1. In Railway project dashboard:
   - Click "+ New" → "Database" → "Add PostgreSQL"
   - Railway auto-connects it!

2. **Setup database schema:**
   - Click PostgreSQL service → "Data" tab → "Query"
   - Copy and paste your `schema.sql` content
   - Click "Run Query"

## Step 4: Set Environment Variables

Click sensor backend service → "Variables" tab → Add:

```
ADMIN_PORTAL_URL=https://[will-add-after-admin-portal-deployed].railway.app
API_KEY=production-api-key-change-this-12345
PORT=3000
NODE_ENV=production
```

Railway automatically provides these (don't add):
- `DATABASE_URL`
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

## Step 5: Deploy Admin Portal

1. **Create new service in same project:**
   - Click "+ New" → "GitHub Repo"
   - Select same repository
   - **Important**: Settings → Root Directory = `admin-portal`

2. **Add Variables:**
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=generate-random-string-min-32-chars
API_KEY=production-api-key-change-this-12345
PORT=4000
NODE_ENV=production

# Firebase (copy from serviceAccountKey.json)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

3. **Link to same PostgreSQL:**
   - In Variables tab, click "+ New Variable"
   - Select "Reference" → Choose PostgreSQL service → `DATABASE_URL`

## Step 6: Update Backend with Admin Portal URL

1. Copy admin portal URL: `https://sensor-app-admin-production.railway.app`
2. Go to sensor backend → Variables
3. Update `ADMIN_PORTAL_URL` with copied URL
4. Service will auto-redeploy

## Step 7: Update Mobile App

Edit `sensor_app/.env`:
```env
EXPO_PUBLIC_API_URL=https://[your-backend].railway.app
EXPO_PUBLIC_ADMIN_PORTAL_URL=https://[your-admin].railway.app
EXPO_PUBLIC_API_KEY=production-api-key-change-this-12345
```

Restart Expo:
```bash
cd sensor_app
npx expo start --clear
```

## ✅ Verify Deployment

**Test Backend:**
```bash
curl https://[your-backend].railway.app/health
curl https://[your-backend].railway.app/api/devices
```

**Test Admin Portal:**
- Open browser: `https://[your-admin].railway.app/login`
- Should see login page

**Test Access Control:**
- Login to admin portal
- Block/allow users
- Test in mobile app

## 📊 Your Railway URLs

After deployment, save these:
- **Sensor Backend**: https://sensor-app-production-xxxx.railway.app
- **Admin Portal**: https://sensor-app-admin-production-xxxx.railway.app
- **PostgreSQL**: Internal only (auto-connected)

## 🔧 Useful Railway Commands

```bash
# View logs
railway logs

# Open service URL
railway open

# Connect to database
railway connect postgres

# Run migrations
railway run node migrate.js
```

## 💰 Cost

- **Starter Plan**: $5/month
- **PostgreSQL**: Included in plan
- **2 Services**: Covered by $5 credit
- **Total**: ~$5-10/month

## 🚨 Important Notes

1. **Environment Variables**: Railway uses `${{Postgres.DATABASE_URL}}` syntax to reference other services
2. **Auto Deploy**: Every git push triggers automatic deployment
3. **Zero Downtime**: Railway handles rolling deployments
4. **Logs**: View real-time logs in Railway dashboard
5. **Metrics**: Monitor CPU, memory, and network usage

## Next: Test Everything!

1. ✅ Backend health check
2. ✅ Admin portal login
3. ✅ Mobile app connection
4. ✅ Sensor data fetching
5. ✅ Access control working
