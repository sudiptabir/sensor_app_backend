#!/usr/bin/env node
/**
 * Cleanup script to remove dummy devices and users from Firestore
 * Run: node cleanup-dummy-firestore.js
 */

const admin = require('firebase-admin');
const fs = require('fs');

const DUMMY_DEVICE_IDS = ['rpi-001', 'rpi-002', 'rpi-003', 'rpi-004'];
const DUMMY_USER_IDS = ['user-001', 'user-002', 'user-003'];

async function cleanup() {
  try {
    console.log('🔥 Starting Firestore cleanup...\n');

    // Initialize Firebase
    const serviceAccountKey = JSON.parse(
      fs.readFileSync('./serviceAccountKey.json', 'utf8')
    );

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
      });
    }

    const db = admin.firestore();

    // Delete dummy devices
    console.log('🗑️  Deleting dummy devices from Firestore...');
    for (const deviceId of DUMMY_DEVICE_IDS) {
      try {
        // Delete all subcollections (readings, alerts)
        const readingsSnapshot = await db
          .collection('devices')
          .doc(deviceId)
          .collection('readings')
          .get();
        
        for (const doc of readingsSnapshot.docs) {
          await doc.ref.delete();
        }

        const alertsSnapshot = await db
          .collection('devices')
          .doc(deviceId)
          .collection('alerts')
          .get();
        
        for (const doc of alertsSnapshot.docs) {
          await doc.ref.delete();
        }

        // Delete device
        await db.collection('devices').doc(deviceId).delete();
        console.log(`  ✅ Deleted device: ${deviceId}`);
      } catch (error) {
        console.log(`  ⚠️  Device ${deviceId} not found or error: ${error.message}`);
      }
    }

    // Delete dummy users
    console.log('\n🗑️  Deleting dummy users from Firestore...');
    for (const userId of DUMMY_USER_IDS) {
      try {
        // Delete all subcollections (mlAlerts, etc)
        const mlAlertsSnapshot = await db
          .collection('users')
          .doc(userId)
          .collection('mlAlerts')
          .get();
        
        for (const doc of mlAlertsSnapshot.docs) {
          await doc.ref.delete();
        }

        // Delete user
        await db.collection('users').doc(userId).delete();
        console.log(`  ✅ Deleted user: ${userId}`);
      } catch (error) {
        console.log(`  ⚠️  User ${userId} not found or error: ${error.message}`);
      }
    }

    // Verify cleanup
    console.log('\n📊 Verification:');
    const devicesSnapshot = await db.collection('devices').get();
    console.log(`  Total devices: ${devicesSnapshot.size}`);

    const usersSnapshot = await db.collection('users').get();
    console.log(`  Total users: ${usersSnapshot.size}`);

    console.log('\n✅ Firestore cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

cleanup();
