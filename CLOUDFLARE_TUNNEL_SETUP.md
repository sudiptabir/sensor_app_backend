# 🔐 Cloudflare Tunnel Setup for Camera Streaming

## Overview
Cloudflare Tunnel securely exposes your Raspberry Pi camera server to the internet **without opening ports** on your router.

```
Internet → Cloudflare Edge → Secure Tunnel → Raspberry Pi (Camera Server port 3000)
```

---

## Step 1: Prerequisites

### Install Cloudflared CLI on Raspberry Pi
```bash
# Download the latest cloudflared binary
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64

# Make it executable
chmod +x cloudflared-linux-arm64

# Move to bin directory
sudo mv cloudflared-linux-arm64 /usr/local/bin/cloudflared

# Verify installation
cloudflared --version
```

---

## Step 2: Login to Cloudflare (One-time Setup)

```bash
# Authenticate with Cloudflare
cloudflared tunnel login

# This will:
# 1. Open a browser window
# 2. Ask you to log into Cloudflare
# 3. Select your domain
# 4. Generate credentials (~/.cloudflared/cert.pem)
```

**Output:** You'll see a path like `/root/.cloudflared/...`

---

## Step 3: Create Tunnel

```bash
# Create a named tunnel called "camera-stream"
cloudflared tunnel create camera-stream

# Output will show:
# Tunnel ID: <uuid>
# Tunnel credentials saved to: ~/.cloudflared/<uuid>.json
```

---

## Step 4: Create Configuration File

Create `/root/.cloudflared/config.yml` on your Raspberry Pi:

```yaml
tunnel: camera-stream
credentials-file: /root/.cloudflared/<YOUR_TUNNEL_ID>.json

# Configure ingress rules (routes for different services)
ingress:
  # Camera streaming on HTTPS
  - hostname: camera.yourdomain.com
    service: http://localhost:3000
    
  # Alternative: Different subdomains for different services
  # - hostname: stream.yourdomain.com
  #   service: http://localhost:3000
  
  # Catch-all rule for health check
  - service: http_status:404
```

**Replace** `yourdomain.com` with your actual Cloudflare domain.

---

## Step 5: Route Domain to Tunnel

Add a DNS record in Cloudflare dashboard:

1. Go to **Cloudflare Dashboard** → Your Domain
2. **DNS** tab → **Add record**
3. Create CNAME record:
   ```
   Type:    CNAME
   Name:    camera
   Content: camera-stream.cfargotunnel.com
   Proxy:   Proxied (orange cloud)
   TTL:     Auto
   ```

---

## Step 6: Run Tunnel (Locally for Testing)

```bash
# Test the tunnel configuration
cloudflared tunnel run camera-stream

# You should see:
# INF |Your tunnel is running! ...
# INF |Route your domain to this tunnel with a CNAME value of: camera-stream.cfargotunnel.com
```

**Test in browser:**
```
https://camera.yourdomain.com
```

---

## Step 7: Run Tunnel as Background Service

### Option A: Systemd Service (Recommended)

Create `/etc/systemd/system/cloudflared-camera.service`:

```ini
[Unit]
Description=Cloudflare Tunnel for Camera Streaming
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/usr/local/bin/cloudflared tunnel run camera-stream
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudflared-camera.service
sudo systemctl start cloudflared-camera.service

# Check status
sudo systemctl status cloudflared-camera.service

# View logs
journalctl -u cloudflared-camera.service -f
```

### Option B: Supervisor Service

Create `/etc/supervisor/conf.d/cloudflared-camera.conf`:

```ini
[program:cloudflared-camera]
command=/usr/local/bin/cloudflared tunnel run camera-stream
directory=/root
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/cloudflared-camera.log
```

Enable:
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start cloudflared-camera
```

---

## Step 8: Test & Verify

### Check Tunnel Status
```bash
# List active tunnels
cloudflared tunnel list

# Check specific tunnel
cloudflared tunnel info camera-stream
```

### Test Access Points

1. **From outside your network:**
   ```
   https://camera.yourdomain.com
   ```

2. **MJPEG stream (if available):**
   ```
   https://camera.yourdomain.com/stream
   ```

3. **Health check:**
   ```
   curl -I https://camera.yourdomain.com
   ```

---

## Step 9: Advanced Configuration

### Multiple Services Through Same Tunnel

Edit `/root/.cloudflared/config.yml`:

```yaml
tunnel: camera-stream
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  # Camera streaming
  - hostname: camera.yourdomain.com
    service: http://localhost:3000
    
  # Sensor API
  - hostname: api.yourdomain.com
    service: http://localhost:8000
    
  # Admin dashboard
  - hostname: admin.yourdomain.com
    service: http://localhost:3001
    
  # Catch-all
  - service: http_status:404
```

---

## Step 10: Security Settings

In Cloudflare Dashboard → SSL/TLS Settings:

- **SSL/TLS Encryption Mode:** Full (Strict) - encrypts server to edge
- **Minimum TLS Version:** 1.2
- **HSTS:** Enable (optional, adds extra header security)

### Add IP Whitelist (Optional)

In Cloudflare Dashboard → WAF (Web Application Firewall):

Create rule:
```
(cf.country_code ne "US") AND (cf.country_code ne "IN")
```
Action: Block (if restricting geographical access)

---

## Troubleshooting

### Tunnel Not Connecting
```bash
# Check tunnel status
cloudflared tunnel info camera-stream

# Restart service
sudo systemctl restart cloudflared-camera.service

# View real-time logs
journalctl -u cloudflared-camera.service -f
```

### Connection to Camera Server Failing
```bash
# Test local camera server
curl http://localhost:3000

# Check if service is running
ps aux | grep camera-server

# Check firewall rules
sudo iptables -L | grep 3000
```

### DNS Not Resolving
```bash
# Test DNS
nslookup camera.yourdomain.com

# Check Cloudflare DNS
dig camera.yourdomain.com +short
```

---

## Monitoring & Logs

### View Tunnel Logs
```bash
# Recent 50 lines
journalctl -u cloudflared-camera.service -n 50

# Follow live
journalctl -u cloudflared-camera.service -f

# With timestamps
journalctl -u cloudflared-camera.service --no-pager | tail -20
```

### Check Tunnel Statistics
```bash
cloudflared tunnel info camera-stream
```

### Cloudflare Dashboard Analytics
1. Go to **Analytics** → **Network Analytics**
2. View tunnel traffic, errors, performance

---

## Authentication (Optional - Extra Security)

Add authentication to your tunnel via Cloudflare Dashboard:

1. **Cloudflare Dashboard** → Domain → **Access**
2. **Create Application**
3. Subdomain: `camera`
4. Application type: `Self-hosted`
5. Add authentication policy (Google login, GitHub, etc.)

---

## Backup & Recovery

### Backup Tunnel Credentials
```bash
# Backup all cloudflared config
tar -czf ~/cloudflared-backup.tar.gz ~/.cloudflared/

# Restore on another machine
tar -xzf ~/cloudflared-backup.tar.gz -C ~/
```

### Delete Tunnel (if needed)
```bash
# Stop service first
sudo systemctl stop cloudflared-camera.service

# Delete tunnel
cloudflared tunnel delete camera-stream
```

---

## Performance Tips

1. **Enable Compression** in Cloudflare Dashboard
2. **Enable Caching** for static assets
3. **Set reasonable TTLs** (3600 seconds = 1 hour)
4. **Monitor bandwidth** in Analytics tab

---

## Next Steps

After tunnel is running:

1. ✅ Access camera at: `https://camera.yourdomain.com`
2. ✅ Integrate with mobile app
3. ✅ Add SSL certificate (auto-managed by Cloudflare)
4. ✅ Monitor tunnel health in dashboard
5. ✅ Set up alerts for tunnel disconnections
