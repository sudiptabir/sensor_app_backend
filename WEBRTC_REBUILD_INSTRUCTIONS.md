# WebRTC - Rebuild Instructions

## Why Rebuild?
The WebRTC component uses `react-native-webrtc` which requires native modules. You need to rebuild the app to include these native bindings.

## Steps

### Option 1: Rebuild from Scratch (Recommended)
```bash
# In sensor_app directory
npm start
# Press 'a' to open Android (or 'i' for iOS)
# This will rebuild the native code
```

### Option 2: Manual Rebuild
```bash
# In sensor_app directory
npm run android
# or
npm run ios
```

### Option 3: Clean Rebuild (if having issues)
```bash
# In sensor_app directory
rm -r android/build
npm run android
```

## What to Expect
1. First build will take 5-10 minutes (compiling native code)
2. App will install on your device
3. Metro bundler will start
4. App will load with WebRTC support

## Testing After Rebuild
1. Open app and go to **Devices** tab
2. Tap **Camera** button
3. You should see WebRTC connection logs in console:
   ```
   [WebRTC] Initializing peer connection...
   [WebRTC] Creating offer...
   [WebRTC] Received response: answer
   [WebRTC] Remote stream added
   ```
4. Video should appear from your laptop's webcam

## Troubleshooting

### Build fails with "react-native-webrtc not found"
- Run: `npm install react-native-webrtc`
- Then rebuild

### App crashes on Camera button
- Check console for errors
- Verify WebRTC server is running
- Check IP address is correct (192.168.43.211)

### Still seeing /frame.jpg 404 errors
- These are from old MJPEG code
- They're harmless - WebRTC uses /signal endpoint instead
- Check console for [WebRTC] logs to confirm WebRTC is working

## Current Setup
- ✅ WebRTC component integrated
- ✅ Dashboard updated to use WebRTC
- ✅ TypeScript errors fixed
- ⏳ Needs rebuild to include native modules
