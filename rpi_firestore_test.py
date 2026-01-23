#!/usr/bin/env python3
"""
🧪 Simple Firestore Connection Test for Raspberry Pi
Tests if the device can connect to Firebase Firestore
"""

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from datetime import datetime
import sys
import os
import json

def test_firestore_connection():
    """Test connection to Firestore"""
    
    print("=" * 60)
    print("🧪 Firestore Connection Test")
    print("=" * 60)
    
    # Step 1: Check and initialize Firebase
    print("\n[1/5] Checking service account key...")
    key_paths = [
        './serviceAccountKey.json',
        'serviceAccountKey.json',
        os.path.expanduser('~/serviceAccountKey.json'),
    ]
    
    cred_path = None
    for path in key_paths:
        if os.path.exists(path):
            cred_path = path
            print(f"✅ Found key at: {path}")
            break
    
    if not cred_path:
        print("❌ Error: serviceAccountKey.json not found in:")
        for path in key_paths:
            print(f"   - {path}")
        return False
    
    # Load and verify key
    try:
        with open(cred_path) as f:
            key_data = json.load(f)
            print(f"✅ Service account email: {key_data.get('client_email')}")
            print(f"✅ Project ID: {key_data.get('project_id')}")
    except Exception as e:
        print(f"❌ Failed to read key file: {e}")
        return False
    
    # Initialize Firebase
    print("\n[2/5] Initializing Firebase Admin SDK...")
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("✅ Firebase Admin SDK initialized successfully")
    except Exception as e:
        print(f"❌ Firebase initialization failed: {e}")
        print(f"   Error type: {type(e).__name__}")
        return False
    
    # Step 3: Test writing to device_tests (most permissive)
    print("\n[3/5] Testing write to device_tests collection...")
    try:
        test_doc = {
            "device": "test-device",
            "test": True,
            "timestamp": datetime.now().isoformat(),
            "message": "Connection test!"
        }
        
        result = db.collection("device_tests").add(test_doc)
        doc_id = result[1].id
        print(f"✅ Successfully wrote to device_tests")
        print(f"   Document ID: {doc_id}")
    except Exception as e:
        print(f"❌ Write to device_tests failed: {e}")
        print(f"   Error type: {type(e).__name__}")
        return False
    
    # Step 4: Test writing to sensors readings
    print("\n[4/5] Testing write to sensors/readings...")
    try:
        reading_doc = {
            "value": 23.5,
            "timestamp": datetime.now().isoformat(),
            "deviceId": "test-device"
        }
        
        # Create a test sensor first if needed
        sensor_ref = db.collection("sensors").document("test-sensor")
        sensor_ref.set({
            "name": "Test Sensor",
            "type": "temperature",
            "userId": "admin"
        }, merge=True)
        
        # Add reading
        reading_ref = sensor_ref.collection("readings").add(reading_doc)
        print(f"✅ Successfully wrote to sensors/readings")
        print(f"   Reading ID: {reading_ref[1].id}")
    except Exception as e:
        print(f"❌ Write to sensors/readings failed: {e}")
        print(f"   Error type: {type(e).__name__}")
        return False
    
    # Step 5: Verify reads
    print("\n[5/5] Testing reads...")
    try:
        # Try reading from device_tests
        test_docs = list(db.collection("device_tests").limit(1).stream())
        print(f"✅ Successfully read from device_tests ({len(test_docs)} docs)")
        
        # Try reading from sensors
        sensor_docs = list(db.collection("sensors").limit(1).stream())
        print(f"✅ Successfully read from sensors ({len(sensor_docs)} docs)")
    except Exception as e:
        print(f"❌ Read test failed: {e}")
        return False
    
    # Success!
    print("\n" + "=" * 60)
    print("🎉 All tests passed! Device can connect to Firestore")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = test_firestore_connection()
    sys.exit(0 if success else 1)
