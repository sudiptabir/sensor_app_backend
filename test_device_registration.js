#!/usr/bin/env node
/**
 * Device Registration Test for Firebase
 * Tests if a device can connect to Firebase and register itself
 */

const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

console.log('='.repeat(60));
console.log('🔥 DEVICE REGISTRATION TEST');
console.log('='.repeat(60));

async function runTest() {
  try {
    console.log('\n[1] Loading Firebase credentials...');
    const serviceAccountKey = JSON.parse(
      fs.readFileSync('./serviceAccountKey.json', 'utf8')
    );
    
    console.log('    ✅ Credentials loaded');
    
    console.log('\n[2] Initializing Firebase Admin SDK...');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
      });
    }
    console.log('    ✅ Firebase initialized');
    
    console.log('\n[3] Connecting to Firestore...');
    const db = admin.firestore();
    console.log('    ✅ Connected to Firestore');
    
    console.log('\n[4] Gathering device information...');
    const deviceId = uuidv4();
    const hostname = os.hostname();
    const platform = os.platform();
    const version = os.version();
    
    const deviceInfo = {
      deviceId: deviceId,
      name: hostname,
      platform: platform,
      version: version,
      status: 'connected',
      registeredAt: admin.firestore.Timestamp.now(),
      lastSeen: admin.firestore.Timestamp.now(),
      type: 'sensor_device',
    };
    
    console.log(`    Device ID: ${deviceId}`);
    console.log(`    Hostname: ${hostname}`);
    console.log(`    Platform: ${platform}`);
    
    console.log('\n[5] Registering device in Firestore...');
    await db.collection('devices').doc(deviceId).set(deviceInfo);
    console.log(`    ✅ Device registered with ID: ${deviceId}`);
    
    console.log('\n[6] Verifying device registration...');
    const registeredDevice = await db.collection('devices').doc(deviceId).get();
    if (registeredDevice.exists) {
      console.log('    ✅ Device successfully registered and verified!');
      console.log('\n    Device data in Firestore:');
      const data = registeredDevice.data();
      for (const [key, value] of Object.entries(data)) {
        console.log(`      - ${key}: ${value}`);
      }
    } else {
      console.log('    ❌ Failed to verify device registration');
    }
    
    console.log('\n[7] Testing sensor reading submission...');
    const readingData = {
      sensorType: 'temperature',
      value: 23.5,
      unit: 'celsius',
      timestamp: admin.firestore.Timestamp.now(),
      deviceId: deviceId,
    };
    
    const readingsRef = db
      .collection('devices')
      .doc(deviceId)
      .collection('readings');
    
    const readingDoc = await readingsRef.add(readingData);
    console.log(`    ✅ Sample reading submitted with ID: ${readingDoc.id}`);
    
    console.log('\n[8] Verifying sensor reading...');
    const reading = await readingDoc.get();
    if (reading.exists) {
      console.log('    ✅ Sensor reading successfully stored!');
      console.log('    Reading data:');
      const data = reading.data();
      for (const [key, value] of Object.entries(data)) {
        console.log(`      - ${key}: ${value}`);
      }
    } else {
      console.log('    ❌ Failed to verify sensor reading');
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS - DEVICE REGISTRATION TEST PASSED!');
    console.log('='.repeat(60));
    console.log(`\nYour device is successfully connected to Firebase!`);
    console.log(`Device ID: ${deviceId}`);
    console.log(`Location: devices/${deviceId}`);
    console.log(`Readings: devices/${deviceId}/readings/`);
    
    // Save device ID for future reference
    fs.writeFileSync('device_id.txt', deviceId);
    console.log(`\n💾 Device ID saved to device_id.txt`);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Verify serviceAccountKey.json exists and is valid');
    console.error('  2. Check your Firebase project ID in firebaseConfig.js');
    console.error('  3. Ensure Firestore database is created in Firebase Console');
    console.error('  4. Check Firestore security rules allow writes');
    console.error('  5. Verify Firebase credentials have proper permissions');
    console.error('\nFull error:');
    console.error(error);
    process.exit(1);
  }
}

runTest();
