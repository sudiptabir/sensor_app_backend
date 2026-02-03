# Using Expo + React Native for WebRTC Video Streaming

## Short Answer
Yes — you **can** use Bare React Native for WebRTC video streaming while still using Expo for the rest of your app. This is not a workaround; it’s a **recommended and common architecture**.

---

## Core Idea
You **do not need two separate apps**.

Instead:
- Use **Expo for ~90% of the app** (UI, navigation, auth, notifications, OTA updates, etc.)
- Drop down to **Bare React Native** *only* for WebRTC video streaming

This is exactly what **Expo’s Bare workflow** is designed for.

---

## Why WebRTC Doesn’t Work in Expo Managed

Expo **Managed workflow** does not support native WebRTC because:
- WebRTC requires native Android/iOS APIs
- Libraries like `react-native-webrtc` rely on native code
- Expo Managed hides native projects (`android/` and `ios/`)

So:
- ❌ WebRTC in Expo Managed → **Not possible**
- ✅ WebRTC in Expo Bare → **Fully supported**

---

## Recommended Architecture

### Expo Bare Workflow

```
Expo App (Bare)
├── Expo features
│   ├── Navigation (expo-router / react-navigation)
│   ├── UI & screens
│   ├── Notifications
│   ├── Firebase auth
│   ├── OTA updates
│
├── Native access enabled
│   ├── react-native-webrtc
│   ├── custom native modules (if needed)
│
└── WebRTC video screen only
```

From JavaScript, it still feels like Expo — you just gain native power.

---

## What You Should NOT Do

| Approach | Verdict |
|--------|--------|
| Two separate apps (Expo + RN) | ❌ Overkill |
| Launch one app from another | ❌ Bad UX |
| Embed RN app inside Expo | ❌ Not supported |
| WebRTC in Expo Managed | ❌ Impossible |

---

## How to Implement (Step-by-Step)

### 1. Create an Expo App

```bash
npx create-expo-app myApp
cd myApp
```

---

### 2. Eject to Bare Workflow

```bash
npx expo prebuild
```

This generates:
- `android/`
- `ios/`

You now have full native access.

---

### 3. Install WebRTC

```bash
npm install react-native-webrtc
cd ios && pod install
```

This works because native projects now exist.

---

### 4. Isolate WebRTC to One Screen

Project structure:
```
src/
├── screens/
│   ├── Home.tsx
│   ├── Sensors.tsx
│   ├── VideoStream.tsx   // WebRTC only here
```

Example import:
```ts
import {
  RTCPeerConnection,
  RTCView
} from 'react-native-webrtc';
```

Only the video screen depends on native WebRTC.

---

## Alternatives (If You Don’t Need True WebRTC)

If you don’t need bidirectional, ultra‑low‑latency video:

| Option | Works in Expo Managed | Notes |
|------|---------------------|------|
| RTSP → HLS | ✅ | Higher latency |
| MJPEG over WebSocket | ✅ | Simple preview |
| SRT + FFmpeg | ⚠️ | Advanced setup |

Limitations:
- ❌ No two‑way audio
- ❌ No peer connections
- ❌ Not interactive

For **real-time interaction**, WebRTC is the correct choice.

---

## Raspberry Pi Use‑Case (Recommended)

Given:
- Raspberry Pi camera
- ML-generated alerts
- On-demand streaming

Suggested architecture:

```
Raspberry Pi
├── WebRTC server (aiortc / GStreamer / Janus)
├── Firebase or MQTT for alerts
└── REST/WebSocket signaling

Mobile App (Expo Bare)
├── Expo UI & auth
├── WebRTC video screen
└── Push notifications
```

This is scalable, clean, and production‑ready.

---

## TL;DR

- ✔ Yes, mixing Expo + Bare React Native is supported
- ✔ Use **Expo Bare workflow**
- ✔ Expo for everything
- ✔ Native RN modules only for WebRTC
- ✔ One app, clean UX

---

## Next Steps (Optional)

If needed, you can extend this with:
- WebRTC signaling flow design
- Raspberry Pi WebRTC server comparison
- Sample Expo Bare + WebRTC code
- Production hardening tips

