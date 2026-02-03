#!/usr/bin/env python3
"""
🚨 Alert Sender for Raspberry Pi
Sends alerts to Railway Alert API
"""

import requests
import json
import time
from datetime import datetime

# Configuration - Update these with your values
RAILWAY_API_URL = "https://web-production-07eda.up.railway.app/api/alerts"  # Your Railway URL
DEVICE_ID = "3d49c55d-bbfd-4bd0-9663-8728d64743ac"  # Your Raspberry Pi device ID (CORRECTED)
DEVICE_NAME = "raspberrypi"

def send_alert(risk_level="Medium", description="Test alert from Raspberry Pi"):
    """Send an alert to the Railway API"""
    
    alert_payload = {
        "deviceId": DEVICE_ID,
        "alert": {
            "notification_type": "Alert",
            "detected_objects": ["test", "detection"],
            "risk_label": risk_level,
            "predicted_risk": risk_level,
            "description": [description, f"Sent from {DEVICE_NAME}"],
            "screenshot": [],
            "device_identifier": DEVICE_NAME,
            "timestamp": int(time.time() * 1000),
            "model_version": "v1.0",
            "confidence_score": 0.85,
            "additional_data": {
                "test": True,
                "source": "raspberry_pi",
                "sent_at": datetime.now().isoformat()
            }
        }
    }
    
    try:
        print(f"🚨 Sending {risk_level} alert...")
        print(f"📡 API URL: {RAILWAY_API_URL}")
        
        response = requests.post(
            RAILWAY_API_URL,
            json=alert_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"✅ Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Alert sent successfully!")
            print(f"📋 Alert ID: {result.get('alertId')}")
            print(f"📱 Notification: {result.get('notification', {}).get('title')}")
            return True
        else:
            print(f"❌ Error: {response.text}")
            return False
            
    except Exception as error:
        print(f"❌ Error sending alert: {error}")
        return False

def test_health():
    """Test if the API is healthy"""
    try:
        health_url = RAILWAY_API_URL.replace("/api/alerts", "/health")
        print(f"🏥 Testing health endpoint...")
        response = requests.get(health_url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API is healthy")
            print(f"   Firebase: {'✅ Connected' if data.get('firebase') else '⚠️  Disabled'}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as error:
        print(f"❌ Health check failed: {error}")
        return False

def main():
    print("=" * 60)
    print("🚨 Raspberry Pi Alert Sender")
    print("=" * 60)
    print(f"Device: {DEVICE_NAME}")
    print(f"Device ID: {DEVICE_ID}")
    print(f"API URL: {RAILWAY_API_URL}")
    print("=" * 60)
    print()
    
    # Test health first
    if not test_health():
        print("\n❌ API is not responding. Check your Railway URL and internet connection.")
        return False
    
    print("\n📤 Sending test alerts...")
    print("-" * 60)
    
    # Send different risk level alerts
    alerts = [
        ("Low", "Low risk detection test"),
        ("Medium", "Medium risk detection test"),
        ("High", "High risk detection test"),
        ("Critical", "Critical risk detection test"),
    ]
    
    for risk_level, description in alerts:
        send_alert(risk_level, description)
        print()
        time.sleep(2)  # Wait 2 seconds between alerts
    
    print("=" * 60)
    print("✅ Test complete!")
    print("📱 Check your mobile app for notifications")
    print("=" * 60)
    return True

if __name__ == "__main__":
    main()