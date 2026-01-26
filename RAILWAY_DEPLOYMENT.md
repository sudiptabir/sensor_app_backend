# 🚀 Railway Deployment Guide

## Prerequisites
- Railway account: https://railway.app/
- GitHub account (for continuous deployment)

## Step 1: Push to GitHub

1. Initialize git repository:
```bash
git init
git add .
git commit -m "Initial commit - Sensor app with admin portal"
```

2. Create GitHub repository and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/sensor-app.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy Sensor Backend to Railway

### Create Project
1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your `sensor-app` repository
4. Railway will auto-detect Node.js and deploy

### Add PostgreSQL Database
1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway will create and connect the database automatically

### Configure Environment Variables
In Railway project settings → Variables, add:

```env
# Database (Railway will auto-provide DATABASE_URL)
DB_USER=postgres
DB_PASSWORD=${PGPASSWORD}
DB_HOST=${PGHOST}
DB_PORT=${PGPORT}
DB_NAME=${PGDATABASE}

# Admin Portal
ADMIN_PORTAL_URL=https://your-admin-portal.railway.app
API_KEY=your-secure-api-key-here-change-this

# Server
PORT=3000
NODE_ENV=production
```

### Setup Database Schema
1. Once deployed, open Railway project → PostgreSQL service
2. Click "Connect" → Copy connection URL
3. Use a PostgreSQL client (like psql or TablePlus) to connect
4. Run the schema.sql file to create tables

## Step 3: Deploy Admin Portal to Railway

### Create New Service
1. In same Railway project, click "+ New"
2. Select "GitHub Repo" → Choose same repository
3. Click "Add Service"

### Configure Root Directory
1. Go to service Settings
2. Under "Build", set Root Directory: `admin-portal`
3. Start Command: `node server.js`

### Add Environment Variables
```env
# Database - Use same PostgreSQL as sensor backend
DATABASE_URL=postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}

# Firebase
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key-from-serviceAccountKey
FIREBASE_CLIENT_EMAIL=your-service-account-email

# Security
SESSION_SECRET=generate-long-random-string-here
API_KEY=same-as-sensor-backend-api-key

# Server
PORT=4000
NODE_ENV=production
```

## Step 4: Update Mobile App

Update `sensor_app/.env`:
```env
EXPO_PUBLIC_API_URL=https://your-sensor-backend.railway.app
EXPO_PUBLIC_ADMIN_PORTAL_URL=https://your-admin-portal.railway.app
EXPO_PUBLIC_API_KEY=your-api-key
```

## Step 5: Test Deployment

1. **Test Sensor Backend:**
```bash
curl https://your-sensor-backend.railway.app/health
curl https://your-sensor-backend.railway.app/api/devices
```

2. **Test Admin Portal:**
```bash
curl https://your-admin-portal.railway.app/health
# Open in browser: https://your-admin-portal.railway.app/login
```

3. **Test Mobile App:**
- Rebuild mobile app with new URLs
- Test sensor data fetching
- Test access control

## URLs You'll Get

After deployment, Railway provides:
- Sensor Backend: `https://[project-name]-production.railway.app`
- Admin Portal: `https://[project-name]-admin-production.railway.app`

## Database Setup Commands

Connect to Railway PostgreSQL and run:
```sql
-- Create admin portal database schema
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_access_control (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    access_level VARCHAR(50) DEFAULT 'read_only',
    granted_by VARCHAR(255),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(user_id, device_id)
);

CREATE TABLE IF NOT EXISTS user_blocks (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    reason TEXT,
    blocked_by VARCHAR(255),
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sensor backend schema (from schema.sql)
-- Copy tables from your existing schema.sql file
```

## Cost Estimate

Railway Pricing:
- **Hobby Plan**: $5/month + usage
- PostgreSQL: ~$5-10/month (shared)
- 2 Services (Backend + Admin): ~$10-15/month total
- **Total**: ~$20-25/month for full stack

## Troubleshooting

### Backend crashes on startup
- Check logs in Railway dashboard
- Verify DATABASE_URL is set correctly
- Ensure all environment variables are set

### Database connection fails
- Verify PostgreSQL service is running
- Check if database schema is created
- Test connection from Railway shell

### Admin portal can't connect
- Check ADMIN_PORTAL_URL in backend env vars
- Verify API_KEY matches in both services
- Check CORS settings if needed

## Automatic Deployments

Railway automatically deploys when you push to GitHub:
```bash
git add .
git commit -m "Update feature"
git push
```

Railway will rebuild and redeploy automatically!

## Next Steps

1. ✅ Set up custom domain (optional)
2. ✅ Configure SSL certificates (automatic)
3. ✅ Set up monitoring and alerts
4. ✅ Configure backup strategy for PostgreSQL
5. ✅ Set up CI/CD pipeline
