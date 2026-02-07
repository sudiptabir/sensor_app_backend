# DHT11 Sensor Control - Python to Node.js Migration Guide

## Overview
The `dhttemp.py` Python script has been converted to `dhttemp.js` Node.js script with **all original functionalities preserved**.

## Feature Parity

### ✅ All Features Maintained:
- **HTTP Server**: Express.js replaces Python's HTTPServer
- **Sensor Control**: GET endpoints for status, control, and health checks
- **Backend Integration**: Backend API communication for device registration & status checks
- **IP Registration**: Automatic device IP registration with backend
- **Status Monitoring**: Periodic background polling of backend for sensor state changes
- **Graceful Shutdown**: Proper cleanup on process termination
- **Error Handling**: Comprehensive error handling and logging with emoji indicators

## File Changes

| Original | New | Purpose |
|----------|-----|---------|
| `dhttemp.py` | `dhttemp.js` | Main sensor control script |
| N/A | `dhttemp-package.json` | Node.js dependencies |

## Installation & Setup

### Prerequisites
- Node.js 14+ installed on Raspberry Pi
- npm package manager

### Step 1: Install Dependencies
Copy `dhttemp-package.json` to your Raspberry Pi and rename it to `package.json`:

```bash
# On Raspberry Pi
mv dhttemp-package.json package.json
npm install
```

### Step 2: Update Configuration
Edit `dhttemp.js` and update these variables:

```javascript
const BACKEND_URL = 'https://your-backend-url';
const DEVICE_ID = 'your-device-id';
const SENSOR_ID = 6; // Your sensor ID
const DHT_PIN = 4; // Your GPIO pin
```

### Step 3: Run the Script

#### Development Mode (with auto-reload):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

#### Run as Background Service:
```bash
# Using PM2 (recommended)
npm install -g pm2
pm2 start dhttemp.js --name "dht-sensor"
pm2 startup
pm2 save
```

## API Endpoints

| Endpoint | Method | Query Params | Response |
|----------|--------|--------------|----------|
| `/sensor/status` | GET | - | `{status, enabled, device_id, sensor_id, timestamp}` |
| `/sensor/control` | GET | `action=on\|off` | `{status, enabled}` |
| `/health` | GET | - | `{status, sensor_enabled}` |

### Example Usage:

```bash
# Check sensor status
curl http://localhost:5000/sensor/status

# Turn sensor ON
curl http://localhost:5000/sensor/control?action=on

# Turn sensor OFF
curl http://localhost:5000/sensor/control?action=off

# Health check
curl http://localhost:5000/health
```

## Key Differences from Python Version

### 1. **HTTP Server**
   - **Python**: `HTTPServer` + `BaseHTTPRequestHandler`
   - **Node.js**: `Express.js` (cleaner routing)

### 2. **Async Operations**
   - **Python**: `threading` module
   - **Node.js**: `async/await` (event-driven non-blocking)

### 3. **Delay/Sleep**
   - **Python**: `time.sleep()`
   - **Node.js**: `setTimeout()` / `Promise` based delays

### 4. **HTTP Requests**
   - **Python**: `requests` library
   - **Node.js**: `axios` library

### 5. **Network Interface Access**
   - **Python**: `socket` module
   - **Node.js**: `os` module

## Dependencies Explained

- **express**: Web server framework for handling HTTP requests
- **axios**: HTTP client for backend API communication
- **node-dht-sensor**: Library for DHT11 sensor control on Raspberry Pi

## Troubleshooting

### Port Already in Use
If port 5000 is already in use:
```javascript
// Edit dhttemp.js
const HTTP_PORT = 3000; // Change to different port
```

### Module Not Found Errors
Ensure all dependencies are installed:
```bash
npm install --save express axios node-dht-sensor
```

### Sensor Not Detected
Check GPIO pin configuration:
```bash
# List GPIO pins
raspi-gpio get
```

Update `DHT_PIN` in the script accordingly.

### Backend Connection Issues
Check:
1. Network connectivity: `ping <backend-url>`
2. Firewall rules
3. `BACKEND_URL` configuration is correct
4. `DEVICE_ID` matches backend database

## Migration Checklist

- [ ] Copy `dhttemp.js` to Raspberry Pi
- [ ] Copy `dhttemp-package.json` and rename to `package.json`
- [ ] Update configuration variables in `dhttemp.js`
- [ ] Run `npm install`
- [ ] Test endpoints with curl or Postman
- [ ] Set up as PM2 service
- [ ] Update mobile app backend to point to new endpoints
- [ ] Monitor logs for issues

## Support

For issues or questions, refer to:
- Original Python script: `dhttemp.py`
- Node.js documentation: https://nodejs.org/docs/
- Express.js guide: https://expressjs.com/
- DHT11 sensor guide: https://github.com/msm-oss/node-dht-sensor

## License

MIT
