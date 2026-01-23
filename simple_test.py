import firebase_admin
from firebase_admin import credentials, firestore

print("Loading credentials...")
cred = credentials.Certificate('./serviceAccountKey.json')

print("Initializing Firebase...")
firebase_admin.initialize_app(cred)

print("Getting Firestore client...")
db = firestore.client()

print("Attempting to write to Firestore...")
try:
    db.collection('test').document('test').set({'hello': 'world'})
    print('SUCCESS! Write worked!')
except Exception as e:
    print(f'ERROR: {e}')
    print(f'Error code: {e.code if hasattr(e, "code") else "N/A"}')
    import traceback
    traceback.print_exc()
