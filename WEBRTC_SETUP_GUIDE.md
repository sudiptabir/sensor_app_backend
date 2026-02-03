# WebRTC Video Streaming Setup Guide

## Overview
This guide sets up WebRTC video streaming using:
- **Mobile App**: Expo Bare workflow (React Native) with WebRTC component
- **Video Server**: Python WebRTC server on Windows 11 laptop
- **Signaling**: HTTP-based signaling protocol

---

## Prerequisites

### Windows 11 Laptop
- Python 3.8+
- Webcam
- Network connectivity

### Mobile App
- React Native (Bare workflow)
- `react-native-webrtc` library

---

## Step 1: Setup Windows WebRTC Server

### 1.1 Install Python Dependencies

```bash
pip install aiortc aiohttp opencv-python
```

### 1.2 Run the Server

```bash
python webrtc_server.py
```

You should see:
```
============================================================
🎥 WebRTC Video Server
============================================================
📡 Server running on http://0.0.0.0:8080
🎬 Video endpoint: /signal
🏥 Health check: /health
============================================================
```

### 1.3 Test the Server

```bash
# Health check
curl http://localhost:8080/health

# Response:
# {"status": "healthy", "active_connections": 0, "timestamp": "..."}
```

---

## Step 2: Setup Mobile App (Expo Bare)

### 2.1 Convert to Bare Workflow

```bash
cd sensor_app
npx expo prebuild
```

This generates `android/` and `ios/` folders.

### 2.2 Install WebRTC Library

```bash
npm install react-native-webrtc
cd ios && pod install && cd ..
```

### 2.3 Update Dashboard to Use WebRTC

In `sensor_app/app/dashboard.tsx`, update the video player modal:

```typescript
import { WebRTCVideoView } from '../components/WebRTCVideoView';

// In your video modal, replace the old video player with:
{showVideoPlayer && selectedDeviceForVideo && (
  <Modal
    visible={showVideoPlayer}
    transparent
    animationType="slide"
    onRequestClose={() => setShowVideoPlayer(false)}
  >
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <WebRTCVideoView
        signalingUrl="http://YOUR_LAPTOP_IP:8080/signal"
        deviceId={selectedDeviceForVideo.id}
        onConnectionStateChange={(state) => {
          console.log('[Dashboard] WebRTC state:', state);
        }}
      />
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 40,
          right: 20,
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: 10,
          borderRadius: 8,
        }}
        onPress={() => setShowVideoPlayer(false)}
      >
        <MaterialIcons name="close" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  </Modal>
)}
```

### 2.4 Find Your Laptop IP Address

**Windows Command Prompt:**
```bash
ipconfig
```

Look for "IPv4 Address" under your network adapter (e.g., `192.168.x.x`)

**Example:**
```
Ethernet adapter Ethernet:
   IPv4 Address. . . . . . . . . : 192.168.1.100
```

Replace `YOUR_LAPTOP_IP` with this address.

---

## Step 3: Network Configuration

### 3.1 Firewall (Windows)

Allow Python through Windows Firewall:
1. Open Windows Defender Firewall
2. Click "Allow an app through firewall"
3. Find Python and check both "Private" and "Public"

### 3.2 Network Access

**From Mobile Device:**
- Must be on same WiFi network as laptop
- Or use port forwarding if on different networks

**Test connectivity:**
```bash
# From mobile device, test if server is reachable
curl http://192.168.1.100:8080/health
```

---

## Step 4: Run the App

### 4.1 Start Development Server

```bash
cd sensor_app
npx expo start
```

### 4.2 Run on Device

- **Android**: Press `a` to open in Android emulator or scan QR code
- **iOS**: Press `i` to open in iOS simulator

### 4.3 Test Video Streaming

1. Open the app
2. Go to Devices tab
3. Tap "Camera" button on a device
4. Tap "Start Video" or similar button
5. WebRTC should connect and show webcam feed

---

## Troubleshooting

### Server Issues

**"Address already in use"**
```bash
# Kill process on port 8080
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

**"No module named 'aiortc'"**
```bash
pip install --upgrade aiortc
```

**Webcam not detected**
```bash
# Check available cameras
python -c "import cv2; print(cv2.VideoCapture(0).isOpened())"
```

### Mobile App Issues

**"Cannot find module 'react-native-webrtc'"**
```bash
npm install react-native-webrtc
cd ios && pod install && cd ..
```

**"Connection refused"**
- Check laptop IP address is correct
- Ensure server is running
- Check firewall settings
- Verify both devices on same network

**"WebRTC connection timeout"**
- Check STUN servers are reachable
- Verify firewall allows UDP traffic
- Check network latency

---

## Architecture Diagram

```
Mobile App (Expo Bare)
├── Dashboard Screen
├── WebRTC Component
│   ├── RTCPeerConnection
│   ├── RTCView (video display)
│   └── Signaling (HTTP)
└── Other Expo Features

        ↓ HTTP Signaling ↓

Windows 11 Laptop
├── WebRTC Server (Python)
│   ├── /signal (offer/answer)
│   ├── /signal/candidate (ICE)
│   └── /health (status)
└── Webcam Capture
    └── Video Stream
```

---

## Performance Tips

1. **Video Quality**: Adjust in `webrtc_server.py`:
   ```python
   self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)  # Increase for better quality
   self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
   self.cap.set(cv2.CAP_PROP_FPS, 30)  # Increase for smoother video
   ```

2. **Network**: Use 5GHz WiFi for better bandwidth

3. **Latency**: Lower STUN server response time by using closer servers

---

## Production Deployment

For production:
1. Use HTTPS instead of HTTP
2. Add authentication to signaling endpoints
3. Deploy server to cloud (AWS, Azure, etc.)
4. Use proper SSL certificates
5. Implement rate limiting
6. Add logging and monitoring

---

## Next Steps

- Add audio streaming
- Implement recording
- Add multiple camera support
- Deploy to production
- Add peer-to-peer connections

---

## Support

For issues:
1. Check console logs in mobile app
2. Check server logs in terminal
3. Verify network connectivity
4. Check firewall settings
5. Test with `curl` commands
