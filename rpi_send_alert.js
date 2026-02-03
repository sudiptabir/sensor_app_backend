#!/usr/bin/env node

/**
 * 🚨 Alert Sender for Raspberry Pi (Node.js Version)
 * Sends alerts to Railway Alert API
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const RAILWAY_API_URL = "https://web-production-07eda.up.railway.app/api/alerts";
const DEVICE_ID_FILE = path.join(__dirname, 'device_id.txt');
const DEVICE_NAME = "raspberrypi";

/**
 * Read device ID from file
 */
function readDeviceId() {
  try {
    if (!fs.existsSync(DEVICE_ID_FILE)) {
      console.error(`❌ Error: device_id.txt not found at ${DEVICE_ID_FILE}`);
      process.exit(1);
    }
    
    const deviceId = fs.readFileSync(DEVICE_ID_FILE, 'utf8').trim();
    
    if (!deviceId) {
      console.error('❌ Error: device_id.txt is empty');
      process.exit(1);
    }
    
    return deviceId;
  } catch (error) {
    console.error('❌ Error reading device_id.txt:', error.message);
    process.exit(1);
  }
}

/**
 * Send HTTP request (GET or POST)
 */
function sendRequest(url, data, method = 'POST') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (method === 'POST' && data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (method === 'POST' && data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Send an alert to the Railway API
 */
async function sendAlert(deviceId, riskLevel = "Medium", description = "Test alert from Raspberry Pi") {
  const alertPayload = {
    deviceId: deviceId,
    alert: {
      notification_type: "Alert",
      detected_objects: ["test", "detection"],
      risk_label: riskLevel,
      predicted_risk: riskLevel,
      description: [description, `Sent from ${DEVICE_NAME}`],
      screenshot: [],
      device_identifier: DEVICE_NAME,
      timestamp: Date.now(),
      model_version: "v1.0",
      confidence_score: 0.85,
      additional_data: {
        test: true,
        source: "raspberry_pi",
        sent_at: new Date().toISOString()
      }
    }
  };

  try {
    console.log(`🚨 Sending ${riskLevel} alert...`);
    console.log(`📡 API URL: ${RAILWAY_API_URL}`);

    const response = await sendRequest(RAILWAY_API_URL, alertPayload);

    console.log(`✅ Response Status: ${response.status}`);

    if (response.status === 200) {
      console.log(`✅ Alert sent successfully!`);
      console.log(`📋 Alert IDs: ${JSON.stringify(response.data.alertIds)}`);
      console.log(`👥 Users notified: ${response.data.usersNotified}`);
      return true;
    } else {
      console.log(`❌ Error: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error sending alert: ${error.message}`);
    return false;
  }
}

/**
 * Test if the API is healthy
 */
async function testHealth() {
  const healthUrl = RAILWAY_API_URL.replace("/api/alerts", "/health");
  
  try {
    console.log(`🏥 Testing health endpoint...`);
    const response = await sendRequest(healthUrl, null, 'GET');

    if (response.status === 200) {
      console.log(`✅ API is healthy`);
      console.log(`   Firebase: ${response.data.firebase ? '✅ Connected' : '⚠️  Disabled'}`);
      return true;
    } else {
      console.log(`❌ Health check failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Health check failed: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const deviceId = readDeviceId();

  console.log("=".repeat(60));
  console.log("🚨 Raspberry Pi Alert Sender (Node.js)");
  console.log("=".repeat(60));
  console.log(`Device: ${DEVICE_NAME}`);
  console.log(`Device ID: ${deviceId}`);
  console.log(`API URL: ${RAILWAY_API_URL}`);
  console.log("=".repeat(60));
  console.log();

  // Test health first
  if (!(await testHealth())) {
    console.log("\n❌ API is not responding. Check your Railway URL and internet connection.");
    process.exit(1);
  }

  console.log("\n📤 Sending test alerts...");
  console.log("-".repeat(60));

  // Send different risk level alerts
  const alerts = [
    ["Low", "Low risk detection test"],
    ["Medium", "Medium risk detection test"],
    ["High", "High risk detection test"],
    ["Critical", "Critical risk detection test"]
  ];

  for (const [riskLevel, description] of alerts) {
    await sendAlert(deviceId, riskLevel, description);
    console.log();
    
    // Wait 2 seconds between alerts
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log("=".repeat(60));
  console.log("✅ Test complete!");
  console.log("📱 Check your mobile app for notifications");
  console.log("=".repeat(60));
}

// Run main function
main().catch(error => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
