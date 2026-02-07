# Quick Test Script for User Blocking
# Run this to test if blocking works

Write-Host "================================" -ForegroundColor Cyan
Write-Host "🧪 Testing User Blocking" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check service health
Write-Host "Step 1: Checking service health..." -ForegroundColor Yellow
$health = curl https://alert-api-production-dc04.up.railway.app/health -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json
Write-Host "✅ Service Status: $($health.status)" -ForegroundColor Green
Write-Host "✅ Firebase: $($health.firebase)" -ForegroundColor Green
Write-Host ""

# Step 2: Check if user is blocked
Write-Host "Step 2: Checking if user is blocked..." -ForegroundColor Yellow
$env:PGPASSWORD = 'wFokJzbqkVDDOKQQVapQHOXzWlyPZIme'
$blockCheck = psql -h centerbeam.proxy.rlwy.net -p 46434 -U postgres -d railway -t -c "SELECT is_active FROM user_blocks WHERE user_id = 'GKu2p6uvarhEzrKG85D7fXbxUh23';"
if ($blockCheck -match 't') {
    Write-Host "✅ User is BLOCKED" -ForegroundColor Green
} else {
    Write-Host "⚠️  User is NOT blocked" -ForegroundColor Red
    Write-Host "   Run this to block the user:" -ForegroundColor Yellow
    Write-Host "   psql -h centerbeam.proxy.rlwy.net -p 46434 -U postgres -d railway -c `"UPDATE user_blocks SET is_active = true WHERE user_id = 'GKu2p6uvarhEzrKG85D7fXbxUh23';`"" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Instructions
Write-Host "Step 3: Send test alert" -ForegroundColor Yellow
Write-Host "   Open TWO terminal windows:" -ForegroundColor White
Write-Host ""
Write-Host "   Terminal 1 - Watch logs:" -ForegroundColor Cyan
Write-Host "   railway service alert-api" -ForegroundColor White
Write-Host "   railway logs --follow" -ForegroundColor White
Write-Host ""
Write-Host "   Terminal 2 - Send alert:" -ForegroundColor Cyan
Write-Host "   node rpi_send_alert.js" -ForegroundColor White
Write-Host ""

Write-Host "Step 4: What to look for in logs" -ForegroundColor Yellow
Write-Host "   If blocking works, you should see:" -ForegroundColor White
Write-Host "   🚨 Received alert: ..." -ForegroundColor Gray
Write-Host "   👤 Device owner: GKu2p6uvarhEzrKG85D7fXbxUh23" -ForegroundColor Gray
Write-Host "   🚫 User GKu2p6uvarhEzrKG85D7fXbxUh23 is BLOCKED: testing" -ForegroundColor Gray
Write-Host "   🚫 Skipping alert storage..." -ForegroundColor Gray
Write-Host "   🚫 Skipping notification..." -ForegroundColor Gray
Write-Host ""

Write-Host "Step 5: Verify on phone" -ForegroundColor Yellow
Write-Host "   ❌ Should NOT receive push notification" -ForegroundColor White
Write-Host "   ❌ Should NOT see alert in app" -ForegroundColor White
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Ready to test! Follow the steps above." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
