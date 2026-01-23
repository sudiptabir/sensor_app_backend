# WebRTC Camera Streaming Setup Guide

## Overview

This guide walks through setting up **WebRTC streaming** from your Raspberry Pi camera to the React Native app using **Firebase as a signaling server**.

### Architecture

```
┌─────────────────┐         Firebase Realtime DB       ┌──────────────────┐
│  React Native   │ ◄──────── Signaling ────────────► │  Raspberry Pi    │
│  (WebRTC Client)│           (SDP/ICE)               │  (WebRTC Server) │
└────────┬────────┘                                   └─────────┬────────┘
         │                                                      │
         └──────── Peer-to-Peer Connection (Media) ───────────┘
                  (after signaling negotiation)
```

### Key Benefits Over HTTP Streaming

| Feature | HTTP H.264 | WebRTC |
|---------|-----------|--------|
| Latency | 500-1000ms | 100-200ms |
| In-App Video | Browser | Native ✅ |
| Bandwidth | Fixed bitrate | Adaptive |
| NAT Traversal | Not needed | Built-in (STUN/TURN) |
| CPU Usage | Moderate | Low |

---

## Prerequisites

### On Your Computer (Development)

- Node.js installed
- Firebase project configured
- React Native app with expo

### On Raspberry Pi

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install dependencies
sudo apt-get install -y \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  libgstreamer1.0-0 \
  libgstreamer-plugins-base1.0-0 \
  python3-pip

# Install Node.js (for the signaling server)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install npm packages
npm install firebase-admin
```

---

## Step 1: Set Up Firebase Realtime Database

### 1.1 Enable Realtime Database

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Realtime Database**
4. Click **Create Database**
5. Start in **Test Mode** (for development)

### 1.2 Set Security Rules

Replace default rules with:

```json
{
  "rules": {
    "webrtc_sessions": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$sessionId": {
        ".indexOn": ["deviceId", "userId", "createdAt"]
      }
    },
    "device_status": {
      ".read": "auth != null",
      ".write": "root.child('devices').child($deviceId).child('userId').val() === auth.uid"
    },
    "devices": {
      ".read": "root.child('devices').child($deviceId).child('userId').val() === auth.uid",
      "$deviceId": {
        ".write": "!data.exists() || data.child('userId').val() === auth.uid"
      }
    }
  }
}
```

### 1.3 Get Database URL

- Note your **Realtime Database URL** (looks like: `https://your-project.firebaseio.com`)

---

## Step 2: Configure Raspberry Pi Server

### 2.1 Prepare Firebase Key

1. In Firebase Console → Project Settings → Service Accounts
2. Click **Generate New Private Key**
3. Save as `serviceAccountKey.json` on your Pi

### 2.2 Set Up Pi Server

1. Copy `webrtc-camera-server.js` to your Raspberry Pi:

```bash
scp webrtc-camera-server.js pi@<pi-ip>:~/Sensor_app/
scp serviceAccountKey.json pi@<pi-ip>:~/Sensor_app/
```

### 2.3 Start the Server

```bash
ssh pi@<pi-ip>

cd ~/Sensor_app

# Set environment variables
export DEVICE_ID="my-pi-camera"
export FIREBASE_DB_URL="https://your-project.firebaseio.com"
export FIREBASE_KEY_PATH="./serviceAccountKey.json"

# Start the server
node webrtc-camera-server.js
```

You should see:
```
╔════════════════════════════════════════════════════╗
║    🎥 Raspberry Pi - WebRTC Camera Server         ║
║    Device ID: my-pi-camera                        ║
╚════════════════════════════════════════════════════╝

📡 WebRTC server ready, waiting for connections...
```

---

## Step 3: Update React Native App

### 3.1 Ensure Firebase Config

Your `firebaseConfig.js` should have Realtime Database enabled:

```typescript
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  // ... your config
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);  // Make sure this is exported
```

### 3.2 Update Device Configuration

Add to your device in Firestore:

```json
{
  "id": "device-123",
  "label": "Living Room Pi Camera",
  "webrtcReady": true,
  "webrtcDeviceId": "my-pi-camera"
}
```

### 3.3 Test WebRTC in App

1. Reload your React Native app
2. Go to **Devices** tab
3. Tap the **📹 camera icon**
4. Tap **🔌 Try WebRTC** button
5. Watch the connection establish in real-time

---

## Step 4: Troubleshooting

### "Device not ready for WebRTC"

**Solution:**
- Ensure Pi server is running
- Check Firebase connection: `device_status/{device-id}` should have `webrtcReady: true`
- Verify `DEVICE_ID` matches the one configured in app

### "Connection timeout"

**Causes & Solutions:**

1. **Pi server not running:**
   ```bash
   ssh pi@<pi-ip>
   ps aux | grep webrtc
   ```

2. **Firebase rules blocking:**
   - Check Security Rules in Firebase Console
   - Make sure you're authenticated

3. **Network connectivity:**
   ```bash
   # From Pi, test Firebase connection
   curl https://your-project.firebaseio.com/device_status.json
   ```

### "ICE candidates not exchanging"

**Check:**
- STUN servers are accessible (Google STUN is used by default)
- Both devices on same network or with proper firewall rules
- For different networks: add TURN server

### GStreamer not available

**Fix:**
```bash
sudo apt-get install -y gstreamer1.0-plugins-base gstreamer1.0-plugins-good
```

---

## Step 5: Advanced Configuration

### TURN Server (For Remote Connections)

If connecting over the internet (not local network), add TURN server:

```typescript
// In WebRTCVideoPlayer.tsx
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:your-turn-server.com:3478',
    username: 'username',
    credential: 'password'
  }
];
```

Free TURN server: [Xirsys](https://xirsys.com/) or [Coturn](https://github.com/coturn/coturn)

### Bandwidth Limiting

In `webrtc-camera-server.js`, adjust GStreamer bitrate:

```javascript
const pipeline = [
  'libcamerasrc',
  '!', 'video/x-raw,width=640,height=480,framerate=30/1',
  '!', 'videoconvert',
  '!', 'x264enc speed-preset=ultrafast bitrate=1000',  // 1000 kbps
  '!', 'rtph264pay',
];
```

### Multiple Simultaneous Connections

To support multiple app users watching the same camera, modify the server to:

1. Share a single GStreamer pipeline
2. Distribute the stream to multiple WebRTC connections
3. Use a media server like **Janus** or **MediaSoup**

---

## Firebase Realtime Database Structure

After connecting, your Firebase structure will look like:

```
webrtc_sessions/
  ├─ device-123_1705950000000/
  │  ├─ deviceId: "device-123"
  │  ├─ offer: { type: "offer", data: {...sdp...} }
  │  ├─ answer: { type: "answer", data: {...sdp...} }
  │  ├─ ice_candidates/
  │  │  ├─ <id>: { candidate: "...", sdpMLineIndex: 0 }
  │  │  └─ <id>: { candidate: "...", sdpMLineIndex: 0 }
  │  └─ ice_candidates_from_pi/
  │     ├─ <id>: { candidate: "...", sdpMLineIndex: 0 }
  │     └─ <id>: { candidate: "...", sdpMLineIndex: 0 }
  │
  └─ device-456_1705950060000/
     └─ ...

device_status/
  ├─ device-123: { online: true, webrtcReady: true, lastSeen: 1705950000000 }
  └─ device-456: { online: false, webrtcReady: false, lastSeen: 1705949900000 }
```

---

## Files Modified/Created

- ✅ `sensor_app/db/webrtcSignaling.ts` - Firebase signaling service
- ✅ `sensor_app/utils/WebRTCVideoPlayer.tsx` - WebRTC video component
- ✅ `webrtc-camera-server.js` - Pi WebRTC server
- ✅ `sensor_app/app/dashboard.tsx` - Updated with WebRTC support

---

## Next Steps

1. ✅ Set up Firebase Realtime Database
2. ✅ Configure Raspberry Pi server
3. ✅ Deploy signaling service
4. ✅ Test WebRTC connection
5. ✅ Monitor Firebase console for real-time signaling
6. ✅ Switch between HTTP and WebRTC modes in app

---

## Performance Monitoring

Monitor WebRTC connection stats in real-time:

```typescript
// Add to WebRTCVideoPlayer.tsx
const statsInterval = setInterval(async () => {
  if (peerConnection.current) {
    const stats = await peerConnection.current.getStats();
    stats.forEach(report => {
      if (report.type === 'inbound-rtp') {
        console.log('📊 Bitrate:', report.bytesReceived);
        console.log('📊 Jitter:', report.jitter);
      }
    });
  }
}, 1000);
```

---

## Support & Resources

- [WebRTC Samples](https://webrtc.github.io/samples/)
- [GStreamer Documentation](https://gstreamer.freedesktop.org/)
- [Firebase Realtime Database](https://firebase.google.com/docs/database)
- [Simple-peer (JS WebRTC)](https://github.com/feross/simple-peer)
