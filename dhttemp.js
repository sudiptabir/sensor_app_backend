#!/usr/bin/env node
/**
 * DHT11 Temperature & Humidity Sensor Control Script
 * Runs on Raspberry Pi - Only handles sensor on/off control
 * 
 * ⚠️  IMPORTANT: Blocked User Access Control
 *     - All authorization is handled on the backend API
 *     - The backend checks if a user is blocked BEFORE sending control commands
 *     - This script simply executes commands from authorized requests only
 *     - If a blocked user tries to control this sensor:
 *       1. Mobile app sends request to backend API with user ID
 *       2. Backend checks user_blocks and device_access_control tables
 *       3. If user is blocked, backend returns 403 Forbidden error
 *       4. No command is sent to this Pi script
 *     - Therefore, this script doesn't need additional blocking logic
 */

const express = require('express');
const axios = require('axios');
const os = require('os');
const Sensor = require('node-dht-sensor').promises;

// ============================================
// Configuration
// ============================================
const BACKEND_URL = 'https://web-production-3d9a.up.railway.app'; // Your Railway backend
const DEVICE_ID = '3d49c55d-bbfd-4bd0-9663-8728d64743ac'; // Raspberry Pi device ID from admin portal
const SENSOR_ID = 6; // DHT11 Sensor ID (integer)
const DHT_PIN = 4; // GPIO4
const STATUS_CHECK_INTERVAL = 5000; // Check backend status every 5 seconds (in milliseconds)
const HTTP_PORT = 5000;

// ============================================
// Global State
// ============================================
let sensorEnabled = true;
let dhtSensor = null;

// ============================================
// Utility Functions
// ============================================

/**
 * Get the local IP address of this Raspberry Pi
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
 * Register this device's IP address with the backend
 */
async function registerDeviceIP() {
  try {
    const ipAddress = getLocalIP();
    if (!ipAddress) {
      console.warn('⚠️  Could not determine local IP address');
      return;
    }

    console.log(`📍 Local IP: ${ipAddress}`);

    const url = `${BACKEND_URL}/api/devices/${DEVICE_ID}/metadata`;
    const response = await axios.put(url, { ip_address: ipAddress }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    if (response.status === 200 || response.status === 201) {
      console.log(`✅ Device IP registered: ${ipAddress}`);
    } else {
      console.warn(`⚠️  Failed to register IP: ${response.status}`);
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.warn('⚠️  Device not found in backend - skipping IP registration');
      console.warn('   (This is OK - device will work without IP registration)');
    } else {
      console.warn(`⚠️  Error registering IP: ${error.message}`);
      console.warn('   (This is OK - continuing without IP registration)');
    }
  }
}

/**
 * Check if sensor is enabled in backend database
 */
async function checkSensorStatus() {
  try {
    const response = await axios.get(
      `${BACKEND_URL}/api/sensors?deviceId=${DEVICE_ID}`,
      { timeout: 5000 }
    );

    if (response.status === 200) {
      const sensors = response.data;
      for (const sensor of sensors) {
        if (sensor.sensor_id === SENSOR_ID) {
          const backendEnabled = sensor.enabled !== false;

          // Update local state if changed
          if (backendEnabled !== sensorEnabled) {
            sensorEnabled = backendEnabled;
            const status = sensorEnabled ? 'ON' : 'OFF';
            console.log(`🔄 Sensor state updated from backend: ${status}`);
          }

          return backendEnabled;
        }
      }
    }

    return sensorEnabled;
  } catch (error) {
    console.warn(`⚠️  Error checking backend status: ${error.message}`);
    return sensorEnabled;
  }
}

/**
 * Status monitoring loop - checks backend periodically
 */
async function statusMonitorLoop() {
  console.log(`🔍 Starting status monitor (Device: ${DEVICE_ID}, Sensor: ${SENSOR_ID})`);

  while (true) {
    try {
      await checkSensorStatus();
      await new Promise(resolve => setTimeout(resolve, STATUS_CHECK_INTERVAL));
    } catch (error) {
      console.error(`❌ Error in status monitor: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, STATUS_CHECK_INTERVAL));
    }
  }
}

// ============================================
// Express Server Setup
// ============================================

const app = express();
app.use(express.json());

/**
 * GET /sensor/status
 * Returns current sensor status
 */
app.get('/sensor/status', (req, res) => {
  const response = {
    status: 'ok',
    enabled: sensorEnabled,
    device_id: DEVICE_ID,
    sensor_id: SENSOR_ID,
    timestamp: Date.now() / 1000
  };
  res.json(response);
});

/**
 * GET /sensor/control
 * Controls sensor on/off
 */
app.get('/sensor/control', (req, res) => {
  const action = req.query.action;

  if (action === 'on') {
    sensorEnabled = true;
    console.log('✅ Sensor turned ON');
    res.json({ status: 'Sensor turned ON', enabled: true });
  } else if (action === 'off') {
    sensorEnabled = false;
    console.log('⏸️  Sensor turned OFF');
    res.json({ status: 'Sensor turned OFF', enabled: false });
  } else {
    res.status(400).json({ error: 'Invalid action. Use ?action=on or ?action=off' });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', sensor_enabled: sensorEnabled });
});

/**
 * Handle 404
 */
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ============================================
// Main Entry Point
// ============================================

async function main() {
  try {
    console.log('🚀 Initializing DHT11 Sensor Control...');
    console.log('ℹ️  This script only handles sensor on/off control');
    console.log('ℹ️  No sensor data will be sent to backend');

    // Register device IP with backend
    await registerDeviceIP();

    // Start Express HTTP server
    const server = app.listen(HTTP_PORT, '0.0.0.0', () => {
      console.log(`🌐 HTTP Server started on port ${HTTP_PORT}`);
      console.log('📍 Control Endpoints:');
      console.log(`   - GET http://localhost:${HTTP_PORT}/sensor/status`);
      console.log(`   - GET http://localhost:${HTTP_PORT}/sensor/control?action=on`);
      console.log(`   - GET http://localhost:${HTTP_PORT}/sensor/control?action=off`);
      console.log(`   - GET http://localhost:${HTTP_PORT}/health`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down gracefully...');
      server.close(() => {
        console.log('🔌 Cleaning up...');
        if (dhtSensor) {
          dhtSensor.uninitialized();
        }
        console.log('✅ Goodbye!');
        process.exit(0);
      });
    });

    // Run status monitor in background
    statusMonitorLoop().catch(error => {
      console.error(`❌ Fatal error in status monitor: ${error.message}`);
      process.exit(1);
    });

  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Start the application
main();
