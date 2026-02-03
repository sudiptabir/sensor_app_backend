#!/usr/bin/env node

/**
 * 🧪 Test Railway Alert API
 * Quick test to verify the deployed API is working
 */

const axios = require('axios');

// Replace with your actual Railway URL
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://alert-api-production-8d75.up.railway.app';
const USER_ID = process.env.USER_ID || 'test_user_123';
const DEVICE_ID = process.env.DEVICE_ID || 'raspberry_pi_001';

async function testRailwayAPI() {
  console.log('🚂 Testing Railway Alert API');
  console.log('============================');
  console.log(`🎯 API URL: ${RAILWAY_URL}`);
  console.log('');

  // Test 1: Health Check
  try {
    console.log('🏥 Testing health endpoint...');
    const healthResponse = await axios.get(`${RAILWAY_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);
    console.log('');
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return;
  }

  // Test 2: Send Test Alert
  try {
    console.log('🚨 Sending test alert...');
    
    const testAlert = {
      userId: USER_ID,
      deviceId: DEVICE_ID,
      alert: {
        notification_type: "Alert",
        detected_objects: ["person", "weapon"],
        risk_label: "Critical",
        predicted_risk: "Critical",
        description: ["Test alert from Railway deployment", "Weapon detected in restricted area"],
        screenshot: [],
        device_identifier: DEVICE_ID,
        timestamp: Date.now(),
        model_version: "v2.1.0",
        confidence_score: 0.95,
        additional_data: {
          test: true,
          source: "railway-test-script",
          location: "Test Zone"
        }
      }
    };

    const alertResponse = await axios.post(`${RAILWAY_URL}/api/alerts`, testAlert, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Alert sent successfully!');
    console.log('📋 Response:', alertResponse.data);
    console.log('');
    
    if (alertResponse.data.success) {
      console.log('🎉 SUCCESS! Your Railway Alert API is working perfectly!');
      console.log('📱 Check your mobile app for the notification');
    }

  } catch (error) {
    console.error('❌ Alert test failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

// Run the test
testRailwayAPI().catch(error => {
  console.error('💥 Test failed:', error.message);
  process.exit(1);
});