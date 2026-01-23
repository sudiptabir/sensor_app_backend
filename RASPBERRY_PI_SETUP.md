# Raspberry Pi Device Registration Setup Guide

## Prerequisites

Before running the device registration test on your Raspberry Pi, ensure you have:

- Raspberry Pi with Raspbian OS installed
- Internet connection
- Node.js and npm installed
- The `serviceAccountKey.json` file (Firebase credentials)

---

## Step 1: Install Node.js and npm on Raspberry Pi

SSH into your Raspberry Pi:
```bash
ssh pi@<your-raspberry-pi-ip>
```

Update system packages:
```bash
sudo apt update
sudo apt upgrade -y
```

Install Node.js (LTS version):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify installation:
```bash
node --version
npm --version
```

---

## Step 2: Transfer Files to Raspberry Pi

On your Windows machine, copy the files to your Raspberry Pi. Run this command in PowerShell:

```powershell
# Replace <RPi-IP> with your Raspberry Pi's IP address
scp test_device_registration.js pi@<RPi-IP>:/home/pi/
scp serviceAccountKey.json pi@<RPi-IP>:/home/pi/
```

Or use SCP GUI tool like WinSCP.

---

## Step 3: Create Project Directory on Raspberry Pi

On your Raspberry Pi (via SSH):

```bash
mkdir -p ~/sensor_test
cd ~/sensor_test
```

Move the files you copied:
```bash
mv ~/test_device_registration.js ./
mv ~/serviceAccountKey.json ./
```

---

## Step 4: Initialize npm and Install Dependencies

In the `/home/pi/sensor_test` directory:

```bash
npm init -y
npm install firebase-admin uuid
```

Verify the packages are installed:
```bash
npm list
```

You should see:
- firebase-admin
- uuid

---

## Step 5: Run the Device Registration Test

Execute the test script:

```bash
node test_device_registration.js
```

### Expected Output

You should see output similar to:

```
============================================================
🔥 DEVICE REGISTRATION TEST
============================================================

[1] Loading Firebase credentials...
    ✅ Credentials loaded

[2] Initializing Firebase Admin SDK...
    ✅ Firebase initialized

[3] Connecting to Firestore...
    ✅ Connected to Firestore

[4] Gathering device information...
    Device ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    Hostname: raspberrypi
    Platform: linux

[5] Registering device in Firestore...
    ✅ Device registered with ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

[6] Verifying device registration...
    ✅ Device successfully registered and verified!

    Device data in Firestore:
      - deviceId: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      - name: raspberrypi
      - platform: linux
      - status: connected
      - registeredAt: Timestamp
      - lastSeen: Timestamp
      - type: sensor_device

[7] Testing sensor reading submission...
    ✅ Sample reading submitted with ID: xxxxxxxxxxxxx

[8] Verifying sensor reading...
    ✅ Sensor reading successfully stored!

============================================================
✅ SUCCESS - DEVICE REGISTRATION TEST PASSED!
============================================================

Your device is successfully connected to Firebase!
Device ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Location: devices/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Readings: devices/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/readings/

💾 Device ID saved to device_id.txt
```

---

## Troubleshooting

### Error: Cannot find module 'firebase-admin'
**Solution:** Ensure you ran `npm install firebase-admin uuid` in the correct directory

### Error: ENOENT: no such file or directory, open './serviceAccountKey.json'
**Solution:** 
- Verify the JSON file is in the same directory as the script
- Check file permissions: `ls -la serviceAccountKey.json`

### Error: Firebase Initialization Failed
**Solution:**
- Verify your Firebase project ID is correct
- Check that Firestore database is created in Firebase Console
- Ensure security rules allow reads/writes

### Slow Internet on Pi
- The first run may take longer due to npm downloads
- Ensure stable internet connection
- You can run with verbose logging: `DEBUG=* node test_device_registration.js`

---

## Next Steps

Once the test passes:

1. **Save the Device ID**: The script automatically saves it to `device_id.txt`
2. **Copy Device ID back**: Transfer `device_id.txt` to your Windows machine for reference
3. **Monitor in Firebase Console**: Check your Firestore database for the device and sensor readings

---

## Automated Execution

To run the script automatically on Raspberry Pi boot:

1. Edit crontab:
```bash
crontab -e
```

2. Add this line to run every 5 minutes:
```
*/5 * * * * cd /home/pi/sensor_test && node test_device_registration.js >> device_test.log 2>&1
```

3. Check logs:
```bash
tail -f device_test.log
```

---

## Performance Tips

- **Minimize Network Calls**: The script is optimized to use minimal bandwidth
- **Monitor Resource Usage**: Check Pi memory: `free -h`
- **Use wired connection** if possible for stability
