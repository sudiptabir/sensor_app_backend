#!/usr/bin/env pwsh
# Admin Portal AWS Elastic Beanstalk Deployment Script

param(
    [string]$AWSRegion = "us-east-1",
    [string]$Environment = "production",
    [string]$InstanceType = "t3.small",
    [switch]$CreateNew = $false
)

$ErrorActionPreference = "Stop"

Write-Host "🔐 Deploying Admin Portal to AWS Elastic Beanstalk" -ForegroundColor Green
Write-Host "Region: $AWSRegion" -ForegroundColor Yellow
Write-Host "Environment: $Environment" -ForegroundColor Yellow

# Check if EB CLI is installed
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Blue
try {
    eb --version | Out-Null
    Write-Host "✅ EB CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ EB CLI not installed. Installing..." -ForegroundColor Red
    Write-Host "Run: pip install awsebcli" -ForegroundColor Yellow
    exit 1
}

# Navigate to admin portal directory
$adminPortalPath = "c:\Users\SUDIPTA\Downloads\Sensor_app\admin-portal"
if (-not (Test-Path $adminPortalPath)) {
    Write-Host "❌ Admin portal directory not found: $adminPortalPath" -ForegroundColor Red
    exit 1
}

Set-Location $adminPortalPath
Write-Host "✅ Located admin portal directory" -ForegroundColor Green

# Create .ebextensions directory if it doesn't exist
Write-Host "`n📁 Creating Elastic Beanstalk configuration..." -ForegroundColor Blue
$ebExtDir = ".ebextensions"
if (-not (Test-Path $ebExtDir)) {
    New-Item -ItemType Directory -Path $ebExtDir | Out-Null
}

# Create node configuration
@"
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
  aws:elasticbeanstalk:environment:proxy:
    ProxyServer: nginx
  aws:elasticbeanstalk:environment:proxy:staticfiles:
    /public: public
"@ | Out-File -FilePath "$ebExtDir\nodecommand.config" -Encoding UTF8

Write-Host "✅ Created EB configuration files" -ForegroundColor Green

# Get environment variables from user
Write-Host "`n⚙️ Configure environment variables:" -ForegroundColor Blue
Write-Host "Please provide the following values (or press Enter to use Railway values):" -ForegroundColor Yellow

$databaseUrl = Read-Host "DATABASE_URL (PostgreSQL connection string)"
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    $databaseUrl = $env:DATABASE_URL
    if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
        Write-Host "⚠️ No DATABASE_URL provided. You'll need to set this manually." -ForegroundColor Yellow
        $databaseUrl = "postgresql://user:pass@host:5432/db"
    }
}

# Generate session secret if not provided
$sessionSecret = -join ((1..32) | ForEach-Object { Get-Random -InputObject ([char[]]"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") })

# Initialize EB if not already done
Write-Host "`n🔧 Initializing Elastic Beanstalk..." -ForegroundColor Blue
if (-not (Test-Path ".elasticbeanstalk")) {
    eb init sensor-admin-portal --region $AWSRegion --platform "Node.js 18"
    Write-Host "✅ Initialized Elastic Beanstalk application" -ForegroundColor Green
} else {
    Write-Host "✅ Elastic Beanstalk already initialized" -ForegroundColor Green
}

# Create or update environment
if ($CreateNew) {
    Write-Host "`n🏗️ Creating new environment: sensor-admin-$Environment..." -ForegroundColor Blue
    
    try {
        eb create "sensor-admin-$Environment" `
            --instance-type $InstanceType `
            --envvars "DATABASE_URL=$databaseUrl,SESSION_SECRET=$sessionSecret,NODE_ENV=production,AWS_REGION=$AWSRegion,PORT=8080"
        
        Write-Host "✅ Environment created successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create environment: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n📦 Deploying to existing environment..." -ForegroundColor Blue
    
    # Check if environment exists
    try {
        eb status | Out-Null
        
        # Set environment variables
        Write-Host "⚙️ Updating environment variables..." -ForegroundColor Cyan
        eb setenv "DATABASE_URL=$databaseUrl" "SESSION_SECRET=$sessionSecret" "NODE_ENV=production" "AWS_REGION=$AWSRegion" "PORT=8080"
        
        # Deploy
        Write-Host "🚀 Deploying application..." -ForegroundColor Cyan
        eb deploy
        
        Write-Host "✅ Deployment successful" -ForegroundColor Green
    } catch {
        Write-Host "❌ No existing environment found. Use -CreateNew to create one." -ForegroundColor Red
        Write-Host "Run: .\deploy-admin-to-aws-eb.ps1 -CreateNew" -ForegroundColor Yellow
        exit 1
    }
}

# Get environment information
Write-Host "`n📊 Environment Information:" -ForegroundColor Blue
eb status

# Get the URL
Write-Host "`n🌐 Getting application URL..." -ForegroundColor Blue
$ebInfo = eb status | Out-String
if ($ebInfo -match "CNAME: (.+)") {
    $adminUrl = "http://$($matches[1])"
    Write-Host "`n✅ Admin Portal is deployed at:" -ForegroundColor Green
    Write-Host $adminUrl -ForegroundColor Cyan
    
    # Save URL to file
    @"
Admin Portal AWS Deployment Information
========================================

Deployment Date: $(Get-Date)
Region: $AWSRegion
Environment: sensor-admin-$Environment
Instance Type: $InstanceType

Admin Portal URL:
$adminUrl

Login URL:
$adminUrl/login

Health Check:
$adminUrl/health

Next Steps:
-----------
1. Test the admin portal: $adminUrl/login
2. Create admin account:
   curl -X POST $adminUrl/api/setup/create-admin \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"YourPassword123!","fullName":"Admin User","setupKey":"setup123"}'

3. Set up custom domain (optional):
   - Get SSL certificate from AWS Certificate Manager
   - Configure Route 53 DNS
   - Update EB environment with custom domain

4. Update backend services with new admin portal URL:
   ADMIN_PORTAL_URL=$adminUrl

Environment Variables Set:
-------------------------
- DATABASE_URL: [CONFIGURED]
- SESSION_SECRET: [CONFIGURED]
- NODE_ENV: production
- AWS_REGION: $AWSRegion
- PORT: 8080

Monitoring:
----------
View logs: eb logs
View health: eb health
Open console: eb console
"@ | Out-File -FilePath "AWS_ADMIN_DEPLOYMENT.txt" -Encoding UTF8
    
    Write-Host "`n💾 Deployment info saved to: AWS_ADMIN_DEPLOYMENT.txt" -ForegroundColor Green
} else {
    Write-Host "⚠️ Could not extract URL. Check 'eb status' manually." -ForegroundColor Yellow
}

# Additional setup instructions
Write-Host "`n📋 Post-Deployment Steps:" -ForegroundColor Blue
Write-Host "1. ✅ Admin portal is deployed" -ForegroundColor Green
Write-Host "2. 🧪 Test the login page: $adminUrl/login" -ForegroundColor Yellow
Write-Host "3. 👤 Create your first admin account (see AWS_ADMIN_DEPLOYMENT.txt)" -ForegroundColor Yellow
Write-Host "4. 🔒 Set up SSL/custom domain for production use" -ForegroundColor Yellow
Write-Host "5. 🔄 Update your sensor backend with new admin URL" -ForegroundColor Yellow

Write-Host "`n🎉 Admin Portal AWS Deployment Complete!" -ForegroundColor Green

# Optional: Open browser
$openBrowser = Read-Host "`nOpen admin portal in browser? (Y/n)"
if ($openBrowser -ne 'n') {
    Start-Process $adminUrl
}