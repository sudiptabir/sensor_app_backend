#!/usr/bin/env node

/**
 * 🧪 Test Alert System
 * Quick test script to verify the alert system is working
 */

const axios = require('axios');

const API_URL = process.env.ALERT_API_URL || 'http://localhost:3001';
const USER_ID = process.env.USER_ID || 'test_user_123';
const DEVICE_ID = process.env.DEVICE_ID || 'test_device_001';

async function testHealthCheck() {
  console.log('🏥 Testing health check...');
  try {
    const response = await axios.get(`${API_URL}/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testAlertEndpoint() {
  console.log('🚨 Testing alert endpoint...');
  
  const testAlert = {
    userId: USER_ID,
    deviceId: DEVICE_ID,
    alert: {
      notification_type: "Alert",
      detected_objects: ["person", "test"],
      risk_label: "Medium",
      predicted_risk: "Medium",
      description: ["This is a test alert from the test script"],
      screenshot: [],
      device_identifier: DEVICE_ID,
      timestamp: Date.now(),
      model_version: "test-v1.0",
      confidence_score: 0.85,
      additional_data: {
        test: true,
        generated_by: "test-script"
      }
    }
  };

  try {
    const response = await axios.post(`${API_URL}/api/alerts`, testAlert, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Alert endpoint test passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Alert endpoint test failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return false;
  }
}

async function testStats() {
  console.log('📊 Testing stats endpoint...');
  try {
    const response = await axios.get(`${API_URL}/api/stats`);
    console.log('✅ Stats endpoint passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Stats endpoint failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 Alert System Test Suite');
  console.log('===========================');
  console.log(`🎯 Testing API at: ${API_URL}`);
  console.log(`👤 User ID: ${USER_ID}`);
  console.log(`🔧 Device ID: ${DEVICE_ID}`);
  console.log('');

  const results = {
    health: false,
    stats: false,
    alert: false
  };

  // Test health check
  results.health = await testHealthCheck();
  console.log('');

  // Test stats
  results.stats = await testStats();
  console.log('');

  // Test alert endpoint
  results.alert = await testAlertEndpoint();
  console.log('');

  // Summary
  console.log('📋 Test Results Summary');
  console.log('=======================');
  console.log(`🏥 Health Check: ${results.health ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📊 Stats Endpoint: ${results.stats ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🚨 Alert Endpoint: ${results.alert ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result);
  console.log('');
  console.log(`🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('🎉 Alert system is working correctly!');
    console.log('💡 You can now use the alert generator to send alerts to your mobile app.');
  } else {
    console.log('🔧 Please check the server logs and fix any issues before proceeding.');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
});