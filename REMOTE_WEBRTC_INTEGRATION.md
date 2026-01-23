# Remote Raspberry Pi WebRTC Video Streaming Integration

## Overview

Your application is set up to stream video from a Raspberry Pi to your React Native app using WebRTC with Firebase Realtime Database for signaling. This guide explains how to properly configure and deploy the streaming server.

## Current Architecture

```
Raspberry Pi (webrtc-remote-server-simple.js)
          ↓
   WebRTC Connection
          ↓
Firebase Realtime Database (Signaling)
          ↓
React Native App (WebRTCVideoPlayer)
```

## Components

### 1. **Server Side (Raspberry Pi)**
- **File**: `webrtc-camera-server-simple.js` (or `webrtc-remote-server-simple.js`)
- **Purpose**: Captures video from Pi camera, handles WebRTC peer connection, exchanges SDP offers/answers
- **Technology**: 
  - GStreamer for video capture
  - Node.js WebRTC library (possibly `wrtc` or similar)
  - Firebase Realtime Database for signaling

### 2. **Client Side (React Native App)**
- **File**: `sensor_app/utils/WebRTCVideoPlayer.tsx`
- **Purpose**: Initiates WebRTC connection, displays remote video stream
- **Technology**: 
  - `react-native-webrtc` (already installed)
  - Firebase Realtime Database (signaling)
  - RTCPeerConnection with STUN servers

### 3. **Signaling Service**
- **File**: `sensor_app/db/webrtcSignaling.ts`
- **Purpose**: Handles Firebase communication for SDP/ICE exchange
- **Structure**:
  ```
  /webrtc_sessions/{sessionId}
    - offer (SDP)
    - answer (SDP)
    - ice_candidates (array)
    - status
    - deviceId
    - userId
  ```

## Setup Instructions

### Phase 1: Prepare the Raspberry Pi Server

#### 1.1 Install Dependencies

```bash
# SSH into your Raspberry Pi
ssh pi@<raspberry_pi_ip>

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install GStreamer for video capture
sudo apt-get install -y gstreamer1.0-tools gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good gstreamer1.0-plugins-bad libgstreamer1.0-0

# Install cmake and build tools (needed for wrtc)
sudo apt-get install -y build-essential cmake python3
```

#### 1.2 Deploy the Server File

```bash
# Copy the server file to your Pi
scp webrtc-remote-server-simple.js pi@<raspberry_pi_ip>:~/sensor_server/

# Copy Firebase credentials
scp serviceAccountKey.json pi@<raspberry_pi_ip>:~/sensor_server/
scp device_id.txt pi@<raspberry_pi_ip>:~/sensor_server/

# SSH back in and navigate to the directory
cd ~/sensor_server/
npm init -y
npm install firebase-admin
```

#### 1.3 Configure Environment

```bash
# Set device ID (optional - will use device_id.txt if present)
export DEVICE_ID="raspberrypi-main"

# Or add to ~/.bashrc for persistence
echo 'export DEVICE_ID="raspberrypi-main"' >> ~/.bashrc
source ~/.bashrc
```

#### 1.4 Start the Server

```bash
# Test run (to see logs)
node webrtc-remote-server-simple.js

# Or run in background
nohup node webrtc-remote-server-simple.js > webrtc_server.log 2>&1 &

# Check if running
ps aux | grep webrtc-remote-server-simple.js

# View logs
tail -f webrtc_server.log
```

### Phase 2: Configure the React Native App

#### 2.1 Update Firebase Configuration

Verify your `sensor_app/firebase/firebaseConfig.js` includes:
- Realtime Database initialization
- Proper security rules for WebRTC sessions

```typescript
export const rtdb = getDatabase(app);
```

#### 2.2 Update WebRTC Signaling (if needed)

The `sensor_app/db/webrtcSignaling.ts` file already handles:
- Creating RTC sessions
- Sending/receiving offers and answers
- ICE candidate exchange

**Key functions available:**
- `createRTCSession(deviceId, userId)` - Creates a signaling session
- `sendOffer(sessionId, userId, offer)` - Sends SDP offer
- `listenForAnswer(sessionId, callback)` - Polls for answer
- `sendICECandidate(sessionId, userId, candidate)` - Sends ICE candidates
- `listenForICECandidates(sessionId, callback)` - Listens for ICE candidates

#### 2.3 Update Dashboard to Launch Video Player

In `sensor_app/app/dashboard.tsx`, add a button to view video:

```tsx
const handleViewVideo = (device: any) => {
  setSelectedDeviceForVideo(device);
  setShowVideoPlayer(true);
};

// In your device render:
<TouchableOpacity 
  onPress={() => handleViewVideo(device)}
  style={styles.videoButton}
>
  <Text>🎥 View Video</Text>
</TouchableOpacity>

// Add video player modal
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

### Phase 3: Network Configuration

#### 3.1 Router Port Forwarding (for external access)

If accessing the Raspberry Pi from outside your local network:

1. Log into your router admin panel (usually `192.168.1.1`)
2. Find Port Forwarding settings
3. Forward port 19302 (STUN) and your signaling port to your Pi's IP
4. **Better approach**: Use a VPN or CloudFlare Tunnel instead

#### 3.2 Firewall Rules

```bash
# On Raspberry Pi
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 19302/tcp # STUN
sudo ufw allow 5004/udp  # GStreamer RTP (if used)
sudo ufw enable
```

#### 3.3 STUN/TURN Servers

Your current config uses Google STUN servers:
```typescript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
```

For better reliability behind NAT, consider adding TURN:
```typescript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { 
    urls: 'turn:your-turn-server.com',
    username: 'user',
    credential: 'pass'
  }
];
```

## Troubleshooting

### Issue: "Device is not ready for WebRTC"

**Cause**: Server hasn't updated device status in Firebase

**Solution**:
1. Check server logs: `tail -f webrtc_server.log`
2. Verify Firebase credentials on Pi
3. Ensure `device_id.txt` exists or `DEVICE_ID` env var is set

### Issue: No video stream appears

**Cause**: ICE candidate exchange failing or no STUN connectivity

**Solution**:
```bash
# On Pi, test STUN server
nc -u stun.l.google.com 19302

# Check Firebase rules allow rtdb writes
# Enable more detailed logging in WebRTCVideoPlayer.tsx
```

### Issue: "Answer not received"

**Cause**: Server not listening for offers or network latency

**Solution**:
1. Verify offer was written to Firebase: Check in Firebase Console
2. Increase polling timeout in `webrtcSignaling.ts`
3. Add retry logic for offer sending

### Issue: Poor video quality or lag

**Optimize**:
1. Reduce resolution in server: `--width=640 --height=480`
2. Increase GStreamer bitrate: `bitrate=500` (for 500kbps)
3. Lower framerate: `framerate=15/1` instead of 30
4. Use better codec settings in server file

## Security Considerations

### 1. Firebase Rules

Update your `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /webrtc_sessions/{sessionId} {
      allow read, write: if request.auth != null 
        && (request.auth.uid == resource.data.userId 
            || request.auth.uid == resource.data.deviceOwnerId);
    }
  }
}
```

### 2. Device Authentication

Add device registration validation:
```typescript
// In webrtcSignaling.ts
const device = await getDeviceInfo(deviceId);
if (!device || !device.isRegistered) {
  throw new Error('Device not authorized');
}
```

### 3. Encryption

Consider encrypting SDP/ICE data at rest in Firebase using:
- Application-level encryption
- Firebase Cloud Functions with KMS

## Performance Tuning

### Server-Side (Raspberry Pi)

```javascript
// In webrtc-remote-server-simple.js

// Adjust GStreamer pipeline for better performance
const gstreamerPipeline = `
  videotestsrc pattern=0 ! 
  "video/x-raw,width=640,height=480,framerate=15/1" ! 
  x264enc speed-preset=veryfast bitrate=500 ! 
  h264parse ! 
  rtph264pay pt=96 ! 
  udpsink host=127.0.0.1 port=5004 sync=false
`;
```

### Client-Side (React Native)

```typescript
// In WebRTCVideoPlayer.tsx

// Adjust RTCPeerConnection settings
const peerConnection = new RTCPeerConnection({
  iceServers: [...],
  bundlePolicy: 'max-bundle',
  iceCandidatePoolSize: 10,
});
```

## Monitoring

### Check Device Status

```bash
# Query Firebase device status
curl -X GET \
  "https://sensor-app-2a69b-default-rtdb.firebaseio.com/device_status/{deviceId}.json" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)"
```

### Monitor Server

```bash
# On Pi
watch -n 1 'ps aux | grep node; echo "---"; free -h; echo "---"; df -h'

# Or use PM2 for better management
npm install -g pm2
pm2 start webrtc-remote-server-simple.js --name "webrtc-server"
pm2 logs webrtc-server
```

## Next Steps

1. ✅ Deploy server to Raspberry Pi
2. ✅ Test Firebase communication
3. ✅ Configure network access
4. ✅ Update React Native app UI
5. ✅ Test video streaming
6. ✅ Monitor and optimize performance

## Files to Review

- `webrtc-remote-server-simple.js` - Main server implementation
- `sensor_app/utils/WebRTCVideoPlayer.tsx` - Video player UI component
- `sensor_app/db/webrtcSignaling.ts` - Firebase signaling logic
- `sensor_app/firebase/firebaseConfig.js` - Firebase config
- `sensor_app/app/dashboard.tsx` - Dashboard integration

## Additional Resources

- [WebRTC MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [GStreamer Documentation](https://gstreamer.freedesktop.org/documentation/)
- [Firebase Realtime Database](https://firebase.google.com/docs/database)
- [React Native WebRTC](https://github.com/react-native-webrtc/react-native-webrtc)
