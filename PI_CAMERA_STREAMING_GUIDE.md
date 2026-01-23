# Raspberry Pi Camera Streaming to React Native App

## Overview
We'll set up a Node.js server on the Raspberry Pi that captures camera frames and streams them to your mobile app via HTTP/WebSocket.

---

## Step 1: Install Dependencies on Raspberry Pi

### Enable Camera on Raspberry Pi
```bash
# SSH into your Raspberry Pi
ssh pi@<your-pi-ip>

# Enable camera in raspi-config
sudo raspi-config
# Navigate to: Interface Options → Camera → Enable → Reboot

# Verify libcamera is working
rpicam-still -o test.jpg
ls -lh test.jpg  # Should show the captured image
rm test.jpg
```

### Install Node.js (if not already installed)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Install Required Packages
```bash
cd ~/camera-server
npm init -y
npm install express cors firebase-admin
```

### That's it! No complex dependencies needed.
We'll use `raspistill` which is already built into Raspberry Pi OS.

---

## Step 2: Create Node.js Camera Server on Raspberry Pi

Create `camera-server.js`:

```javascript
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
const deviceIdFile = './device_id.txt';
const DEVICE_ID = fs.readFileSync(deviceIdFile, 'utf-8').trim();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

let lastFramePath = null;

// Function to capture a frame using rpicam-still (libcamera)
async function captureFrame() {
  try {
    const timestamp = Date.now();
    const framePath = `/tmp/frame_${timestamp}.jpg`;
    
    // Capture JPEG image using rpicam-still (modern libcamera tool)
    execSync(`rpicam-still -o ${framePath} -w 640 -h 480 --quality 80 --timeout 1`, {
      timeout: 5000,
      stdio: 'ignore'
    });
    
    // Delete old frame if exists
    if (lastFramePath && fs.existsSync(lastFramePath)) {
      try {
        fs.unlinkSync(lastFramePath);
      } catch (e) {
        console.error('Failed to delete old frame:', e.message);
      }
    }
    
    lastFramePath = framePath;
    return framePath;
  } catch (error) {
    console.error('Camera capture failed:', error.message);
    return null;
  }
}

// Start capturing frames continuously in background
async function startCameraCapture() {
  console.log('🎥 Camera capture started...');
  setInterval(async () => {
    await captureFrame();
  }, 500); // Capture every 500ms
}

// Endpoint to get current frame
app.get('/camera/frame', async (req, res) => {
  try {
    const framePath = await captureFrame();
    
    if (!framePath || !fs.existsSync(framePath)) {
      return res.status(500).json({ error: 'Frame capture failed' });
    }
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(framePath);
  } catch (error) {
    console.error('Frame endpoint error:', error);
    res.status(500).json({ error: 'Failed to retrieve frame' });
  }
});

// Endpoint to get camera status
app.get('/camera/status', async (req, res) => {
  try {
    const result = execSync('rpicam-still --help 2>&1 | head -1', { encoding: 'utf-8' });
    res.json({
      status: 'ready',
      camera: 'libcamera (rpicam-still)',
      device_id: DEVICE_ID,
      port: PORT,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Simple web interface for testing
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Raspberry Pi Camera Stream</title>
      <style>
        body { font-family: Arial; text-align: center; padding: 20px; }
        img { max-width: 100%; border: 2px solid #333; margin: 20px 0; }
        .info { background: #f0f0f0; padding: 10px; border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>🎥 Raspberry Pi Camera Stream</h1>
      <div class="info">
        <p><strong>Device ID:</strong> ${DEVICE_ID}</p>
        <p><strong>Status:</strong> Running on port ${PORT}</p>
      </div>
      <h2>Live Stream</h2>
      <img src="/camera/frame?t=${Date.now()}" alt="Camera Feed" id="stream" />
      <script>
        // Auto-refresh frame every 500ms
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
  console.log(`\n✅ Camera server running on http://localhost:${PORT}`);
  console.log(`📸 Frame endpoint: http://localhost:${PORT}/camera/frame`);
  console.log(`📊 Status endpoint: http://localhost:${PORT}/camera/status`);
  console.log(`🌐 Web interface: http://localhost:${PORT}`);
  console.log(`\nDevice ID: ${DEVICE_ID}\n`);
  
  // Start continuous camera capture
  startCameraCapture();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down camera server...');
  process.exit(0);
});
```

---

## Step 3: Create Web Interface (Optional)

Create `public/index.html` to test camera streaming:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Pi Camera Stream</title>
  <style>
    body { font-family: Arial; text-align: center; }
    img { max-width: 100%; border: 2px solid #333; margin: 20px; }
    button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>🎥 Raspberry Pi Camera Stream</h1>
  <div>
    <img id="stream" src="/camera/frame" style="width: 640px; height: 480px;">
  </div>
  <button onclick="refreshFrame()">Refresh</button>
  
  <script>
    // Refresh frame every 500ms
    setInterval(() => {
      const img = document.getElementById('stream');
      img.src = '/camera/frame?' + new Date().getTime();
    }, 500);
    
    function refreshFrame() {
      const img = document.getElementById('stream');
      img.src = '/camera/frame?' + new Date().getTime();
    }
  </script>
</body>
</html>
```

---

## Step 4: Run Camera Server

```bash
# Copy serviceAccountKey.json to camera-server directory
cp ~/serviceAccountKey.json ~/camera-server/

# Copy device_id.txt
cp ~/device_id.txt ~/camera-server/

# Make camera server auto-start
chmod +x camera-server.js

# Start the server
node camera-server.js
```

**To make it run on boot:**
```bash
# Create systemd service
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

Then:
```bash
sudo systemctl enable pi-camera.service
sudo systemctl start pi-camera.service
sudo systemctl status pi-camera.service
```

---

## Step 5: Update React Native App

### Install Image Viewing Package
```bash
cd sensor_app
npm install react-native-image-viewing
```

### Add Camera View to Dashboard

Update [sensor_app/app/dashboard.tsx](sensor_app/app/dashboard.tsx) to add camera streaming:

**Add imports:**
```typescript
import { Image } from 'react-native';
```

**Add state for camera:**
```typescript
const [cameraUrl, setCameraUrl] = useState<string>('');
const [showCamera, setShowCamera] = useState(false);
const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
```

**Add function to stream camera:**
```typescript
const startCameraStream = (deviceId: string) => {
  // Get device IP from your network
  const piIp = '192.168.x.x'; // Replace with your Pi's IP
  setCameraUrl(`http://${piIp}:3000/camera/frame`);
  setSelectedDeviceId(deviceId);
  setShowCamera(true);
};
```

**Add camera button to device card:**
```typescript
<TouchableOpacity
  style={[styles.actionBtn, styles.cameraBtn]}
  onPress={() => startCameraStream(item.id)}
>
  <Text style={styles.actionBtnText}>📹</Text>
</TouchableOpacity>
```

**Add camera view modal:**
```typescript
{showCamera && cameraUrl && (
  <Modal
    visible={showCamera}
    transparent
    onRequestClose={() => setShowCamera(false)}
  >
    <View style={styles.cameraModal}>
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={() => setShowCamera(false)}
      >
        <Text style={styles.closeText}>✕ Close</Text>
      </TouchableOpacity>
      
      <Image
        source={{ uri: cameraUrl + '?' + Date.now() }}
        style={styles.cameraImage}
      />
      
      <Text style={styles.cameraInfo}>
        Device: {selectedDeviceId}
      </Text>
    </View>
  </Modal>
)}
```

**Add styles:**
```typescript
cameraBtn: {
  backgroundColor: '#F3E5AB',
  borderColor: '#FFC107',
},
cameraModal: {
  flex: 1,
  backgroundColor: '#000',
  justifyContent: 'center',
  alignItems: 'center',
},
closeButton: {
  position: 'absolute',
  top: 40,
  right: 20,
  zIndex: 10,
  backgroundColor: 'rgba(0,0,0,0.7)',
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 8,
},
closeText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
},
cameraImage: {
  width: '90%',
  height: '70%',
  resizeMode: 'contain',
},
cameraInfo: {
  color: '#fff',
  marginTop: 20,
  fontSize: 14,
},
```

---

## Step 6: Test the Setup

1. **Start Pi Camera Server:**
   ```bash
   ssh pi@<pi-ip>
   cd ~/camera-server
   node camera-server.js
   ```

2. **Test via Web Browser:**
   - Open `http://<pi-ip>:3000` in a browser
   - You should see live camera feed

3. **Test in Mobile App:**
   - Update the Pi IP in your app code
   - Click the 📹 button on any device
   - Live camera stream should appear

---

## Troubleshooting

### Camera Not Working
```bash
# Test camera directly
raspistill -o test.jpg -w 640 -h 480
ls -lh test.jpg
```

### Connection Issues
```bash
# Check if server is running
curl http://<pi-ip>:3000/health

# Check firewall
sudo ufw allow 3000
```

### Performance Issues
- Reduce frame resolution (320x240 instead of 640x480)
- Increase interval between captures (1000ms instead of 500ms)
- Use H.264 compression instead of JPEG

---

## Next Steps
- Add recording functionality
- Stream to multiple users simultaneously
- Add pan/tilt control (with servo motors)
- Store frames to Firebase Storage
