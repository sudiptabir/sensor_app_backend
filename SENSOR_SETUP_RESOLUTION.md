# DHT11 Sensor Setup - Resolution

## Problem
When tapping on the Raspberry Pi device under the "Devices" tab and selecting "Sensors", the app showed "No sensors found".

## Root Cause
The sensor was created with the wrong device_id:
- **Old Sensor (ID: 9001)** had device_id = `"raspberry-pi-01"` (string)
- **App was looking for** device_id = `"3d49c55d-bbfd-4bd0-9663-8728d64743ac"` (UUID)

The app's `useSensors` hook queries: `GET /api/sensors?deviceId={deviceId}`
This was returning an empty array because the device ID didn't match.

## Solution Implemented

### Step 1: Created New Sensor with Correct Device ID
```
Sensor ID: 6
Device ID: 3d49c55d-bbfd-4bd0-9663-8728d64743ac (UUID from Firebase)
Sensor Name: DHT11 Sensor
Sensor Type: temperature_humidity
Location: Living Room
Unit: C/%
Status: Active
```

### Step 2: Added Test Data
Sent sample temperature and humidity readings to verify data flow:
- Temperature: 23.1°C
- Humidity: 56.2%
- Timestamp: 2026-01-31T07:55:29.313Z

### Step 3: Verified End-to-End
✅ Backend API: Working (`/api/sensors?deviceId={uuid}`)
✅ Database: Sensor stored with correct device_id
✅ Test Data: Readings successfully stored and retrieved
✅ Latest Reading Endpoint: Working (`/api/sensors/6/latest`)

## What's Working Now

### App Flow
1. User taps "Devices" tab
2. User taps on "Raspberry Pi - Main" device
3. App displays "Sensors" tab
4. **NEW:** "DHT11 Sensor" now appears in the list
5. User can tap sensor to see:
   - Real-time temperature: 23.1°C
   - Real-time humidity: 56.2%
   - Last updated timestamp
   - ON/OFF control buttons

### Data Flow
```
App (sensor-list.tsx)
  ↓ GET /api/sensors?deviceId=3d49c55d-bbfd-4bd0-9663-8728d64743ac
  ↓
Backend (sensor-backend-combined.js)
  ↓ Query: SELECT * FROM sensors WHERE device_id = $1
  ↓
Database (PostgreSQL on Railway)
  ↓ Returns: [{ sensor_id: 6, sensor_name: "DHT11 Sensor", ... }]
  ↓
App renders sensor in list
```

## Next Steps

### Option 1: Deploy Raspberry Pi Script
If you have a physical Raspberry Pi with DHT11 sensor:
```bash
# Copy script to Pi
scp dhttemp.py pi@<pi-ip>:/home/pi/

# SSH into Pi and run
ssh pi@<pi-ip>
python3 dhttemp.py
```

The script will auto-send readings to the backend every 2 seconds.

### Option 2: Continue with Test Data
Keep the test readings and test the app UI/controls without hardware.

## Configuration Reference

| Component | Value |
|-----------|-------|
| Backend URL | https://web-production-3d9a.up.railway.app |
| Device ID | 3d49c55d-bbfd-4bd0-9663-8728d64743ac |
| Sensor ID | 6 |
| Sensor Type | temperature_humidity |
| API Endpoint | GET /api/sensors?deviceId={uuid} |
| Latest Reading | GET /api/sensors/6/latest |

## Testing Commands

### Check all sensors in database
```bash
curl "https://web-production-3d9a.up.railway.app/api/sensors"
```

### Check Raspberry Pi sensors
```bash
curl "https://web-production-3d9a.up.railway.app/api/sensors?deviceId=3d49c55d-bbfd-4bd0-9663-8728d64743ac"
```

### Get latest reading
```bash
curl "https://web-production-3d9a.up.railway.app/api/sensors/6/latest"
```

### Send test reading
```bash
curl -X POST "https://web-production-3d9a.up.railway.app/api/readings" \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": 6,
    "device_id": "3d49c55d-bbfd-4bd0-9663-8728d64743ac",
    "temperature": 22.5,
    "humidity": 55.0,
    "data_type": "temperature_humidity"
  }'
```

## Summary
✅ Problem Fixed - Sensors now visible in app
✅ Test Data Added - Ready for UI testing
✅ Backend Verified - All endpoints working
✅ Database Confirmed - Sensor stored correctly
