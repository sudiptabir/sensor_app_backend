# Windows 11 Laptop Webcam Streaming Setup

## 🎯 Overview

You can use your Windows 11 laptop's built-in webcam to stream video to your Sensor App, just like a Raspberry Pi camera! This guide shows you how to set up a camera server on Windows.

## ✅ Prerequisites

### 1. Install FFmpeg

FFmpeg is required to capture video from your Windows webcam.

**Option A: Using Chocolatey (Recommended)**
```powershell
# Install Chocolatey if you don't have it
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install FFmpeg
choco install ffmpeg
```

**Option B: Manual Installation**
1. Download FFmpeg from https://ffmpeg.org/download.html
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to your system PATH:
   - Open Settings → System → About → Advanced system settings
   - Click "Environment Variables"
   - Edit "Path" under System variables
   - Add `C:\ffmpeg\bin`
   - Click OK and restart PowerShell

**Verify Installation:**
```powershell
ffmpeg -version
```

### 2. Install Node.js Dependencies

```powershell
cd C:\Users\SUDIPTA\Downloads\Sensor_app
npm install express cors
```

## 🎥 Step 1: Find Your Webcam Device Name

First, you need to identify your camera's device name:

```powershell
ffmpeg -list_devices true -f dshow -i dummy
```

This will show output like:
```
[dshow @ 000001234567890] DirectShow video devices
[dshow @ 000001234567890]  "Integrated Camera"
[dshow @ 000001234567890]     Alternative name "@device_pnp_\\?\usb#vid_..."
[dshow @ 000001234567890]  "OBS Virtual Camera"
```

Look for your built-in camera (usually "Integrated Camera" or "HP TrueVision HD Camera", etc.)

## 🚀 Step 2: Start the Windows Camera Server

### Default Setup (Most Common)

If your camera is named "Integrated Camera":

```powershell
cd C:\Users\SUDIPTA\Downloads\Sensor_app
node windows-camera-server.js
```

### Custom Camera Name

If your camera has a different name:

```powershell
$env:VIDEO_DEVICE='video="Your Camera Name"'
node windows-camera-server.js
```

### Custom Configuration

```powershell
# Set custom options
$env:DEVICE_ID="my-laptop-camera"
$env:VIDEO_DEVICE='video="Integrated Camera"'
$env:VIDEO_WIDTH="1280"
$env:VIDEO_HEIGHT="720"
$env:FRAME_RATE="30"
$env:PORT="3000"

# Start server
node windows-camera-server.js
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║       🎥 Windows Webcam Streaming Server                  ║
║       Device: my-laptop-camera                            ║
╚════════════════════════════════════════════════════════════╝

✅ Server running on:
   - Web UI:        http://localhost:3000
   - Camera Frame:  http://localhost:3000/camera/frame
   - Status:        http://localhost:3000/camera/status

📹 Video Device:  video="Integrated Camera"
📐 Resolution:     640x480
⏱️  Frame Rate:     30 FPS
```

## 🌐 Step 3: Test in Web Browser

1. Open your browser to http://localhost:3000
2. Click "▶️ Start Stream"
3. You should see your webcam video streaming!

## 📱 Step 4: Connect to Your Mobile App

### Find Your Laptop's IP Address

```powershell
# Get your local IP address
ipconfig
```

Look for "IPv4 Address" under your Wi-Fi adapter (e.g., `192.168.1.105`)

### Add Device to Firebase

You need to add your laptop as a device in Firebase with the IP address:

**Option 1: Using Firebase Console**
1. Go to https://console.firebase.google.com
2. Navigate to Firestore Database
3. Find or create a device document
4. Add these fields:
   - `device_id`: `my-laptop-camera` (or whatever you set)
   - `device_name`: `Windows Laptop Camera`
   - `ipAddress`: `192.168.1.105` (your laptop's IP)
   - `cameraPort`: `3000`
   - `type`: `camera`

**Option 2: Using the create-admin.js Script**

Create a file `add-laptop-device.js`:

```javascript
const admin = require('firebase-admin');

// Initialize Firebase (reuse your existing service account)
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Add laptop as a camera device
async function addLaptopDevice() {
  const deviceData = {
    device_id: 'windows-laptop',
    device_name: 'Windows Laptop Camera',
    type: 'camera',
    ipAddress: '192.168.1.105', // CHANGE THIS to your laptop's IP
    cameraPort: 3000,
    status: 'online',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  };

  const docRef = await db.collection('devices').add(deviceData);
  console.log('✅ Laptop device added with ID:', docRef.id);
  process.exit(0);
}

addLaptopDevice();
```

Run it:
```powershell
node add-laptop-device.js
```

## 📲 Step 5: View in Mobile App

1. **Open your Sensor App** on your phone
2. **Go to Devices tab**
3. **Find your laptop device** (should show "Windows Laptop Camera")
4. **Tap the 📹 camera icon**
5. **Tap "🌐 Open in Browser"**
6. **Your laptop's webcam stream should appear!**

## 🔧 Advanced Configuration

### Higher Quality Stream

```powershell
$env:VIDEO_WIDTH="1920"
$env:VIDEO_HEIGHT="1080"
$env:FRAME_RATE="30"
node windows-camera-server.js
```

### Lower Bandwidth (Mobile Networks)

```powershell
$env:VIDEO_WIDTH="320"
$env:VIDEO_HEIGHT="240"
$env:FRAME_RATE="15"
node windows-camera-server.js
```

### Use Different Port

```powershell
$env:PORT="8080"
node windows-camera-server.js
```

### Run Multiple Cameras

If you have multiple webcams:

```powershell
# Terminal 1 - Built-in camera
$env:VIDEO_DEVICE='video="Integrated Camera"'
$env:DEVICE_ID="laptop-camera-1"
$env:PORT="3000"
node windows-camera-server.js

# Terminal 2 - External USB camera
$env:VIDEO_DEVICE='video="USB2.0 HD UVC WebCam"'
$env:DEVICE_ID="laptop-camera-2"
$env:PORT="3001"
node windows-camera-server.js
```

## 🚀 Run as Background Service

### Option 1: Using PM2 (Recommended)

```powershell
# Install PM2
npm install -g pm2

# Start server
pm2 start windows-camera-server.js --name "webcam-server"

# View logs
pm2 logs webcam-server

# Stop server
pm2 stop webcam-server

# Auto-start on boot
pm2 startup
pm2 save
```

### Option 2: Using NSSM (Windows Service)

1. Download NSSM from https://nssm.cc/download
2. Install as service:

```powershell
nssm install WebcamServer "C:\Program Files\nodejs\node.exe"
nssm set WebcamServer AppDirectory "C:\Users\SUDIPTA\Downloads\Sensor_app"
nssm set WebcamServer AppParameters "windows-camera-server.js"
nssm start WebcamServer
```

## 🌍 Access from Outside Your Network

### Option 1: Port Forwarding (Router)

1. Log into your router (usually http://192.168.1.1)
2. Find "Port Forwarding" settings
3. Forward external port 3000 → your laptop's IP (192.168.1.105):3000
4. Use your public IP to access: http://YOUR_PUBLIC_IP:3000

### Option 2: Ngrok (Easiest)

```powershell
# Install ngrok
choco install ngrok

# Start ngrok tunnel
ngrok http 3000
```

Ngrok will give you a public URL like `https://abc123.ngrok.io` that you can use from anywhere.

Update your Firebase device with the ngrok URL:
- `ipAddress`: `abc123.ngrok.io`
- `cameraPort`: `443` (HTTPS)

## 🔥 Firewall Configuration

Allow Node.js through Windows Firewall:

```powershell
# Allow inbound connections
New-NetFirewallRule -DisplayName "Webcam Server" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000

# Or use Windows Defender Firewall GUI:
# Settings → Windows Security → Firewall & network protection → Allow an app through firewall
```

## 🐛 Troubleshooting

### "ffmpeg not found" Error

**Solution:** Make sure FFmpeg is installed and in your PATH
```powershell
ffmpeg -version
```

### Camera Permission Denied

**Solution:** Check Windows camera privacy settings
1. Settings → Privacy & Security → Camera
2. Enable "Let apps access your camera"
3. Enable "Let desktop apps access your camera"

### "Camera device not found"

**Solution:** Verify device name
```powershell
ffmpeg -list_devices true -f dshow -i dummy
```

### Stream is Laggy

**Solution:** Reduce resolution and frame rate
```powershell
$env:VIDEO_WIDTH="480"
$env:VIDEO_HEIGHT="360"
$env:FRAME_RATE="15"
node windows-camera-server.js
```

### Can't Connect from Phone

**Solution:** Ensure devices are on same Wi-Fi network
```powershell
# Check laptop IP
ipconfig

# Test from phone browser
http://YOUR_LAPTOP_IP:3000
```

### Port Already in Use

**Solution:** Find and kill the process using port 3000
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or use a different port
$env:PORT="3001"
node windows-camera-server.js
```

## 📊 Monitoring & Logs

### Check Server Status

Open http://localhost:3000/camera/status in browser

### View Real-time Logs

The server logs appear in the PowerShell terminal where you started it.

### Performance Monitoring

```powershell
# View Node.js process stats
Get-Process node | Select-Object CPU, WorkingSet, ProcessName
```

## 🎨 Features

✅ **MJPEG Streaming** - Compatible with existing app infrastructure  
✅ **Still Frame Capture** - Grab individual frames  
✅ **Web UI** - Built-in browser interface for testing  
✅ **Auto-refresh** - Continuous streaming at configurable FPS  
✅ **Status API** - Monitor server and camera status  
✅ **Cross-platform Compatible** - Works with existing React Native app  
✅ **Configurable Quality** - Adjust resolution, FPS, and bitrate  

## 🔗 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web UI for viewing stream |
| `/camera/frame` | GET | Get latest video frame (JPEG) |
| `/camera/status` | GET | Get server and camera status (JSON) |
| `/camera/start` | POST | Start continuous capture |
| `/camera/stop` | POST | Stop streaming |

## 📝 Next Steps

1. **Configure Firebase** - Add laptop device to Firestore
2. **Test Mobile App** - Verify streaming works from your phone
3. **Optimize Settings** - Adjust quality based on your network
4. **Setup Auto-start** - Use PM2 or NSSM for production
5. **Enable Remote Access** - Use ngrok or port forwarding if needed

## 💡 Tips

- **Battery:** Streaming uses more battery - keep laptop plugged in
- **Performance:** Close other camera apps before starting server
- **Network:** Use wired Ethernet for best quality
- **Privacy:** Remember to stop the server when not in use
- **Quality:** Start with default settings, then adjust as needed

---

**Enjoy streaming from your Windows 11 laptop! 📹✨**
