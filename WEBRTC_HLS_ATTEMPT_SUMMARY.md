# WebRTC and HLS Streaming Attempts - Summary Report
**Date:** February 1, 2026  
**Goal:** Implement smooth, flicker-free video streaming from Windows laptop camera to React Native app

---

## 📋 Initial State (Working MJPEG Setup)

### Configuration
- **Component:** `MJPEGVideoPlayer.tsx` (Native Image-based)
- **Server:** `windows-camera-server.js` (FFmpeg MJPEG stream)
- **Port:** 8080
- **Endpoint:** `/stream.mjpeg`
- **Frame Rate:** 1.5 second refresh (manual frame loading)
- **Status:** ✅ Working but with flickering issues

### Known Issues
- Visible flickering when frames update
- Not true streaming (discrete frame loading)
- Low effective FPS (~0.67 FPS)

---

## 🔄 Attempt #1: WebRTC Streaming

### Changes Made

#### 1. Created WebRTC Server (`webrtc-windows-server.js`)
```javascript
- GStreamer pipeline for H.264 encoding
- Firebase Realtime Database for signaling
- Device ID: 192b7a8c-972d-4429-ac28-4bc73e9a8809
- Video: 640x480@30fps
- Bitrate: 2000kbps
```

#### 2. Created WebRTC Video Player (`WebRTCVideoPlayer.tsx`)
```typescript
- Used react-native-webrtc library
- RTCPeerConnection implementation
- Firebase signaling integration
- Auto-reconnect logic
```

#### 3. App Configuration Changes (`app.json`)
```json
Added permissions:
- Android: CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, BLUETOOTH, BLUETOOTH_CONNECT
- iOS: NSCameraUsageDescription, NSMicrophoneUsageDescription
```

#### 4. Dashboard Integration
```typescript
- Changed from MJPEGVideoPlayer to WebRTCVideoPlayer
- Passed deviceId instead of streamUrl
- Updated imports
```

#### 5. Build Process
```bash
npx expo prebuild --clean
npx expo run:android
```

### Errors Encountered

#### Error #1: Native Module Not Found (Expo Go)
```
Exception in HostObject::get for prop 'WebRTCModule': 
TurboModuleInteropUtils$ParsingException: Unable to parse @ReactMethod 
annotations from native module: WebRTCModule
```
**Reason:** Expo Go doesn't support native modules like react-native-webrtc

#### Error #2: Native Module After Custom Build
```
TurboModule system assumes returnType == void iff the method is synchronous
```
**Reason:** Even with custom dev client, react-native-webrtc wasn't properly linked

### Why WebRTC Failed

1. **No Expo Config Plugin**
   - react-native-webrtc doesn't have an official Expo config plugin
   - Manual native code linking required
   - `npx expo prebuild` doesn't properly configure WebRTC native modules

2. **Incompatible with Expo Managed Workflow**
   - WebRTC requires direct native code access
   - Expo's managed workflow abstracts away native code
   - Would require ejecting to bare React Native

3. **Build System Conflicts**
   - TurboModule architecture incompatibility
   - Native method signature mismatches
   - Android/iOS native code not properly generated

### WebRTC Attempt Conclusion
❌ **FAILED** - Requires bare React Native workflow, not compatible with Expo managed workflow

---

## 🎥 Attempt #2: HLS (HTTP Live Streaming)

### Changes Made

#### 1. Installed expo-video Package
```bash
npx expo install expo-video
```

#### 2. Created HLS Server (`hls-camera-server.js`)
```javascript
- FFmpeg with HLS output format
- 1-second segments
- Keep last 3 segments
- Output: stream.m3u8 playlist
- Port: 3000
- Endpoint: /hls/stream.m3u8
```

**FFmpeg HLS Configuration:**
```bash
-c:v libx264              # H.264 codec
-preset ultrafast         # Fast encoding
-tune zerolatency         # Low latency
-f hls                    # HLS format
-hls_time 1               # 1 second segments
-hls_list_size 3          # Keep 3 segments
-hls_flags delete_segments+append_list
```

#### 3. Created HLS Video Player (`HLSVideoPlayer.tsx`)
```typescript
- Used expo-video's VideoView component
- useVideoPlayer hook for stream management
- Auto-play logic with multiple triggers
- Manual play button as fallback
- Status monitoring (isPlaying, isLoading, isReadyToPlay)
```

#### 4. Dashboard Integration
```typescript
- Changed from MJPEGVideoPlayer to HLSVideoPlayer
- Stream URL: http://192.168.43.211:3000/hls/stream.m3u8
- Updated imports
```

#### 5. Build Process
```bash
npx expo prebuild --clean  # Exit code: 0 ✅
npx expo run:android       # Exit code: 0 ✅
```

### Server Status
```
✅ HLS server running successfully
📹 Camera: Integrated Camera
📐 Resolution: 640x480@30fps
📺 Streaming... (confirmed in logs)
```

### Errors Encountered

#### Error: Player Status All Undefined
```javascript
[HLS] Player status: {
  "error": undefined,
  "isLoading": undefined,
  "isPlaying": undefined,
  "isReadyToPlay": undefined
}
```

**Observation:**
- Component mounted successfully
- Stream URL correct: `http://192.168.43.211:3000/hls/stream.m3u8`
- Player initialized: `[HLS] Player initialized`
- Force play triggered: `[HLS] Force playing stream...`
- But player status never changed from `undefined`

#### Visual Result
- Black screen displayed
- No video playback
- No error messages
- Player appears non-functional

### Why HLS Failed

1. **expo-video Native Module Not Properly Compiled**
   - Build succeeded (`exit code: 0`)
   - But native video player module didn't initialize properly
   - Player status remaining `undefined` indicates native layer not connected

2. **Possible expo-video Incompatibility**
   - expo-video may have specific React Native version requirements
   - New Architecture mode (`"newArchEnabled": true` in app.json) might conflict
   - Video codec/format compatibility issues with Android build

3. **Silent Native Failure**
   - No JavaScript errors
   - No native crash logs
   - Video player simply never initialized
   - Suggests native code loaded but didn't bind to JavaScript properly

4. **HLS Format Issues (Possible)**
   - Android MediaPlayer may have codec restrictions
   - H.264 baseline profile might be required
   - HLS segments might not be generating fast enough
   - Network accessibility of localhost:3000 from Android device

### Debugging Attempted
```typescript
// Added extensive logging
console.log('[HLS] Component mounted with URL:', streamUrl);
console.log('[HLS] Player initialized');
console.log('[HLS] Player status:', status);
console.log('[HLS] Force playing stream...');

// Added auto-play triggers
- On mount with 1-second delay
- When isReadyToPlay becomes true
- Manual play button

// Result: No status ever changed from undefined
```

### HLS Attempt Conclusion
❌ **FAILED** - expo-video native module not functioning, player status never initialized

---

## 🔍 Root Cause Analysis

### Common Issue: Expo's Native Module Limitations

Both WebRTC and HLS attempts failed due to the same fundamental problem:

**Expo's managed workflow cannot properly support complex native video modules**

#### Why Native Modules Fail in Expo

1. **Limited Native Code Access**
   - Expo abstracts away native Android/iOS code
   - Complex modules need direct native configuration
   - Config plugins don't exist for all libraries

2. **Build System Constraints**
   - `expo prebuild` generates native code automatically
   - Not all native modules have proper Expo integration
   - Manual linking impossible in managed workflow

3. **TurboModule Architecture**
   - React Native's new architecture
   - Stricter native method requirements
   - Many older native modules incompatible

### Specific Module Issues

**react-native-webrtc:**
- No Expo config plugin
- Requires manual native Android/iOS setup
- Peer connection native methods incompatible with Expo

**expo-video:**
- Has config plugin but may have bugs
- Native video player didn't bind to JavaScript
- Silent failure with no error messages

---

## 📊 Comparison Matrix

| Feature | MJPEG (Current) | WebRTC (Failed) | HLS (Failed) |
|---------|----------------|-----------------|--------------|
| **Implementation** | ✅ Working | ❌ Failed | ❌ Failed |
| **Frame Rate** | ~0.67 FPS | 30 FPS | 30 FPS |
| **Latency** | ~1.5 seconds | ~200ms | ~3 seconds |
| **Flickering** | ⚠️ Yes | ❌ N/A | ❌ N/A |
| **Native Module** | ❌ No | ✅ Yes | ✅ Yes |
| **Expo Compatible** | ✅ Yes | ❌ No | ⚠️ Should be |
| **Server Complexity** | Low | High | Medium |
| **Build Required** | ❌ No | ✅ Yes | ✅ Yes |
| **Network Usage** | Low | Medium | Medium |

---

## 🛠️ MJPEG Optimization Attempts

While trying to fix flickering, several optimizations were attempted:

### 1. Double Buffering
```typescript
// Two Image components alternating
const [uri1, setUri1] = useState('');
const [uri2, setUri2] = useState('');
const [activeImage, setActiveImage] = useState<1 | 2>(1);
```
**Result:** Still flickered

### 2. Crossfade Animation
```typescript
Animated.parallel([
  Animated.timing(opacity1, { toValue: 1, duration: 150 }),
  Animated.timing(opacity2, { toValue: 0, duration: 150 }),
]).start();
```
**Result:** Still flickered

### 3. Faster Refresh Rates
- Tried: 333ms (3 FPS), 500ms (2 FPS), 1000ms (1 FPS), 1500ms (0.67 FPS)
**Result:** Faster = more flickering

### 4. Removed All Animations
```typescript
// Plain Image component, no opacity changes
<Image source={{ uri, cache: 'reload' }} />
```
**Result:** Still flickered (inherent to frame-by-frame loading)

---

## ✅ Final Configuration (Restored Backup)

### Current Setup
```typescript
Component: MJPEGVideoPlayer (from MJPEG_BACKUP/)
Server: Port 8080, /stream.mjpeg endpoint
Refresh: 1.5 seconds per frame
Status: Working with acceptable flickering
```

### Backup Location
```
C:\Users\SUDIPTA\Downloads\Sensor_app\MJPEG_BACKUP\
├── MJPEGVideoPlayer.tsx.backup
├── MJPEGVideoPlayerWebView.tsx.backup
└── MJPEG_RESTORE_GUIDE.md
```

---

## 💡 Recommendations

### Short Term (Keep MJPEG)
1. ✅ **Accept current MJPEG solution**
   - It works reliably
   - No build complexity
   - Flickering is tolerable for monitoring use case

2. **Potential MJPEG Improvements:**
   - Reduce frame refresh to 2 seconds (less flickering)
   - Add motion detection (only update when needed)
   - Implement frame interpolation

### Long Term (Future Improvements)

#### Option 1: Eject to Bare React Native
```bash
# Remove Expo, go full React Native
npx expo eject
# Then properly configure react-native-webrtc
```
**Pros:** Full native control, WebRTC possible
**Cons:** Lose Expo benefits, more complexity

#### Option 2: Use IP Camera with RTSP
- Get dedicated IP camera
- Use RTSP native player
- Better hardware encoding

#### Option 3: Backend Video Proxy
- Server-side video processing
- Convert to web-friendly format
- Progressive download instead of streaming

---

## 📝 Lessons Learned

1. **Expo's Limitations**
   - Not all React Native libraries work with Expo
   - Native video streaming requires bare workflow
   - Always check library compatibility before starting

2. **Native Module Complexity**
   - "It has a package" ≠ "It works in Expo"
   - Silent failures are common with native modules
   - Build success ≠ runtime success

3. **Video Streaming is Hard**
   - Real-time streaming requires native code
   - WebRTC and HLS are complex protocols
   - Simple solutions (MJPEG) sometimes better than fancy ones

4. **Backup Everything**
   - Having MJPEG_BACKUP saved hours of work
   - Always create restore points before major changes
   - Document working configurations

---

## 📦 Files Created During Attempts

### WebRTC Files
- `webrtc-windows-server.js` - WebRTC signaling server
- `sensor_app/utils/WebRTCVideoPlayer.tsx` - WebRTC player component
- `sensor_app/db/webrtcSignaling.ts` - Firebase signaling service

### HLS Files
- `hls-camera-server.js` - HLS streaming server
- `sensor_app/utils/HLSVideoPlayer.tsx` - HLS player component
- `hls_stream/` - Generated HLS segments directory

### Documentation
- `WEBRTC_HLS_ATTEMPT_SUMMARY.md` - This file

---

## 🎯 Conclusion

**WebRTC and HLS streaming were not achievable in Expo managed workflow** due to native module limitations. The original MJPEG solution, while having some flickering, remains the most reliable approach for this use case.

**Final Status:** Reverted to MJPEG backup from earlier today ✅

**Current State:** Functional video streaming with acceptable trade-offs ✅

**Future Path:** Consider bare React Native if real-time WebRTC becomes critical requirement ⚠️
