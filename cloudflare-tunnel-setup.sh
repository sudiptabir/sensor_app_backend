#!/bin/bash

# 🔐 Cloudflare Tunnel Installation Script for Raspberry Pi
# Automates cloudflared setup and systemd service creation

set -e

echo "╔════════════════════════════════════════════╗"
echo "║  Cloudflare Tunnel Setup for Camera Stream ║"
echo "╚════════════════════════════════════════════╝"

# Check if running as root
if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then 
  echo "❌ This script requires root access. Run with: sudo bash cloudflare-tunnel-setup.sh"
  exit 1
fi

# Determine architecture
ARCH=$(uname -m)
echo "📱 Detected architecture: $ARCH"

case "$ARCH" in
  aarch64) 
    CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
    ;;
  armv7l)
    CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm"
    ;;
  x86_64)
    CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    ;;
  *)
    echo "❌ Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

# Step 1: Download and install cloudflared
echo ""
echo "📥 Step 1: Installing cloudflared..."

TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo "   Downloading from: $CLOUDFLARED_URL"
if wget -q "$CLOUDFLARED_URL" -O cloudflared; then
  chmod +x cloudflared
  sudo mv cloudflared /usr/local/bin/cloudflared
  echo "   ✅ cloudflared installed successfully"
else
  echo "   ❌ Failed to download cloudflared"
  exit 1
fi

# Verify installation
INSTALLED_VERSION=$(/usr/local/bin/cloudflared --version 2>/dev/null | head -1)
echo "   Version: $INSTALLED_VERSION"

cd - > /dev/null
rm -rf "$TEMP_DIR"

# Step 2: Create cloudflared directory
echo ""
echo "📁 Step 2: Creating configuration directory..."
sudo mkdir -p /root/.cloudflared
sudo chmod 700 /root/.cloudflared
echo "   ✅ Created /root/.cloudflared"

# Step 3: Login to Cloudflare
echo ""
echo "🔑 Step 3: Authenticate with Cloudflare..."
echo ""
echo "   A browser window will open for authentication."
echo "   Follow the steps in your browser:"
echo "   1. Log into your Cloudflare account"
echo "   2. Select the domain you want to use"
echo "   3. Copy the credentials that appear"
echo ""

sudo /usr/local/bin/cloudflared tunnel login

# Verify credentials file was created
CREDS_FILE=$(ls /root/.cloudflared/*.json 2>/dev/null | head -1)
if [ -n "$CREDS_FILE" ]; then
  TUNNEL_ID=$(basename "$CREDS_FILE" .json)
  echo "   ✅ Credentials saved: $CREDS_FILE"
else
  echo "   ⚠️  No credentials file found. Did authentication complete?"
  exit 1
fi

# Step 4: Get user input for tunnel and domain
echo ""
echo "🌐 Step 4: Tunnel Configuration..."
read -p "   Enter tunnel name (default: camera-stream): " TUNNEL_NAME
TUNNEL_NAME=${TUNNEL_NAME:-camera-stream}

read -p "   Enter your domain (e.g., example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
  echo "   ❌ Domain is required"
  exit 1
fi

read -p "   Enter subdomain for camera (default: camera): " SUBDOMAIN
SUBDOMAIN=${SUBDOMAIN:-camera}

echo "   Tunnel: $TUNNEL_NAME"
echo "   Full URL will be: https://$SUBDOMAIN.$DOMAIN"

# Step 5: Create tunnel
echo ""
echo "🔗 Step 5: Creating tunnel '$TUNNEL_NAME'..."

TUNNEL_OUTPUT=$(sudo /usr/local/bin/cloudflared tunnel create "$TUNNEL_NAME" 2>&1 || true)

if echo "$TUNNEL_OUTPUT" | grep -q "Tunnel created"; then
  echo "   ✅ Tunnel created: $TUNNEL_NAME"
  TUNNEL_UUID=$(echo "$TUNNEL_OUTPUT" | grep "Tunnel ID:" | awk '{print $NF}')
else
  # Check if tunnel already exists
  TUNNEL_UUID=$TUNNEL_ID
  echo "   ℹ️  Using existing tunnel: $TUNNEL_NAME"
fi

echo "   Tunnel UUID: $TUNNEL_UUID"

# Step 6: Create config file
echo ""
echo "📝 Step 6: Creating configuration file..."

CONFIG_FILE="/root/.cloudflared/config.yml"

cat > /tmp/config.yml << EOF
tunnel: $TUNNEL_NAME
credentials-file: /root/.cloudflared/$TUNNEL_UUID.json

# Ingress rules for routing traffic
ingress:
  # Camera streaming service
  - hostname: $SUBDOMAIN.$DOMAIN
    service: http://localhost:3000
    
  # IP origins (optional - uncomment to restrict)
  # - hostname: $SUBDOMAIN.$DOMAIN
  #   service: http://localhost:3000
  #   originRequest:
  #     ipRules:
  #       - prefix: 192.168.1.0/24
  #         allow: true
  #       - prefix: 0.0.0.0/0
  #         allow: false
  
  # Health check path
  - service: http_status:404
EOF

sudo mv /tmp/config.yml "$CONFIG_FILE"
sudo chmod 600 "$CONFIG_FILE"
echo "   ✅ Configuration file created: $CONFIG_FILE"

# Step 7: Create systemd service
echo ""
echo "⚙️  Step 7: Creating systemd service..."

SERVICE_FILE="/etc/systemd/system/cloudflared-tunnel.service"

cat > /tmp/cloudflared-tunnel.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel for Camera Streaming
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/usr/local/bin/cloudflared tunnel run
Restart=on-failure
RestartSec=30
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloudflared-tunnel

# Resource limits
MemoryHighWaterMark=256M
MemoryMax=512M

# Security
NoNewPrivileges=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
EOF

sudo mv /tmp/cloudflared-tunnel.service "$SERVICE_FILE"
sudo chmod 644 "$SERVICE_FILE"
echo "   ✅ Systemd service file created: $SERVICE_FILE"

# Step 8: Enable and start service
echo ""
echo "🚀 Step 8: Starting Cloudflare Tunnel service..."

sudo systemctl daemon-reload
sudo systemctl enable cloudflared-tunnel.service
sudo systemctl start cloudflared-tunnel.service

# Wait a moment for service to start
sleep 3

# Check service status
if sudo systemctl is-active --quiet cloudflared-tunnel.service; then
  echo "   ✅ Service started successfully!"
else
  echo "   ⚠️  Service may not have started. Checking logs..."
  sudo journalctl -u cloudflared-tunnel.service -n 10
fi

# Step 9: Summary and next steps
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║         ✅ Setup Complete!                 ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "📊 Configuration Summary:"
echo "   Tunnel Name:    $TUNNEL_NAME"
echo "   Tunnel ID:      $TUNNEL_UUID"
echo "   Domain:         $DOMAIN"
echo "   Subdomain:      $SUBDOMAIN"
echo "   Camera URL:     https://$SUBDOMAIN.$DOMAIN"
echo ""
echo "📝 Configuration File:"
echo "   $CONFIG_FILE"
echo ""
echo "🔧 Service Management:"
echo "   Start:   sudo systemctl start cloudflared-tunnel.service"
echo "   Stop:    sudo systemctl stop cloudflared-tunnel.service"
echo "   Status:  sudo systemctl status cloudflared-tunnel.service"
echo "   Logs:    sudo journalctl -u cloudflared-tunnel.service -f"
echo ""
echo "📋 Next Steps:"
echo "   1. Create DNS record in Cloudflare:"
echo "      - Type: CNAME"
echo "      - Name: $SUBDOMAIN"
echo "      - Content: $TUNNEL_NAME.cfargotunnel.com"
echo "      - Proxied: Yes (orange cloud)"
echo ""
echo "   2. Wait 1-2 minutes for DNS propagation"
echo ""
echo "   3. Test access:"
echo "      curl -I https://$SUBDOMAIN.$DOMAIN"
echo ""
echo "   4. View tunnel details:"
echo "      cloudflared tunnel info $TUNNEL_NAME"
echo ""

# Optional: Display tunnel route instructions
echo "💡 To manually route the domain to this tunnel:"
echo "   cloudflared tunnel route dns $TUNNEL_NAME $SUBDOMAIN.$DOMAIN"
echo ""

echo "🔐 For additional security, consider:"
echo "   - Enabling Cloudflare Access/Authentication"
echo "   - Adding WAF rules in Cloudflare Dashboard"
echo "   - Restricting access by IP/country"
echo ""

echo "📚 Full documentation: CLOUDFLARE_TUNNEL_SETUP.md"
echo ""
