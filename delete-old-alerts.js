#!/usr/bin/env node

/**
 * Delete All Old Alerts
 * Removes all alerts from Firestore to prevent notification spam
 */

const admin = require('firebase-admin');

// Initialize Firebase
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath))
  });
  console.log('✅ Firebase initialized');
} catch (err) {
  console.error('❌ Firebase init error:', err.message);
  process.exit(1);
}

const db = admin.firestore();

async function deleteAllAlerts() {
  console.log('\n🗑️  Deleting All Old Alerts');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let totalDeleted = 0;

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`\n📋 Found ${usersSnapshot.size} users`);

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`\n👤 Processing user: ${userId}`);

      // Delete mlAlerts subcollection
      const mlAlertsRef = db.collection('users').doc(userId).collection('mlAlerts');
      const mlAlertsSnapshot = await mlAlertsRef.get();
      
      if (!mlAlertsSnapshot.empty) {
        console.log(`   Found ${mlAlertsSnapshot.size} ML alerts`);
        
        // Batch delete in chunks of 500 (Firestore limit)
        const batch = db.batch();
        let batchCount = 0;
        
        for (const alertDoc of mlAlertsSnapshot.docs) {
          batch.delete(alertDoc.ref);
          batchCount++;
          totalDeleted++;
          
          if (batchCount >= 500) {
            await batch.commit();
            console.log(`   Deleted batch of ${batchCount} alerts...`);
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
          console.log(`   ✅ Deleted ${batchCount} ML alerts`);
        }
      } else {
        console.log(`   No ML alerts found`);
      }
    }

    // Also check for device-level alerts
    const devicesSnapshot = await db.collection('devices').get();
    console.log(`\n📱 Found ${devicesSnapshot.size} devices`);

    for (const deviceDoc of devicesSnapshot.docs) {
      const deviceId = deviceDoc.id;
      console.log(`\n🔧 Processing device: ${deviceId}`);

      // Delete alerts subcollection
      const alertsRef = db.collection('devices').doc(deviceId).collection('alerts');
      const alertsSnapshot = await alertsRef.get();
      
      if (!alertsSnapshot.empty) {
        console.log(`   Found ${alertsSnapshot.size} device alerts`);
        
        const batch = db.batch();
        let batchCount = 0;
        
        for (const alertDoc of alertsSnapshot.docs) {
          batch.delete(alertDoc.ref);
          batchCount++;
          totalDeleted++;
          
          if (batchCount >= 500) {
            await batch.commit();
            console.log(`   Deleted batch of ${batchCount} alerts...`);
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
          console.log(`   ✅ Deleted ${batchCount} device alerts`);
        }
      } else {
        console.log(`   No device alerts found`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 SUCCESS! Deleted ${totalDeleted} total alerts`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (totalDeleted === 0) {
      console.log('ℹ️  No alerts found to delete');
    } else {
      console.log('✅ Your app should no longer show old notifications');
      console.log('🔄 Restart your mobile app to see the changes\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error deleting alerts:', error);
    console.error('Details:', error.message);
    process.exit(1);
  }
}

// Confirm before deleting
console.log('\n⚠️  WARNING: This will delete ALL alerts from Firestore!');
console.log('Press Ctrl+C within 3 seconds to cancel...\n');

setTimeout(() => {
  deleteAllAlerts();
}, 3000);
