# Remote WebRTC Streaming - Quick Start Checklist

## ✅ Pre-Deployment Checklist

### On Your Development Machine
- [ ] Clone/access the Sensor_app repository
- [ ] Have `serviceAccountKey.json` available
- [ ] Know your Raspberry Pi's IP address
- [ ] Have SSH access to Raspberry Pi
- [ ] Have `device_id.txt` from your app

### Raspberry Pi Requirements
- [ ] Raspberry Pi 3B+ or newer
- [ ] Raspberry Pi OS (Bullseye or newer)
- [ ] Network connection (WiFi or Ethernet)
- [ ] 2GB+ RAM available
- [ ] 5GB+ free disk space
- [ ] SSH enabled

---

## 🚀 5-Minute Quick Start

### Step 1: SSH into Raspberry Pi (30 seconds)
```bash
ssh pi@<YOUR_PI_IP>
```

### Step 2: Create Server Directory (30 seconds)
```bash
mkdir -p ~/webrtc-server
cd ~/webrtc-server
```

### Step 3: Download Files (1 minute)
```bash
# Copy from your dev machine or download
# webrtc-remote-server-simple.js
# serviceAccountKey.json  
# device_id.txt

# Verify files exist
ls -la
```

### Step 4: Install Dependencies (2 minutes)
```bash
npm init -y
npm install firebase-admin

# Install system packages
sudo apt-get update
sudo apt-get install -y gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good
```

### Step 5: Start Server (30 seconds)
```bash
node webrtc-remote-server-simple.js
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════╗
║   🎥 Remote WebRTC Camera Server                      ║
║      Raspberry Pi → React Native App                  ║
╚════════════════════════════════════════════════════════╝
[📱] Device ID: raspberrypi-...
[✅] Device status updated
[✅] Server ready for WebRTC connections
```

**If you see this → Server is working! ✅**

---

## 🔍 Verify Setup (2 minutes)

### Check 1: Firebase Console
1. Open [Firebase Console](https://console.firebase.google.com)
2. Go to Realtime Database
3. Navigate to `device_status`
4. Should see your device with:
   - `online: true`
   - `webrtcReady: true`
   - `lastSeen: recent timestamp`

### Check 2: Server Logs
```bash
# Watch for messages like:
# [✅] Device status updated
# [✅] Server ready for WebRTC connections
```

### Check 3: Network Connectivity
```bash
# Test STUN server
nc -zu stun.l.google.com 19302
# Should say: Connection succeeded

# Test Firebase
curl -s https://sensor-app-2a69b-default-rtdb.firebaseio.com/.json | head -c 100
# Should return JSON data
```

---

## 🎮 Test in React Native App

### Step 1: Update Dashboard

In `sensor_app/app/dashboard.tsx`, add video streaming:

```tsx
// Add to imports
import WebRTCVideoPlayer from '../utils/WebRTCVideoPlayer';

// In your device list, add button:
<TouchableOpacity 
  onPress={() => {
    setSelectedDeviceForVideo(device);
    setShowVideoPlayer(true);
  }}
  style={styles.videoButton}
>
  <Text>🎥 View Stream</Text>
</TouchableOpacity>

// Add modal for video player:
{showVideoPlayer && selectedDeviceForVideo && (
  <Modal visible={true} onRequestClose={() => setShowVideoPlayer(false)}>
    <WebRTCVideoPlayer 
      deviceId={selectedDeviceForVideo.id}
      deviceLabel={selectedDeviceForVideo.label}
      onClose={() => setShowVideoPlayer(false)}
    />
  </Modal>
)}
```

### Step 2: Test Connection
1. Make sure server is running on Pi
2. Open app on your phone
3. Click "View Stream" button
4. Should see:
   - "Connecting to camera..." → "Waiting for answer..."
   - If successful: Stream appears with "✅ LIVE"

---

## 🐛 Troubleshooting Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| "Device not ready" | `curl` Firebase console - check device_status |
| "Answer not received" | Check server logs: `tail -f server.log` |
| "Connection failed" | Test STUN: `nc -zu stun.l.google.com 19302` |
| "No video appearing" | Check GStreamer: `gst-launch-1.0 videotestsrc ! fakesink` |
| Server crashed | `node webrtc-remote-server-simple.js` in terminal to see errors |

---

## 📊 Performance Tuning

### For Fast Networks (>10 Mbps)
```bash
export VIDEO_WIDTH=1280
export VIDEO_HEIGHT=720
export VIDEO_FPS=30
export VIDEO_BITRATE=2000
node webrtc-remote-server-simple.js
```

### For Medium Networks (5-10 Mbps)
```bash
export VIDEO_WIDTH=640
export VIDEO_HEIGHT=480
export VIDEO_FPS=20
export VIDEO_BITRATE=1000
node webrtc-remote-server-simple.js
```

### For Slow Networks (<5 Mbps)
```bash
export VIDEO_WIDTH=320
export VIDEO_HEIGHT=240
export VIDEO_FPS=15
export VIDEO_BITRATE=256
node webrtc-remote-server-simple.js
```

---

## 🔧 Run as Background Service

### Option 1: Using PM2 (Easiest)

```bash
# Install PM2
npm install -g pm2

# Start server
cd ~/webrtc-server
pm2 start webrtc-remote-server-simple.js --name "webrtc-server"

# Auto-start on reboot
pm2 startup
pm2 save

# View logs anytime
pm2 logs webrtc-server

# Control
pm2 stop webrtc-server      # Stop
pm2 restart webrtc-server   # Restart
pm2 delete webrtc-server    # Delete
```

### Option 2: Using systemd (Most Robust)

```bash
# Create service file
sudo nano /etc/systemd/system/webrtc-server.service
```

Paste this content:
```ini
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
```

Then:
```bash
# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable webrtc-server
sudo systemctl start webrtc-server

# Check status
sudo systemctl status webrtc-server

# View logs
sudo journalctl -u webrtc-server -f
```

---

## 📈 Monitoring Checklist

Daily/Weekly checks:

- [ ] Server still running: `ps aux | grep webrtc`
- [ ] Device status online: Check Firebase Console
- [ ] No errors in logs: `tail -50 server.log | grep error`
- [ ] Memory usage normal: `free -h` (should be < 256MB)
- [ ] Disk usage acceptable: `df -h` (should be > 1GB free)

---

## 🆘 Help Resources

1. **Server Won't Start?**
   - Check logs: `node webrtc-remote-server-simple.js`
   - Verify Node.js: `node --version` (should be 14+)
   - Test Firebase key: `jq . serviceAccountKey.json`

2. **App Can't Connect?**
   - Server running on Pi? `ps aux | grep webrtc`
   - Device online in Firebase? Check device_status
   - Check app logs for WebRTC errors

3. **Video Quality Bad?**
   - Reduce bitrate: `export VIDEO_BITRATE=500`
   - Lower resolution: `export VIDEO_WIDTH=480`
   - Check network: `iperf3 -c <pi-ip>`

4. **Need Detailed Logs?**
   - Enable debugging in code
   - Check both server logs and app console
   - Use Firebase Console to monitor sessions

---

## 📚 Full Documentation Files

- `REMOTE_WEBRTC_INTEGRATION.md` - Complete integration guide
- `DEPLOYMENT_GUIDE_REMOTE_WEBRTC.md` - Detailed deployment steps  
- `TROUBLESHOOTING_REMOTE_WEBRTC.md` - In-depth troubleshooting
- `webrtc-remote-server-simple.js` - Server implementation
- `sensor_app/utils/WebRTCVideoPlayer.tsx` - Video player component

---

## ✅ Success Criteria

You've successfully set up remote WebRTC streaming when:

1. ✅ Server runs without errors: `[✅] Server ready for WebRTC connections`
2. ✅ Device appears online in Firebase: device_status shows `online: true`
3. ✅ App can connect and create sessions (visible in Firebase)
4. ✅ Answers are generated and sent back (visible in server logs)
5. ✅ Video stream appears in React Native app
6. ✅ Video persists for at least 30 seconds without disconnecting

---

## 🎯 Next Steps After Success

1. **Optimize Performance**
   - Fine-tune video settings for your network
   - Monitor CPU/memory usage
   - Test quality at different bitrates

2. **Secure the Connection**
   - Implement device authentication
   - Add user authorization checks
   - Enable Firebase security rules

3. **Scale Up**
   - Add multiple cameras
   - Support multiple concurrent connections
   - Implement load balancing

4. **Monitor & Maintain**
   - Set up alerts for server crashes
   - Monitor Firebase quota usage
   - Regular log review and cleanup

---

**Questions?** Check TROUBLESHOOTING_REMOTE_WEBRTC.md or REMOTE_WEBRTC_INTEGRATION.md
