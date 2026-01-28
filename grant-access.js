#!/usr/bin/env node
/**
 * Grant device access to a user via admin portal API
 */

const https = require('https');

const ADMIN_PORTAL_URL = 'https://sensorappbackend-production.up.railway.app';

// Get parameters from command line
const userId = process.argv[2];
const deviceId = process.argv[3] || '192b7a8c-972d-4429-ac28-4bc73e9a8809'; // Default LAPTOP device
const accessLevel = process.argv[4] || 'full_access';

if (!userId) {
  console.log('❌ Usage: node grant-access.js <userId> [deviceId] [accessLevel]');
  console.log('\nExample:');
  console.log('  node grant-access.js GKu2p6uvarhEzrKG85D7fXbxUh23');
  console.log('  node grant-access.js GKu2p6uvarhEzrKG85D7fXbxUh23 192b7a8c-972d-4429-ac28-4bc73e9a8809 full_access');
  process.exit(1);
}

const accessData = {
  userId,
  deviceId,
  accessLevel, // 'viewer', 'read_only', or 'full_access'
  grantedBy: 'admin@sensor.com'
};

console.log('🔐 Granting device access...');
console.log(`👤 User ID: ${userId}`);
console.log(`📱 Device ID: ${deviceId}`);
console.log(`🔑 Access Level: ${accessLevel}`);

const data = JSON.stringify(accessData);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'x-api-key': 'production-api-key-123456'
  }
};

const req = https.request(`${ADMIN_PORTAL_URL}/api/access-control/grant`, options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('\n📊 Response:');
    console.log(responseData);
    
    if (res.statusCode === 200) {
      console.log('\n✅ Access granted successfully!');
      console.log(`\n👤 User ${userId} can now access device ${deviceId}`);
    } else {
      console.log(`\n❌ Failed with status: ${res.statusCode}`);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(data);
req.end();
