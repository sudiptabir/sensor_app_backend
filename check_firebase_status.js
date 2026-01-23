#!/usr/bin/env node
/**
 * Firebase Connection & Configuration Status Checker
 * Verifies your Firebase setup without requiring write permissions
 */

const admin = require('firebase-admin');
const fs = require('fs');

console.log('='.repeat(70));
console.log('🔍 FIREBASE CONNECTION & CONFIGURATION STATUS CHECKER');
console.log('='.repeat(70));

async function checkStatus() {
  try {
    // Check 1: Verify serviceAccountKey.json exists
    console.log('\n[1] Checking serviceAccountKey.json...');
    if (!fs.existsSync('./serviceAccountKey.json')) {
      throw new Error('serviceAccountKey.json not found!');
    }
    console.log('    ✅ File exists');
    
    // Check 2: Verify JSON is valid
    console.log('\n[2] Validating JSON format...');
    let serviceAccountKey;
    try {
      serviceAccountKey = JSON.parse(
        fs.readFileSync('./serviceAccountKey.json', 'utf8')
      );
      console.log('    ✅ Valid JSON');
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
    
    // Check 3: Verify required fields
    console.log('\n[3] Checking required fields...');
    const requiredFields = [
      'type',
      'project_id',
      'private_key_id',
      'private_key',
      'client_email',
      'client_id',
    ];
    
    for (const field of requiredFields) {
      if (!serviceAccountKey[field]) {
        throw new Error(`Missing field: ${field}`);
      }
    }
    console.log('    ✅ All required fields present');
    
    // Check 4: Display credential info
    console.log('\n[4] Credential Information:');
    console.log(`    Service Account: ${serviceAccountKey.client_email}`);
    console.log(`    Project ID: ${serviceAccountKey.project_id}`);
    console.log(`    Auth Provider: ${serviceAccountKey.auth_provider_x509_cert_url}`);
    
    // Check 5: Initialize Firebase
    console.log('\n[5] Initializing Firebase Admin SDK...');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        projectId: serviceAccountKey.project_id,
      });
    }
    console.log('    ✅ Firebase initialized successfully');
    
    // Check 6: Connect to Firestore
    console.log('\n[6] Connecting to Firestore...');
    const db = admin.firestore();
    console.log('    ✅ Firestore client created');
    
    // Check 7: Test read operation (doesn't require permissions)
    console.log('\n[7] Testing Firestore read permission...');
    try {
      const docRef = db.collection('_metadata').doc('test');
      const doc = await docRef.get();
      console.log('    ✅ Read operation successful');
      console.log(`       (Document exists: ${doc.exists})`);
    } catch (readError) {
      if (readError.message.includes('PERMISSION_DENIED')) {
        console.log('    ⚠️  Read permission denied (this is normal)');
      } else {
        throw readError;
      }
    }
    
    // Check 8: Firestore info
    console.log('\n[8] Firestore Configuration:');
    console.log(`    Project: ${serviceAccountKey.project_id}`);
    console.log(`    Database: (default)`);
    
    // Check 9: Configuration files
    console.log('\n[9] Configuration Files:');
    const configFiles = [
      { name: 'firebaseConfig.js', path: './sensor_app/firebase/firebaseConfig.js' },
      { name: 'firestore.rules', path: './firestore.rules' },
      { name: 'firebase.json', path: './firebase.json' },
      { name: '.firebaserc', path: './.firebaserc' },
    ];
    
    for (const file of configFiles) {
      const exists = fs.existsSync(file.path);
      console.log(`    ${exists ? '✅' : '❌'} ${file.name}`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ FIREBASE CONNECTION VERIFIED');
    console.log('='.repeat(70));
    console.log('\n📋 Status Summary:');
    console.log('  ✅ Service account credentials valid');
    console.log('  ✅ Firebase Admin SDK initialized');
    console.log('  ✅ Connected to Firestore');
    console.log('  ⏳ Write permissions: UNKNOWN (requires actual write test)');
    console.log('\n💡 To test device registration with write permissions:');
    console.log('   node test_device_registration.js');
    console.log('\n⚠️  If device registration fails with permission error:');
    console.log('   1. Check Google Cloud IAM permissions for service account');
    console.log('   2. Ensure Editor role is assigned');
    console.log('   3. See TROUBLESHOOTING_PERMISSIONS.md for more help');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\n📋 Troubleshooting:');
    console.error('  1. Verify serviceAccountKey.json exists and is valid');
    console.error('  2. Ensure JSON file is properly formatted');
    console.error('  3. Check project ID matches Firebase project');
    console.error('  4. Verify internet connection');
    console.error('\nFull error details:');
    console.error(error);
    process.exit(1);
  }
}

checkStatus();
