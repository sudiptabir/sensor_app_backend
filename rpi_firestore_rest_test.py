#!/usr/bin/env python3
"""
Simple Firestore connectivity test using REST API
This bypasses service account SDK issues
"""

import json
import requests
import time

PROJECT_ID = "sensor-app-2a69b"

def test_firestore_rest():
    print("="*60)
    print("Testing Firestore via REST API")
    print("="*60)
    
    # Load service account for token
    try:
        with open('serviceAccountKey.json') as f:
            creds = json.load(f)
    except:
        print("ERROR: serviceAccountKey.json not found")
        return False
    
    # Get access token
    import google.auth
    from google.auth.transport.requests import Request
    from google.oauth2.service_account import Credentials
    
    try:
        scopes = ['https://www.googleapis.com/auth/cloud-platform']
        credentials = Credentials.from_service_account_file(
            'serviceAccountKey.json', 
            scopes=scopes
        )
        credentials.refresh(Request())
        token = credentials.token
        print(f"✓ Got access token")
    except Exception as e:
        print(f"ERROR getting token: {e}")
        return False
    
    # Test write via REST
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/default/documents/test_collection"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "fields": {
            "test": {"stringValue": "hello"},
            "timestamp": {"timestampValue": time.time()}
        }
    }
    
    try:
        print("\nAttempting REST write...")
        response = requests.post(f"{url}?documentId=test-doc", json=data, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code in [200, 201]:
            print("✓ Write successful!")
            return True
        else:
            print(f"✗ Write failed")
            return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    test_firestore_rest()
