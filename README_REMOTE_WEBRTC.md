# Remote Raspberry Pi WebRTC Video Streaming - Complete Setup Summary

## 📋 What You Now Have

Your Sensor App now has **complete WebRTC video streaming** capability to stream video from a remote Raspberry Pi to your React Native mobile application. Here's what has been created:

### Server-Side (Raspberry Pi)

**File:** `webrtc-remote-server-simple.js`
- Listens for WebRTC connection requests from the app
- Generates WebRTC answers to client offers
- Manages ICE candidate exchange
- Supports both real camera (libcamera) and test patterns
- Maintains device status in Firebase
- Auto-cleanup of old sessions

**Key Features:**
- 🎥 Real-time video capture from Raspberry Pi camera
- 🔌 Firebase Realtime Database integration for signaling
- 📡 STUN/TURN support for NAT traversal
- 🎬 Configurable video quality (resolution, FPS, bitrate)
- 🛡️ Device status tracking
- 📊 Session management and monitoring

### Client-Side (React Native App)

**File:** `sensor_app/utils/WebRTCVideoPlayer.tsx` (already exists, fully compatible)
- Initiates WebRTC connections to remote Pi
- Displays live video stream
- Handles connection state changes
- Provides error recovery with retry functionality
- Shows connection status to user

**File:** `sensor_app/db/webrtcSignaling.ts` (already exists, fully compatible)
- Firebase-based signaling for SDP exchange
- ICE candidate management
- Session lifecycle handling
- Polling-based communication (reliable in React Native)

---

## 🗂️ File Structure

```
Sensor_app/
├── webrtc-remote-server-simple.js          [NEW] Main server for Pi
├── REMOTE_WEBRTC_INTEGRATION.md            [NEW] Architecture & integration guide
├── DEPLOYMENT_GUIDE_REMOTE_WEBRTC.md       [NEW] Step-by-step deployment
├── QUICK_START_REMOTE_WEBRTC.md            [NEW] 5-minute quick start
├── TROUBLESHOOTING_REMOTE_WEBRTC.md        [NEW] Complete troubleshooting guide
├── serviceAccountKey.json                   [EXISTING] Firebase credentials
├── device_id.txt                            [EXISTING] Device identifier
├── sensor_app/
│   ├── firebase/
│   │   └── firebaseConfig.js               [EXISTING] Firebase config
│   ├── db/
│   │   └── webrtcSignaling.ts              [EXISTING] Signaling logic
│   ├── utils/
│   │   └── WebRTCVideoPlayer.tsx           [EXISTING] Video player UI
│   └── app/
│       └── dashboard.tsx                    [NEEDS UPDATE] Add video button
```

---

## 🚀 Quick Start (5 Minutes)

### 1. Deploy Server to Pi (2 min)
```bash
# SSH to Pi
ssh pi@<YOUR_PI_IP>

# Create directory
mkdir -p ~/webrtc-server && cd ~/webrtc-server

# Copy files (from your dev machine)
scp webrtc-remote-server-simple.js pi@<YOUR_PI_IP>:~/webrtc-server/
scp serviceAccountKey.json pi@<YOUR_PI_IP>:~/webrtc-server/
scp device_id.txt pi@<YOUR_PI_IP>:~/webrtc-server/

# Install Node dependencies
npm init -y
npm install firebase-admin

# Install system dependencies
sudo apt-get update
sudo apt-get install -y gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good
```

### 2. Start Server (1 min)
```bash
node webrtc-remote-server-simple.js
```

Expected output:
```
╔════════════════════════════════════════════════════════╗
║   🎥 Remote WebRTC Camera Server                      ║
║      Raspberry Pi → React Native App                  ║
╚════════════════════════════════════════════════════════╝
[✅] Device status updated
[✅] Server ready for WebRTC connections
```

### 3. Verify in Firebase (1 min)
- Open Firebase Console
- Check `Realtime Database > device_status`
- Should show your device with `online: true` and `webrtcReady: true`

### 4. Test in App (1 min)
- Open your React Native app
- Click "View Stream" button (add if not present)
- Video should start connecting

---

## 🔄 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│         Your React Native Mobile App                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User clicks "View Stream"                             │
│            ↓                                            │
│  WebRTCVideoPlayer component initializes               │
│            ↓                                            │
│  1. Create RTC session in Firebase                     │
│  2. Generate WebRTC offer with RTCPeerConnection       │
│  3. Send offer to Firebase: webrtc_sessions/           │
│  4. Wait for answer in Firebase polling loop           │
│            ↓                                            │
│  Exchange ICE candidates for NAT traversal             │
│            ↓                                            │
│  Display video stream in RTCView component             │
│                                                         │
└─────────────────────────────────────────────────────────┘
               ↕ Firebase Realtime Database ↕
        (SDP offers/answers, ICE candidates)
┌─────────────────────────────────────────────────────────┐
│       Raspberry Pi (webrtc-remote-server-simple.js)    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Poll Firebase for new WebRTC sessions              │
│  2. Receive offer from app                             │
│  3. Generate H.264 video stream via GStreamer          │
│  4. Create WebRTC answer with video track               │
│  5. Send answer back to Firebase                       │
│  6. Exchange ICE candidates                             │
│  7. Stream video data via WebRTC connection            │
│  8. Monitor session status                              │
│                                                         │
│  GStreamer Pipeline:                                   │
│  Video Source → Encode (H.264) → Send via RTP/WebRTC  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 How It Works - Step by Step

### Connection Flow

1. **User Initiates**: Clicks "View Stream" in app
2. **Session Created**: App creates Firebase session in `webrtc_sessions/{sessionId}`
3. **Offer Generated**: App's RTCPeerConnection creates SDP offer
4. **Offer Sent**: App writes offer to Firebase at `webrtc_sessions/{sessionId}/offer`
5. **Server Receives**: Pi server polls Firebase and detects new offer
6. **Answer Generated**: Server creates answer SDP with video codec info
7. **Answer Sent**: Server writes answer to Firebase
8. **Client Processes**: App polls Firebase, receives answer, sets remote description
9. **ICE Exchange**: Both sides exchange ICE candidates for NAT traversal
10. **Connection Established**: WebRTC connection is established
11. **Video Streams**: Server sends H.264 video via WebRTC
12. **Display**: App's RTCView displays incoming video stream

### Data Flow

```
📱 App                    🔥 Firebase                   🍓 Pi Server
  │                          │                             │
  ├─ Create session ────────→ webrtc_sessions/xxx         │
  │                          │                             │
  ├─ Create offer            │                             │
  │                          │                             │
  ├─ Send offer ────────────→ webrtc_sessions/xxx/offer    │
  │                          │                             │
  │                          ← Poll detected offer ────────┤
  │                          │                             │
  │                          │ ← Generate answer ─────────┤
  │                          │                             │
  │ ← Answer received ────← webrtc_sessions/xxx/answer     │
  │                          │                             │
  ├─ Set remote desc         │                             │
  │                          │                             │
  ├─ ICE candidate ────────→ webrtc_sessions/xxx/ice       │
  │                          │                             │
  │                          ← Read ICE ────────────────────┤
  │                          │                             │
  ├─ Add ICE candidate       │                             │
  │                          │                             │
  │ ◄───────── WebRTC Connection Established ────────────┤
  │                                                        │
  │ ◄───────────── H.264 Video Stream ─────────────────┤
  │                                                        │
  ├─ Display in RTCView                                    │
```

---

## ⚙️ Configuration Options

Control server behavior via environment variables:

```bash
# Video Quality
export VIDEO_WIDTH=1280              # Default: 1280
export VIDEO_HEIGHT=720              # Default: 720
export VIDEO_FPS=30                  # Default: 30
export VIDEO_BITRATE=2000            # Default: 2000 kbps
export VIDEO_PRESET=ultrafast        # ultrafast|fast|medium|slow

# Camera Source
export USE_REAL_CAMERA=true          # Use real Pi camera (false = test pattern)

# Firebase
export DATABASE_URL="https://..."    # Custom database URL
export SERVICE_ACCOUNT_KEY="..."     # Path to credentials

# Device
export DEVICE_ID="my-camera-1"       # Device identifier

# Start with config
VIDEO_WIDTH=640 VIDEO_FPS=15 node webrtc-remote-server-simple.js
```

---

## 📊 Performance Recommendations

### For Different Network Speeds

**Fast Networks (>10 Mbps)**
```bash
export VIDEO_WIDTH=1280 VIDEO_HEIGHT=720 VIDEO_FPS=30 VIDEO_BITRATE=3000
```
- Best quality, may have slight delay
- Requires good WiFi or fiber

**Medium Networks (5-10 Mbps)**
```bash
export VIDEO_WIDTH=640 VIDEO_HEIGHT=480 VIDEO_FPS=20 VIDEO_BITRATE=1000
```
- Good balance of quality and latency
- Typical home WiFi

**Slow Networks (<5 Mbps)**
```bash
export VIDEO_WIDTH=320 VIDEO_HEIGHT=240 VIDEO_FPS=10 VIDEO_BITRATE=256
```
- Lower quality but smoother
- Works on 4G/LTE

### Monitoring Performance

```bash
# Check resource usage
watch -n 1 'free -h; ps aux | grep node; df -h'

# Monitor network usage
sudo iftop

# Check latency to Firebase
ping 8.8.8.8
```

---

## 🔐 Security Considerations

### Current Setup
✅ Firebase authentication required
✅ Service account credentials used
✅ Realtime Database for signaling

### Recommended Enhancements

1. **Device Authorization**
   - Verify device is registered to user
   - Check ownership before streaming

2. **Encryption**
   - WebRTC uses DTLS by default (encrypted)
   - Consider additional application-level encryption

3. **Rate Limiting**
   - Limit session creation rate
   - Prevent DoS attacks

4. **Firebase Rules**
   ```javascript
   "webrtc_sessions": {
     ".write": "auth != null",
     ".read": "auth != null",
     ".validate": "newData.hasChildren(['deviceId', 'userId'])"
   }
   ```

---

## 🛠️ Maintenance & Operations

### Daily Operations

```bash
# Check server status
systemctl status webrtc-server
# or
pm2 list

# View recent logs
tail -20 server.log
# or
journalctl -u webrtc-server -n 20

# Verify device online in Firebase Console
```

### Weekly Checks

- Review error logs for patterns
- Monitor Firebase quota usage
- Check system resources (memory, disk)
- Verify all connections working

### Monthly Tasks

- Update dependencies: `npm update`
- Review and optimize video settings
- Clean up old Firebase sessions
- Test failover/restart procedures

### Troubleshooting Commands

```bash
# Server not responding
systemctl restart webrtc-server

# Check logs for errors
grep -i error server.log | tail -20

# Test Firebase connection
curl -s https://sensor-app-2a69b-default-rtdb.firebaseio.com/device_status.json | jq '.'

# Monitor active sessions
curl -s https://sensor-app-2a69b-default-rtdb.firebaseio.com/webrtc_sessions.json | jq '.' | grep -i "deviceId\|createdAt"

# GStreamer test
gst-launch-1.0 videotestsrc ! fakesink
```

---

## 📚 Documentation Reference

| Document | Purpose | Time to Read |
|----------|---------|-------------|
| `QUICK_START_REMOTE_WEBRTC.md` | Get up and running fast | 5 min |
| `REMOTE_WEBRTC_INTEGRATION.md` | Understand architecture | 15 min |
| `DEPLOYMENT_GUIDE_REMOTE_WEBRTC.md` | Detailed setup steps | 20 min |
| `TROUBLESHOOTING_REMOTE_WEBRTC.md` | Fix problems | 30 min |
| `webrtc-remote-server-simple.js` | Server implementation | Code review |

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Server running on Pi without errors
- [ ] Device appears in Firebase `device_status` with `online: true`
- [ ] WebRTC session created when app connects
- [ ] Server receives offer and generates answer
- [ ] Answer appears in Firebase
- [ ] App receives answer and sets remote description
- [ ] ICE candidates are exchanged
- [ ] Video stream appears in app RTCView
- [ ] Video persists for at least 30 seconds
- [ ] Connection state shows "connected" or "✅ LIVE"

---

## 🎯 What You Can Do Now

1. **View Live Video**
   - Stream from remote Raspberry Pi to your app
   - Multiple concurrent connections supported
   - Configurable video quality

2. **Monitor Device Status**
   - Check if Pi is online
   - View capabilities (resolution, FPS, bitrate)
   - Track last seen timestamp

3. **Scale to Multiple Cameras**
   - Run multiple server instances
   - Use different device IDs
   - Support multi-camera setup

4. **Integrate with Dashboard**
   - Add "View Camera" button to device cards
   - Show camera status (online/offline)
   - Display video in modal or full screen

---

## 🚀 Next Steps

### Immediate (Today)
1. Deploy `webrtc-remote-server-simple.js` to your Pi
2. Verify in Firebase Console
3. Test connection from app

### Short Term (This Week)
1. Optimize video settings for your network
2. Integrate video button into dashboard
3. Test with real camera (not just test pattern)

### Medium Term (This Month)
1. Add device authentication/authorization
2. Implement monitoring and alerting
3. Add multiple camera support
4. Performance testing and optimization

### Long Term (Ongoing)
1. Implement security enhancements
2. Scale to production with multiple Pis
3. Add recording/playback capability
4. Integrate with cloud storage

---

## 💡 Tips & Best Practices

1. **Always use PM2 or systemd** for production - don't rely on terminal windows
2. **Monitor Firebase quota** - WebRTC signaling can add to read/write operations
3. **Test with test pattern first** - easier debugging than real camera
4. **Adjust bitrate based on network** - quality suffers more from high latency than low bitrate
5. **Keep server logs** - helpful for debugging later
6. **Use static IP** for Raspberry Pi - simplifies connection configuration
7. **Implement watchdog** - automatically restart if server crashes
8. **Plan for multiple devices** - organize sessions/credentials properly

---

## 🆘 Getting Help

If you encounter issues:

1. **Check QUICK_START_REMOTE_WEBRTC.md** - 5-minute fixes
2. **Check TROUBLESHOOTING_REMOTE_WEBRTC.md** - Detailed diagnostic guide
3. **Review Server Logs** - Most issues are in the logs
4. **Verify Firebase** - Check device_status and webrtc_sessions paths
5. **Test Connectivity** - Ping Pi, test STUN server, verify Firebase access

---

## 📞 Support Resources

**Server Logs**
```bash
# With PM2
pm2 logs webrtc-server

# With systemd  
journalctl -u webrtc-server -f

# With nohup
tail -f server.log
```

**Firebase Debugging**
- Open Firebase Console > Realtime Database
- Check `device_status` for device health
- Watch `webrtc_sessions` during connections

**Network Diagnostics**
```bash
nc -zu stun.l.google.com 19302          # Test STUN
ping 8.8.8.8                            # Test internet
curl -I https://firebase.google.com     # Test Firebase
```

---

**You're all set! Your remote WebRTC video streaming is ready to deploy.** 🎉

Start with `QUICK_START_REMOTE_WEBRTC.md` for the fastest path to a working system.
