# Remote WebRTC Streaming - Troubleshooting Guide

## Problem Diagnosis Flowchart

```
Is the Pi server running?
├─ YES → Is Firebase receiving device_status update?
│        ├─ YES → Is the React app creating sessions?
│        │        ├─ YES → Are offers being received by server?
│        │        │        ├─ YES → Are answers being sent back?
│        │        │        │        ├─ YES → Check ICE candidates
│        │        │        │        └─ NO → SDP generation issue
│        │        │        └─ NO → Offer not reaching Firebase
│        │        └─ NO → Firebase connectivity issue
│        └─ NO → Server not authenticating with Firebase
└─ NO → Server not running or crashed
```

## Common Issues & Solutions

### 1. "Device is not ready for WebRTC"

**Symptoms:**
- React app shows error immediately
- No attempt to connect

**Root Causes:**
- Server hasn't started yet
- Server crashed silently
- Device ID mismatch
- Firebase credentials invalid

**Debugging:**

```bash
# On Raspberry Pi, check server status
ps aux | grep webrtc-remote-server-simple

# If not running, check for errors
cd ~/webrtc-server
node webrtc-remote-server-simple.js 2>&1 | head -50

# Check Firebase connection
# Should see: [✅] Device status updated

# Verify device_status in Firebase Console
# Path: Realtime Database > device_status > your-device-id
# Should have: online: true, webrtcReady: true
```

**Solutions:**

```bash
# 1. Ensure service account key is valid
jq . serviceAccountKey.json

# 2. Verify device_id.txt exists
cat device_id.txt

# 3. Check Firebase database URL matches
echo $DATABASE_URL

# 4. Test Firebase credentials with curl
curl -X GET \
  "https://sensor-app-2a69b-default-rtdb.firebaseio.com/device_status.json?auth=$(gcloud auth print-identity-token)" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)"

# 5. Restart server
pm2 restart webrtc-server
# or
systemctl restart webrtc-server
```

---

### 2. "Answer Not Received" (Timeout)

**Symptoms:**
- "Waiting for answer..." stuck for 30 seconds
- Then shows "connection timeout"

**Root Causes:**
- Server received offer but failed to generate answer
- Answer generated but not written to Firebase
- Network latency too high

**Debugging:**

```bash
# Check server logs for offer reception
tail -f webrtc_server.log | grep "Session\|offer\|answer"

# Expected flow:
# [🔗] New WebRTC Session: xxx
# [📨] Received offer
# [📤] Generated answer SDP
# [✅] Answer sent to client via Firebase

# Monitor Firebase in real-time
# Open Firebase Console and watch:
# Realtime Database > webrtc_sessions > [sessionId] > answer

# Should appear within 2-3 seconds of seeing "Received offer"
```

**Solutions:**

```bash
# 1. Check GStreamer is running
ps aux | grep gst-launch

# 2. Check for SDP generation errors in logs
grep "answer\|SDP\|error" webrtc_server.log

# 3. Verify Firebase write permissions
# In Firebase Console > Realtime Database > Rules:
{
  "rules": {
    "webrtc_sessions": {
      ".write": true,
      ".read": true
    }
  }
}

# 4. Increase timeout in WebRTCVideoPlayer.tsx
// Change from 30000 to 60000
const timeout = setTimeout(() => {
  if (!isConnected) {
    setError('WebRTC connection timeout...');
  }
}, 60000); // 60 seconds

# 5. Add more detailed logging
// In server, add around generateAnswerSDP:
console.log('[DEBUG] Offer SDP lines:', offerSDP.split('\n').length);
console.log('[DEBUG] Answer SDP generated:', answerSDP?.split('\n').length);
```

---

### 3. "Connection Failed" (ICE Failure)

**Symptoms:**
- Answer is received
- Still can't establish connection
- "Connection failed" error after 10-30 seconds

**Root Causes:**
- No ICE candidates being exchanged
- STUN server unreachable
- Firewall blocking UDP
- Network NAT issues

**Debugging:**

```bash
# Test STUN server connectivity from Pi
nc -zu stun.l.google.com 19302
# If successful: Connection succeeded

# Check if UDP is blocked
sudo apt-get install netcat-openbsd
echo "test" | nc -u -w 1 stun.l.google.com 19302

# Monitor Firebase ICE candidates
# Watch path: webrtc_sessions > [sessionId] > ice_candidates
# Should show candidates from both client and server

# Check WebRTC connection state
// In WebRTCVideoPlayer.tsx console logs
// Look for: CONNECTION STATE CHANGED messages
```

**Solutions:**

```bash
# 1. Add fallback ICE servers
// In WebRTCVideoPlayer.tsx:
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Add TURN server for NAT traversal:
  {
    urls: ['turn:turnserver.example.com'],
    username: 'user',
    credential: 'pass'
  }
];

# 2. Check firewall on Pi
sudo ufw status
# Should show:
# 19302/tcp  ALLOW
# 5004/udp   ALLOW

# 3. Configure firewall if needed
sudo ufw allow 19302/tcp
sudo ufw allow 5004/udp
sudo ufw enable

# 4. Check router port forwarding
# If accessing from outside network:
# Forward 19302 UDP → Pi IP
# Or use VPN/Cloudflare Tunnel instead

# 5. Test with tcpdump
sudo tcpdump -i any -n port 19302
# Should see STUN packets flowing
```

---

### 4. "No Video Stream Appearing"

**Symptoms:**
- Connection established (✅ Connected)
- No video in RTCView
- But no error either

**Root Causes:**
- GStreamer not running
- GStreamer not sending video
- RTCView component not rendering
- Track disabled

**Debugging:**

```bash
# Check GStreamer process
ps aux | grep gst-launch

# Check GStreamer pipeline
gst-launch-1.0 videotestsrc ! fakesink -v
# Should show successful pipeline

# Check if it's generating video
gst-launch-1.0 videotestsrc pattern=0 ! \
  "video/x-raw,width=640,height=480" ! \
  autovideosink &
# Should show test pattern window

# Monitor RTCView rendering in React
// In WebRTCVideoPlayer.tsx:
console.log('[DEBUG] remoteStream:', remoteStream.current);
console.log('[DEBUG] remoteStream.toURL():', remoteStream.current?.toURL());
console.log('[DEBUG] RTCView props:', {
  streamURL: remoteStream.current?.toURL(),
  style: styles.videoStream,
  mirror: false,
  objectFit: 'cover'
});
```

**Solutions:**

```bash
# 1. Restart GStreamer with debug logging
GDK_DEBUG=1 gst-launch-1.0 -v videotestsrc ! fakesink

# 2. Check GStreamer has required plugins
gst-inspect-1.0 | grep -i h264
gst-inspect-1.0 | grep -i x264

# Install if missing:
sudo apt-get install gstreamer1.0-plugins-good gstreamer1.0-plugins-bad

# 3. Force video track to be enabled
// In server SDP generation:
console.log('[DEBUG] Video track enabled:', videoTrack?.enabled);
if (videoTrack) {
  videoTrack.enabled = true;
}

# 4. Check RTCView implementation
// Ensure RTCView is within a View with flex: 1
// and proper dimensions

# 5. Test with real camera if using test pattern
export USE_REAL_CAMERA=true
node webrtc-remote-server-simple.js
```

---

### 5. Firebase Realtime Database Issues

**Symptoms:**
- Firebase Connection Error
- Can't read device_status
- Can't write sessions

**Root Causes:**
- Firebase credentials expired
- Wrong database URL
- Firebase rules too restrictive
- Network connectivity issue

**Debugging:**

```bash
# Test Firebase connectivity
firebase realtime-database:describe sensor-app-2a69b

# Check rules
firebase database:rules:get

# Test with curl
curl -X GET \
  "https://sensor-app-2a69b-default-rtdb.firebaseio.com/.json" \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)"

# Test write permissions
curl -X PUT \
  "https://sensor-app-2a69b-default-rtdb.firebaseio.com/test.json" \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  -d '{"test": "value"}'
```

**Solutions:**

```bash
# 1. Update Firebase credentials
# Regenerate and download new service account key
# From Firebase Console > Project Settings > Service Accounts > Generate Key
cp ~/Downloads/sensor-app-2a69b-*.json ./serviceAccountKey.json

# 2. Fix database URL
export DATABASE_URL="https://sensor-app-2a69b-default-rtdb.firebaseio.com"

# 3. Update Firebase rules
firebase deploy --only database

# 4. Check network connectivity from Pi
ping 8.8.8.8
curl -I https://sensor-app-2a69b-default-rtdb.firebaseio.com

# 5. Restart server
pm2 restart webrtc-server
```

---

### 6. High Latency / Lag

**Symptoms:**
- Video appears but with 5+ second delay
- Response to actions delayed

**Root Causes:**
- Video bitrate too high (network congestion)
- Framerate too high causing encoding delay
- GStreamer preset too slow
- Network inherently slow

**Solutions:**

```bash
# Reduce video quality
export VIDEO_WIDTH=480
export VIDEO_HEIGHT=360
export VIDEO_FPS=15
export VIDEO_BITRATE=512
export VIDEO_PRESET=ultrafast

node webrtc-remote-server-simple.js

# Or for optimal balance:
export VIDEO_WIDTH=640
export VIDEO_HEIGHT=480
export VIDEO_FPS=20
export VIDEO_BITRATE=1000
export VIDEO_PRESET=fast

# Monitor actual bitrate usage
sudo iftop
# or
sudo nethogs

# Test network bandwidth
# On client machine
iperf3 -c <pi-ip> -P 4 -t 10
```

---

### 7. Memory or CPU Issues

**Symptoms:**
- Server crashes after running for a while
- Out of memory errors
- High CPU usage

**Root Causes:**
- Memory leak in GStreamer
- Too many active sessions
- Inefficient SDP generation

**Debugging:**

```bash
# Monitor resources
watch -n 1 'free -h; echo "---"; ps aux | grep webrtc'

# Or with PM2
pm2 monit

# Check swap usage
free -h
swapon --show

# Monitor over time
vmstat 1 10
iostat -x 1 10
```

**Solutions:**

```bash
# 1. Reduce video quality
export VIDEO_BITRATE=500
export VIDEO_PRESET=ultrafast

# 2. Implement session cleanup
// In server: sessions older than 5 minutes automatically removed
// Already done in webrtc-remote-server-simple.js

# 3. Set memory limits for node process
node --max-old-space-size=256 webrtc-remote-server-simple.js

# 4. Enable swap (if low memory)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 5. Restart periodically via cron
# Add to crontab: 0 */6 * * * systemctl restart webrtc-server
# (restart every 6 hours)

# Or with PM2:
pm2 start webrtc-remote-server-simple.js --max-memory-restart 200M
```

---

### 8. Camera Permission Issues

**Symptoms:**
- "libcamera not found"
- "Permission denied" when accessing /dev/video0

**Root Causes:**
- libcamera not installed
- User not in video group
- Camera disabled in raspi-config

**Solutions:**

```bash
# 1. Install libcamera
sudo apt-get update
sudo apt-get install -y libcamera-tools libcamera-dev libcamera0

# 2. Add user to video group
sudo usermod -a -G video pi
sudo usermod -a -G dialout pi

# Log out and back in:
exit
ssh pi@<ip>

# 3. Enable camera in raspi-config
sudo raspi-config
# Interfacing Options > Camera > Enable

# 4. Verify camera access
libcamera-hello --list-cameras

# 5. Check /dev/video0 permissions
ls -la /dev/video*
# Should show: crw-rw----+ 1 root video

# 6. Use test pattern if camera unavailable
export USE_REAL_CAMERA=false
node webrtc-remote-server-simple.js
```

---

## Logging & Monitoring

### Enable Detailed Logging

```bash
# On server, redirect all output to log file
nohup node webrtc-remote-server-simple.js > server.log 2>&1 &

# or with PM2
pm2 start webrtc-remote-server-simple.js --output server.log

# Watch logs in real-time
tail -f server.log

# Filter for errors
grep -i "error\|failed\|❌" server.log

# Watch for session activity
grep "Session\|answer\|offer" server.log
```

### Systemd Journal

```bash
# If using systemd
journalctl -u webrtc-server -f

# With timestamps
journalctl -u webrtc-server --output=short-precise -f

# Last 50 lines
journalctl -u webrtc-server -n 50

# Errors only
journalctl -u webrtc-server --priority=3
```

### Network Monitoring

```bash
# Real-time packet analysis
sudo tcpdump -i any -n 'port 19302 or port 5004'

# Monitor network interfaces
watch -n 1 'ifconfig | grep -A 2 "inet "'

# DNS resolution
nslookup stun.l.google.com
ping stun.l.google.com
```

---

## Quick Diagnostic Script

Save this as `diagnose.sh` on your Pi:

```bash
#!/bin/bash

echo "=== WebRTC Server Diagnostics ==="
echo ""

echo "1. Server Status"
ps aux | grep webrtc-remote-server-simple | grep -v grep || echo "   ❌ NOT RUNNING"

echo ""
echo "2. Firebase Connectivity"
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  https://sensor-app-2a69b-default-rtdb.firebaseio.com/device_status.json

echo ""
echo "3. STUN Server"
nc -zu stun.l.google.com 19302 && echo "   ✅ REACHABLE" || echo "   ❌ UNREACHABLE"

echo ""
echo "4. GStreamer"
gst-launch-1.0 videotestsrc ! fakesink 2>&1 | head -1

echo ""
echo "5. System Resources"
echo "   Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "   CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')"
echo "   Disk: $(df -h / | tail -1 | awk '{print $3 "/" $2}')"

echo ""
echo "6. Network"
echo "   IP: $(hostname -I)"
echo "   Gateway: $(ip route | grep default | awk '{print $3}')"

echo ""
echo "7. Device Status in Firebase"
curl -s https://sensor-app-2a69b-default-rtdb.firebaseio.com/device_status.json | jq '.[] | {online, webrtcReady, lastSeen}' 2>/dev/null || echo "   Could not fetch"

echo ""
echo "=== End Diagnostics ==="
```

Usage:
```bash
chmod +x diagnose.sh
./diagnose.sh
```

---

## When All Else Fails

1. **Collect Logs**
   ```bash
   # Server logs (last 100 lines)
   tail -100 webrtc_server.log > /tmp/logs.txt
   
   # System info
   uname -a >> /tmp/logs.txt
   free -h >> /tmp/logs.txt
   df -h >> /tmp/logs.txt
   
   # Check for Firebase errors
   grep -i "error\|failed" /tmp/logs.txt >> /tmp/errors.txt
   ```

2. **Factory Reset Server**
   ```bash
   # Stop server
   pm2 stop webrtc-server
   
   # Backup old files
   mv ~/webrtc-server ~/webrtc-server.bak
   mkdir -p ~/webrtc-server
   
   # Redeploy fresh
   # Copy files, npm install, restart
   ```

3. **Test Manually**
   ```bash
   # Create test session in Firebase Console manually
   # Check if server responds with answer
   # Monitor logs: tail -f server.log
   ```

4. **Network Reset**
   ```bash
   # Restart networking
   sudo systemctl restart networking
   
   # Check connectivity
   ping 8.8.8.8
   curl -I https://firebase.google.com
   ```

5. **Escalate to Support**
   - Attach: `logs.txt`, `errors.txt`
   - Include: Pi model, OS version, network setup
   - Describe: What worked before? What changed?
