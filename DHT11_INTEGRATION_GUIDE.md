# DHT11 Sensor Integration Guide

Complete integration of DHT11 temperature and humidity sensor with your app and backend.

## 📋 Overview

- **Python Script**: `dhttemp.py` - Reads DHT11 sensor on Raspberry Pi, sends data to backend
- **Backend API**: Enhanced `sensor-backend-combined.js` with sensor control endpoints
- **React Component**: `DHT11Sensor.tsx` - Displays readings and controls sensor
- **Screen**: `TemperatureHumidityScreen.tsx` - Full-page sensor monitor

## 🔧 Setup Instructions

### 1. Raspberry Pi Setup

#### Install Dependencies

```bash
# Update package manager
sudo apt-get update
sudo apt-get upgrade

# Install Python libraries for DHT11
pip3 install adafruit-circuitpython-dht
pip3 install requests

# Install requests library
pip3 install requests
```

#### Configure DHT11 Sensor

1. Connect DHT11 to GPIO4 (pin 7) on Raspberry Pi:
   - VCC → Pin 1 (3.3V)
   - GND → Pin 6 (GND)
   - DATA → GPIO4 (Pin 7)

2. Enable I2C (if needed):
   ```bash
   sudo raspi-config
   # Navigate to Interface Options → I2C → Enable
   ```

#### Deploy Python Script

```bash
# Copy dhttemp.py to Raspberry Pi
scp dhttemp.py pi@raspberry-pi-ip:/home/pi/

# Make it executable
chmod +x dhttemp.py

# Run the script
python3 dhttemp.py
```

**Expected Output:**
```
🚀 Starting sensor loop (Device: raspberry-pi-01, Sensor: dht11-sensor-01)
🌐 HTTP Server started on port 5000
📍 Endpoints:
   - GET http://localhost:5000/sensor/status
   - GET http://localhost:5000/sensor/control?action=on
   - GET http://localhost:5000/sensor/control?action=off
   - GET http://localhost:5000/health
📊 Temperature: 24.5°C | Humidity: 65.2%
✅ Data sent to backend: 24.5°C, 65.2%
```

### 2. Backend Configuration

#### Database Schema

Ensure your `sensor_readings` table has a `data_type` column:

```sql
ALTER TABLE sensor_readings ADD COLUMN data_type VARCHAR(50) DEFAULT 'temperature';

-- Create a sensor for DHT11 if it doesn't exist
INSERT INTO sensors (device_id, sensor_id, sensor_name, sensor_type, location, unit, is_active)
VALUES (
  'raspberry-pi-01',
  'dht11-sensor-01',
  'DHT11 Sensor',
  'temperature_humidity',
  'Living Room',
  'C/%',
  true
) ON CONFLICT (sensor_id) DO NOTHING;
```

#### Environment Variables

Update your `.env` file:

```env
# Backend URL on Raspberry Pi
RASPBERRY_PI_BACKEND_URL=http://your-raspberry-pi-ip:3000

# Your Railway/Production Backend
BACKEND_URL=https://your-railway-app.up.railway.app
```

### 3. API Endpoints

#### Send Temperature & Humidity Data (from Raspberry Pi)

```bash
POST /api/readings
Content-Type: application/json

{
  "device_id": "raspberry-pi-01",
  "sensor_id": "dht11-sensor-01",
  "temperature": 24.5,
  "humidity": 65.2,
  "quality": 100
}
```

#### Get Latest Readings (from App)

```bash
GET /api/sensors/dht11-sensor-01/latest

Response:
{
  "sensor_id": "dht11-sensor-01",
  "temperature": 24.5,
  "humidity": 65.2,
  "timestamp": "2024-01-31T11:53:26.000Z"
}
```

#### Control Sensor (Turn On/Off)

```bash
# Turn OFF
POST /api/sensors/dht11-sensor-01/control
{
  "action": "off"
}

# Turn ON
POST /api/sensors/dht11-sensor-01/control
{
  "action": "on"
}

Response:
{
  "message": "Sensor turned ON",
  "sensor_id": "dht11-sensor-01",
  "is_active": true
}
```

#### Get Sensor History

```bash
GET /api/readings/dht11-sensor-01?hours=24&limit=100
```

### 4. React App Integration

#### Add Screen to Navigation

In your main navigation file (e.g., `App.tsx` or `Navigation.tsx`):

```typescript
import TemperatureHumidityScreen from './screens/TemperatureHumidityScreen';

// Add to your navigation stack
<Stack.Screen 
  name="TemperatureHumidity" 
  component={TemperatureHumidityScreen}
  options={{ title: 'Temperature Monitor' }}
/>
```

#### Configure API URL

In `.env` file:

```env
EXPO_PUBLIC_API_URL=https://your-railway-app.up.railway.app
```

For local development:

```env
EXPO_PUBLIC_API_URL=http://localhost:8080
```

### 5. WebSocket Real-time Updates

The component automatically subscribes to WebSocket updates:

```javascript
// Automatically receives updates via socket.io
socket.on('sensor_update', (data) => {
  console.log('New reading:', data);
  // temperature, humidity, timestamp
});

// Receive control commands
socket.on('sensor_control', (data) => {
  console.log('Sensor controlled:', data.action); // 'on' or 'off'
});
```

## 🚀 Running Everything

### Option 1: Local Development

```bash
# Terminal 1: Backend (local)
cd Sensor_app
npm install
node sensor-backend-combined.js

# Terminal 2: Raspberry Pi Python Script
ssh pi@your-pi-ip
python3 dhttemp.py

# Terminal 3: React App
cd sensor_app
expo start
```

### Option 2: Production (Railway + Raspberry Pi)

1. Ensure Raspberry Pi dhttemp.py points to your Railway URL:
   ```python
   BACKEND_URL = "https://your-railway-app.up.railway.app"
   ```

2. Deploy to Railway:
   ```bash
   git add .
   git commit -m "Add DHT11 sensor integration"
   git push
   ```

3. Run on Raspberry Pi:
   ```bash
   python3 dhttemp.py &  # Run in background
   ```

4. Update app `.env` to use Railway URL

## 📊 Component Features

### Temperature Card
- Shows current temperature in Celsius
- Updates every 5 seconds
- Shows last update time
- Temperature icon with red color

### Humidity Card
- Shows current humidity percentage
- Updates every 5 seconds
- Shows last update time
- Water droplet icon with blue color

### Control Buttons
- **Turn ON/OFF**: Control sensor from app
- **Refresh**: Manual data refresh
- Status badge shows ACTIVE/INACTIVE

### Sensor Info
- Displays sensor type, ID, device ID
- Shows last update timestamp
- Formatted information display

## 🔧 Troubleshooting

### Python Script Won't Start

```bash
# Check if required packages are installed
pip3 list | grep -i dht
pip3 list | grep -i requests

# Try installing again
pip3 install adafruit-circuitpython-dht requests
```

### "Cannot find module" Error in Backend

```bash
# Reinstall dependencies
npm install

# Check package-lock.json is up to date
npm ci
```

### App Can't Connect to Backend

- Verify backend URL in `.env`
- Check firewall settings
- Test connectivity: `curl https://your-railway-app.up.railway.app/health`

### Sensor Not Reading Data

1. Check DHT11 wiring on GPIO4
2. Verify sensor is enabled in database
3. Check Python script is running: `ps aux | grep dhttemp.py`
4. Check backend logs for errors

### WebSocket Connection Failed

- Ensure backend is running with socket.io
- Check CORS settings in backend
- Verify firewall allows WebSocket connections

## 📝 Notes

- Temperature readings are updated every 2 seconds from Pi
- App fetches latest data every 5 seconds automatically
- Sensor can be controlled on/off from app in real-time
- All data is stored in database for historical analysis
- WebSocket provides real-time push updates to all connected clients

## 🔐 Security Considerations

1. **API Keys**: Add authentication to sensor control endpoints
2. **CORS**: Configure CORS for your domain only
3. **Data Validation**: Always validate sensor input
4. **Rate Limiting**: Implement rate limiting on API
5. **HTTPS**: Use HTTPS in production (Railway provides this)

## 📚 API Reference

### DHT11 Sensor Readings Format

```javascript
{
  "device_id": "raspberry-pi-01",
  "sensor_id": "dht11-sensor-01",
  "temperature": 24.5,        // in Celsius
  "humidity": 65.2,           // in percentage
  "quality": 100,             // signal quality 0-100
  "timestamp": "2024-01-31T..."
}
```

### Database Tables

```sql
-- Sensors Table
CREATE TABLE sensors (
  sensor_id VARCHAR(100) PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL,
  sensor_name VARCHAR(255),
  sensor_type VARCHAR(50),
  location VARCHAR(255),
  unit VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sensor Readings Table
CREATE TABLE sensor_readings (
  id SERIAL PRIMARY KEY,
  time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sensor_id VARCHAR(100) NOT NULL REFERENCES sensors(sensor_id),
  value NUMERIC(10, 2),
  quality INT DEFAULT 100,
  data_type VARCHAR(50) DEFAULT 'temperature',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sensor_id) REFERENCES sensors(sensor_id)
);
```

---

**For questions or issues, check the logs:**
- Backend: Check Railway logs
- Python: Check Raspberry Pi terminal output
- App: Check React Native console and Network tab
