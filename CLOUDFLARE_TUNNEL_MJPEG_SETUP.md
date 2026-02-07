# 🎥 Cloudflare Tunnel for MJPEG Camera Server

## Quick Setup

Your MJPEG camera server runs on **port 8080** with endpoints:
- `/stream.mjpeg` - MJPEG stream
- `/` - Default stream

### Step 1: Install cloudflared on Raspberry Pi

```bash
# Download binary
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
sudo chmod +x cloudflared-linux-arm64
sudo mv cloudflared-linux-arm64 /usr/local/bin/cloudflared

# Verify
cloudflared --version
```

### Step 2: Login to Cloudflare

```bash
cloudflared tunnel login
# Browser opens - authorize and select your domain
```

### Step 3: Create Tunnel

```bash
cloudflared tunnel create camera-mjpeg
```

### Step 4: Create Config File

Create `/root/.cloudflared/config.yml`:

```yaml
tunnel: camera-mjpeg
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # MJPEG stream endpoint
  - hostname: camera.yourdomain.com
    service: http://localhost:8080
    originRequest:
      connectTimeout: 60s
      tlsTimeout: 60s
      httpHostHeader: localhost:8080
      # IMPORTANT: MJPEG needs chunked encoding
      disableChunkedEncoding: false
  
  # Catch-all
  - service: http_status:404
```

### Step 5: Run Tunnel

```bash
# Test first
cloudflared tunnel run camera-mjpeg

# Should show: Your tunnel is running!
```

### Step 6: Setup as Service

```bash
sudo tee /etc/systemd/system/cloudflared-mjpeg.service > /dev/null << 'EOF'
[Unit]
Description=Cloudflare Tunnel for MJPEG Camera
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel run camera-mjpeg
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable cloudflared-mjpeg.service
sudo systemctl start cloudflared-mjpeg.service

sudo systemctl status cloudflared-mjpeg.service
```

### Step 7: Configure Domain in Cloudflare

1. **Cloudflare Dashboard** → Your Domain → **DNS**
2. Add CNAME:
   ```
   Name: camera
   Content: camera-mjpeg.cfargotunnel.com
   Proxied: Yes (orange cloud)
   ```

### Step 8: Test

```bash
# From Pi
curl -I https://camera.yourdomain.com

# In browser
https://camera.yourdomain.com
# or
https://camera.yourdomain.com/stream.mjpeg
```

---

## MJPEG-Specific Configuration

MJPEG streams are special - they use **chunked transfer encoding**. Here's the optimal config:

```yaml
tunnel: camera-mjpeg
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: camera.yourdomain.com
    service: http://localhost:8080
    originRequest:
      # MJPEG settings
      connectTimeout: 60s      # Long connection for streaming
      tlsTimeout: 60s
      tcpKeepAlive: 30s        # Keep connection alive
      disableChunkedEncoding: false  # MJPEG uses chunked encoding
      httpHostHeader: localhost:8080
      
      # Optional: Add headers for compatibility
      customHeaders:
        add:
          X-Forwarded-Proto: https
          X-Real-IP: cf-connecting-ip
      
      # Connection pooling for better performance
      dialDualStack: auto
  
  - service: http_status:404
```

---

## Testing MJPEG Stream

### From command line
```bash
# Stream to file
curl https://camera.yourdomain.com/stream.mjpeg -o stream.mjpeg

# Play with ffplay
ffplay https://camera.yourdomain.com/stream.mjpeg
```

### From browser (simple)
```html
<img src="https://camera.yourdomain.com/stream.mjpeg" />
```

### From React/Vue (with error handling)
```jsx
<img 
  src="https://camera.yourdomain.com/stream.mjpeg" 
  alt="Camera Stream"
  onError={() => console.error('Stream failed')}
  style={{ maxWidth: '100%' }}
/>
```

### Using OpenCV (Python)
```python
import cv2

# Via Cloudflare tunnel
cap = cv2.VideoCapture('https://camera.yourdomain.com/stream.mjpeg')
ret, frame = cap.read()

if ret:
    cv2.imshow('MJPEG Stream', frame)
else:
    print('Failed to get frame')
```

---

## Troubleshooting MJPEG

### ❌ Stream freezes / disconnects frequently

**Solution 1: Increase TCP keepalive**
```yaml
originRequest:
  tcpKeepAlive: 10s   # More frequent keepalives
```

**Solution 2: Enable connection persistence**
```yaml
originRequest:
  httpVersion: "2"    # Use HTTP/2 if supported
```

**Solution 3: Check framerate**
```bash
# Reduce MJPEG_PORT or framerate to lower bandwidth
export FRAMERATE=10  # Slower framerate
node mjpeg-camera-server.js
```

### ❌ "Stream ended unexpectedly" in browser

**Solution:**
```bash
# Restart tunnel service
sudo systemctl restart cloudflared-mjpeg.service

# Check if camera process is running
ps aux | grep rpicam-vid

# Restart camera server
sudo systemctl restart mjpeg-camera  # or however you run it
```

### ❌ High latency / slow stream

**Solution 1: Enable compression**
- Cloudflare Dashboard → Speed → Optimization → Auto Minify (uncheck JPEG)

**Solution 2: Reduce resolution in camera-server**
```javascript
// In mjpeg-camera-server.js
// Reduce quality
const QUALITY = 60;  // Was 80

// Or reduce framerate
const FRAMERATE = 10;  // Was 15
```

**Solution 3: Cache optimization**
```yaml
# In Cloudflare Dashboard → Caching Rules
# Add rule: Bypass cache for /stream.mjpeg
```

### ❌ "Connection reset" errors

**Cause:** Tunnel connection dropping

**Solution:**
```yaml
originRequest:
  connectTimeout: 120s  # Longer timeout
  tlsTimeout: 120s
  dialDualStack: auto   # Try IPv4 and IPv6
```

---

## Monitoring & Logs

### View stream stats
```bash
# Check tunnel
cloudflared tunnel info camera-mjpeg

# View logs
sudo journalctl -u cloudflared-mjpeg.service -f

# With errors only
sudo journalctl -u cloudflared-mjpeg.service -p err
```

### Monitor bandwidth usage
```bash
# In Cloudflare Dashboard → Analytics → Network Analytics
# Filter by camera.yourdomain.com

# Or via command line
watch -n 1 'cloudflared tunnel info camera-mjpeg | grep -i bandwidth'
```

---

## Performance Optimization

### 1. Reduce Camera Load

```bash
# Lower quality
QUALITY=40 FRAMERATE=5 node mjpeg-camera.js

# Or in systemd service
Environment="MJPEG_PORT=8080"
Environment="FRAMERATE=10"
Environment="QUALITY=60"
```

### 2. Enable Cloudflare Caching (for snapshots)

Create `/root/.cloudflared/config.yml`:
```yaml
ingress:
  # Snapshot endpoint with caching
  - hostname: camera.yourdomain.com
    path: /snapshot
    service: http://localhost:8080
    originRequest:
      cacheMaxAge: 5s  # Cache 5 seconds
  
  # Live stream (no cache)
  - hostname: camera.yourdomain.com
    service: http://localhost:8080
```

### 3. Use HTTP/2
```yaml
originRequest:
  httpVersion: "2"
```

---

## Multiple Camera Streams

If you want to stream multiple cameras:

```yaml
tunnel: camera-mjpeg
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Camera 1
  - hostname: camera1.yourdomain.com
    service: http://localhost:8080
    originRequest:
      disableChunkedEncoding: false
      connectTimeout: 60s
  
  # Camera 2
  - hostname: camera2.yourdomain.com
    service: http://localhost:8081
    originRequest:
      disableChunkedEncoding: false
      connectTimeout: 60s
  
  # Catch-all
  - service: http_status:404
```

---

## Security: Add Authentication (Optional)

To protect your camera stream:

1. **Cloudflare Access (recommended)**
   - Dashboard → Access → Create Application
   - Add authentication (Google login, GitHub, etc.)

2. **Or use basic auth proxy**
   ```bash
   # Install nginx
   sudo apt-get install nginx
   
   # Create auth file
   sudo htpasswd -c /etc/nginx/.htpasswd camera
   
   # Configure reverse proxy with auth
   ```

---

## Running Both Camera Server & Tunnel

### Option 1: Systemd Services (Recommended)

**Camera service** (`/etc/systemd/system/mjpeg-camera.service`):
```ini
[Unit]
Description=MJPEG Camera Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/sensor_app
ExecStart=/usr/bin/node mjpeg-camera-server.js
Environment="MJPEG_PORT=8080"
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
```

**Tunnel service** (already created above)

**Start both:**
```bash
sudo systemctl start mjpeg-camera.service
sudo systemctl start cloudflared-mjpeg.service

# Enable on boot
sudo systemctl enable mjpeg-camera.service
sudo systemctl enable cloudflared-mjpeg.service

# Check both running
sudo systemctl status mjpeg-camera.service
sudo systemctl status cloudflared-mjpeg.service
```

### Option 2: Single Screen Session (for testing)
```bash
# Screen 1 - Camera
export MJPEG_PORT=8080
node mjpeg-camera-server.js

# Screen 2 - Tunnel
cloudflared tunnel run camera-mjpeg
```

---

## Checklist

- [ ] cloudflared installed: `cloudflared --version`
- [ ] Tunnel created: `cloudflared tunnel list`
- [ ] Config file at `/root/.cloudflared/config.yml`
- [ ] Camera server running on port 8080
- [ ] Service started: `sudo systemctl status cloudflared-mjpeg.service`
- [ ] DNS CNAME record created in Cloudflare
- [ ] Can access locally: `curl http://localhost:8080`
- [ ] Can access remotely: `https://camera.yourdomain.com`

---

## Next: Integrate with Mobile App

Once tunnel is working, update your app to use:

```javascript
const CAMERA_URL = "https://camera.yourdomain.com";

// MJPEG stream
const streamUrl = `${CAMERA_URL}/stream.mjpeg`;

// In React Native
<Image
  source={{ uri: streamUrl }}
  style={{ width: 400, height: 300 }}
/>

// Or for continuous update
const updateStream = () => {
  fetch(`${streamUrl}`)
    .then(res => res.blob())
    .then(blob => {
      setFrameUrl(URL.createObjectURL(blob));
      setTimeout(updateStream, 100);  // Update every 100ms
    });
};
```

Done! Your MJPEG camera is now securely accessible worldwide! 🎥🌍
