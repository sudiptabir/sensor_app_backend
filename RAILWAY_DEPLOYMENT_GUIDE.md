# 🚂 Railway Deployment Guide - Alert API Server

## 📋 Pre-Deployment Checklist

✅ Files created:
- `railway-server.js` - Main server file
- `alert-api-package.json` - Package dependencies  
- `railway.json` - Railway configuration
- `Procfile` - Process definition
- `.env.example` - Environment variables template

## 🚀 Step-by-Step Deployment

### 1. Create New Railway Project

```bash
# Install Railway CLI (if not already installed)
npm install -g @railway/cli

# Login to Railway
railway login

# Create new project
railway init
# Choose: "Empty Project"
# Name: "alert-api-server"
```

### 2. Prepare Files for Deployment

Create a new folder for Railway deployment:

```bash
# Create deployment folder
mkdir alert-api-railway
cd alert-api-railway

# Copy necessary files
cp ../railway-server.js ./server.js
cp ../alert-api-package.json ./package.json
cp ../railway.json ./railway.json
cp ../Procfile ./Procfile
```

### 3. Initialize Git Repository

```bash
# Initialize git in the deployment folder
git init
git add .
git commit -m "Initial commit - Alert API Server"
```

### 4. Connect to Railway

```bash
# Link to Railway project
railway link
# Select your "alert-api-server" project

# Deploy to Railway
railway up
```

### 5. Set Environment Variables in Railway Dashboard

Go to your Railway dashboard and add these environment variables:

**🔥 Firebase Configuration:**
```
FIREBASE_PROJECT_ID=sensor-app-2a69b
FIREBASE_PRIVATE_KEY_ID=baabee4eb60deb36527e9edba974ded84defd361
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC7bv5SlL4lhfbN
RIszBsN2ZVDeNZ+LlYJMioT6AIhixVsaVHOnvOQyOp+HwmcShSiOBAKszexEDMnZ
mAkikuCn8SUDudC/GYaFUm9W3rhisnHINyvs5DZ6zspM98ZBcrhtAUayHxM5u7J1
ZZCM65lhq1KpSezCSRzdaK3a1zvz463ls6mH8KtY+CqRmXKdd1v5H4W7bUUU2ETp
9r8eETxL2UxfNiow3y6X3rO+9fQ7gApobpzMYPpQBgOvnSU4xj68jEMEJA8xeS4N
P6/kagJkqx7DI6MUuSlRUlQNfKdjQlR3tsRN8eYoqa0qqv0eENjcNOjxZje+k+n3
mzuTnqKhAgMBAAECggEAA5AfhOa7kttoIrSqa/3VXEA+rFuy+Mh+u6lgL9+v2AdS
BRcNBAe144vMXax9ELu/5qu2OI5ZTv2afnC6vznRLBYcHtUS3hgcT9deYxWMpiEn
4y9Dzi70J2tcCoClB9hYP8e3/iGzuAusr7k+mUQvBC2ZXpsXdWXGBwIy+FuSMd+W
Ohl8h9VPX5VgJOP+6L/+7fH2+TXo+rXUajfHQKaCdxEZIMQtYPD6Bq1FyKsCE7kg
Tccm5pteKguHqYYq7+EVf/SsXOAmtqayHsczTnezlkym5vNg5TyAKVoUNeRs6NMc
Uk0jmyHSX6s0fG9idwklKycOoTK3CCWDKCXv/X9dEQKBgQDb9kiT8yzmAmb02Cab
bpK6zAgv8PV3/DzG3kih9jcfQjO0yIS2MJuqCulLXEjvnc+oF7aLbFMv5zDet0Ed
2PUd9UI4YLihxeFY+I3X/eHtTidf9x4/nUt48A9VP+QMy0kzhUm9UouZYeckPWCx
Namb3cw+jomOtO9Pc6dcZPVEMQKBgQDaJGP0krQ9XYCvfF03LD3DB5XoMOb1ABc8
IBy5Xf7l1eOpNiDCb0hq7EUBCXjwykoim6DtMdCt4Jry2Hd4MMtVwrhWEXf4N4iE
4art5EuUmywnKflsvcPwIyegeh08am17bmuoxirSmkf7CLlLKpyzR/P3nDZY5mSE
za2KZ+7ZcQKBgQCeR6fMRsU9MedSMqP9XuDY5+7QSKzqTSiS1esgGKNrq+C3Kz9M
Nsgc4UMlBmA5hK6jv4SM6UMnCk7BRM7nonInv4+KMBdL2a+hrSGsljVX5NAynwk2
L4LaoKv35US97B5do4D/agGoOqnwCvakLgBBd6X8MedMOGioHIoG02MmUQKBgQDC
1RnJiXYeEPMsyWDgNE19cbr8RSEi1c/qzauaDE/rq5vIuCWOQ6JkjV4cTP+N4L9S
JboX4BRIGIGMQLaDzODvWhkWFkgWlFMEjCIEk5DFy8oluKGj8+GbC2sLM8YE/fGG
+tqBRW1d6Jo9pk8Iyahnn+5Qy17nC+/fhWxoX+e+oQKBgQCEv9dCjcYbFEGqZSau
JlMn4YBTEa9OiR3/dxoAUGibl4Zl4bCIcsok77lrJ98CxxuymbRVfJy7GvF01ZCX
wj36oUpzX95E8ojhTBuBnYpjM2bXipt82lR4jrcijayo0XwYlr24NP2NM5eOEb56
azTNbTxqlcw7lpoEUfQ3dL9g5w==
-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@sensor-app-2a69b.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=107093742514712029206
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40sensor-app-2a69b.iam.gserviceaccount.com
FIREBASE_DATABASE_URL=https://sensor-app-2a69b-default-rtdb.firebaseio.com
```

**⚙️ Server Configuration:**
```
NODE_ENV=production
PORT=3000
```

### 6. Deploy and Test

```bash
# Deploy to Railway
railway up

# Get your deployment URL
railway domain
```

Your API will be available at: `https://your-project-name.railway.app`

### 7. Test the Deployment

```bash
# Test health endpoint
curl https://your-project-name.railway.app/health

# Test alert endpoint
curl -X POST https://your-project-name.railway.app/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "deviceId": "test_device_001", 
    "alert": {
      "notification_type": "Alert",
      "detected_objects": ["person", "test"],
      "risk_label": "Medium",
      "predicted_risk": "Medium",
      "description": ["Test alert from Railway deployment"],
      "device_identifier": "test_device_001",
      "timestamp": 1234567890,
      "model_version": "v1.0",
      "confidence_score": 0.85
    }
  }'
```

## 🔧 Alternative: One-Click Railway Deployment

### Option 1: Deploy from GitHub

1. **Push to GitHub:**
   ```bash
   # Create GitHub repo and push
   git remote add origin https://github.com/yourusername/alert-api-server.git
   git push -u origin main
   ```

2. **Deploy from Railway Dashboard:**
   - Go to Railway dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Add environment variables
   - Deploy!

### Option 2: Railway Button (Future)

Create a `README.md` with Railway deploy button:

```markdown
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/your-template-id)
```

## 📱 Update Your Mobile App

Once deployed, update your alert generator to use the Railway URL:

```bash
# Set the Railway URL as your API endpoint
export ALERT_API_URL=https://your-project-name.railway.app/api/alerts

# Test with the generator
node alert-generator.js
```

## 🔍 Monitoring and Logs

### View Logs
```bash
# View real-time logs
railway logs

# View logs in dashboard
# Go to Railway dashboard > Your project > Logs tab
```

### Monitor Health
```bash
# Check health endpoint
curl https://your-project-name.railway.app/health

# Check stats
curl https://your-project-name.railway.app/api/stats
```

## 🚨 Troubleshooting

### Common Issues

**1. Firebase Connection Failed**
- Check all environment variables are set correctly
- Ensure private key includes `\n` characters properly
- Verify project ID matches your Firebase project

**2. Port Issues**
- Railway automatically assigns PORT environment variable
- Don't hardcode port 3000, use `process.env.PORT`

**3. Build Failures**
- Check `package.json` has correct dependencies
- Ensure `railway.json` configuration is valid
- Verify Node.js version compatibility

**4. Environment Variables**
- Use Railway dashboard to set variables
- Don't include quotes around values in dashboard
- For private key, paste the entire key including BEGIN/END lines

### Debug Commands
```bash
# Check Railway project status
railway status

# View environment variables
railway variables

# Restart deployment
railway up --detach
```

## ✅ Success Checklist

After successful deployment:

- [ ] Health endpoint returns 200 OK
- [ ] Firebase connection successful (check logs)
- [ ] Alert endpoint accepts POST requests
- [ ] Alerts are stored in Firestore
- [ ] Push notifications are sent to mobile app
- [ ] Mobile app receives real-time updates
- [ ] Logs show no errors

## 🎯 Next Steps

1. **Update Raspberry Pi script** to use Railway URL
2. **Test end-to-end flow** from Pi to mobile app
3. **Set up monitoring** and alerting for the API
4. **Configure custom domain** (optional)
5. **Set up CI/CD** for automatic deployments

Your Alert API is now running on Railway! 🎉