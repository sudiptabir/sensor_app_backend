#!/usr/bin/env node
/**
 * Device Registration Test - Dual System Sync
 * Registers device in BOTH Firestore AND PostgreSQL (AWS Database)
 * 
 * Usage: node test_device_registration_dual_sync.js
 */

const admin = require('firebase-admin');
const { Pool } = require('pg');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

console.log('='.repeat(70));
console.log('🔥 DUAL-SYSTEM DEVICE REGISTRATION (Firestore + PostgreSQL)');
console.log('='.repeat(70));

async function runTest() {
  let pgClient;
  
  try {
    // ============================================
    // [1] Initialize Firebase
    // ============================================
    console.log('\n[1] Initializing Firebase...');
    const serviceAccountKey = JSON.parse(
      fs.readFileSync('./serviceAccountKey.json', 'utf8')
    );
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
      });
    }
    const db = admin.firestore();
    console.log('    ✅ Firebase initialized');
    
    // ============================================
    // [2] Connect to PostgreSQL
    // ============================================
    console.log('\n[2] Connecting to PostgreSQL...');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'sensor_db',
      user: process.env.DB_USER || 'sensor_admin',
      password: process.env.DB_PASSWORD || 'sensor_admin_pass123',
    });

    pgClient = await pool.connect();
    console.log('    ✅ Connected to PostgreSQL');

    // ============================================
    // [3] Gather device information
    // ============================================
    console.log('\n[3] Gathering device information...');
    const deviceId = uuidv4();
    const hostname = os.hostname();
    const platform = os.platform();
    const version = os.version();
    
    const deviceInfo = {
      deviceId: deviceId,
      label: hostname || `Device-${deviceId.substring(0, 8)}`,
      name: hostname || `Device-${deviceId.substring(0, 8)}`,
      platform: platform,
      version: version,
      status: 'connected',
      userId: null,  // Unassigned initially
      type: 'sensor_device',
    };
    
    console.log(`    Device ID: ${deviceId}`);
    console.log(`    Hostname: ${hostname}`);
    console.log(`    Platform: ${platform}`);

    // ============================================
    // [4] Register in Firestore
    // ============================================
    console.log('\n[4] Registering device in Firestore...');
    const firestoreData = {
      label: deviceInfo.label,
      userId: null,
      createdAt: admin.firestore.Timestamp.now(),
      lastSeen: admin.firestore.Timestamp.now(),
      type: deviceInfo.type,
      platform: deviceInfo.platform,
      version: deviceInfo.version,
    };

    await db.collection('devices').doc(deviceId).set(firestoreData);
    console.log(`    ✅ Device registered in Firestore: ${deviceId}`);

    // ============================================
    // [5] Register in PostgreSQL
    // ============================================
    console.log('\n[5] Registering device in PostgreSQL...');
    const insertQuery = `
      INSERT INTO devices (device_id, device_name, location, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (device_id) DO UPDATE
      SET device_name = EXCLUDED.device_name, 
          location = EXCLUDED.location,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      RETURNING device_id, device_name;
    `;

    const result = await pgClient.query(insertQuery, [
      deviceId,
      deviceInfo.label,
      hostname || 'Not specified',
      true // is_active
    ]);

    console.log(`    ✅ Device registered in PostgreSQL: ${deviceId}`);
    console.log(`    Device Name: ${result.rows[0].device_name}`);

    // ============================================
    // [6] Verify Firestore registration
    // ============================================
    console.log('\n[6] Verifying Firestore registration...');
    const firestoreDevice = await db.collection('devices').doc(deviceId).get();
    if (firestoreDevice.exists) {
      console.log('    ✅ Device verified in Firestore!');
      console.log('    Firestore data:');
      const data = firestoreDevice.data();
      for (const [key, value] of Object.entries(data)) {
        console.log(`      - ${key}: ${value}`);
      }
    } else {
      throw new Error('Device not found in Firestore');
    }

    // ============================================
    // [7] Verify PostgreSQL registration
    // ============================================
    console.log('\n[7] Verifying PostgreSQL registration...');
    const pgQuery = 'SELECT * FROM devices WHERE device_id = $1;';
    const pgResult = await pgClient.query(pgQuery, [deviceId]);

    if (pgResult.rows.length > 0) {
      console.log('    ✅ Device verified in PostgreSQL!');
      console.log('    PostgreSQL data:');
      const device = pgResult.rows[0];
      for (const [key, value] of Object.entries(device)) {
        console.log(`      - ${key}: ${value}`);
      }
    } else {
      throw new Error('Device not found in PostgreSQL');
    }

    // ============================================
    // [8] Test sensor reading submission
    // ============================================
    console.log('\n[8] Testing sensor reading in Firestore...');
    const readingData = {
      sensorType: 'temperature',
      value: 23.5,
      unit: 'celsius',
      timestamp: admin.firestore.Timestamp.now(),
      deviceId: deviceId,
    };
    
    const readingDoc = await db
      .collection('devices')
      .doc(deviceId)
      .collection('readings')
      .add(readingData);

    console.log(`    ✅ Sample reading submitted with ID: ${readingDoc.id}`);

    // ============================================
    // [9] Summary
    // ============================================
    console.log('\n' + '='.repeat(70));
    console.log('✅ REGISTRATION COMPLETE');
    console.log('='.repeat(70));
    console.log('\n📋 Device Summary:');
    console.log(`  Device ID: ${deviceId}`);
    console.log(`  Device Name: ${deviceInfo.label}`);
    console.log(`  Status: Ready for use`);
    console.log(`  Location: Firestore and PostgreSQL synced ✓`);
    console.log('\n💡 Next steps:');
    console.log(`  1. Open admin portal: http://13.205.201.82/`);
    console.log(`  2. Login with admin/admin123`);
    console.log(`  3. Check Devices tab - your device should appear`);
    console.log(`  4. You can now restrict/allow this device`);
    console.log('\n' + '='.repeat(70) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Registration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (pgClient) {
      pgClient.release();
    }
  }
}

runTest();
