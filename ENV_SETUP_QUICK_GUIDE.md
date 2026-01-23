# Environment Variables Setup - Quick Reference

## Your Specific Values

Replace these with YOUR actual values:

```bash
# Your Firebase Realtime Database URL
FIREBASE_DB_URL="https://sensor-app-default-rtdb.firebaseio.com"

# Your Raspberry Pi device identifier
DEVICE_ID="pi-living-room"

# Path to Firebase service account key (usually in same directory)
FIREBASE_KEY_PATH="./serviceAccountKey.json"
```

---

## 3 Easy Ways to Set Them

### Option A: Automatic Setup (Easiest)

On your Raspberry Pi, run:

```bash
cd ~/Sensor_app
bash pi-setup.sh
```

This will:
1. Ask for your Firebase URL
2. Ask for your Device ID
3. Create start script
4. Configure permanently

Then start the server with:
```bash
./start-camera.sh
```

---

### Option B: Manual One-Time Setup (Fastest)

Copy-paste this, replacing YOUR_VALUES:

```bash
ssh pi@192.168.132.207

cd ~/Sensor_app

# Create start script
cat > start-camera.sh << 'EOF'
#!/bin/bash
export DEVICE_ID="my-pi-camera"
export FIREBASE_DB_URL="https://your-project.firebaseio.com"
export FIREBASE_KEY_PATH="./serviceAccountKey.json"
node webrtc-camera-server.js
EOF

chmod +x start-camera.sh

# Run it
./start-camera.sh
```

---

### Option C: Permanent Setup (Best)

Edit your bash profile:

```bash
ssh pi@192.168.132.207

# Open editor
nano ~/.bashrc

# Add these lines at the very end:
export DEVICE_ID="my-pi-camera"
export FIREBASE_DB_URL="https://your-project.firebaseio.com"
export FIREBASE_KEY_PATH="./serviceAccountKey.json"

# Save: Ctrl+X → Y → Enter

# Reload
source ~/.bashrc

# Test
echo $DEVICE_ID  # Should print: my-pi-camera
```

Then start server anytime with:
```bash
node webrtc-camera-server.js
```

---

## Finding Your Firebase URL

1. Open [Firebase Console](https://console.firebase.google.com)
2. Click your project name
3. Go to **Realtime Database**
4. You'll see the URL in the top bar

**Example:**
```
https://sensor-app-12345-abcde.firebaseio.com
```

---

## Verifying Setup

```bash
# Check if variables are set
echo "Device: $DEVICE_ID"
echo "Firebase: $FIREBASE_DB_URL"
echo "Key Path: $FIREBASE_KEY_PATH"

# All three should display your values
```

---

## Troubleshooting

### "command not found: DEVICE_ID"
- You forgot the `export` keyword
- Or environment isn't loaded (reload with `source ~/.bashrc`)

### Server starts but says "Firebase key not found"
- Check `serviceAccountKey.json` exists in `~/Sensor_app/`
- Verify `FIREBASE_KEY_PATH` points to it

### Server runs but no connections
- Check `FIREBASE_DB_URL` is correct
- Verify Firebase Realtime Database is enabled
- Check service account has read/write permissions

---

## What Each Variable Does

| Variable | Purpose | Example |
|----------|---------|---------|
| `DEVICE_ID` | Unique ID for this Pi in your app | `"pi-living-room"` |
| `FIREBASE_DB_URL` | Where signaling messages go | `"https://project.firebaseio.com"` |
| `FIREBASE_KEY_PATH` | Authentication key file | `"./serviceAccountKey.json"` |

---

## Start Server in Background (Keep Running)

Once configured, you can run it permanently with:

```bash
# Using nohup (survives closing terminal)
nohup node webrtc-camera-server.js > camera.log 2>&1 &

# Check it's running
ps aux | grep webrtc

# View logs
tail -f camera.log
```

---

## Stop the Server

```bash
# Find process
ps aux | grep webrtc

# Kill it
kill <PID>

# Or simply press Ctrl+C in the terminal
```

---

## Quick Commands Cheat Sheet

```bash
# SSH into Pi
ssh pi@192.168.132.207

# Navigate to app
cd ~/Sensor_app

# View files
ls -la

# View current variables
env | grep FIREBASE
env | grep DEVICE

# Test Firebase connection
curl https://your-project.firebaseio.com/device_status.json

# Start with logging
node webrtc-camera-server.js 2>&1 | tee server.log

# Start in background
./start-camera.sh &

# View running process
pgrep -f webrtc
```
