# Railway Deployment Script - Alert API Server
Write-Host "Railway Deployment Script - Alert API Server" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

# Check if Railway CLI is installed
try {
    railway --version | Out-Null
    Write-Host "Railway CLI found" -ForegroundColor Green
} catch {
    Write-Host "Railway CLI not found. Installing..." -ForegroundColor Red
    npm install -g @railway/cli
}

# Create deployment directory
Write-Host "Creating deployment directory..." -ForegroundColor Yellow
if (!(Test-Path "alert-api-railway")) {
    New-Item -ItemType Directory -Name "alert-api-railway"
}
Set-Location "alert-api-railway"

# Copy files
Write-Host "Copying deployment files..." -ForegroundColor Yellow
Copy-Item "..\railway-server.js" -Destination "server.js"
Copy-Item "..\alert-api-package.json" -Destination "package.json"
Copy-Item "..\railway.json" -Destination "railway.json"
Copy-Item "..\Procfile" -Destination "Procfile"

# Create .gitignore
Write-Host "Creating .gitignore..." -ForegroundColor Yellow
$gitignoreContent = @"
node_modules/
.env
.DS_Store
*.log
"@
$gitignoreContent | Out-File -FilePath ".gitignore" -Encoding UTF8

# Initialize git
Write-Host "Initializing git repository..." -ForegroundColor Yellow
git init
git add .
git commit -m "Initial commit - Alert API Server for Railway"

# Check Railway authentication
Write-Host "Checking Railway authentication..." -ForegroundColor Yellow
try {
    railway whoami | Out-Null
    Write-Host "Railway authenticated" -ForegroundColor Green
} catch {
    Write-Host "Please run: railway login" -ForegroundColor Red
}

Write-Host ""
Write-Host "Ready to deploy! Next steps:" -ForegroundColor Green
Write-Host "1. Run: railway init" -ForegroundColor White
Write-Host "2. Choose: Empty Project" -ForegroundColor White
Write-Host "3. Name: alert-api-server" -ForegroundColor White
Write-Host "4. Run: railway link (select your project)" -ForegroundColor White
Write-Host "5. Run: railway up" -ForegroundColor White
Write-Host "6. Add environment variables in Railway dashboard" -ForegroundColor White
Write-Host ""
Write-Host "Environment variables to add:" -ForegroundColor Cyan
Write-Host "FIREBASE_PROJECT_ID=sensor-app-2a69b" -ForegroundColor Gray
Write-Host "FIREBASE_PRIVATE_KEY_ID=baabee4eb60deb36527e9edba974ded84defd361" -ForegroundColor Gray
Write-Host "FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@sensor-app-2a69b.iam.gserviceaccount.com" -ForegroundColor Gray
Write-Host "FIREBASE_CLIENT_ID=107093742514712029206" -ForegroundColor Gray
Write-Host "FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40sensor-app-2a69b.iam.gserviceaccount.com" -ForegroundColor Gray
Write-Host "FIREBASE_DATABASE_URL=https://sensor-app-2a69b-default-rtdb.firebaseio.com" -ForegroundColor Gray
Write-Host "NODE_ENV=production" -ForegroundColor Gray
Write-Host ""
Write-Host "For FIREBASE_PRIVATE_KEY, copy the entire private key from serviceAccountKey.json" -ForegroundColor Yellow
Write-Host ""
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host "Ready for Railway deployment!" -ForegroundColor Green

Read-Host "Press Enter to continue"