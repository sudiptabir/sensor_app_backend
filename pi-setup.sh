#!/bin/bash

# Raspberry Pi WebRTC Camera Server - Setup Script
# Run this once to set everything up

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════╗"
echo "║   🎥 WebRTC Camera Server - Setup Script          ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo "⚠️  Warning: This doesn't appear to be a Raspberry Pi"
    echo "   (But continuing anyway...)"
fi

# Step 1: Get Firebase URL
echo ""
echo "📝 Step 1: Firebase Configuration"
echo "=================================="
echo ""
echo "Go to: https://console.firebase.google.com"
echo "1. Select your project"
echo "2. Click 'Realtime Database'"
echo "3. Copy the URL (looks like: https://your-project.firebaseio.com)"
echo ""
read -p "Enter your Firebase Realtime DB URL: " FIREBASE_DB_URL

# Step 2: Get Device ID
echo ""
echo "📝 Step 2: Device ID"
echo "===================="
echo ""
read -p "Enter device ID (e.g., 'pi-living-room'): " DEVICE_ID

# Step 3: Verify serviceAccountKey.json
echo ""
echo "📝 Step 3: Firebase Service Account Key"
echo "========================================"
if [ ! -f "./serviceAccountKey.json" ]; then
    echo ""
    echo "❌ serviceAccountKey.json not found!"
    echo ""
    echo "To get this file:"
    echo "1. Go to Firebase Console → Project Settings"
    echo "2. Click 'Service Accounts' tab"
    echo "3. Click 'Generate New Private Key'"
    echo "4. Download and place in ~/Sensor_app/serviceAccountKey.json"
    echo ""
    read -p "Have you added serviceAccountKey.json? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled. Please add serviceAccountKey.json first."
        exit 1
    fi
else
    echo "✅ serviceAccountKey.json found"
fi

# Step 4: Create start script
echo ""
echo "✅ Creating start-camera.sh script..."
cat > start-camera.sh << EOF
#!/bin/bash

# WebRTC Camera Server Configuration
export DEVICE_ID="$DEVICE_ID"
export FIREBASE_DB_URL="$FIREBASE_DB_URL"
export FIREBASE_KEY_PATH="./serviceAccountKey.json"

echo "🎥 Starting WebRTC Camera Server"
echo "Device ID: \$DEVICE_ID"
echo "Firebase URL: \$FIREBASE_DB_URL"
echo ""

# Start the server
node webrtc-camera-server.js
EOF

chmod +x start-camera.sh
echo "✅ start-camera.sh created"

# Step 5: Create .env file
echo ""
echo "✅ Creating .env file..."
cat > .env << EOF
DEVICE_ID="$DEVICE_ID"
FIREBASE_DB_URL="$FIREBASE_DB_URL"
FIREBASE_KEY_PATH="./serviceAccountKey.json"
EOF
echo "✅ .env file created"

# Step 6: Add to .bashrc
echo ""
echo "✅ Adding to ~/.bashrc..."
if ! grep -q "DEVICE_ID=" ~/.bashrc; then
    cat >> ~/.bashrc << EOF

# WebRTC Camera Server Configuration
export DEVICE_ID="$DEVICE_ID"
export FIREBASE_DB_URL="$FIREBASE_DB_URL"
export FIREBASE_KEY_PATH="./serviceAccountKey.json"
EOF
    echo "✅ Added to ~/.bashrc"
else
    echo "⚠️  Already configured in ~/.bashrc"
fi

# Step 7: Summary
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║             ✅ Setup Complete!                    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo "📋 Configuration Summary:"
echo "   Device ID: $DEVICE_ID"
echo "   Firebase URL: $FIREBASE_DB_URL"
echo "   Service Key: ./serviceAccountKey.json"
echo ""
echo "🚀 To start the camera server, run:"
echo "   ./start-camera.sh"
echo ""
echo "💡 Or simply run:"
echo "   node webrtc-camera-server.js"
echo ""
echo "The environment variables are now set permanently in ~/.bashrc"
echo ""
