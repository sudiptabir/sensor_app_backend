#!/usr/bin/env node
/**
 * 🤖 Sensor Test Data Generator
 * Generates realistic test data for sensors and streams to backend
 * 
 * Usage: node sensor-test-generator.js --continuous --interval=5000
 */

const http = require('http');
const https = require('https');
const fs = require('fs');

// ============================================
// Configuration
// ============================================
const urlArg = process.argv.find(arg => arg.startsWith('http://') || arg.startsWith('https://'));
const API_BASE = urlArg || process.env.API_URL || 'http://192.168.43.211:3000';
const CONTINUOUS = process.argv.includes('--continuous') || process.argv.includes('--burst');
const INTERVAL = parseInt(
  process.argv
    .find(arg => arg.startsWith('--interval='))
    ?.split('=')[1] || '5000'
);

// ============================================
// Helper Functions
// ============================================

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const protocol = url.protocol === 'https:' ? https : http;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = protocol.request(url, options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch {
          resolve(responseData);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// ============================================
// Test Data Functions
// ============================================

function generateTemperature() {
  // Normal distribution around 22°C with some variation
  return 22 + (Math.random() - 0.5) * 10;
}

function generateHumidity() {
  // Normal distribution around 60%
  return Math.max(0, Math.min(100, 60 + (Math.random() - 0.5) * 20));
}

function generatePressure() {
  // Normal distribution around 1013 hPa
  return 1013 + (Math.random() - 0.5) * 20;
}

function generateCPUUsage() {
  // Tends to be lower with occasional spikes
  if (Math.random() < 0.1) return Math.random() * 100; // Spike
  return Math.random() * 30; // Normal usage
}

function generateMemoryUsage() {
  // Gradually increases then resets
  return 30 + Math.random() * 40;
}

function generateWindSpeed() {
  // Breezy with occasional gusts
  if (Math.random() < 0.15) return Math.random() * 100; // Gust
  return Math.random() * 25; // Normal wind
}

function generateRainfall() {
  // Usually 0, occasionally rain
  if (Math.random() < 0.9) return 0;
  return Math.random() * 10;
}

// ============================================
// Main Test Scenarios
// ============================================

async function runTests() {
  console.log(`
╔════════════════════════════════════════════════════════╗
║       🤖 Sensor Test Data Generator                   ║
║                                                        ║
║  API Base: ${API_BASE}                       ║
║  Mode: ${CONTINUOUS ? 'CONTINUOUS' : 'ONE-TIME'}                           ║
║  Interval: ${INTERVAL}ms                             ║
╚════════════════════════════════════════════════════════╝
  `);

  try {
    // Step 1: Get existing sensors
    console.log('\n📊 Fetching existing sensors...');
    const allSensors = await makeRequest('GET', '/api/sensors');
    
    if (!allSensors || allSensors.length === 0) {
      console.log('❌ No sensors found. Please run schema setup first.');
      process.exit(1);
    }
    
    console.log(`✅ Found ${allSensors.length} existing sensors`);

    // Create sensor ID mapping from existing sensors
    // Use the LATEST (highest sensor_id) for each device+type combination
    const sensorMap = {};
    allSensors.forEach((sensor) => {
      if (sensor && sensor.sensor_id) {
        const key = `${sensor.device_id}_${sensor.sensor_type}`;
        // Keep the highest sensor_id (newest)
        if (!sensorMap[key] || sensor.sensor_id > sensorMap[key]) {
          sensorMap[key] = sensor.sensor_id;
        }
      }
    });

    // Debug: show sensor mapping
    console.log('\n🗺️  Sensor Mapping (LAPTOP sensors only):');
    console.log('LAPTOP_temperature =>', sensorMap['192b7a8c-972d-4429-ac28-4bc73e9a8809_temperature']);
    console.log('LAPTOP_memory =>', sensorMap['192b7a8c-972d-4429-ac28-4bc73e9a8809_memory']);
    console.log('LAPTOP_pressure =>', sensorMap['192b7a8c-972d-4429-ac28-4bc73e9a8809_pressure']);
    console.log('LAPTOP_humidity =>', sensorMap['192b7a8c-972d-4429-ac28-4bc73e9a8809_humidity']);
    console.log('LAPTOP_rainfall =>', sensorMap['192b7a8c-972d-4429-ac28-4bc73e9a8809_rainfall']);

    // Step 2: Generate test readings
    console.log('\n📈 Generating test readings...');

    const generateReadingBatch = async () => {
      const readings = [
        // LAPTOP device - CPU Temp, Memory, Disk, GPU Temp, Battery sensors
        { sensor_id: sensorMap['192b7a8c-972d-4429-ac28-4bc73e9a8809_temperature'], value: 40 + Math.random() * 30 },
        { sensor_id: sensorMap['192b7a8c-972d-4429-ac28-4bc73e9a8809_memory'], value: generateMemoryUsage() },
        { sensor_id: sensorMap['192b7a8c-972d-4429-ac28-4bc73e9a8809_pressure'], value: 30 + Math.random() * 50 },
        { sensor_id: sensorMap['192b7a8c-972d-4429-ac28-4bc73e9a8809_humidity'], value: 30 + Math.random() * 40 },
        { sensor_id: sensorMap['192b7a8c-972d-4429-ac28-4bc73e9a8809_rainfall'], value: 80 + Math.random() * 20 },
      ].filter(r => r.sensor_id); // Only send if sensor ID exists

      try {
        if (readings.length === 0) {
          console.error('❌ No valid sensor mappings found');
          return;
        }
        
        await makeRequest('POST', '/api/readings/batch', { readings });
        
        // Display current values
        console.log(`\n⏱️  ${new Date().toLocaleTimeString()}`);
        readings.forEach(r => {
          const sensorKey = Object.keys(sensorMap).find(key => sensorMap[key] === r.sensor_id);
          const sensorType = sensorKey ? sensorKey.split('_').slice(1).join('_') : 'Unknown';
          console.log(`  📊 ${sensorType}: ${r.value.toFixed(2)}`);
        });
      } catch (error) {
        console.error('❌ Error sending readings:', error.message);
      }
    };

    // Initial batch
    await generateReadingBatch();

    // Continuous mode
    if (CONTINUOUS) {
      console.log(`\n🔄 Continuous mode enabled. Sending data every ${INTERVAL}ms...`);
      console.log('Press Ctrl+C to stop\n');

      setInterval(generateReadingBatch, INTERVAL);
    } else {
      console.log('\n✅ Test complete! Use --continuous flag for continuous data generation');
      console.log(`   Example: node sensor-test-generator.js --continuous --interval=5000`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// ============================================
// Run Tests
// ============================================

runTests();
