# 🔧 Cloudflare Tunnel Troubleshooting Guide

## Quick Verification

### 1. Is cloudflared installed?
```bash
cloudflared --version
```

### 2. Is the tunnel running?
```bash
sudo systemctl status cloudflared-tunnel.service
```

### 3. Check logs
```bash
# Last 20 lines
sudo journalctl -u cloudflared-tunnel.service -n 20

# Follow live
sudo journalctl -u cloudflared-tunnel.service -f

# With priority
sudo journalctl -u cloudflared-tunnel.service -p err
```

---

## Common Issues & Solutions

### ❌ "Tunnel not found" or "Invalid tunnel"

**Problem:** Configuration can't find tunnel

**Solution:**
```bash
# Verify tunnel exists
cloudflared tunnel list

# Check credentials file
ls -la /root/.cloudflared/

# Verify config file points to correct tunnel
cat /root/.cloudflared/config.yml | grep tunnel

# Recreate tunnel if needed
cloudflared tunnel create camera-stream
cloudflared tunnel route dns camera-stream camera.yourdomain.com
```

---

### ❌ "Cannot connect to origin service"

**Problem:** Tunnel can't reach local camera server

**Solution:**
```bash
# Test if camera server is running
curl -I http://localhost:3000

# Check if port 3000 is listening
netstat -tlnp | grep :3000

# Start camera server if not running
node camera-server.js

# Check firewall
sudo ufw status
sudo ufw allow 3000  # If needed
```

---

### ❌ "Connection reset by peer"

**Problem:** Network connectivity issue between tunnel and origin

**Solution:**
```bash
# Test network connectivity
ping 8.8.8.8

# Check DNS resolution
nslookup localhost
dig localhost

# Restart tunnel service
sudo systemctl restart cloudflared-tunnel.service

# Check if other services on port 3000
sudo lsof -i :3000
```

---

### ❌ "TLS: unknown certificate authority"

**Problem:** SSL certificate verification failure

**Solution:**
```bash
# Update certificates
sudo update-ca-certificates

# Bypass for testing (NOT for production)
# Add to config.yml under that hostname:
originRequest:
  noTLSVerify: true
```

---

### ❌ Domain returns "502 Bad Gateway"

**Problem:** DNS routed but service unreachable

**Solution:**

1. **Check DNS routing:**
   ```bash
   # Should return tunnel address
   nslookup camera.yourdomain.com
   
   # Should show CNAME
   dig camera.yourdomain.com +full
   ```

2. **Verify tunnel is actually running:**
   ```bash
   cloudflared tunnel info camera-stream
   ```

3. **Test local connection:**
   ```bash
   curl http://localhost:3000/health
   ```

4. **Check config file:**
   ```bash
   cat /root/.cloudflared/config.yml
   # Verify 'service: http://localhost:3000' is correct
   ```

5. **Restart everything:**
   ```bash
   # Restart camera server
   sudo systemctl restart camera-server  # or however you run it
   
   # Restart tunnel
   sudo systemctl restart cloudflared-tunnel.service
   
   # Wait 30 seconds and test
   sleep 30
   curl https://camera.yourdomain.com
   ```

---

### ❌ "dial tcp: lookup <hostname>: no such host"

**Problem:** DNS resolution failing in config

**Solution:**
```bash
# Change localhost to 127.0.0.1 in config.yml
# Edit service: http://127.0.0.1:3000

# Or use the hostname if binding to all interfaces
# service: http://0.0.0.0:3000

sudo systemctl restart cloudflared-tunnel.service
```

---

### ❌ Tunnel stops randomly / keeps disconnecting

**Problem:** Service crashes or loses connection

**Solution:**

1. **Check logs for errors:**
   ```bash
   sudo journalctl -u cloudflared-tunnel.service -n 50 | grep -i error
   ```

2. **Increase restart wait:**
   ```bash
   # Edit service file
   sudo nano /etc/systemd/system/cloudflared-tunnel.service
   
   # Change RestartSec to longer delay
   RestartSec=60  # Instead of 30
   
   # Reload
   sudo systemctl daemon-reload
   sudo systemctl restart cloudflared-tunnel.service
   ```

3. **Check system resources:**
   ```bash
   free -h           # Memory usage
   df -h             # Disk space
   top -b -n 1 | head -n 20  # CPU usage
   ```

4. **Increase memory limit:**
   ```bash
   # Edit service file
   sudo nano /etc/systemd/system/cloudflared-tunnel.service
   
   # Increase limits
   MemoryMax=1G
   
   sudo systemctl daemon-reload
   ```

---

### ❌ Service fails to start (systemd)

**Problem:** systemctl start returns error

**Solution:**

1. **Check service syntax:**
   ```bash
   sudo systemd-analyze verify /etc/systemd/system/cloudflared-tunnel.service
   ```

2. **View error messages:**
   ```bash
   sudo systemctl start cloudflared-tunnel.service
   sudo journalctl -xe  # Shows last error
   ```

3. **Test service command manually:**
   ```bash
   sudo /usr/local/bin/cloudflared tunnel run
   # Should show tunnel details if working
   ```

4. **Reload and try again:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start cloudflared-tunnel.service
   ```

---

## Performance Issues

### 🐢 Slow streaming

**Solutions:**
1. **Check bandwidth:**
   ```bash
   # Monitor tunnel traffic
   cloudflared tunnel info camera-stream
   ```

2. **Enable compression in Cloudflare Dashboard:**
   - Speed → Optimization → Auto Minify
   - Caching → Browser Cache TTL

3. **Reduce camera quality:**
   ```bash
   # Edit camera-server.js
   '--quality', '60'  # Lower than 80
   '--width', '480'   # Smaller resolution
   ```

4. **Check Pi resources:**
   ```bash
   htop
   ```

---

### 🔌 Frequent disconnections

**Solutions:**
1. **Enable persistent connections:**
   ```yaml
   # In config.yml
   originRequest:
     connectTimeout: 30s
     tlsTimeout: 30s
     tcpKeepAlive: 30s
   ```

2. **Check network:**
   ```bash
   ping -c 5 8.8.8.8
   mtr 8.8.8.8 -c 5
   ```

3. **Update cloudflared:**
   ```bash
   # Auto-updates are enabled, but force:
   cloudflared update
   sudo systemctl restart cloudflared-tunnel.service
   ```

---

## Verification Checklist

- [ ] `cloudflared --version` shows version
- [ ] `cloudflared tunnel list` shows tunnel
- [ ] `/root/.cloudflared/config.yml` exists
- [ ] `/root/.cloudflared/*.json` exists (credentials)
- [ ] `curl http://localhost:3000` returns response
- [ ] `sudo systemctl status cloudflared-tunnel.service` shows active
- [ ] `nslookup camera.yourdomain.com` resolves
- [ ] `https://camera.yourdomain.com` loads in browser
- [ ] Logs show no errors: `sudo journalctl -u cloudflared-tunnel.service`

---

## Debug Mode

Run tunnel with debug logging:

```bash
# Stop service
sudo systemctl stop cloudflared-tunnel.service

# Run in foreground with debug
sudo /usr/local/bin/cloudflared tunnel run --loglevel debug

# Logs will show detailed info
# Press Ctrl+C to stop
```

---

## Restore from Backup

If you backed up credentials:

```bash
# Restore backup
tar -xzf ~/cloudflared-backup.tar.gz -C ~/

# Recreate service
sudo systemctl restart cloudflared-tunnel.service

# Verify
sudo journalctl -u cloudflared-tunnel.service
```

---

## Still Having Issues?

1. **Collect diagnostic info:**
   ```bash
   echo "=== System Info ===" && uname -a
   echo "=== Cloudflared Version ===" && cloudflared --version
   echo "=== Tunnel Status ===" && cloudflared tunnel list
   echo "=== Service Status ===" && sudo systemctl status cloudflared-tunnel.service
   echo "=== Recent Logs ===" && sudo journalctl -u cloudflared-tunnel.service -n 30
   echo "=== Network Test ===" && curl -I http://localhost:3000
   ```

2. **Check Cloudflare Dashboard:**
   - Analytics → Network Analytics (check for errors)
   - DNS → Verify CNAME record
   - Cache Rules → Check if anything is blocking

3. **Contact support:**
   - Cloudflare: https://support.cloudflare.com/
   - Include logs from: `sudo journalctl -u cloudflared-tunnel.service`
   - Include output from diagnostic commands above
