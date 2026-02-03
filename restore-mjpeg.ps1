# Restore MJPEG Configuration
Write-Host "🔄 Restoring MJPEG Configuration..." -ForegroundColor Cyan
Write-Host ""

# Check if backup files exist
$backupDir = "MJPEG_BACKUP"
if (-not (Test-Path $backupDir)) {
    Write-Host "❌ Error: Backup directory not found!" -ForegroundColor Red
    Write-Host "   Looking for: $backupDir" -ForegroundColor Yellow
    exit 1
}

$file1 = "$backupDir\MJPEGVideoPlayer.tsx.backup"
$file2 = "$backupDir\MJPEGVideoPlayerWebView.tsx.backup"

if (-not (Test-Path $file1)) {
    Write-Host "❌ Error: Backup file not found: $file1" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $file2)) {
    Write-Host "❌ Error: Backup file not found: $file2" -ForegroundColor Red
    exit 1
}

# Copy backup files
try {
    Copy-Item $file1 "sensor_app\utils\MJPEGVideoPlayer.tsx" -Force
    Write-Host "✅ Restored: MJPEGVideoPlayer.tsx" -ForegroundColor Green
    
    Copy-Item $file2 "sensor_app\utils\MJPEGVideoPlayerWebView.tsx" -Force
    Write-Host "✅ Restored: MJPEGVideoPlayerWebView.tsx" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "🎉 Files successfully restored!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error during file copy: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "⚠️  MANUAL STEPS REQUIRED" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Update Import Statement (dashboard.tsx, line ~11)" -ForegroundColor Yellow
Write-Host ""
Write-Host "   REMOVE:" -ForegroundColor Red
Write-Host "   import WebRTCVideoPlayer from '../utils/WebRTCVideoPlayer';" -ForegroundColor Red
Write-Host ""
Write-Host "   ADD:" -ForegroundColor Green
Write-Host "   import MJPEGVideoPlayer from '../utils/MJPEGVideoPlayer';" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "2️⃣  Update Component Usage (dashboard.tsx, lines ~1520-1540)" -ForegroundColor Yellow
Write-Host ""
Write-Host "   REMOVE:" -ForegroundColor Red
Write-Host "   <WebRTCVideoPlayer" -ForegroundColor Red
Write-Host "     deviceId={selectedDeviceForVideo?.id}" -ForegroundColor Red
Write-Host "     deviceLabel={selectedDeviceForVideo?.name || 'Camera'}" -ForegroundColor Red
Write-Host "     onClose={() => {...}}" -ForegroundColor Red
Write-Host "   />" -ForegroundColor Red
Write-Host ""
Write-Host "   ADD:" -ForegroundColor Green
Write-Host "   <MJPEGVideoPlayer" -ForegroundColor Green
Write-Host "     streamUrl={\`http://\${selectedDeviceForVideo.ipAddress || selectedDeviceForVideo.ip_address}:8080/stream.mjpeg\`}" -ForegroundColor Green
Write-Host "     deviceLabel={selectedDeviceForVideo?.name || 'Camera'}" -ForegroundColor Green
Write-Host "     onClose={() => {...}}" -ForegroundColor Green
Write-Host "   />" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "3️⃣  Rebuild the App" -ForegroundColor Yellow
Write-Host ""
Write-Host "   cd sensor_app" -ForegroundColor Cyan
Write-Host "   npx expo start --clear" -ForegroundColor Cyan
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📖 For detailed instructions, see:" -ForegroundColor Cyan
Write-Host "   MJPEG_BACKUP\MJPEG_RESTORE_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
