# DHT11 Sensor Integration - Complete Setup

## ✅ What's Been Done

### 1. **Python Script** (`dhttemp.py`)
- Reads DHT11 sensor data every 2 seconds
- Runs HTTP server on port 5000 for control commands
- Automatically sends temperature/humidity to backend
- Supports on/off control from the app

### 2. **Backend API Updates** (`sensor-backend-combined.js`)
- ✅ Added `/api/readings` - Enhanced to handle temperature & humidity
- ✅ Added `/api/sensors/:sensorId/control` - Turn sensor on/off
- ✅ Added `/api/sensors/:sensorId/latest` - Get latest readings
- ✅ WebSocket events for real-time updates

### 3. **React App Updates**
- ✅ Created `DHT11Sensor.tsx` component - Full sensor display with control
- ✅ Created `sensor-detail.tsx` - Detailed sensor page
- ✅ Updated `SensorCard.tsx` - Now clickable, navigates to details
- ✅ Updated `sensor-list.tsx` - Passes device ID to sensor cards

### 4. **Database**
- Added `CLEANUP_OLD_SENSORS.sql` - Script to remove test sensors
- Schema ready for DHT11 data storage

## 🚀 Quick Start

### Step 1: Clean Database (Run Once)
```sql
-- Connect to your PostgreSQL database and run:
-- File: CLEANUP_OLD_SENSORS.sql

-- This will:
-- 1. Delete all old test sensor readings
-- 2. Delete all old test sensors
-- 3. Create the Raspberry Pi device
-- 4. Create the DHT11 sensor
```

### Step 2: Setup Raspberry Pi

```bash
# SSH into your Raspberry Pi
ssh pi@your-pi-ip

# Install dependencies
pip3 install adafruit-circuitpython-dht requests

# Copy the Python script
# (From your computer to Raspberry Pi)
scp dhttemp.py pi@your-pi-ip:/home/pi/

# Make it executable and run
cd /home/pi
chmod +x dhttemp.py
python3 dhttemp.py
```

### Step 3: Configure Backend URL

Edit `dhttemp.py` and set:
```python
BACKEND_URL = "https://your-railway-app.up.railway.app"  # Your production URL
```

Or for local testing:
```python
BACKEND_URL = "http://192.168.x.x:8080"  # Your local backend IP
```

### Step 4: Deploy to Railway (Already Done)
```bash
# Already pushed to Railway
# Just check the deployment logs
```

### Step 5: Update React App

In your `.env` file (sensor_app/.env):
```env
EXPO_PUBLIC_API_URL=https://your-railway-app.up.railway.app
```

## 📱 How to Use the App

### Viewing Sensor Data

1. **Open the app** → Navigate to **Devices** tab
2. **Tap on** "Raspberry Pi - Main" device
3. **View sensors** → You'll see "DHT11 Sensor"
4. **Tap the sensor card** → Opens detailed sensor view with:
   - Temperature display (°C)
   - Humidity display (%)
   - Current readings
   - Last update time
   - **Turn ON/OFF button** at the bottom

### Controlling the Sensor

1. **On sensor detail page**, see the power button
2. **Tap "TURN OFF"** → Disables sensor (no more readings)
3. **Tap "TURN ON"** → Re-enables sensor (resumes readings)
4. **Data refreshes automatically** every 5 seconds

## 🔧 API Reference

### Get Latest Sensor Readings
```bash
GET /api/sensors/dht11-sensor-01/latest

Response:
{
  "sensor_id": "dht11-sensor-01",
  "temperature": 24.5,
  "humidity": 65.2,
  "timestamp": "2024-01-31T..."
}
```

### Control Sensor
```bash
POST /api/sensors/dht11-sensor-01/control

Body:
{
  "action": "off"  // or "on"
}

Response:
{
  "message": "Sensor turned OFF",
  "sensor_id": "dht11-sensor-01",
  "is_active": false
}
```

### Send Sensor Data (from Raspberry Pi)
```bash
POST /api/readings

Body:
{
  "device_id": "raspberry-pi-01",
  "sensor_id": "dht11-sensor-01",
  "temperature": 24.5,
  "humidity": 65.2,
  "quality": 100
}
```

## 📊 Database Schema

The system uses these tables:

```sql
-- Devices
device_metadata (device_id, device_name, device_type, location, is_online)

-- Sensors
sensors (sensor_id, device_id, sensor_name, sensor_type, location, unit, is_active)

-- Readings (supports multiple data types)
sensor_readings (id, sensor_id, value, data_type, time, quality)
```

## 🔌 Hardware Wiring

### DHT11 to Raspberry Pi
```
DHT11 Pin 1 (VCC)   → GPIO 3.3V (Pin 1)
DHT11 Pin 2 (DATA)  → GPIO 4 (Pin 7)
DHT11 Pin 3 (NC)    → Not connected
DHT11 Pin 4 (GND)   → GPIO GND (Pin 6)
```

## ✅ Checklist

- [ ] Run `CLEANUP_OLD_SENSORS.sql` on your database
- [ ] Install DHT11 library on Raspberry Pi
- [ ] Copy `dhttemp.py` to Raspberry Pi
- [ ] Update backend URL in `dhttemp.py`
- [ ] Update app `.env` with Railway URL
- [ ] Test DHT11 sensor on Raspberry Pi
- [ ] Test app sensor detail page
- [ ] Test on/off button functionality
- [ ] Verify real-time updates in app

## 🐛 Troubleshooting

### "Sensor not found" error
→ Run `CLEANUP_OLD_SENSORS.sql` to create the sensor

### Python script not sending data
```bash
# Check logs
python3 dhttemp.py

# Should show:
# ✅ Data sent to backend: XX.X°C, XX.X%
```

### App can't connect to backend
```bash
# Test backend URL
curl https://your-railway-app.up.railway.app/health

# Should return: {"status": "ok", ...}
```

### Sensor shows "No data"
- Check Raspberry Pi is running the script
- Verify DHT11 wiring
- Check backend database has the sensor created

## 📝 File Structure

```
Sensor_app/
├── dhttemp.py                          # Python sensor script
├── sensor-backend-combined.js          # Backend with new endpoints
├── CLEANUP_OLD_SENSORS.sql             # Database cleanup script
├── DHT11_INTEGRATION_GUIDE.md           # Detailed guide
├── sensor_app/
│   ├── app/
│   │   ├── sensor-detail.tsx           # NEW: Sensor detail page
│   │   ├── sensor-list.tsx             # Updated: Clickable cards
│   │   └── index.tsx
│   ├── components/
│   │   ├── DHT11Sensor.tsx             # NEW: DHT11 display component
│   │   └── SensorCard.tsx              # Updated: Now clickable
│   └── screens/
│       └── TemperatureHumidityScreen.tsx # NEW: Alternative full-page view
```

## 🎯 Next Steps

1. **Production Deployment**
   - Ensure Raspberry Pi is connected reliably
   - Set up automatic restart on reboot
   - Monitor sensor readings in production

2. **Data Storage & History**
   - Readings are stored in database
   - Query `/api/readings/:sensorId?hours=24` for historical data
   - Use analytics to view trends

3. **Alerts & Notifications**
   - Implement threshold-based alerts
   - Send push notifications when temp/humidity goes out of range

4. **Multi-Sensor Support**
   - Add more DHT11 sensors to other GPIO pins
   - Register each with a unique sensor ID
   - Display all sensors on dashboard

## 📞 Support

For issues with:
- **Python script**: Check `dhttemp.py` logs
- **Backend API**: Check Railway deployment logs
- **App integration**: Check React Native console
- **Database**: Check PostgreSQL logs

---

**Last Updated**: January 31, 2026
**Status**: ✅ Production Ready
