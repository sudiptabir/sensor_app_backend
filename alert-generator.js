#!/usr/bin/env node

/**
 * 🚨 Alert Generator Script
 * Generates realistic alerts and sends them to the API backend
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const API_ENDPOINT = process.env.ALERT_API_URL || 'https://your-railway-url.railway.app/api/alerts';
const DEVICE_ID = process.env.DEVICE_ID || 'device_001';
const USER_ID = process.env.USER_ID || 'test_user_123';

// Alert templates for realistic scenarios
const ALERT_TEMPLATES = [
  {
    notification_type: "Critical",
    detected_objects: ["person", "weapon"],
    risk_label: "Critical",
    predicted_risk: "Critical",
    description: ["Weapon detected in restricted area", "Immediate security response required"],
    confidence_score: 0.95
  },
  {
    notification_type: "Alert",
    detected_objects: ["person", "unauthorized_access"],
    risk_label: "High",
    predicted_risk: "High", 
    description: ["Unauthorized person detected", "Access control breach detected"],
    confidence_score: 0.87
  },
  {
    notification_type: "Warning",
    detected_objects: ["vehicle", "speeding"],
    risk_label: "Medium",
    predicted_risk: "Medium",
    description: ["Vehicle exceeding speed limit", "Traffic violation detected"],
    confidence_score: 0.78
  },
  {
    notification_type: "Alert",
    detected_objects: ["fire", "smoke"],
    risk_label: "Critical",
    predicted_risk: "Critical",
    description: ["Fire hazard detected", "Emergency evacuation may be required"],
    confidence_score: 0.92
  },
  {
    notification_type: "Warning",
    detected_objects: ["person", "loitering"],
    risk_label: "Low",
    predicted_risk: "Low",
    description: ["Person loitering in area", "Monitoring suspicious behavior"],
    confidence_score: 0.65
  },
  {
    notification_type: "Alert",
    detected_objects: ["package", "unattended"],
    risk_label: "Medium",
    predicted_risk: "Medium",
    description: ["Unattended package detected", "Potential security concern"],
    confidence_score: 0.73
  }
];

/**
 * Generate a random alert based on templates
 */
function generateAlert() {
  const template = ALERT_TEMPLATES[Math.floor(Math.random() * ALERT_TEMPLATES.length)];
  
  return {
    notification_type: template.notification_type,
    detected_objects: template.detected_objects,
    risk_label: template.risk_label,
    predicted_risk: template.predicted_risk,
    description: template.description,
    screenshot: [], // Empty for now, could add base64 images
    device_identifier: DEVICE_ID,
    timestamp: Date.now(),
    model_version: "v2.1.0",
    confidence_score: template.confidence_score + (Math.random() * 0.1 - 0.05), // Add slight variation
    additional_data: {
      alert_id: crypto.randomUUID(),
      location: "Zone A - Main Entrance",
      camera_id: "cam_001",
      generated_by: "alert-generator-script"
    }
  };
}

/**
 * Send alert to API backend
 */
async function sendAlert(alertData) {
  try {
    console.log('🚨 Generating alert:', {
      type: alertData.notification_type,
      risk: alertData.risk_label,
      objects: alertData.detected_objects.join(', '),
      confidence: alertData.confidence_score.toFixed(2)
    });

    const response = await axios.post(API_ENDPOINT, {
      userId: USER_ID,
      deviceId: DEVICE_ID,
      alert: alertData
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_KEY || 'test-key'}`
      },
      timeout: 10000
    });

    console.log('✅ Alert sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending alert:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

/**
 * Generate and send multiple alerts
 */
async function generateMultipleAlerts(count = 1, interval = 2000) {
  console.log(`🎯 Generating ${count} alert(s) with ${interval}ms interval`);
  console.log(`📡 API Endpoint: ${API_ENDPOINT}`);
  console.log(`🔧 Device ID: ${DEVICE_ID}`);
  console.log(`👤 User ID: ${USER_ID}`);
  console.log('---');

  for (let i = 0; i < count; i++) {
    try {
      const alert = generateAlert();
      await sendAlert(alert);
      
      if (i < count - 1) {
        console.log(`⏳ Waiting ${interval}ms before next alert...`);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } catch (error) {
      console.error(`❌ Failed to send alert ${i + 1}/${count}`);
    }
  }

  console.log('🏁 Alert generation complete');
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);
  const count = parseInt(args[0]) || 1;
  const interval = parseInt(args[1]) || 2000;

  console.log('🚨 Alert Generator Script');
  console.log('========================');

  try {
    await generateMultipleAlerts(count, interval);
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
}

// Export functions for programmatic use
module.exports = {
  generateAlert,
  sendAlert,
  generateMultipleAlerts
};

// Run if called directly
if (require.main === module) {
  main();
}