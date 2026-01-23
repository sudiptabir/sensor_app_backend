# Configuration Template - webrtc-remote-server-simple.js

## Environment Variables

Create a `.env` file in your server directory with these settings:

```bash
# ============================================================================
# RASPBERRY PI WEBRTC SERVER CONFIGURATION
# ============================================================================

# Firebase Configuration
DATABASE_URL=https://sensor-app-2a69b-default-rtdb.firebaseio.com
SERVICE_ACCOUNT_KEY=./serviceAccountKey.json

# Device Configuration
DEVICE_ID=raspberrypi-main
DEVICE_LABEL=Raspberry Pi Main Camera

# Video Settings
USE_REAL_CAMERA=false          # Set to true to use real Pi camera
VIDEO_WIDTH=1280               # Resolution width in pixels
VIDEO_HEIGHT=720               # Resolution height in pixels
VIDEO_FPS=30                   # Frames per second
VIDEO_BITRATE=2000             # Bitrate in kbps
VIDEO_PRESET=ultrafast         # Encoding preset: ultrafast|fast|medium|slow

# Server Settings
PORT=3000
NODE_ENV=production

# GStreamer Settings (advanced)
GST_DEBUG=2                    # GStreamer debug level (0-5)
GST_PLUGIN_PATH=/usr/lib/gstreamer-1.0

# Logging
LOG_LEVEL=info                 # debug|info|warn|error
LOG_FILE=/var/log/webrtc-server.log

# Performance
MAX_SESSIONS=10                # Max concurrent sessions
SESSION_TIMEOUT=300000         # Session timeout in ms (5 min)
MEMORY_LIMIT=256               # Max memory in MB
```

## Preset Configurations

### Development/Testing
```bash
# Quick testing with test pattern
export USE_REAL_CAMERA=false
export VIDEO_WIDTH=640
export VIDEO_HEIGHT=480
export VIDEO_FPS=15
export VIDEO_BITRATE=500
export LOG_LEVEL=debug
```

### Production - Good Quality
```bash
# Balanced setup for typical home network
export USE_REAL_CAMERA=true
export VIDEO_WIDTH=1280
export VIDEO_HEIGHT=720
export VIDEO_FPS=30
export VIDEO_BITRATE=2000
export VIDEO_PRESET=fast
export LOG_LEVEL=info
```

### Production - High Performance
```bash
# Optimized for fast networks
export USE_REAL_CAMERA=true
export VIDEO_WIDTH=1920
export VIDEO_HEIGHT=1440
export VIDEO_FPS=30
export VIDEO_BITRATE=4000
export VIDEO_PRESET=slow
export LOG_LEVEL=info
```

### Production - Low Bandwidth
```bash
# Optimized for slow networks/mobile
export USE_REAL_CAMERA=true
export VIDEO_WIDTH=320
export VIDEO_HEIGHT=240
export VIDEO_FPS=15
export VIDEO_BITRATE=256
export VIDEO_PRESET=ultrafast
export LOG_LEVEL=info
```

### Production - Streaming Long Hours
```bash
# Optimized for stability and efficiency
export USE_REAL_CAMERA=true
export VIDEO_WIDTH=640
export VIDEO_HEIGHT=480
export VIDEO_FPS=20
export VIDEO_BITRATE=800
export VIDEO_PRESET=veryfast
export MAX_SESSIONS=5
export SESSION_TIMEOUT=600000
export LOG_LEVEL=info
```

## Loading Configuration

### Method 1: Environment Variables (Direct)

```bash
# In terminal before starting
export DEVICE_ID="my-camera"
export VIDEO_WIDTH=640
node webrtc-remote-server-simple.js
```

### Method 2: .env File

Create `.env` file:
```bash
DEVICE_ID=my-camera
VIDEO_WIDTH=640
VIDEO_FPS=15
```

Load with node-env:
```bash
npm install dotenv
```

Update top of `webrtc-remote-server-simple.js`:
```javascript
require('dotenv').config();
```

Start normally:
```bash
node webrtc-remote-server-simple.js
```

### Method 3: Shell Script

Create `start.sh`:
```bash
#!/bin/bash

# Load configuration
export DEVICE_ID="raspberrypi-main"
export VIDEO_WIDTH=1280
export VIDEO_HEIGHT=720
export VIDEO_FPS=30
export VIDEO_BITRATE=2000
export USE_REAL_CAMERA=false
export DATABASE_URL="https://sensor-app-2a69b-default-rtdb.firebaseio.com"

# Start server
node webrtc-remote-server-simple.js
```

Usage:
```bash
chmod +x start.sh
./start.sh
```

### Method 4: PM2 with Ecosystem File

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'webrtc-server',
    script: './webrtc-remote-server-simple.js',
    watch: false,
    max_memory_restart: '256M',
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    env: {
      NODE_ENV: 'production',
      DEVICE_ID: 'raspberrypi-main',
      VIDEO_WIDTH: 1280,
      VIDEO_HEIGHT: 720,
      VIDEO_FPS: 30,
      VIDEO_BITRATE: 2000,
      USE_REAL_CAMERA: false,
      DATABASE_URL: 'https://sensor-app-2a69b-default-rtdb.firebaseio.com'
    }
  }]
};
```

Start with:
```bash
pm2 start ecosystem.config.js
```

## Network Configuration

### Local Network (Same WiFi)
```bash
# No special configuration needed
# Just use Pi's local IP address
```

### Remote Access (Different Network)

#### Option A: VPN (Recommended)
```bash
# Use VPN to access Pi from anywhere
# Most secure option
# No port forwarding needed
```

#### Option B: Port Forwarding
```bash
# In your router admin panel:
# Forward port 19302 (STUN) to Pi's IP:19302
# Be aware of security implications
```

#### Option C: CloudFlare Tunnel
```bash
# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/download/2024.1.5/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared-linux-arm64.deb

# Create tunnel
cloudflared tunnel create webrtc-pi

# Configure tunnel
# Forward to localhost:3000

# Start tunnel
cloudflared tunnel run webrtc-pi
```

## Firewall Configuration

### ufw (Ubuntu/Debian)

```bash
# Allow STUN
sudo ufw allow 19302/tcp
sudo ufw allow 19302/udp

# Allow GStreamer RTP (if using)
sudo ufw allow 5004/udp

# Allow SSH
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### iptables (Direct)

```bash
# Allow STUN
sudo iptables -A INPUT -p tcp --dport 19302 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 19302 -j ACCEPT

# Save rules (iptables-persistent)
sudo apt-get install iptables-persistent
sudo netfilter-persistent save
```

## Video Codec Configuration

### H.264 (Current - Recommended)
```bash
# Built into webrtc-remote-server-simple.js
# Good compression, widely supported
# Bitrate: 256-4000 kbps depending on quality
```

### VP8 (Alternative)
```bash
# If you want to modify server for VP8:
# More modern, better compression
# May not be supported on older devices
# Requires server modification
```

## STUN/TURN Configuration

### Google STUN (Current - Free)
```javascript
// In WebRTCVideoPlayer.tsx
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
```

### Custom TURN Server (For NAT)
```javascript
// If using TURN for better reliability
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: ['turn:your-turn-server.com:3478'],
    username: 'username',
    credential: 'password'
  }
];
```

## Security Configuration

### Firebase Rules

**Restrictive (Recommended)**
```javascript
rules_version = '2';
service realtime {
  match /databases/{database}/documents {
    match /device_status/{deviceId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == root.child('devices').child(deviceId).child('ownerId').val();
    }
    match /webrtc_sessions/{sessionId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.userId || 
         request.auth.uid == resource.data.deviceOwnerId);
    }
  }
}
```

**Development (Permissive - Testing Only)**
```javascript
rules_version = '2';
service realtime {
  match /databases/{database}/documents {
    match /{path=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Monitoring Configuration

### Prometheus Metrics (Optional)

Add to server:
```javascript
const prometheus = require('prom-client');

// Register custom metrics
const sessionCounter = new prometheus.Counter({
  name: 'webrtc_sessions_total',
  help: 'Total WebRTC sessions',
});

const connectionDuration = new prometheus.Histogram({
  name: 'webrtc_connection_duration_seconds',
  help: 'Connection duration in seconds',
  buckets: [5, 10, 30, 60, 120, 300],
});
```

### Log Aggregation

```bash
# Install fluent-bit
wget https://packages.fluentbit.io/debian/fluent-bit-2024.01.00-amd64.deb
sudo dpkg -i fluent-bit-2024.01.00-amd64.deb

# Configure to send logs to ELK, Splunk, etc.
# Edit /etc/fluent-bit/fluent-bit.conf
```

## Backup Configuration

### Automatic Backup Script

Create `backup.sh`:
```bash
#!/bin/bash

BACKUP_DIR="/home/pi/backups"
mkdir -p $BACKUP_DIR

# Backup important files
tar -czf $BACKUP_DIR/webrtc-server-$(date +%Y%m%d).tar.gz \
  ~/webrtc-server/serviceAccountKey.json \
  ~/webrtc-server/device_id.txt \
  ~/webrtc-server/server.log

# Keep only last 30 days
find $BACKUP_DIR -mtime +30 -delete

echo "Backup complete: $BACKUP_DIR"
```

Schedule with cron:
```bash
crontab -e
# Add: 0 2 * * * /home/pi/backup.sh
```

## Testing Configuration

### Unit Test Script

```bash
#!/bin/bash

echo "Testing WebRTC Server Configuration..."

# Test 1: Node.js
echo "✓ Node.js version:"
node --version

# Test 2: Firebase credentials
echo "✓ Firebase credentials:"
jq '.project_id' serviceAccountKey.json

# Test 3: GStreamer
echo "✓ GStreamer:"
gst-launch-1.0 videotestsrc ! fakesink 2>&1 | head -1

# Test 4: Network
echo "✓ Network to Firebase:"
curl -I https://sensor-app-2a69b-default-rtdb.firebaseio.com 2>&1 | head -1

# Test 5: STUN
echo "✓ STUN server:"
nc -zu stun.l.google.com 19302 && echo "Reachable" || echo "Unreachable"

echo ""
echo "Configuration test complete!"
```

## Summary

This template provides:
- ✅ Pre-configured settings for different scenarios
- ✅ Multiple loading methods (env vars, .env file, scripts)
- ✅ Network configuration examples
- ✅ Security settings
- ✅ Monitoring setup
- ✅ Testing procedures

Choose the configuration that matches your use case and network environment.
