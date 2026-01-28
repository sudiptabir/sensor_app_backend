# 🔧 MJPEG Remote Streaming - Production Fix Guide

## ✅ What Was Fixed

I've updated `mjpeg-camera-server.js` to automatically detect and register the Raspberry Pi's local IP address with Firebase, which is critical for your mobile app to connect remotely.

### Changes Made:

1. **Auto-detect Local IP Address** - Added `getLocalIPAddress()` function to find the Pi's network IP
2. **Register IP in Firebase** - Now stores `ipAddress` and `ip_address` fields in device record
3. **Enhanced Health Check** - Returns more debugging info including IP and frame status
4. **Better Console Output** - Shows local IP and remote access instructions on startup

---

## 🔍 Root Cause Analysis

### Why Your App Can't See the Stream:

Your [dashboard.tsx](dashboard.tsx#L1326) constructs the stream URL as:
```typescript
streamUrl={`http://${device.ipAddress || device.ip_address}:8080/stream.mjpeg`}
```

**The Problem:** The device's `ipAddress` field in Firebase was never being set correctly, so the app had no way to reach your Pi.

**The Fix:** Server now auto-detects and registers its local IP during startup.

---

## 📋 Testing Checklist

### Step 1: Test Updated Server on Raspberry Pi

1. **Stop any existing camera server:**
   ```bash
   pkill -f mjpeg-camera-server
   ```

2. **Start the updated server:**
   ```bash
   node mjpeg-camera-server.js
   ```

3. **Check console output** - You should see:
   ```
   🎥 MJPEG Camera Server
   ━━━━━━━━━━━━━━━━━━━━━━
   Device ID: raspberrypi
   Local IP: 192.168.1.XXX  ← Check this!
   Port: 8080
   Framerate: 15 fps
   JPEG Quality: 80%
   
   ✅ Firebase initialized
   🚀 Starting persistent camera stream...
   
   ✅ MJPEG server listening on http://0.0.0.0:8080
   📹 Local Stream URL: http://192.168.1.XXX:8080/stream.mjpeg
   📹 Single Frame URL: http://192.168.1.XXX:8080/frame.jpg
   💓 Health check: http://192.168.1.XXX:8080/health
   ```

4. **Verify Firebase was updated:**
   ```bash
   # Test health endpoint
   curl http://localhost:8080/health
   ```
   
   Should return JSON with `localIP` field populated.

### Step 2: Test Local Network Access

From another device on the **same network** (laptop, phone):

```bash
# Replace 192.168.1.XXX with your Pi's IP from above
curl http://192.168.1.XXX:8080/health

# Expected output:
{
  "status": "ok",
  "device": "raspberrypi",
  "localIP": "192.168.1.XXX",
  "hasFrames": true,
  ...
}
```

Try accessing in a browser:
- Health: `http://192.168.1.XXX:8080/health`
- Single Frame: `http://192.168.1.XXX:8080/frame.jpg`
- Stream: `http://192.168.1.XXX:8080/stream.mjpeg`

### Step 3: Verify Firebase Device Entry

Check Firebase Realtime Database console:

```
devices/
  └─ raspberrypi/
       ├─ ipAddress: "192.168.1.XXX"     ← Should exist!
       ├─ ip_address: "192.168.1.XXX"    ← Should exist!
       ├─ streaming_enabled: true
       ├─ streaming_url: "http://192.168.1.XXX:8080/stream.mjpeg"
       ├─ streaming_type: "mjpeg"
       └─ streaming_port: 8080
```

**If these fields are missing**, the Firebase Admin credentials may be incorrect.

---

## 🌐 Remote Access Setup (Outside Your Network)

If you want to access the stream **from outside your home network** (e.g., on mobile data):

### Option 1: Port Forwarding (Recommended)

1. **Find your public IP:**
   ```bash
   curl ifconfig.me
   # Example output: 203.0.113.45
   ```

2. **Configure router port forwarding:**
   - Login to your router admin panel (usually 192.168.1.1)
   - Navigate to Port Forwarding / NAT settings
   - Add new rule:
     - **External Port:** 8080
     - **Internal IP:** 192.168.1.XXX (your Pi's local IP)
     - **Internal Port:** 8080
     - **Protocol:** TCP
   - Save and apply

3. **Update Firebase manually** (one-time):
   ```bash
   # On Raspberry Pi
   node -e "
   const admin = require('firebase-admin');
   admin.initializeApp({
     credential: admin.credential.cert(require('./serviceAccountKey.json')),
     databaseURL: 'https://sensor-app-2a69b-default-rtdb.firebaseio.com'
   });
   
   const PUBLIC_IP = '203.0.113.45'; // Replace with your public IP
   const DEVICE_ID = require('os').hostname().toLowerCase().replace(/[^a-z0-9-]/g, '');
   
   admin.database().ref(\`devices/\${DEVICE_ID}\`).update({
     ipAddress: PUBLIC_IP,
     ip_address: PUBLIC_IP
   }).then(() => {
     console.log('✅ Public IP updated in Firebase');
     process.exit(0);
   });
   "
   ```

4. **Test from external network:**
   ```bash
   # From phone on mobile data (not WiFi)
   curl http://203.0.113.45:8080/health
   ```

### Option 2: Dynamic DNS (For Changing IPs)

If your ISP changes your public IP frequently:

1. Sign up for a free DDNS service:
   - [DuckDNS](https://www.duckdns.org/)
   - [No-IP](https://www.noip.com/)

2. Install DDNS client on Pi:
   ```bash
   # Example for DuckDNS
   sudo apt install duckdns
   ```

3. Use your DDNS hostname in Firebase:
   ```javascript
   ipAddress: "yourname.duckdns.org"
   ```

### Option 3: Tailscale VPN (Most Secure)

For secure private access without port forwarding:

1. Install Tailscale on Pi and mobile:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```

2. Get Pi's Tailscale IP (usually 100.x.x.x)
3. Use Tailscale IP in Firebase

---

## 🔍 Troubleshooting Guide

### Problem: App shows "No Camera Connected"

**Causes:**
1. Firebase device entry missing `ipAddress` field
2. IP address is "localhost" or "127.0.0.1"
3. Server not running on Pi

**Solution:**
```bash
# Check Firebase has correct data
curl http://<pi-ip>:8080/health

# Restart server to re-register IP
pkill -f mjpeg-camera-server
node mjpeg-camera-server.js
```

### Problem: Connection timeout / Can't reach server

**Causes:**
1. Firewall blocking port 8080
2. Pi is on different network
3. Port not forwarded (for remote access)

**Solution:**
```bash
# Allow port 8080 through firewall
sudo ufw allow 8080/tcp

# Check if server is listening
sudo netstat -tlnp | grep 8080

# Test from Pi itself
curl http://localhost:8080/health
```

### Problem: Stream loads but shows old/frozen frames

**Causes:**
1. Camera not capturing new frames
2. Network bandwidth too low
3. MJPEG client not refreshing

**Solution:**
```bash
# Check camera process is running
ps aux | grep rpicam-vid

# Check logs for frame capture
# Should see: "📊 Captured X frames" every 5 seconds

# Reduce framerate for slower networks
export MJPEG_PORT=8080
export MJPEG_FPS=10  # Lower FPS
node mjpeg-camera-server.js
```

### Problem: Works on local network but not remotely

**Causes:**
1. Port 8080 not forwarded on router
2. ISP blocking incoming connections
3. Using local IP instead of public IP

**Solution:**
```bash
# Test if port is open from external network
# Use: https://www.yougetsignal.com/tools/open-ports/

# Check current public IP matches what's in Firebase
curl ifconfig.me

# Some ISPs block port 8080 - try different port:
export MJPEG_PORT=8888
# Then forward port 8888 instead
```

### Problem: "Failed to fetch" error in mobile app

**Causes:**
1. HTTP blocked by Android/iOS (requires HTTPS)
2. CORS issue
3. Network permissions in app

**Solution:**
```bash
# Check CORS headers are being sent
curl -I http://<ip>:8080/stream.mjpeg | grep Access-Control

# Should see: Access-Control-Allow-Origin: *
```

For production apps, you may need HTTPS. Consider:
- Using a reverse proxy (nginx) with Let's Encrypt SSL
- Cloudflare Tunnel
- Tailscale (encrypted by default)

---

## 📊 Testing App Connection

After confirming server works, test in your mobile app:

1. **Open dashboard** in your Sensor App
2. **Navigate to Devices tab**
3. **Click Camera button** on your Pi device
4. **Check debug console** in React Native:
   ```javascript
   // Should see in logs:
   [Dashboard] Device IP: 192.168.1.XXX
   [MJPEGPlayer] Stream URL: http://192.168.1.XXX:8080/stream.mjpeg
   ```

If IP is missing or wrong, check Firebase manually.

---

## 🚀 Production Deployment

For 24/7 operation:

1. **Run as systemd service:**
   ```bash
   sudo nano /etc/systemd/system/mjpeg-camera.service
   ```
   
   ```ini
   [Unit]
   Description=MJPEG Camera Server
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/Sensor_app
   Environment="NODE_ENV=production"
   Environment="MJPEG_PORT=8080"
   ExecStart=/usr/bin/node mjpeg-camera-server.js
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable mjpeg-camera.service
   sudo systemctl start mjpeg-camera.service
   sudo systemctl status mjpeg-camera.service
   ```

2. **Check logs:**
   ```bash
   sudo journalctl -u mjpeg-camera -f
   ```

---

## 📝 Quick Reference

### Server Endpoints

| Endpoint | Description | Example |
|----------|-------------|---------|
| `/stream.mjpeg` | MJPEG video stream | `http://IP:8080/stream.mjpeg` |
| `/` | Same as `/stream.mjpeg` | `http://IP:8080/` |
| `/frame.jpg` | Single JPEG frame | `http://IP:8080/frame.jpg` |
| `/health` | Server status JSON | `http://IP:8080/health` |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MJPEG_PORT` | 8080 | HTTP server port |
| `GOOGLE_APPLICATION_CREDENTIALS` | `./serviceAccountKey.json` | Firebase credentials path |
| `FIREBASE_REALTIME_DB` | Auto-detect | Firebase Realtime DB URL |

### Useful Commands

```bash
# Check if server is running
ps aux | grep mjpeg-camera-server

# Kill server
pkill -f mjpeg-camera-server

# Start server with logs
node mjpeg-camera-server.js 2>&1 | tee mjpeg.log

# Test camera separately
rpicam-vid --codec mjpeg --timeout 5000 -o test.mjpeg

# Check network connectivity
ping 8.8.8.8
```

---

## ✅ Success Checklist

Before considering it "fixed":

- [ ] Server starts without errors
- [ ] Console shows correct local IP (not 127.0.0.1)
- [ ] Firebase device entry has `ipAddress` field
- [ ] Health endpoint returns valid JSON with IP
- [ ] Single frame loads in browser: `http://IP:8080/frame.jpg`
- [ ] MJPEG stream loads in browser: `http://IP:8080/stream.mjpeg`
- [ ] Mobile app on same WiFi network shows camera
- [ ] (Optional) Mobile app on cellular data shows camera

---

## 🆘 Still Not Working?

If you've followed all steps and still can't connect:

1. **Check Firebase logs:**
   ```javascript
   // In mjpeg-camera-server.js, look for:
   "Firebase update error:"
   ```

2. **Verify network topology:**
   ```bash
   # Check routes
   ip route
   
   # Check firewall
   sudo iptables -L -n
   ```

3. **Test with different client:**
   ```bash
   # VLC media player
   vlc http://IP:8080/stream.mjpeg
   
   # ffplay
   ffplay http://IP:8080/stream.mjpeg
   ```

4. **Enable verbose logging:**
   ```bash
   # Add to top of mjpeg-camera-server.js
   process.env.DEBUG = '*';
   ```

5. **Share debug info:**
   - Server console output
   - `curl http://IP:8080/health` output
   - Firebase device entry JSON
   - Mobile app console logs

---

## 📚 Related Documentation

- [PI_CAMERA_STREAMING_GUIDE.md](PI_CAMERA_STREAMING_GUIDE.md) - Original streaming setup
- [CAMERA_INTEGRATION_GUIDE.md](CAMERA_INTEGRATION_GUIDE.md) - App integration details
- [REMOTE_WEBRTC_INTEGRATION.md](REMOTE_WEBRTC_INTEGRATION.md) - WebRTC alternative

---

**Last Updated:** 2026-01-28
**Server Version:** mjpeg-camera-server.js (with auto IP detection)
