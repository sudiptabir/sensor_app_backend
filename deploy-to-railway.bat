@echo off
echo 🚂 Railway Deployment Script - Alert API Server
echo ===============================================

REM Check if Railway CLI is installed
railway --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Railway CLI not found. Installing...
    npm install -g @railway/cli
)

REM Create deployment directory
echo 📁 Creating deployment directory...
if not exist "alert-api-railway" mkdir alert-api-railway
cd alert-api-railway

REM Copy files
echo 📋 Copying deployment files...
copy ..\railway-server.js server.js
copy ..\alert-api-package.json package.json
copy ..\railway.json railway.json
copy ..\Procfile Procfile

REM Create .gitignore
echo 📝 Creating .gitignore...
(
echo node_modules/
echo .env
echo .DS_Store
echo *.log
) > .gitignore

REM Initialize git
echo 🔧 Initializing git repository...
git init
git add .
git commit -m "Initial commit - Alert API Server for Railway"

REM Check Railway authentication
echo 🔐 Checking Railway authentication...
railway whoami
if %errorlevel% neq 0 (
    echo Please run: railway login
)

echo.
echo 🚀 Ready to deploy! Next steps:
echo 1. Run: railway init
echo 2. Choose: Empty Project
echo 3. Name: alert-api-server
echo 4. Run: railway link (select your project)
echo 5. Run: railway up
echo 6. Add environment variables in Railway dashboard
echo.
echo 📋 Environment variables to add:
echo FIREBASE_PROJECT_ID=sensor-app-2a69b
echo FIREBASE_PRIVATE_KEY_ID=baabee4eb60deb36527e9edba974ded84defd361
echo FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@sensor-app-2a69b.iam.gserviceaccount.com
echo FIREBASE_CLIENT_ID=107093742514712029206
echo FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%%40sensor-app-2a69b.iam.gserviceaccount.com
echo FIREBASE_DATABASE_URL=https://sensor-app-2a69b-default-rtdb.firebaseio.com
echo NODE_ENV=production
echo.
echo ⚠️  For FIREBASE_PRIVATE_KEY, copy the entire private key from serviceAccountKey.json
echo.
echo 🎯 Current directory: %cd%
echo ✅ Ready for Railway deployment!
pause