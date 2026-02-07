# Deploy Alert API Server to Railway
# PowerShell Script

Write-Host "🚀 Deploying Alert API Server to Railway" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Step 1: Check if Railway CLI is installed
Write-Host "`n📋 Step 1: Checking Railway CLI..." -ForegroundColor Yellow
$railwayVersion = railway --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Railway CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g @railway/cli" -ForegroundColor White
    exit 1
}
Write-Host "✅ Railway CLI installed: $railwayVersion" -ForegroundColor Green

# Step 2: Check if logged in
Write-Host "`n📋 Step 2: Checking Railway login..." -ForegroundColor Yellow
railway whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not logged into Railway. Please login first:" -ForegroundColor Red
    Write-Host "   railway login" -ForegroundColor White
    exit 1
}
Write-Host "✅ Logged into Railway" -ForegroundColor Green

# Step 3: Show current project
Write-Host "`n📋 Step 3: Current Railway project..." -ForegroundColor Yellow
railway status

# Step 4: Instructions for creating new service
Write-Host "`n📋 Step 4: Create new service" -ForegroundColor Yellow
Write-Host "You need to create a new service in Railway Dashboard:" -ForegroundColor White
Write-Host ""
Write-Host "Option 1: Via Railway Dashboard (Recommended)" -ForegroundColor Cyan
Write-Host "  1. Go to: https://railway.app/dashboard" -ForegroundColor White
Write-Host "  2. Select your project: 'joyful-rebirth'" -ForegroundColor White
Write-Host "  3. Click 'New Service' → 'GitHub Repo'" -ForegroundColor White
Write-Host "  4. Select your repository" -ForegroundColor White
Write-Host "  5. Configure:" -ForegroundColor White
Write-Host "     - Service Name: alert-api" -ForegroundColor White
Write-Host "     - Start Command: node alert-api-server.js" -ForegroundColor White
Write-Host "  6. Add environment variables (see below)" -ForegroundColor White
Write-Host ""
Write-Host "Option 2: Via CLI" -ForegroundColor Cyan
Write-Host "  Run these commands:" -ForegroundColor White
Write-Host "  railway service create alert-api" -ForegroundColor Gray
Write-Host "  railway service alert-api" -ForegroundColor Gray
Write-Host ""

# Step 5: Environment variables needed
Write-Host "`n📋 Step 5: Environment Variables Needed" -ForegroundColor Yellow
Write-Host "Copy these from your existing 'web' service:" -ForegroundColor White
Write-Host ""
Write-Host "Required:" -ForegroundColor Cyan
Write-Host "  - DATABASE_URL" -ForegroundColor White
Write-Host "  - FIREBASE_PRIVATE_KEY" -ForegroundColor White
Write-Host "  - FIREBASE_CLIENT_EMAIL" -ForegroundColor White
Write-Host "  - FIREBASE_PROJECT_ID" -ForegroundColor White
Write-Host "  - NODE_ENV=production" -ForegroundColor White
Write-Host ""
Write-Host "Optional:" -ForegroundColor Cyan
Write-Host "  - FIREBASE_DATABASE_URL" -ForegroundColor White
Write-Host "  - PORT (Railway auto-assigns if not set)" -ForegroundColor White
Write-Host ""

# Step 6: Get variables from existing service
Write-Host "`n📋 Step 6: Get variables from existing service" -ForegroundColor Yellow
$getVars = Read-Host "Do you want to see variables from 'web' service? (y/n)"
if ($getVars -eq 'y') {
    Write-Host "`nSwitching to 'web' service..." -ForegroundColor White
    railway service web
    Write-Host "`nEnvironment variables:" -ForegroundColor White
    railway variables
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Create the service (via Dashboard or CLI)" -ForegroundColor White
Write-Host "2. Set environment variables" -ForegroundColor White
Write-Host "3. Deploy will happen automatically" -ForegroundColor White
Write-Host "4. Check logs: railway logs --service alert-api" -ForegroundColor White
Write-Host "5. Get URL: railway domain --service alert-api" -ForegroundColor White
Write-Host ""
Write-Host "Preparation complete!" -ForegroundColor Green
