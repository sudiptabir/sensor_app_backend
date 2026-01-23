# Raspberry Pi Camera Streaming to Mobile App - Simple Guide

## Overview
Stream live video from Raspberry Pi camera to your React Native app using Node.js HTTP server (no complex dependencies).

---

## Step 1: Prerequisites

**On Raspberry Pi:**
- Raspberry Pi with camera module enabled
- Node.js installed (v14+)
- serviceAccountKey.json (Firebase credentials)
- device_id.txt (Your Pi's device ID)

**Check camera is enabled:**
```bash
rpicam-still -o test.jpg  # Should capture a test image
rm test.jpg
```

---

## Step 2: Create Camera Server on Raspberry Pi

```bash
# Create directory
mkdir -p ~/camera-server
cd ~/camera-server

# Initialize Node.js project
npm init -y

# Install dependencies (only 3 packages!)
npm install express cors firebase-admin
```

---

## Step 3: Create camera-server.js

Create file: `~/camera-server/camera-server.js`

```javascript
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const { execSync } = require('child_process');
const fs = require('fs');

// Initialize Firebase
const serviceAccount = require('./serviceAccountKey.json');
const DEVICE_ID = fs.readFileSync('./device_id.txt', 'utf-8').trim();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();
const app = express();
const PORT = 3000;

app.use(cors());

let lastFramePath = null;

// Capture frame using rpicam-still (libcamera)
async function captureFrame() {
  try {
    const framePath = `/tmp/frame_${Date.now()}.jpg`;
    
    // Capture image using rpicam-still (modern libcamera tool)
    execSync(`rpicam-still -o ${framePath} -w 640 -h 480 --quality 80 --timeout 1`, {
      timeout: 5000,
      stdio: 'ignore'
    });
    
    // Cleanup old frame
    if (lastFramePath && fs.existsSync(lastFramePath)) {
      fs.unlinkSync(lastFramePath);
    }
    
    lastFramePath = framePath;
    return framePath;
  } catch (error) {
    console.error('❌ Capture failed:', error.message);
    return null;
  }
}

// GET /camera/frame - Returns JPEG image
app.get('/camera/frame', async (req, res) => {
  try {
    const framePath = await captureFrame();
    
    if (!framePath || !fs.existsSync(framePath)) {
      return res.status(500).json({ error: 'Frame capture failed' });
    }
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(framePath);
  } catch (error) {
    console.error('Frame error:', error);
    res.status(500).json({ error: 'Failed to get frame' });
  }
});

// GET /camera/status - Returns camera status
app.get('/camera/status', (req, res) => {
  res.json({
    status: 'ok',
    device_id: DEVICE_ID,
    camera: 'libcamera (rpicam-still)',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Web interface for testing
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pi Camera Stream</title>
      <style>
        body { font-family: Arial; text-align: center; padding: 20px; }
        img { max-width: 100%; border: 2px solid #333; margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>🎥 Raspberry Pi Camera Stream</h1>
      <p>Device: ${DEVICE_ID}</p>
      <img src="/camera/frame?t=${Date.now()}" id="stream" />
      <script>
        setInterval(() => {
          document.getElementById('stream').src = '/camera/frame?t=' + Date.now();
        }, 500);
      </script>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Camera server running on port ${PORT}`);
  console.log(`📸 Stream: http://localhost:${PORT}/camera/frame`);
  console.log(`🌐 Web UI: http://localhost:${PORT}`);
  console.log(`Device ID: ${DEVICE_ID}\n`);
});
```

---

## Step 4: Copy Required Files

```bash
cp ~/serviceAccountKey.json ~/camera-server/
cp ~/device_id.txt ~/camera-server/
```

---

## Step 5: Test Camera Server

```bash
# Start server
node camera-server.js

# In another terminal, test endpoints:
curl http://localhost:3000/camera/status
```

Visit `http://<pi-ip>:3000` in your browser to see the live stream.

---

## Step 6: Make It Auto-Start on Boot

Create: `/etc/systemd/system/pi-camera.service`

```bash
sudo nano /etc/systemd/system/pi-camera.service
```

Add:
```ini
[Unit]
Description=Raspberry Pi Camera Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/camera-server
ExecStart=/usr/bin/node /home/pi/camera-server/camera-server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable pi-camera.service
sudo systemctl start pi-camera.service

# Check status
sudo systemctl status pi-camera.service
```

---

## Step 7: Add Camera to React Native App

### 7a. Install Package

```bash
cd /path/to/sensor_app
npm install react-native-image-viewing
```

### 7b. Update dashboard.tsx

Find the import section and add:

```typescript
import { Image } from 'react-native';
import ImageViewing from 'react-native-image-viewing';
```

### 7c. Add Camera State

Find the `useState` declarations and add:

```typescript
const [showCameraModal, setShowCameraModal] = useState(false);
const [cameraFrameUrl, setCameraFrameUrl] = useState<string>('');
const [cameraTimestamp, setCameraTimestamp] = useState(0);
```

### 7d. Add Camera Function

Add this function before the device rendering:

```typescript
const handleOpenCamera = async (deviceId: string) => {
  try {
    // Get device IP from Firestore (you'll need to add this field)
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    const deviceData = deviceDoc.data();
    
    if (!deviceData?.ip_address) {
      Alert.alert('Error', 'Device IP address not found');
      return;
    }
    
    const cameraUrl = `http://${deviceData.ip_address}:3000/camera/frame`;
    setCameraFrameUrl(cameraUrl);
    setCameraTimestamp(Date.now());
    setShowCameraModal(true);
  } catch (error) {
    console.error('Camera error:', error);
    Alert.alert('Error', 'Failed to open camera');
  }
};
```

### 7e. Add Camera Button to Device Card

Find where device action buttons are rendered (around the edit/delete buttons) and add:

```typescript
<TouchableOpacity 
  onPress={() => handleOpenCamera(item.id)}
  className="bg-blue-500 px-3 py-1 rounded"
>
  <Text className="text-white text-xs">📹</Text>
</TouchableOpacity>
```

### 7f. Add Camera Modal

Add this before the return statement (around where other modals are):

```typescript
<Modal
  visible={showCameraModal}
  transparent
  animationType="fade"
  onRequestClose={() => setShowCameraModal(false)}
>
  <View className="flex-1 bg-black justify-center items-center">
    <TouchableOpacity 
      className="absolute top-10 right-5 z-10 bg-red-500 px-4 py-2 rounded"
      onPress={() => setShowCameraModal(false)}
    >
      <Text className="text-white font-bold">Close</Text>
    </TouchableOpacity>
    
    <Image
      source={{ uri: `${cameraFrameUrl}?t=${Date.now()}` }}
      style={{ width: '100%', height: '100%' }}
      resizeMode="contain"
    />
  </View>
</Modal>
```

---

## Step 8: Update Firestore Document

Add device IP address to each device in Firestore:

```javascript
// In Firestore console, update device document with:
ip_address: "192.168.1.100"  // Replace with your Pi's actual IP
```

---

## Troubleshooting

### Camera not capturing frames
```bash
# Test rpicam-still directly
rpicam-still -o test.jpg -w 640 -h 480
file test.jpg  # Should show JPEG image
```

### Server won't start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process if needed
kill -9 <PID>
```

### Frames not updating in app
- Check device IP address is correct
- Ensure Pi and phone are on same WiFi network
- Add CORS headers check: `curl -I http://<pi-ip>:3000/camera/frame`

### Connection timeout
- Verify Pi is reachable: `ping <pi-ip>`
- Check firewall: `sudo ufw allow 3000`

---

## Performance Tips

- **Frame Resolution**: Currently 640x480. Reduce to 320x240 if network is slow
- **Quality**: Change `-q 80` to `-q 60` for smaller files
- **Capture Interval**: Currently 500ms. Increase if CPU usage is high

Edit camera-server.js:
```bash
# Change this line:
execSync(`rpicam-still -o ${framePath} -w 320 -h 240 --quality 60 --timeout 1`, {

# And this interval (in captureFrame calls):
}, 1000);  // 1 second instead of 500ms
```

---

## Next Steps

✅ Camera streaming working  
📱 Add recording capability  
🔐 Add authentication to camera server  
📊 Monitor Pi CPU/temperature  

