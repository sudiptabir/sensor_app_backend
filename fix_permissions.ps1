# This script will:
# 1. Download the service account key
# 2. Grant it Firestore permissions
# 3. Test the connection

$projectId = "sensor-app-2a69b"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Firebase Service Account Permissions Fix" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "[Step 1] Download Service Account Key from Firebase Console" -ForegroundColor Yellow
Write-Host "Visit: https://console.firebase.google.com/project/$projectId/settings/serviceaccounts/adminsdk"
Write-Host "Click: 'Generate New Private Key'"
Write-Host "Save as: serviceAccountKey.json in this directory"
Write-Host ""
Write-Host "Press ENTER once you have placed the file here..."
Read-Host

# Check if file exists
if (-not (Test-Path "serviceAccountKey.json")) {
    Write-Host "ERROR: serviceAccountKey.json not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SUCCESS: Found serviceAccountKey.json" -ForegroundColor Green

# Extract service account email
$key = Get-Content "serviceAccountKey.json" | ConvertFrom-Json
$serviceAccountEmail = $key.client_email

Write-Host "Email: $serviceAccountEmail" -ForegroundColor Cyan

# Grant permissions
Write-Host ""
Write-Host "Step 2: Granting Firebase Admin permissions..." -ForegroundColor Yellow

gcloud projects add-iam-policy-binding $projectId `
  --member="serviceAccount:$serviceAccountEmail" `
  --role="roles/firebase.admin" `
  --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Permissions granted!" -ForegroundColor Green
} else {
    Write-Host "WARNING: Could not auto-grant permissions" -ForegroundColor Yellow
    Write-Host "Manual fix needed at https://console.cloud.google.com/iam-admin/iam" -ForegroundColor Yellow
    Write-Host "Add Member: $serviceAccountEmail" -ForegroundColor Yellow
    Write-Host "Role: Firebase Admin" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 3: Waiting for propagation..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "Step 4: Testing connection..." -ForegroundColor Yellow
python3 rpi_firestore_test.py

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
