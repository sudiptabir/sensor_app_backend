# WebRTC Quick Start Guide

## Current Configuration
- **Laptop IP**: `10.42.0.140`
- **Server Port**: `8080`
- **Signaling URL**: `http://10.42.0.140:8080/signal`

## Start WebRTC Server

From the project root directory:

```powershell
.\rtc-test\Scripts\python.exe webrtc_server.py
```

You should see:
```
INFO:__main__:📹 Webcam initialized: 0
INFO:__main__:============================================================
INFO:__main__:🎥 WebRTC Video Server
INFO:__main__:============================================================
INFO:__main__:📡 Server running on http://0.0.0.0:8080
INFO:__main__:🎬 Video endpoint: /signal
INFO:__main__:🏥 Health check: /health
INFO:__main__:============================================================
```

## Rebuild Mobile App

```bash
cd sensor_app
npm run android
```

## What Changed

1. **Network Security Config**: Updated to only allow cleartext for `10.42.0.140`
2. **WebRTC Component**: Cleaned up unused imports and styles
3. **IP Address**: Updated from `192.168.43.211` to `10.42.0.140`

## Expected Behavior

When you open a device camera in the app:
1. WebView should load with visible status badge (purple background)
2. Green "WebView is rendering!" marker at bottom
3. Status should change: 🔄 Initializing → 🔄 Connecting → ✅ Connected
4. Video should appear once connected

## Troubleshooting

### If screen is still black:
1. Check server logs - should see "Received offer from device"
2. Check app logs - should see "[WebRTC] Initializing peer connection"
3. Verify IP hasn't changed: `ipconfig` (look for IPv4 Address)

### If IP changed again:
1. Update `sensor_app/components/WebRTCWebViewPlayer.tsx` line 13
2. Update `sensor_app/android/app/src/main/res/xml/network_security_config.xml`
3. Rebuild app

### Server logs to watch for:
- ✅ `📨 Received offer from device`
- ✅ `✅ Answer created for device`
- ✅ `🔗 Connection state: connected`
- ✅ `📤 Sent X frames`

## Notes

- Webcam device 0 is your default camera
- Server streams at ~30fps, 1280x720
- WebView uses HTML5 WebRTC (no native modules needed)
- Network security config is production-ready (only allows specific IPs)
