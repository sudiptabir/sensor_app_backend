#!/usr/bin/env python3
"""
Device Registration and Connection Test for Firebase
Tests if a device can connect to Firebase and register itself
"""

import sys
import firebase_admin
from firebase_admin import credentials, firestore
import uuid
import socket
import platform
from datetime import datetime

# Redirect output to a file AND stdout
output_file = open('test_output.txt', 'w')

def log_message(msg):
    print(msg)
    output_file.write(msg + '\n')
    output_file.flush()

log_message("=" * 60)
log_message("🔥 DEVICE REGISTRATION TEST")
log_message("=" * 60)

try:
    log_message("\n[1] Loading Firebase credentials...")
    cred = credentials.Certificate('./serviceAccountKey.json')
    
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
        log_message("    ✅ Firebase initialized")
    else:
        log_message("    ✅ Firebase already initialized")
    
    # Get Firestore client
    log_message("\n[2] Connecting to Firestore...")
    db = firestore.client()
    log_message("    ✅ Connected to Firestore")
    
    # Gather device information
    log_message("\n[3] Gathering device information...")
    device_id = str(uuid.uuid4())
    hostname = socket.gethostname()
    try:
        ip_address = socket.gethostbyname(hostname)
    except:
        ip_address = "127.0.0.1"
    
    device_info = {
        "deviceId": device_id,
        "name": hostname,
        "platform": platform.system(),
        "version": platform.version(),
        "ipAddress": ip_address,
        "status": "connected",
        "registeredAt": datetime.now().isoformat(),
        "lastSeen": datetime.now().isoformat(),
        "type": "sensor_device"
    }
    
    log_message(f"    Device ID: {device_id}")
    log_message(f"    Hostname: {hostname}")
    log_message(f"    Platform: {platform.system()}")
    log_message(f"    IP Address: {ip_address}")
    
    # Register device in Firestore
    log_message("\n[4] Registering device in Firestore...")
    devices_ref = db.collection('devices')
    devices_ref.document(device_id).set(device_info)
    log_message(f"    ✅ Device registered with ID: {device_id}")
    
    # Verify device was written
    log_message("\n[5] Verifying device registration...")
    registered_device = devices_ref.document(device_id).get()
    if registered_device.exists:
        log_message("    ✅ Device successfully registered and verified!")
        log_message("\n    Device data in Firestore:")
        for key, value in registered_device.to_dict().items():
            log_message(f"      - {key}: {value}")
    else:
        log_message("    ❌ Failed to verify device registration")
    
    # Test write a sensor reading
    log_message("\n[6] Testing sensor reading submission...")
    reading_data = {
        "sensorType": "temperature",
        "value": 23.5,
        "unit": "celsius",
        "timestamp": datetime.now().isoformat(),
        "deviceId": device_id
    }
    
    readings_ref = db.collection('devices').document(device_id).collection('readings')
    reading_id = readings_ref.document().id
    readings_ref.document(reading_id).set(reading_data)
    log_message(f"    ✅ Sample reading submitted with ID: {reading_id}")
    
    # Verify reading was written
    log_message("\n[7] Verifying sensor reading...")
    reading = readings_ref.document(reading_id).get()
    if reading.exists:
        log_message("    ✅ Sensor reading successfully stored!")
        log_message("    Reading data:")
        for key, value in reading.to_dict().items():
            log_message(f"      - {key}: {value}")
    else:
        log_message("    ❌ Failed to verify sensor reading")
    
    # Summary
    log_message("\n" + "=" * 60)
    log_message("✅ SUCCESS - DEVICE REGISTRATION TEST PASSED!")
    log_message("=" * 60)
    log_message(f"\nYour device is successfully connected to Firebase!")
    log_message(f"Device ID: {device_id}")
    log_message(f"Location: devices/{device_id}")
    log_message(f"Readings: devices/{device_id}/readings/")
    
    # Save device ID for future reference
    with open('device_id.txt', 'w') as f:
        f.write(device_id)
    log_message(f"\n💾 Device ID saved to device_id.txt")
    
except FileNotFoundError as e:
    log_message(f"\n❌ ERROR: Could not find serviceAccountKey.json")
    log_message(f"   Make sure serviceAccountKey.json is in the same directory as this script")
    log_message(f"   Current error: {e}")
    
except Exception as e:
    log_message(f"\n❌ ERROR: {e}")
    log_message(f"\nTroubleshooting:")
    log_message("  1. Verify serviceAccountKey.json exists and is valid")
    log_message("  2. Check your Firebase project ID in firebaseConfig.js")
    log_message("  3. Ensure Firestore database is created in Firebase Console")
    log_message("  4. Check Firestore security rules allow writes")
    log_message("  5. Verify Firebase credentials have proper permissions")
    
    import traceback
    log_message("\nTraceback:")
    log_message(traceback.format_exc())

finally:
    log_message("\n")
    output_file.close()
