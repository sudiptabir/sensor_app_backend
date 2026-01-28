/**
 * 🤖 ML ALERT CLOUD FUNCTION
 * 
 * Add this function to: functions/src/index.js
 * After the existing checkSensorThreshold and triggerTestAlert functions
 * 
 * This endpoint receives ML detection alerts from remote devices,
 * validates them, stores in Firestore, and sends push notifications
 */

/**
 * 📬 HTTP Endpoint: Receive ML alerts from remote devices
 * 
 * Usage:
 * POST https://YOUR_PROJECT.cloudfunctions.net/receiveMLAlert
 * 
 * Request body example:
 * {
 *   "deviceId": "rpi_camera_01",
 *   "deviceIdentifier": "Raspberry Pi 1",
 *   "mlAlert": {
 *     "notification_type": "Alert",
 *     "detected_objects": ["cattle", "buffalo"],
 *     "risk_label": "High",
 *     "predicted_risk": "High",
 *     "description": [
 *       "10 buffalo detected",
 *       "Close proximity",
 *       "Aggressive motion"
 *     ],
 *     "screenshot": ["image_001.jpg", "image_002.jpg"],
 *     "timestamp": 1705977600000,
 *     "model_version": "v2.1",
 *     "confidence_score": 0.95
 *   }
 * }
 */
exports.receiveMLAlert = functions.https.onRequest(async (req, res) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Use POST'
      });
    }

    console.log('[ML Alert] Received request:', {
      deviceId: req.body.deviceId,
      deviceIdentifier: req.body.deviceIdentifier,
    });

    // Extract and validate request body
    const { deviceId, deviceIdentifier, mlAlert } = req.body;

    // Validate required fields
    if (!deviceId || !deviceIdentifier) {
      console.error('[ML Alert] Missing device identification');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: deviceId, deviceIdentifier'
      });
    }

    if (!mlAlert) {
      console.error('[ML Alert] Missing mlAlert object');
      return res.status(400).json({
        success: false,
        error: 'Missing mlAlert object'
      });
    }

    // Validate alert payload
    if (!mlAlert.detected_objects || !Array.isArray(mlAlert.detected_objects)) {
      console.error('[ML Alert] Invalid detected_objects');
      return res.status(400).json({
        success: false,
        error: 'Invalid alert: detected_objects must be an array'
      });
    }

    if (!mlAlert.risk_label) {
      console.error('[ML Alert] Missing risk_label');
      return res.status(400).json({
        success: false,
        error: 'Invalid alert: risk_label is required'
      });
    }

    // Get device from Firestore
    console.log('[ML Alert] Fetching device:', deviceId);
    const deviceDoc = await db.collection('devices').doc(deviceId).get();

    if (!deviceDoc.exists) {
      console.error('[ML Alert] Device not found:', deviceId);
      return res.status(404).json({
        success: false,
        error: `Device not found: ${deviceId}`
      });
    }

    const deviceData = deviceDoc.data();
    console.log('[ML Alert] Device found:', {
      label: deviceData.label,
      userId: deviceData.userId ? 'exists' : 'missing'
    });

    // Verify device is claimed by a user
    const userId = deviceData.userId;
    if (!userId) {
      console.error('[ML Alert] Device not claimed by any user:', deviceId);
      return res.status(404).json({
        success: false,
        error: 'Device is not claimed by any user'
      });
    }

    // Store alert in Firestore
    console.log('[ML Alert] Storing alert in Firestore');
    const alertRef = await db
      .collection('devices')
      .doc(deviceId)
      .collection('alerts')
      .add({
        // Device info
        deviceId,
        deviceIdentifier,
        userId,

        // Alert content
        notificationType: mlAlert.notification_type || 'Alert',
        detectedObjects: mlAlert.detected_objects,
        riskLabel: mlAlert.risk_label,
        predictedRisk: mlAlert.predicted_risk || mlAlert.risk_label,
        description: mlAlert.description || [],
        screenshots: mlAlert.screenshot || [],

        // Timestamps
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        alertGeneratedAt: mlAlert.timestamp || Date.now(),

        // Model info
        modelVersion: mlAlert.model_version || null,
        confidenceScore: mlAlert.confidence_score || null,

        // Status
        acknowledged: false,
        rating: null,
        ratingAccuracy: null,

        // Additional data
        additionalData: mlAlert.additional_data || {},
      });

    console.log('[ML Alert] Alert stored with ID:', alertRef.id);

    // Get user's push token
    console.log('[ML Alert] Fetching user push token for:', userId);
    const userDoc = await db.collection('users').doc(userId).get();
    const expoPushToken = userDoc.exists ? userDoc.data()?.expoPushToken : null;

    let notificationSent = false;
    let notificationError = null;

    if (expoPushToken) {
      try {
        console.log('[ML Alert] Sending push notification');

        // Create formatted notification
        const riskEmojis = {
          'critical': '🔴',
          'high': '🟠',
          'medium': '🟡',
          'low': '🟢'
        };

        const riskLevel = (mlAlert.risk_label || 'medium').toLowerCase();
        const riskEmoji = riskEmojis[riskLevel] || '🔵';

        const notificationTitle = `${riskEmoji} ${mlAlert.risk_label} - ${deviceIdentifier}`;
        const notificationBody = `${mlAlert.detected_objects.join(', ')}: ${
          mlAlert.description?.[0] || 'ML detection alert'
        }`;

        const notificationPayload = {
          to: expoPushToken,
          sound: 'default',
          title: notificationTitle,
          body: notificationBody,
          badge: 1,
          priority: 'high',
          data: {
            type: 'mlAlert',
            deviceId,
            deviceIdentifier,
            alertId: alertRef.id,
            riskLabel: mlAlert.risk_label,
            detectedObjects: mlAlert.detected_objects.join(','),
            timestamp: new Date().toISOString(),
          },
        };

        console.log('[ML Alert] Sending notification payload:', {
          to: notificationPayload.to.substring(0, 20) + '...',
          title: notificationPayload.title,
          body: notificationPayload.body,
        });

        const response = await axios.post(
          'https://exp.host/--/api/v2/push/send',
          notificationPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            timeout: 10000,
          }
        );

        console.log('[ML Alert] Push notification response:', response.status);

        if (response.data?.errors && response.data.errors.length > 0) {
          console.warn('[ML Alert] Push notification error:', response.data.errors);
          notificationError = response.data.errors[0].message;
        } else {
          notificationSent = true;
          console.log('[ML Alert] ✅ Push notification sent successfully');
        }
      } catch (error) {
        console.warn('[ML Alert] Push notification failed:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        });
        notificationError = error.message;
      }
    } else {
      console.warn('[ML Alert] ⚠️ No push token found for user:', userId);
    }

    // Return success response
    const successResponse = {
      success: true,
      alertId: alertRef.id,
      message: notificationSent
        ? 'Alert received and push notification sent successfully'
        : 'Alert stored successfully (push notification pending)',
    };

    if (!notificationSent && expoPushToken) {
      successResponse.warning = 'Push notification failed to send';
      successResponse.error = notificationError;
    }

    if (!expoPushToken) {
      successResponse.warning = 'No push token available for user';
      successResponse.info = 'Alert stored in Firestore for when user opens app';
    }

    console.log('[ML Alert] ✅ Returning response:', {
      success: successResponse.success,
      alertId: successResponse.alertId,
      notificationSent,
    });

    return res.status(201).json(successResponse);

  } catch (error) {
    console.error('[ML Alert] Unexpected error:', {
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * 🧹 Cleanup: Remove ML alerts older than 30 days
 * Schedule: Daily at 2 AM UTC
 */
exports.cleanupOldMLAlerts = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    try {
      console.log('[Cleanup] Starting ML alerts cleanup');

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const devicesSnapshot = await db.collection('devices').get();
      let deletedCount = 0;
      let processedDevices = 0;

      for (const deviceDoc of devicesSnapshot.docs) {
        const alertsSnapshot = await db
          .collection('devices')
          .doc(deviceDoc.id)
          .collection('alerts')
          .where('timestamp', '<', thirtyDaysAgo)
          .get();

        for (const alertDoc of alertsSnapshot.docs) {
          await alertDoc.ref.delete();
          deletedCount++;
        }

        processedDevices++;
      }

      console.log(`[Cleanup] ✅ Cleaned up ${deletedCount} old ML alerts from ${processedDevices} devices`);
      return {
        success: true,
        deletedCount,
        processedDevices,
      };
    } catch (error) {
      console.error('[Cleanup] Error cleaning up ML alerts:', error);
      throw error;
    }
  });

/**
 * 📋 Export these to your functions/src/index.js:
 * 
 * Add to exports section:
 * exports.receiveMLAlert = receiveMLAlert;
 * exports.cleanupOldMLAlerts = cleanupOldMLAlerts;
 */
