# Camera Streaming Integration Guide

## Overview

Your React Native Sensor App can now display live camera streams from Raspberry Pi devices. The integration supports:

- ✅ H.264 streaming via camera server
- ✅ MJPEG streaming support  
- ✅ Direct browser viewing from mobile app
- ✅ Snapshot capture functionality
- ✅ Multiple camera formats

---

## How It Works

### Architecture

1. **Raspberry Pi** - Runs `camera-server-h264.js` on port 3000
2. **React Native App** - Shows camera IP/port and provides link to open stream
3. **Mobile Browser** - Displays the actual video stream with HTML5 player

### Flow

```
React Native App
    ↓
    [📹 Button clicked on device]
    ↓
    [Shows device camera details]
    ↓
    [User taps "🌐 Open in Browser"]
    ↓
    Mobile Browser opens: http://<device-ip>:3000
    ↓
    [Full H.264 streaming interface loads]
```

---

## Setup Instructions

### Step 1: Configure Device with Camera IP Address

You need to add `ipAddress` and `cameraPort` to your device document in Firestore.

#### Option A: Using Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → Firestore Database
3. Navigate to `devices` collection
4. Open your device document
5. Add/Update these fields:
   ```
   ipAddress: "192.168.x.x"    (Your Raspberry Pi IP)
   cameraPort: 3000             (Camera server port)
   ```

#### Option B: Programmatically

Add this to your device setup code:

```typescript
// In firestore.ts or device initialization
import { doc, updateDoc } from "firebase/firestore";

export async function configureDeviceCamera(
  deviceId: string,
  ipAddress: string,
  cameraPort: number = 3000
) {
  const deviceRef = doc(db, "devices", deviceId);
  await updateDoc(deviceRef, {
    ipAddress,
    cameraPort,
  });
}
```

Then call it:

```typescript
await configureDeviceCamera("device-id", "192.168.1.100", 3000);
```

---

### Step 2: Find Your Raspberry Pi IP Address

#### SSH into Raspberry Pi

```bash
# Get IP address
hostname -I
# Example output: 192.168.1.100 192.168.17.100
```

#### Alternative Methods

**Via RouterAdmin Console:**
- Log into your router (usually 192.168.1.1 or 192.168.0.1)
- Look for "Connected Devices" or "DHCP Clients"
- Find device named "raspberrypi"

**Via nmap (Linux/Mac):**
```bash
nmap -sn 192.168.1.0/24 | grep -i raspberry
```

**Via Windows PowerShell:**
```powershell
arp -a | Select-String "raspberry"
```

---

### Step 3: Start Camera Server on Raspberry Pi

```bash
# SSH into your Pi
ssh pi@<pi-ip>

# Navigate to project
cd ~/Sensor_app

# Start the camera server
node camera-server-h264.js

# Should see:
# ✅ Server running on:
#    - Web UI: http://192.168.1.100:3000
```

---

### Step 4: Test in React Native App

1. **Launch the app** on your phone/emulator
2. **Go to Devices tab**
3. **Tap the 📹 camera icon** on any device
4. **Verify** device shows IP address (e.g., "192.168.1.100:3000")
5. **Tap "🌐 Open in Browser"**
6. **Browser opens** showing the camera server interface
7. **Click "▶ Start H.264 Stream"** to begin streaming
8. **Video appears** in the browser player

---

## Device Configuration Example

Your Firestore device document should look like:

```json
{
  "id": "device-123",
  "label": "Pi Camera - Living Room",
  "userId": "user-456",
  "ipAddress": "192.168.1.100",
  "cameraPort": 3000,
  "location": "Living Room",
  "lastSeen": 1706000000000,
  "status": "online"
}
```

---

## Troubleshooting

### "No Camera Connected" Message

**Cause:** Device missing `ipAddress` field

**Solution:**
1. Add `ipAddress` to device in Firestore
2. Set correct Raspberry Pi IP address
3. Refresh the app

### "Browser won't open"

**Cause:** Invalid URL or network issue

**Solution:**
- Verify IP address is correct: `ping 192.168.1.100`
- Check camera server is running: `ps aux | grep camera`
- Ensure phone/computer is on same WiFi network

### "Stream doesn't appear in browser"

**Cause:** Camera server not streaming or camera not enabled

**Solution:**

1. **Check camera is enabled:**
   ```bash
   sudo raspi-config
   # Interface Options > Camera > Enable
   sudo reboot
   ```

2. **Verify camera device exists:**
   ```bash
   ls /dev/video0
   ```

3. **Test camera directly:**
   ```bash
   rpicam-still -o test.jpg
   ls -la test.jpg
   ```

4. **Check camera server logs:**
   Look at the terminal running `camera-server-h264.js` for errors

---

## Camera Server Endpoints

Once you have the IP configured, these URLs are available:

| Endpoint | Purpose |
|----------|---------|
| `http://ip:3000/` | Web UI with full controls |
| `http://ip:3000/camera/stream` | H.264 video stream |
| `http://ip:3000/camera/frame` | Single frame snapshot |
| `http://ip:3000/camera/status` | JSON status info |

---

## Advanced: Add Your Devices Automatically

To auto-add camera configuration when registering devices, update the registration process:

```typescript
// In your device registration function
export async function registerDeviceWithCamera(
  deviceId: string,
  label: string,
  ipAddress: string,
  cameraPort: number = 3000
) {
  const deviceRef = collection(db, "devices");
  
  await setDoc(doc(deviceRef, deviceId), {
    id: deviceId,
    label,
    ipAddress,
    cameraPort,
    userId: auth.currentUser?.uid,
    registeredAt: new Date(),
    status: "online"
  });
}
```

---

## Next Steps

1. ✅ Find your Raspberry Pi's IP address
2. ✅ Update device document in Firestore with IP + port
3. ✅ Start camera server on Pi: `node camera-server-h264.js`
4. ✅ Test by tapping 📹 in the app
5. ✅ Open stream in browser via "🌐 Open in Browser" button

---

## Files Modified

- `sensor_app/app/dashboard.tsx` - Added camera controls to video modal
- `sensor_app/utils/cameraStreaming.ts` - New camera URL utility functions

---

## Support

For issues with:
- **Camera server**: See `PI_CAMERA_STREAMING_GUIDE.md`
- **Raspberry Pi setup**: See `RASPBERRY_PI_SETUP.md`
- **Firestore config**: See Firebase documentation
