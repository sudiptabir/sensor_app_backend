# Deployment Checklist ✅

## Pre-Deployment

- [ ] Node.js 18+ installed: `node --version`
- [ ] Firebase CLI installed: `firebase --version`
- [ ] Authenticated with Firebase: `firebase login`
- [ ] Project set: `firebase use sensor-app-2a69b`

## Deploy Cloud Functions

```bash
# 1. Navigate to functions directory
cd functions

# 2. Install dependencies
npm install

# 3. Go back to root
cd ..

# 4. Deploy functions
firebase deploy --only functions

# 5. Verify deployment
firebase functions:log
```

Expected output:
```
✔  checkSensorThreshold
✔  cleanupOldAlerts
Functions deployed successfully!
```

## Update Firestore Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: `sensor-app-2a69b`
3. Firestore Database → Rules
4. Replace with:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - store push tokens
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    // Sensors collection
    match /sensors/{sensorId} {
      allow read, write: if request.auth.uid == resource.data.userId;
      
      // Readings subcollection
      match /readings/{readingId} {
        allow read, write: if request.auth.uid == 
          get(/databases/$(database)/documents/sensors/$(sensorId)).data.userId;
      }

      // Alerts subcollection (history)
      match /alerts/{alertId} {
        allow read: if request.auth.uid == 
          get(/databases/$(database)/documents/sensors/$(sensorId)).data.userId;
      }
    }
  }
}
```

5. Click **Publish**
6. Confirm update

## Test on Device

```bash
# Build and run on Android device
npx expo run:android
```

### Test Steps

1. **Sign in** with test account
2. **Create sensor** with thresholds:
   ```
   Name: Test Sensor
   Type: Temperature
   Location: Test
   Alert Thresholds: Min 10, Max 20
   ```
3. **Add reading** that exceeds threshold
   - In code: `await addSensorReadingData(sensorId, { value: 25 })`
4. **Check notification** - Should appear within 10 seconds
5. **Verify history** - Check Firestore `/sensors/{id}/alerts`

## Monitor

```bash
# Real-time function logs
firebase functions:log --follow

# Tail with grep filter
firebase functions:log | grep "Alert sent"

# Check specific function
firebase functions:log --function checkSensorThreshold
```

## Troubleshooting

### Function not deploying
```bash
# Check for syntax errors
cd functions
npm run lint  # if configured

# Re-deploy
cd ..
firebase deploy --only functions --debug
```

### Notification not received
1. Check token in Firestore `/users/{userId}`
2. Check logs: `firebase functions:log`
3. Verify threshold is set on sensor
4. Check notification permissions on device

### Permission errors
- Verify security rules updated
- Rules take 1-2 minutes to propagate
- Try clearing app data and signing back in

## Useful Commands

```bash
# View all functions
firebase functions:list

# Deploy specific function
firebase deploy --only functions:checkSensorThreshold

# Monitor in real-time
firebase functions:log --follow

# Show last 100 lines
firebase functions:log --limit 100

# Tail for 5 minutes
firebase functions:log --limit 50 | tail -f

# Deploy everything
firebase deploy
```

## Verification Steps

After deployment, verify:

1. **Functions deployed**
   ```bash
   firebase functions:list
   # Should show: checkSensorThreshold, cleanupOldAlerts
   ```

2. **Rules updated**
   - Firebase Console → Firestore → Rules
   - Should show updated rules

3. **Token registered**
   - Create/sign in to app
   - Check Firestore: `/users/{userId}`
   - Should see `expoPushToken` field

4. **Alert fires**
   - Create sensor with thresholds
   - Add reading that exceeds threshold
   - Check device notification

5. **History logged**
   - Check Firestore: `/sensors/{sensorId}/alerts`
   - Should see alert record

## Post-Deployment

- ✅ Monitor logs daily: `firebase functions:log`
- ✅ Check alert counts in Firestore
- ✅ Review cleanup job: `firebase functions:log | grep cleanup`
- ✅ Track function errors: `firebase functions:log | grep error`

## Roll Back (if needed)

```bash
# Redeploy previous version
firebase deploy --only functions

# Or delete functions (warning: removes all alerts)
firebase functions:delete checkSensorThreshold --force
firebase functions:delete cleanupOldAlerts --force
```

## Production Considerations

- [ ] Set up monitoring/alerting in Cloud Console
- [ ] Review Cloud Function quotas/limits
- [ ] Configure error notifications for team
- [ ] Document alert thresholds for each sensor
- [ ] Set up backup for Firestore data
- [ ] Test failover/recovery procedures

## Support Resources

- 📖 [FIRESTORE_ALERTS_SETUP.md](./FIRESTORE_ALERTS_SETUP.md) - Full setup guide
- 📋 [functions/README.md](./functions/README.md) - Function documentation
- 🔧 [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Architecture overview

---

**Status**: Ready for deployment ✅

Next step: Run `firebase deploy --only functions`
