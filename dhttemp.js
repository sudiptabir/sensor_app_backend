#!/usr/bin/env node
/**
 * DHT11 Sensor Control Agent (Raspberry Pi)
 *
 * Control-only behavior:
 * - Registers a controllable sensor row in EC2 PostgreSQL via Sensor Control API.
 * - Polls desired on/off state from EC2 API.
 * - Does NOT send sensor readings/data to backend.
 */

const express = require('express');
const os = require('os');
const fs = require('fs');

require('dotenv').config();

// ============================================
// Configuration
// ============================================
const SENSOR_CONTROL_API_URL = (process.env.SENSOR_CONTROL_API_URL || 'http://13.205.201.82/sensor-api').replace(/\/$/, '');
const DEVICE_ID_FILE = process.env.DEVICE_ID_FILE || './device_id.txt';
const DEVICE_ID = (process.env.DEVICE_ID || (fs.existsSync(DEVICE_ID_FILE) ? fs.readFileSync(DEVICE_ID_FILE, 'utf8').trim() : '')).trim();
const SENSOR_NAME = process.env.SENSOR_NAME || 'DHT11 Sensor';
const SENSOR_TYPE = process.env.SENSOR_TYPE || 'dht11';
const API_KEY = process.env.API_KEY || process.env.ADMIN_API_KEY || '';
const DEVICE_SECRET = process.env.DEVICE_REGISTRATION_SECRET || '';
const STATUS_CHECK_INTERVAL = Number(process.env.SENSOR_STATUS_CHECK_INTERVAL_MS || 5000);
const HTTP_PORT = Number(process.env.SENSOR_LOCAL_PORT || 5000);

// ============================================
// Global State
// ============================================
let sensorEnabled = true;
let sensorId = null;

if (!DEVICE_ID) {
  console.error('❌ DEVICE_ID is required (set DEVICE_ID or DEVICE_ID_FILE)');
  process.exit(1);
}

if (!API_KEY) {
  console.error('❌ API_KEY (or ADMIN_API_KEY) is required for sensor-control API calls');
  process.exit(1);
}

// ============================================
// Utility Functions
// ============================================

async function requestJson(path, { method = 'GET', body, extraHeaders = {} } = {}) {
  const response = await fetch(`${SENSOR_CONTROL_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${json.error || json.message || text || 'Request failed'}`);
  }

  return json;
}

/**
 * Get local IP for diagnostics
 */
function getLocalIP() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting local IP:', error);
    return null;
  }
}

/**
 * Register or upsert this Pi's DHT sensor on EC2
 */
async function registerSensor() {
  try {
    const response = await requestJson('/api/sensors/register', {
      method: 'POST',
      body: {
        deviceId: DEVICE_ID,
        sensorName: SENSOR_NAME,
        sensorType: SENSOR_TYPE,
      },
      extraHeaders: {
        'x-device-secret': DEVICE_SECRET,
      },
    });

    sensorId = response?.sensor?.sensor_id || null;
    if (sensorId) {
      console.log(`✅ Sensor registered on EC2 (sensor_id=${sensorId})`);
    } else {
      console.warn('⚠️  Sensor registration succeeded but sensor_id missing in response');
    }
  } catch (error) {
    console.error(`❌ Failed to register sensor on EC2: ${error.message}`);
    throw error;
  }
}

/**
 * Poll desired sensor state from EC2 backend
 */
async function checkSensorStatus() {
  try {
    const sensors = await requestJson(`/api/sensors?deviceId=${encodeURIComponent(DEVICE_ID)}`);
    const target = Array.isArray(sensors)
      ? sensors.find((s) => (sensorId ? s.sensor_id === sensorId : String(s.sensor_name || '').toLowerCase() === SENSOR_NAME.toLowerCase())) || sensors[0]
      : null;

    if (!target) {
      console.warn('⚠️  No sensor row found for device yet');
      return sensorEnabled;
    }

    if (!sensorId && target.sensor_id) {
      sensorId = target.sensor_id;
    }

    const backendEnabled = target.enabled !== false;
    if (backendEnabled !== sensorEnabled) {
      sensorEnabled = backendEnabled;
      console.log(`🔄 Sensor state changed from EC2 backend: ${sensorEnabled ? 'ON' : 'OFF'}`);
    }

    return sensorEnabled;
  } catch (error) {
    console.warn(`⚠️  Error polling sensor status: ${error.message}`);
    return sensorEnabled;
  }
}

/**
 * Status monitoring loop - polls desired state from EC2
 */
async function statusMonitorLoop() {
  console.log(`🔍 Starting status monitor (device=${DEVICE_ID}, interval=${STATUS_CHECK_INTERVAL}ms)`);

  while (true) {
    try {
      await checkSensorStatus();
      await new Promise((resolve) => setTimeout(resolve, STATUS_CHECK_INTERVAL));
    } catch (error) {
      console.error(`❌ Error in status monitor: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, STATUS_CHECK_INTERVAL));
    }
  }
}

// ============================================
// Local Express Server (Optional local control/debug)
// ============================================

const app = express();
app.use(express.json());

app.get('/sensor/status', (req, res) => {
  res.json({
    status: 'ok',
    enabled: sensorEnabled,
    device_id: DEVICE_ID,
    sensor_id: sensorId,
    timestamp: Date.now() / 1000,
  });
});

app.get('/sensor/control', (req, res) => {
  const action = String(req.query.action || '').toLowerCase();

  if (action === 'on') {
    sensorEnabled = true;
    console.log('✅ Sensor turned ON (local endpoint)');
    return res.json({ status: 'Sensor turned ON', enabled: true });
  }

  if (action === 'off') {
    sensorEnabled = false;
    console.log('⏸️  Sensor turned OFF (local endpoint)');
    return res.json({ status: 'Sensor turned OFF', enabled: false });
  }

  return res.status(400).json({ error: 'Invalid action. Use ?action=on or ?action=off' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', sensor_enabled: sensorEnabled, sensor_id: sensorId });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ============================================
// Main Entry Point
// ============================================

async function main() {
  try {
    console.log('🚀 Initializing DHT11 Sensor Control Agent...');
    console.log(`🌍 EC2 Sensor Control API: ${SENSOR_CONTROL_API_URL}`);
    console.log(`📍 Local IP: ${getLocalIP() || 'unknown'}`);
    console.log('ℹ️  Mode: control-only (no sensor data upload)');

    await registerSensor();

    const server = app.listen(HTTP_PORT, '0.0.0.0', () => {
      console.log(`🌐 Local control server started on port ${HTTP_PORT}`);
      console.log('Endpoints: /sensor/status, /sensor/control?action=on|off, /health');
    });

    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down gracefully...');
      server.close(() => {
        console.log('✅ Goodbye!');
        process.exit(0);
      });
    });

    statusMonitorLoop().catch((error) => {
      console.error(`❌ Fatal error in status monitor: ${error.message}`);
      process.exit(1);
    });
  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main();
