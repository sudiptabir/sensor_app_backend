import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('./serviceAccountKey.json')
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

try:
    db.collection('devices').document('rpi-test').set({'name': 'RPi Test', 'connected': True})
    print('SUCCESS! Write to devices collection worked!')
except Exception as e:
    print(f'ERROR: {e}')
