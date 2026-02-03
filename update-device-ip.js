/**
 * Update device IP address in Firestore
 */

const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const DEVICE_ID = '192b7a8c-972d-4429-ac28-4bc73e9a8809';
const IP_ADDRESS = '192.168.43.211'; // Your Windows laptop IP

async function updateDeviceIP() {
  try {
    console.log(`\n🔧 Updating device ${DEVICE_ID}...`);
    console.log(`📍 New IP: ${IP_ADDRESS}\n`);

    await db.collection('devices').doc(DEVICE_ID).update({
      ipAddress: IP_ADDRESS,
      ip_address: IP_ADDRESS, // Add both variants for compatibility
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      cameraEnabled: true,
      cameraUrl: `http://${IP_ADDRESS}:3000/camera/frame`
    });

    console.log('✅ Device IP address updated successfully!');
    console.log(`\n📱 In your app, tap the camera icon on this device to view the stream.\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating device:', error.message);
    process.exit(1);
  }
}

updateDeviceIP();
