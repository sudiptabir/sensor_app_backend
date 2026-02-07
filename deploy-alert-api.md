# Deploy Alert API Server to Railway

## Prerequisites
- Railway CLI installed
- Logged into Railway (`railway login`)
- In the project directory

## Steps

### 1. Create New Service

```bash
# Link to your Railway project
railway link

# Create a new service for alert API
railway service create alert-api
```

### 2. Set Environment Variables

```bash
# Link to the new service
railway service alert-api

# Set environment variables (replace with your actual values)
railway variables set DATABASE_URL="postgresql://postgres:password@host:port/database"
railway variables set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
railway variables set FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@sensor-app-2a69b.iam.gserviceaccount.com"
railway variables set FIREBASE_PROJECT_ID="sensor-app-2a69b"
railway variables set NODE_ENV="production"
```

### 3. Deploy

```bash
# Deploy the alert API server
railway up --service alert-api
```

### 4. Get Service URL

```bash
# Get the public URL
railway domain
```

## Alternative: Copy Variables from Existing Service

If you already have environment variables in another service:

```bash
# Switch to existing service
railway service web

# List all variables
railway variables

# Copy the output, then switch to alert-api service
railway service alert-api

# Set each variable
railway variables set KEY="VALUE"
```

## Verify Deployment

1. Check logs:
```bash
railway logs --service alert-api
```

2. Check status:
```bash
railway status --service alert-api
```

3. Test the endpoint:
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

## Troubleshooting

### Issue: Module not found
**Solution**: Make sure `package.json` includes all dependencies:
```bash
railway run npm install
```

### Issue: Firebase initialization failed
**Solution**: Check environment variables are set correctly:
```bash
railway variables
```

### Issue: Database connection failed
**Solution**: Verify `DATABASE_URL` is correct and PostgreSQL service is running:
```bash
railway service postgres
railway status
```

## Update Deployment

When you make changes to `alert-api-server.js`:

```bash
# Commit changes
git add alert-api-server.js
git commit -m "Update alert API server"
git push

# Railway will auto-deploy if connected to GitHub
# Or manually deploy:
railway up --service alert-api
```

## Environment Variables Needed

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:port/db` |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key | `-----BEGIN PRIVATE KEY-----\n...` |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | `firebase-adminsdk-xxx@project.iam.gserviceaccount.com` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `sensor-app-2a69b` |
| `FIREBASE_DATABASE_URL` | Firebase Realtime Database URL | `https://sensor-app-2a69b-default-rtdb.firebaseio.com` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port (optional) | Railway auto-assigns if not set |

## Service Configuration

The alert API server will:
- Listen on the port provided by Railway (via `process.env.PORT`)
- Connect to PostgreSQL for user blocking checks
- Connect to Firebase for push notifications
- Receive ML alerts at `POST /api/alerts`
- Provide health check at `GET /health`

## Next Steps

After deployment:
1. Update your ML alert sender to use the new URL
2. Test sending an alert
3. Verify blocked users don't receive notifications
4. Monitor logs for any errors
