# WebRTC Video Streaming - Testing Guide

## Current Setup
- **WebRTC Server**: Running on Windows laptop at `192.168.43.211:8080`
- **Mobile App**: Configured to connect to WebRTC server
- **Video Component**: Integrated into Camera button in Devices tab

## Prerequisites
✅ WebRTC server running: `.\rtc-test\Scripts\python.exe webrtc_server.py`
✅ Mobile app built with Bare workflow (android directory exists)
✅ `react-native-webrtc` installed in dependencies
✅ WebRTC component integrated into dashboard

## Testing Steps

### 1. Start WebRTC Server
```bash
# In PowerShell
.\rtc-test\Scripts\python.exe webrtc_server.py
```

Expected output:
```
INFO:__main__:🎥 WebRTC Video Server
INFO:__main__:📡 Server running on http://0.0.0.0:8080
INFO:__main__:🎬 Video endpoint: /signal
```

### 2. Run Mobile App
```bash
# In sensor_app directory
npm start
# Then press 'a' for Android or 'i' for iOS
```

### 3. Test Video Streaming
1. Open the app and navigate to **Devices** tab
2. Tap the **Camera** button on any device
3. A modal will open with WebRTC video player
4. You should see:
   - Loading spinner while connecting
   - "Connecting to video stream..." message
   - Once connected: Live video from your webcam

### 4. Monitor Connection
Check the console logs for:
```
[WebRTC] Initializing peer connection...
[WebRTC] Creating offer...
[WebRTC] Offer created, sending to server...
[WebRTC] Received response: answer
[WebRTC] Setting remote description (answer)
[WebRTC] Remote stream added
```

## Troubleshooting

### Issue: 404 errors for /frame.jpg
**Cause**: Old MJPEG implementation trying to run
**Solution**: The WebRTC component now replaces MJPEG. These errors are harmless.

### Issue: Connection timeout
**Cause**: Server not reachable or wrong IP
**Solution**: 
- Verify server is running: `http://192.168.43.211:8080/health`
- Check IP address matches your laptop
- Ensure phone and laptop are on same network

### Issue: "Connection failed" state
**Cause**: WebRTC negotiation failed
**Solution**:
- Check server logs for errors
- Verify firewall allows port 8080
- Try restarting the server

### Issue: No video displayed
**Cause**: Stream not being sent from server
**Solution**:
- Check webcam is working on laptop
- Verify OpenCV can access camera (device_id=0)
- Check server logs for frame sending messages

## Architecture

```
Mobile App (Expo Bare)
    ↓
WebRTC Component (react-native-webrtc)
    ↓
HTTP Signaling (192.168.43.211:8080/signal)
    ↓
Python WebRTC Server (aiortc)
    ↓
Webcam (OpenCV)
```

## Next Steps
- Test video quality and latency
- Optimize frame rate if needed
- Add video controls (pause, screenshot, etc.)
- Implement fallback to MJPEG if WebRTC fails
