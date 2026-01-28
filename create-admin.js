#!/usr/bin/env node
/**
 * Create first admin user for Railway admin portal
 */

const https = require('https');

const ADMIN_PORTAL_URL = 'https://sensorappbackend-production.up.railway.app';
const SETUP_KEY = process.env.SETUP_KEY || 'initial-setup-123';

const adminData = {
  email: 'admin@sensor.com',
  password: 'Admin123!',
  fullName: 'Admin User',
  setupKey: SETUP_KEY
};

console.log('🔐 Creating admin user...');
console.log(`📧 Email: ${adminData.email}`);
console.log(`🔑 Setup Key: ${SETUP_KEY}`);

const data = JSON.stringify(adminData);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(`${ADMIN_PORTAL_URL}/api/setup/create-admin`, options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('\n📊 Response:');
    console.log(responseData);
    
    if (res.statusCode === 200) {
      console.log('\n✅ Admin user created successfully!');
      console.log('\n📝 Login credentials:');
      console.log(`   Email: ${adminData.email}`);
      console.log(`   Password: ${adminData.password}`);
      console.log(`\n🌐 Login at: ${ADMIN_PORTAL_URL}`);
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
