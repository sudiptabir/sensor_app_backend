#!/usr/bin/env python3
import sys
sys.stdout.flush()
sys.stderr.flush()

with open('C:\\Users\\SUDIPTA\\Downloads\\Sensor_app\\test_run.log', 'w') as f:
    f.write('Test started\n')
    f.flush()
    
    try:
        import firebase_admin
        f.write('firebase_admin imported\n')
        f.flush()
        
        from firebase_admin import credentials, firestore
        f.write('credentials and firestore imported\n')
        f.flush()
        
        cred = credentials.Certificate('./serviceAccountKey.json')
        f.write('credentials loaded\n')
        f.flush()
        
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        f.write('firebase initialized\n')
        f.flush()
        
        db = firestore.client()
        f.write('firestore connected\n')
        f.flush()
        
        import uuid
        device_id = str(uuid.uuid4())
        f.write(f'device_id: {device_id}\n')
        f.flush()
        
        devices_ref = db.collection('devices')
        devices_ref.document(device_id).set({'name': 'Test Device', 'connected': True})
        f.write('Device written to database\n')
        f.flush()
        
        f.write('SUCCESS!\n')
        
    except Exception as e:
        f.write(f'ERROR: {str(e)}\n')
        f.write(f'Type: {type(e)}\n')
        import traceback
        f.write(traceback.format_exc())
        f.flush()
