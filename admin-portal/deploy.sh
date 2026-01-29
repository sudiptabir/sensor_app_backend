#!/bin/bash

# Admin Portal Deployment Script for Railway
# This script helps deploy the admin portal to Railway

echo "╔════════════════════════════════════════════╗"
echo "║  Admin Portal Railway Deployment Helper    ║"
echo "╚════════════════════════════════════════════╝"

# Check if in admin-portal directory
if [ ! -f "server.js" ]; then
    echo "❌ Error: server.js not found. Please run this from admin-portal directory"
    echo "cd admin-portal && bash deploy.sh"
    exit 1
fi

echo ""
echo "Step 1: Checking Railway CLI..."

if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
else
    echo "✅ Railway CLI found"
fi

echo ""
echo "Step 2: Railway Status"
railway whoami

echo ""
echo "Step 3: Link to Railway Project"
echo "Choose your project (should be your sensor-app-production):"
railway link

echo ""
echo "Step 4: Set Root Directory (if new service)"
echo "In Railway Dashboard:"
echo "1. Go to admin-portal service"
echo "2. Settings → Build → Root Directory: admin-portal"
echo "3. Redeploy"

echo ""
echo "Step 5: Set Environment Variables in Railway Dashboard"
echo ""
echo "Required variables:"
cat <<'EOF'
NODE_ENV=production
PORT=4000
SESSION_SECRET=[generate-long-random-string]
API_KEY=test-api-key-123
SETUP_KEY=setup123
FIREBASE_DATABASE_URL=https://sensor-app-2a69b.firebaseio.com
FIREBASE_SERVICE_ACCOUNT=[paste-full-serviceAccountKey.json]
ADMIN_PORTAL_URL=[your-admin-portal.railway.app-url]
DATABASE_URL=[same-as-backend, Railway auto-provides]
EOF

echo ""
echo "Step 6: Deploy"
echo "Option A: Push to GitHub (auto-deploys via Railway)"
echo "git push origin main"
echo ""
echo "Option B: Deploy from local (requires railway CLI)"
echo "railway up"

echo ""
echo "Step 7: Get Your URL"
railway domain

echo ""
echo "Step 8: Create Admin User"
echo ""
echo "Once deployed, create your first admin:"
echo ""
read -p "Enter your admin email (default: admin@example.com): " EMAIL
EMAIL=${EMAIL:-"admin@example.com"}
read -p "Enter admin password: " PASSWORD
ADMIN_PORTAL_URL=$(railway domain | tail -1)
SETUP_KEY="setup123"

echo ""
echo "Creating admin user at: https://${ADMIN_PORTAL_URL}/api/setup/create-admin"
echo ""

curl -X POST "https://${ADMIN_PORTAL_URL}/api/setup/create-admin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'${EMAIL}'",
    "password": "'${PASSWORD}'",
    "fullName": "Admin User",
    "setupKey": "'${SETUP_KEY}'"
  }'

echo ""
echo ""
echo "✅ Setup complete!"
echo ""
echo "Access your admin portal at: https://${ADMIN_PORTAL_URL}/login"
echo "Email: ${EMAIL}"
echo ""
echo "Next steps:"
echo "1. Login to admin portal"
echo "2. Create device access rules"
echo "3. Grant user permissions"
