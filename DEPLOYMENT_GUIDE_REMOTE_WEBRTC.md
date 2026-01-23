# Quick Deployment Guide - Remote WebRTC Server

## Prerequisites Checklist

- [ ] Raspberry Pi with SSH access
- [ ] Firebase service account key (`serviceAccountKey.json`)
- [ ] Device ID (from `device_id.txt`)
- [ ] Node.js installed on Pi (v14+)
- [ ] GStreamer installed on Pi

## Step 1: Prepare Files

```bash
# On your development machine
# Copy all necessary files to a deployment directory
mkdir -p ~/pi-deployment
cp webrtc-remote-server-simple.js ~/pi-deployment/
cp serviceAccountKey.json ~/pi-deployment/
cp device_id.txt ~/pi-deployment/
```

## Step 2: Deploy to Raspberry Pi

```bash
# From your development machine
RASPBERRY_PI_IP="192.168.1.XXX"  # Replace with your Pi's IP
PI_USER="pi"

# Create directory on Pi
ssh $PI_USER@$RASPBERRY_PI_IP "mkdir -p ~/webrtc-server"

# Copy files
scp ~/pi-deployment/webrtc-remote-server-simple.js \
    $PI_USER@$RASPBERRY_PI_IP:~/webrtc-server/

scp ~/pi-deployment/serviceAccountKey.json \
    $PI_USER@$RASPBERRY_PI_IP:~/webrtc-server/

scp ~/pi-deployment/device_id.txt \
    $PI_USER@$RASPBERRY_PI_IP:~/webrtc-server/

# SSH into Pi
ssh $PI_USER@$RASPBERRY_PI_IP
```

## Step 3: Install Dependencies on Raspberry Pi

```bash
cd ~/webrtc-server

# Install Node.js dependencies
npm init -y
npm install firebase-admin

# Install GStreamer (if not already installed)
sudo apt-get update
sudo apt-get install -y gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good

# For real camera support (optional)
sudo apt-get install -y libcamera-tools
```

## Step 4: Test the Server

### Test 1: Basic Server Startup

```bash
cd ~/webrtc-server

# Run with test pattern
node webrtc-remote-server-simple.js

# Expected output:
# ╔════════════════════════════════════════════════════════╗
# ║   🎥 Remote WebRTC Camera Server                      ║
# ║      Raspberry Pi → React Native App                  ║
# ╚════════════════════════════════════════════════════════╝
# [📱] Device ID: raspberrypi-...
# [🎬] Video: 1280x720@30fps
# [🔊] Bitrate: 2000kbps
# [✅] Device status updated
# [✅] Server ready for WebRTC connections
```

### Test 2: Check Device Status in Firebase

```bash
# In another terminal or use Firebase Console
# Go to: Realtime Database > device_status > {your-device-id}
# Should show: online: true, webrtcReady: true
```

### Test 3: Manual Session Test

```bash
# Create a test session in Firebase Console:
# Path: webrtc_sessions/test-session-001
# Data:
{
  "deviceId": "your-device-id",
  "userId": "test-user",
  "offer": {
    "type": "offer",
    "data": {
      "sdp": "v=0\no=- ...",  // your SDP
      "type": "offer"
    }
  }
}

# Watch server logs - should show:
# [🔗] New WebRTC Session: test-session-001
# [📨] Received offer
# [📤] Generated answer SDP
# [✅] Answer sent to client via Firebase
```

## Step 5: Run as Background Service

### Option A: Using nohup

```bash
cd ~/webrtc-server

# Run in background
nohup node webrtc-remote-server-simple.js > server.log 2>&1 &

# Verify it's running
ps aux | grep webrtc-remote-server-simple

# View logs
tail -f server.log

# Kill the process
pkill -f webrtc-remote-server-simple
```

### Option B: Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

cd ~/webrtc-server

# Start the server
pm2 start webrtc-remote-server-simple.js --name "webrtc-server"

# View logs
pm2 logs webrtc-server

# Auto-restart on reboot
pm2 startup
pm2 save

# Monitor
pm2 monit

# Stop/restart
pm2 stop webrtc-server
pm2 restart webrtc-server
pm2 delete webrtc-server
```

### Option C: Using systemd (Most Robust)

```bash
# Create service file
sudo tee /etc/systemd/system/webrtc-server.service > /dev/null << EOF
[Unit]
Description=WebRTC Camera Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/webrtc-server
ExecStart=/usr/bin/node /home/pi/webrtc-server/webrtc-remote-server-simple.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable webrtc-server
sudo systemctl start webrtc-server

# Check status
sudo systemctl status webrtc-server

# View logs
sudo journalctl -u webrtc-server -f
```

## Configuration Options

Set environment variables before starting:

```bash
# Use real camera instead of test pattern
export USE_REAL_CAMERA=true

# Adjust video quality
export VIDEO_WIDTH=640
export VIDEO_HEIGHT=480
export VIDEO_FPS=15
export VIDEO_BITRATE=500
export VIDEO_PRESET=fast

# Use custom database URL
export DATABASE_URL="https://your-db-url.firebaseio.com"

# Set custom device ID
export DEVICE_ID="my-pi-camera"

# Start server with config
USE_REAL_CAMERA=false VIDEO_WIDTH=640 VIDEO_FPS=15 node webrtc-remote-server-simple.js
```

## Troubleshooting

### GStreamer Not Found

```bash
# Install GStreamer
sudo apt-get install -y gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav

# Test GStreamer
gst-launch-1.0 videotestsrc ! fakesink
```

### Firebase Connection Issues

```bash
# Check if serviceAccountKey.json is valid JSON
jq . serviceAccountKey.json

# Verify database URL
echo $DATABASE_URL

# Check Firebase rules allow device_status writes
# In Firebase Console > Realtime Database > Rules
# Should have: "device_status": { ".write": true }
```

### Out of Memory

```bash
# Check available memory
free -h

# If memory is low, reduce video quality:
export VIDEO_WIDTH=320
export VIDEO_HEIGHT=240
export VIDEO_FPS=10
export VIDEO_BITRATE=256
```

### Permission Denied on Camera

```bash
# Add pi user to video group (for libcamera access)
sudo usermod -a -G video pi

# Log out and log back in for group changes to take effect
exit
ssh pi@$RASPBERRY_PI_IP
```

## Monitoring the Server

### Check Process

```bash
ps aux | grep webrtc-remote-server-simple
```

### View Logs

```bash
# With PM2
pm2 logs webrtc-server

# With systemd
sudo journalctl -u webrtc-server -f

# With nohup
tail -f server.log
```

### Monitor Resources

```bash
# Install htop for better monitoring
sudo apt-get install htop
htop

# Or watch memory/CPU
watch -n 1 'free -h; echo "---"; top -bn1 | head -20'
```

### Check Firebase Status

```bash
# Query device_status
curl -s "https://sensor-app-2a69b-default-rtdb.firebaseio.com/device_status.json" | jq '.'

# Query active sessions
curl -s "https://sensor-app-2a69b-default-rtdb.firebaseio.com/webrtc_sessions.json" | jq '.'
```

## Integration with React Native App

### Update Dashboard (Optional)

In your React Native app, add a "View Camera" button:

```tsx
// In sensor_app/app/dashboard.tsx

const handleViewCamera = (device: any) => {
  // Check if device supports WebRTC
  if (device.status?.webrtcReady) {
    setSelectedDeviceForVideo(device);
    setShowVideoPlayer(true);
  } else {
    Alert.alert('Error', `Device "${device.label}" is not ready for WebRTC streaming`);
  }
};

// In your device list render:
<TouchableOpacity 
  style={styles.viewButton}
  onPress={() => handleViewCamera(device)}
  disabled={!device.status?.webrtcReady}
>
  <Text>🎥 View Live Stream</Text>
</TouchableOpacity>
```

## Performance Tuning

### For Low Bandwidth

```bash
export VIDEO_WIDTH=320
export VIDEO_HEIGHT=240
export VIDEO_FPS=10
export VIDEO_BITRATE=256
node webrtc-remote-server-simple.js
```

### For Low Latency

```bash
export VIDEO_WIDTH=640
export VIDEO_HEIGHT=480
export VIDEO_FPS=30
export VIDEO_BITRATE=1000
export VIDEO_PRESET=ultrafast
node webrtc-remote-server-simple.js
```

### For Better Quality

```bash
export VIDEO_WIDTH=1920
export VIDEO_HEIGHT=1440
export VIDEO_FPS=30
export VIDEO_BITRATE=4000
export VIDEO_PRESET=slow
node webrtc-remote-server-simple.js
```

## Next Steps

1. **Test Connection**: Start the server and check Firebase
2. **Test WebRTC**: Use your React Native app to connect
3. **Monitor Logs**: Watch for any errors or warnings
4. **Optimize**: Adjust video settings based on performance
5. **Deploy**: Move to systemd service for production

## Additional Debugging

### Enable verbose logging (edit server file)

```javascript
// At the top of webrtc-remote-server-simple.js, add:
const DEBUG = process.env.DEBUG === 'true';

// Then use DEBUG flag in logs
if (DEBUG) console.log('[DEBUG]', message);

// Run with:
DEBUG=true node webrtc-remote-server-simple.js
```

### Monitor network usage

```bash
# Install iftop to see real-time network usage
sudo apt-get install iftop
sudo iftop

# Or use nethogs to see per-process network usage
sudo apt-get install nethogs
sudo nethogs
```

## Support

If issues persist, collect this information:

1. Server logs (last 100 lines)
2. Firebase device_status entry
3. Network connectivity test (ping to app, latency)
4. Device resources (free -h, df -h)
5. GStreamer test: `gst-launch-1.0 videotestsrc ! fakesink`
