# ⚡ Cloudflare Tunnel for Camera - Quick Start (5 minutes)

## TL;DR - Three Steps

### Step 1️⃣: Copy & paste this on your Raspberry Pi
```bash
sudo bash -c 'cd /tmp && curl -sSL https://raw.githubusercontent.com/cloudflare/cloudflared/master/scripts/install.sh | bash'
```

Or download the binary manually:
```bash
cd ~
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
sudo chmod +x cloudflared-linux-arm64
sudo mv cloudflared-linux-arm64 /usr/local/bin/cloudflared
cloudflared --version
```

### Step 2️⃣: Login & Create Tunnel
```bash
# This opens your browser - select domain and authorize
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create camera-stream

# Get your tunnel ID from output (something like: 12345678-1234-1234-1234-123456789abc)
```

### Step 3️⃣: Save Config & Run

Create `/root/.cloudflared/config.yml`:
```yaml
tunnel: camera-stream
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: camera.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

Start tunnel:
```bash
cloudflared tunnel run camera-stream
```

---

## Setup as Background Service (1 minute)

```bash
# Create systemd service
sudo tee /etc/systemd/system/cloudflared.service > /dev/null << 'EOF'
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel run
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

# Enable & start
sudo systemctl daemon-reload
sudo systemctl enable cloudflared.service
sudo systemctl start cloudflared.service

# Check it's running
sudo systemctl status cloudflared.service
```

---

## Configure Domain in Cloudflare (1 minute)

1. Go to **Cloudflare Dashboard** → Your Domain → **DNS**
2. Add **CNAME** record:
   - **Name**: camera
   - **Content**: camera-stream.cfargotunnel.com
   - **Proxied**: Yes (orange cloud)

Wait 1-2 minutes for DNS to propagate.

---

## Test It Works

```bash
# From your Raspberry Pi
curl -I https://camera.yourdomain.com

# Should return 200, not 502
```

In your browser:
```
https://camera.yourdomain.com
```

---

## What You Get ✅

| Feature | Benefit |
|---------|---------|
| **No Port Forwarding** | Don't expose your router - tunnel handles it |
| **HTTPS** | Automatic SSL encryption |
| **Auto-update** | cloudflared updates itself |
| **"Always on"** | Systemd keeps it running 24/7 |
| **Free Tier** | Unlimited tunnels on free Cloudflare plan |
| **Easy DNS** | Single CNAME record, no A records needed |

---

## Common Commands

```bash
# View tunnel
cloudflared tunnel list
cloudflared tunnel info camera-stream

# View logs
sudo journalctl -u cloudflared.service -f

# Stop service
sudo systemctl stop cloudflared.service

# Restart service
sudo systemctl restart cloudflared.service

# Manually run (debugging)
sudo /usr/local/bin/cloudflared tunnel run camera-stream
```

---

## Troubleshooting

**Getting "502 Bad Gateway"?**
```bash
# Make sure camera server is running
curl http://localhost:3000

# Restart tunnel
sudo systemctl restart cloudflared.service

# Check logs
sudo journalctl -u cloudflared.service -n 20
```

**DNS not working?**
```bash
# Check it resolves
nslookup camera.yourdomain.com

# Should show CNAME to cfargotunnel.com
dig camera.yourdomain.com
```

**Need more help?**
- Full guide: [CLOUDFLARE_TUNNEL_SETUP.md](CLOUDFLARE_TUNNEL_SETUP.md)
- Troubleshooting: [CLOUDFLARE_TUNNEL_TROUBLESHOOTING.md](CLOUDFLARE_TUNNEL_TROUBLESHOOTING.md)

---

## Next: Integrate with Mobile App

Once your camera is at `https://camera.yourdomain.com`, update your mobile app:

```javascript
// In app config
const CAMERA_URL = "https://camera.yourdomain.com";

// Use in React component
<img src={`${CAMERA_URL}/snapshot`} />
```

Or for MJPEG streams:
```html
<img src="https://camera.yourdomain.com/stream" />
```

---

## 🎉 Done!

You now have secure remote access to your camera without touching your router settings!

Next time you want to access:
1. Open browser
2. Go to `https://camera.yourdomain.com`
3. See your live camera

That's it! 🚀
