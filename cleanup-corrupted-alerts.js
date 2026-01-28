#!/usr/bin/env node

/**
 * Clean up corrupted alerts with device IDs
 * These are invalid alert entries that got mixed in
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

// List of device IDs (corrupt alert IDs to delete)
const CORRUPT_ALERT_IDS = [
  '192b7a8c-972d-4429-ac28-4bc73e9a8809',
  '3d49c55d-bbfd-4bd0-9663-8728d64743ac'
];

async function cleanupCorruptedAlerts() {
  console.log('\n🧹 Cleaning up corrupted alerts...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let totalDeleted = 0;

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`\n📋 Checking ${usersSnapshot.size} users for corrupted alerts`);

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const mlAlertsRef = db.collection('users').doc(userId).collection('mlAlerts');
      
      for (const corruptId of CORRUPT_ALERT_IDS) {
        const docRef = mlAlertsRef.doc(corruptId);
        const docSnapshot = await docRef.get();
        
        if (docSnapshot.exists) {
          console.log(`   Found corrupted alert: ${corruptId} in user: ${userId}`);
          await docRef.delete();
          totalDeleted++;
          console.log(`   ✅ Deleted corrupted alert: ${corruptId}`);
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 SUCCESS! Deleted ${totalDeleted} corrupted alerts`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (totalDeleted === 0) {
      console.log('ℹ️  No corrupted alerts found');
    } else {
      console.log('✅ Your app should now work correctly\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error cleaning up:', error);
    console.error('Details:', error.message);
    process.exit(1);
  }
}

console.log('\n⚠️  This will delete corrupted alert entries (device IDs used as alert IDs)');
console.log('Press Ctrl+C within 3 seconds to cancel...\n');

setTimeout(() => {
  cleanupCorruptedAlerts();
}, 3000);
