#!/usr/bin/env python3
"""
Test script to verify and setup DHT11 sensor in Railway database
"""
import requests
import json
import os
from datetime import datetime

# Railway PostgreSQL connection via backend
API_URL = "https://web-production-3d9a.up.railway.app"
DEVICE_ID = "3d49c55d-bbfd-4bd0-9663-8728d64743ac"
SENSOR_ID = 9001

def test_backend_connection():
    """Test if backend is reachable"""
    try:
        response = requests.get(f"{API_URL}/api/health", timeout=5)
        print(f"✅ Backend is reachable: {response.status_code}")
        return True
    except Exception as e:
        print(f"❌ Backend connection failed: {e}")
        return False

def get_all_sensors():
    """Get all sensors from backend"""
    try:
        response = requests.get(f"{API_URL}/api/sensors", timeout=5)
        sensors = response.json()
        print(f"\n📊 All sensors in database:")
        for sensor in sensors:
            print(f"  - Sensor ID: {sensor['sensor_id']}, Name: {sensor['sensor_name']}, Device: {sensor['device_id']}, Active: {sensor['is_active']}")
        return sensors
    except Exception as e:
        print(f"❌ Failed to get sensors: {e}")
        return []

def get_device_sensors(device_id):
    """Get sensors for specific device"""
    try:
        response = requests.get(f"{API_URL}/api/sensors?deviceId={device_id}", timeout=5)
        sensors = response.json()
        print(f"\n📱 Sensors for device {device_id}:")
        if sensors:
            for sensor in sensors:
                print(f"  - Sensor ID: {sensor['sensor_id']}, Name: {sensor['sensor_name']}, Type: {sensor['sensor_type']}, Active: {sensor['is_active']}")
        else:
            print(f"  ⚠️  No sensors found for this device")
        return sensors
    except Exception as e:
        print(f"❌ Failed to get device sensors: {e}")
        return []

def create_sensor():
    """Create DHT11 sensor via backend"""
    try:
        payload = {
            "device_id": DEVICE_ID,
            "sensor_name": "DHT11 Sensor",
            "sensor_type": "temperature_humidity",
            "location": "Living Room",
            "unit": "C/%"
        }
        response = requests.post(f"{API_URL}/api/sensors", json=payload, timeout=5)
        if response.status_code in [200, 201]:
            result = response.json()
            print(f"\n✅ Sensor created successfully:")
            print(f"  Response: {json.dumps(result, indent=2)}")
            return True
        else:
            print(f"\n❌ Failed to create sensor: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating sensor: {e}")
        return False

def send_test_reading():
    """Send a test reading to the backend"""
    try:
        payload = {
            "sensor_id": SENSOR_ID,
            "device_id": DEVICE_ID,
            "temperature": 22.5,
            "humidity": 55.0,
            "data_type": "temperature_humidity"
        }
        response = requests.post(f"{API_URL}/api/readings", json=payload, timeout=5)
        if response.status_code in [200, 201]:
            print(f"\n✅ Test reading sent successfully")
            return True
        else:
            print(f"\n❌ Failed to send reading: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error sending reading: {e}")
        return False

def main():
    print("=" * 60)
    print("🔍 DHT11 Sensor Setup Test")
    print("=" * 60)
    print(f"\nConfiguration:")
    print(f"  Backend URL: {API_URL}")
    print(f"  Device ID: {DEVICE_ID}")
    print(f"  Sensor ID: {SENSOR_ID}")
    
    # Test connection
    if not test_backend_connection():
        print("\n❌ Cannot proceed without backend connection")
        return
    
    # Get all sensors
    all_sensors = get_all_sensors()
    
    # Get sensors for Raspberry Pi
    device_sensors = get_device_sensors(DEVICE_ID)
    
    # If no sensors found, create one
    if not device_sensors:
        print(f"\n⚠️  No sensors found for Raspberry Pi device")
        print(f"🔧 Attempting to create DHT11 sensor...")
        create_sensor()
        
        # Verify creation
        print(f"\n🔄 Verifying sensor creation...")
        device_sensors = get_device_sensors(DEVICE_ID)
    
    # Send test reading
    if device_sensors:
        print(f"\n📤 Sending test reading...")
        send_test_reading()
    
    print("\n" + "=" * 60)
    print("✅ Test complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
