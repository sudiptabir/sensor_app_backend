#!/usr/bin/env python3
"""
🤖 ML Alert Sender for Testing
Sends ML alerts from your device to Firebase Cloud Messaging
"""

import requests
import json
import time
from datetime import datetime

# Configuration
# TODO: Update these with your actual values
DEVICE_ID = "192b7a8c-972d-4429-ac28-4bc73e9a8809"
USER_ID = "GKu2p6uvarhEzrKG85D7fXbxUh23"  # Get from Firebase Auth console
DEVICE_IDENTIFIER = "LAPTOP-14678VIP"

# Cloud Function Endpoint
# Replace with your actual Firebase Cloud Function URL after deployment
ENDPOINT = "https://us-central1-sensor-app-2a69b.cloudfunctions.net/receiveMLAlert"
BATCH_ENDPOINT = "https://us-central1-sensor-app-2a69b.cloudfunctions.net/receiveMLAlertBatch"


def send_single_alert(
    objects: list,
    risk_label: str = "medium",
    description: str = None,
    confidence: float = 0.85,
    screenshots: list = None
) -> dict:
    """
    Send a single ML alert to the endpoint
    
    Args:
        objects: List of detected objects e.g., ["person", "car"]
        risk_label: Risk level - "critical", "high", "medium", "low"
        description: Alert description
        confidence: Confidence score (0-1)
        screenshots: List of screenshot URLs
    
    Returns:
        Response from the endpoint
    """
    
    payload = {
        "deviceId": DEVICE_ID,
        "userId": USER_ID,
        "deviceIdentifier": DEVICE_IDENTIFIER,
        "detectedObjects": objects,
        "riskLabel": risk_label,
        "description": [description] if description else [],
        "screenshots": screenshots or [],
        "confidenceScore": confidence
    }
    
    print(f"\n📤 Sending alert...")
    print(f"   Objects: {', '.join(objects)}")
    print(f"   Risk: {risk_label.upper()}")
    print(f"   Confidence: {confidence * 100:.0f}%")
    
    try:
        response = requests.post(ENDPOINT, json=payload, timeout=10)
        response.raise_for_status()
        
        result = response.json()
        print(f"✅ Alert sent successfully!")
        print(f"   Alert ID: {result.get('alertId')}")
        print(f"   Message ID: {result.get('messageId')}")
        
        return result
    except requests.exceptions.RequestException as e:
        print(f"❌ Error sending alert: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Response: {e.response.text}")
        return None


def send_batch_alerts(alerts: list) -> dict:
    """
    Send multiple alerts in batch
    
    Args:
        alerts: List of alert dictionaries
    
    Returns:
        Response from the endpoint
    """
    
    payload = {"alerts": alerts}
    
    print(f"\n📤 Sending {len(alerts)} alerts in batch...")
    
    try:
        response = requests.post(BATCH_ENDPOINT, json=payload, timeout=10)
        response.raise_for_status()
        
        result = response.json()
        print(f"✅ Batch processed!")
        print(f"   Processed: {result.get('processed')}")
        
        for res in result.get('results', []):
            if res['success']:
                print(f"   ✓ Device {res['deviceId'][:8]}... - Alert {res['alertId'][:8]}...")
            else:
                print(f"   ✗ Device {res['deviceId'][:8]}... - Error: {res['error']}")
        
        return result
    except requests.exceptions.RequestException as e:
        print(f"❌ Error sending batch: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Response: {e.response.text}")
        return None


def test_alerts():
    """Send test alerts to verify the system works"""
    
    print("\n" + "="*60)
    print("🤖 ML Alert Testing System")
    print("="*60)
    print(f"Device ID: {DEVICE_ID}")
    print(f"User ID: {USER_ID}")
    print(f"Device Name: {DEVICE_IDENTIFIER}")
    print(f"Endpoint: {ENDPOINT}")
    print("="*60)
    
    # Test 1: High risk alert - Person detected
    print("\n[Test 1] High Risk - Person Detected")
    send_single_alert(
        objects=["person"],
        risk_label="high",
        description="Unauthorized person detected at entrance",
        confidence=0.92
    )
    time.sleep(2)
    
    # Test 2: Critical alert - Multiple threats
    print("\n[Test 2] Critical - Multiple Threats")
    send_single_alert(
        objects=["person", "weapon", "vehicle"],
        risk_label="critical",
        description="Suspicious activity with multiple threats detected",
        confidence=0.88
    )
    time.sleep(2)
    
    # Test 3: Medium alert - Vehicle detected
    print("\n[Test 3] Medium Risk - Vehicle Detected")
    send_single_alert(
        objects=["vehicle"],
        risk_label="medium",
        description="Vehicle in restricted area",
        confidence=0.78
    )
    time.sleep(2)
    
    # Test 4: Low alert - Normal activity
    print("\n[Test 4] Low Risk - Normal Activity")
    send_single_alert(
        objects=["person", "bicycle"],
        risk_label="low",
        description="Normal pedestrian activity",
        confidence=0.85
    )
    
    print("\n" + "="*60)
    print("✅ All tests completed!")
    print("="*60)


def send_custom_alert():
    """Send a custom alert based on user input"""
    
    print("\n" + "="*60)
    print("🤖 Send Custom Alert")
    print("="*60)
    
    # Get input from user
    objects_input = input("Detected objects (comma-separated): ").strip()
    objects = [obj.strip() for obj in objects_input.split(",")] if objects_input else ["unknown"]
    
    risk_label = input("Risk level (critical/high/medium/low) [medium]: ").strip() or "medium"
    if risk_label not in ["critical", "high", "medium", "low"]:
        risk_label = "medium"
    
    description = input("Description [empty]: ").strip() or None
    
    confidence_input = input("Confidence (0-100) [85]: ").strip()
    try:
        confidence = float(confidence_input or 85) / 100
    except ValueError:
        confidence = 0.85
    
    # Send the alert
    send_single_alert(
        objects=objects,
        risk_label=risk_label,
        description=description,
        confidence=confidence
    )


def main():
    """Main menu"""
    
    print("\n🤖 ML Alert Sender - Menu")
    print("1. Run automated tests")
    print("2. Send custom alert")
    print("3. Exit")
    
    choice = input("\nSelect option (1-3): ").strip()
    
    if choice == "1":
        test_alerts()
    elif choice == "2":
        send_custom_alert()
    else:
        print("Exiting...")


if __name__ == "__main__":
    # Verify configuration
    if USER_ID == "YOUR_USER_ID_HERE":
        print("⚠️  WARNING: USER_ID not configured!")
        print("Edit this file and set USER_ID to your Firebase User ID")
        print("You can find it in: Firebase Console → Authentication → Click your user")
        print()
    
    if "YOUR_REGION" in ENDPOINT:
        print("⚠️  WARNING: Cloud Function endpoint not configured!")
        print("Edit this file and update ENDPOINT with your actual Firebase function URL")
        print()
    
    main()
