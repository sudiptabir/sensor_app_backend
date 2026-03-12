#!/usr/bin/env node

/**
 * 🚨 Alert Sender for Raspberry Pi (Node.js Version)
 * Sends alerts to Alert API and checks access via Admin Portal
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Configuration
const ALERT_API_URL =
  process.env.ALERT_API_URL ||
  process.env.RAILWAY_API_URL ||
  "https://alert-api-production-dc04.up.railway.app/api/alerts";

const ADMIN_PORTAL_URL = process.env.ADMIN_PORTAL_URL || 'http://localhost:4000';
const API_KEY = process.env.API_KEY || process.env.ADMIN_API_KEY || 'test-api-key-123';
const CHECK_ACCESS_BEFORE_SEND = (process.env.CHECK_ACCESS_BEFORE_SEND || 'true').toLowerCase() !== 'false';
const DEVICE_ID_FILE = path.join(__dirname, 'device_id.txt');
const DEVICE_NAME = "raspberrypi";
// ⚠️  IMPORTANT: Replace with your Firebase user ID (the admin/test user)
const USER_ID = process.env.ALERT_USER_ID || "GKu2p6uvarhEzrKG85D7fXbxUh23";

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
function sendRequest(url, data, method = 'POST', extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000,
    };

    options.headers = { ...options.headers, ...extraHeaders };

    if (method === 'POST' && data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = client.request(options, (res) => {
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

    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });

    if (method === 'POST' && data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Check whether user has access to the device via Admin Portal.
 */
async function checkDeviceAccess(userId, deviceId) {
  const url = `${ADMIN_PORTAL_URL}/api/check-access/${encodeURIComponent(userId)}/${encodeURIComponent(deviceId)}`;

  try {
    const response = await sendRequest(url, null, 'GET', {
      'X-API-Key': API_KEY,
    });

    if (response.status !== 200 || typeof response.data !== 'object') {
      return {
        reachable: false,
        hasAccess: true,
        reason: `Unexpected admin portal response: HTTP ${response.status}`,
      };
    }

    return {
      reachable: true,
      hasAccess: response.data.hasAccess !== false,
      accessLevel: response.data.accessLevel || 'default',
      reason: response.data.reason || null,
      details: response.data.details || null,
    };
  } catch (error) {
    return {
      reachable: false,
      hasAccess: true,
      reason: `Admin portal check failed: ${error.message}`,
    };
  }
}

/**
 * Send an alert to the Alert API
 */
async function sendAlert(deviceId, riskLevel = "Medium", description = "Test alert from Raspberry Pi") {
  const alertPayload = {
    userId: USER_ID,        // ← REQUIRED: Firebase user ID
    deviceId: deviceId,     // ← REQUIRED: Device identifier
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
    console.log(`📡 API URL: ${ALERT_API_URL}`);

    const response = await sendRequest(ALERT_API_URL, alertPayload);

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
  const healthUrl = ALERT_API_URL.replace("/api/alerts", "/health");
  
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
  console.log(`User ID: ${USER_ID}`);
  console.log(`Alert API URL: ${ALERT_API_URL}`);
  console.log(`Admin Portal URL: ${ADMIN_PORTAL_URL}`);
  console.log(`Access precheck: ${CHECK_ACCESS_BEFORE_SEND ? 'enabled' : 'disabled'}`);
  console.log("=".repeat(60));
  console.log();

  if (CHECK_ACCESS_BEFORE_SEND) {
    console.log('🔐 Checking user/device access via admin portal...');
    const access = await checkDeviceAccess(USER_ID, deviceId);

    if (!access.reachable) {
      console.warn(`⚠️  ${access.reason}`);
      console.warn('⚠️  Continuing in fail-open mode; alert API will do final block checks.');
    } else if (!access.hasAccess) {
      console.error('🚫 Access denied by admin portal. Alerts will not be sent.');
      console.error(`   Reason: ${access.reason || 'No access'}`);
      if (access.details) {
        console.error(`   Details: ${access.details}`);
      }
      process.exit(1);
    } else {
      console.log(`✅ Access granted (level: ${access.accessLevel || 'default'})`);
    }

    console.log();
  }

  // Test health first
  if (!(await testHealth())) {
    console.log("\n❌ Alert API is not responding. Check ALERT_API_URL and internet connection.");
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
