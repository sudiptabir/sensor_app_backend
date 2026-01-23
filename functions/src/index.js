const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

/**
 * 🚨 Cloud Function triggered when a sensor reading is added
 * Checks thresholds and sends push notifications via Expo
 */
exports.checkSensorThreshold = functions.firestore
  .document("sensors/{sensorId}/readings/{readingId}")
  .onCreate(async (snap, context) => {
    try {
      const reading = snap.data();
      const { sensorId } = context.params;
      const value = reading.value;

      // Get sensor data
      const sensorDoc = await db.collection("sensors").doc(sensorId).get();
      if (!sensorDoc.exists) {
        console.log("[Function] Sensor not found:", sensorId);
        return;
      }

      const sensorData = sensorDoc.data();
      const { name, userId, alertThreshold } = sensorData;

      if (!alertThreshold) {
        console.log("[Function] No alert threshold for sensor:", sensorId);
        return;
      }

      // Check if value exceeds thresholds
      let shouldAlert = false;
      let alertType = "";
      let severity = "warning";

      if (alertThreshold.max && value > alertThreshold.max) {
        shouldAlert = true;
        alertType = "MAX_EXCEEDED";
        severity = "error";
      } else if (alertThreshold.min && value < alertThreshold.min) {
        shouldAlert = true;
        alertType = "MIN_EXCEEDED";
        severity = "warning";
      }

      if (!shouldAlert) {
        console.log("[Function] Value within thresholds:", sensorId, value);
        return;
      }

      // Get user's Expo push token
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        console.log("[Function] User not found:", userId);
        return;
      }

      const userData = userDoc.data();
      const expoPushToken = userData.expoPushToken;

      if (!expoPushToken) {
        console.log("[Function] No push token for user:", userId);
        return;
      }

      // Send push notification via Expo
      const alertMessage = alertType === "MAX_EXCEEDED"
        ? `Exceeded maximum threshold: ${value} > ${alertThreshold.max}`
        : `Below minimum threshold: ${value} < ${alertThreshold.min}`;

      await sendExpoNotification(expoPushToken, {
        title: `🚨 ${name} Alert`,
        body: alertMessage,
        data: {
          type: "sensorAlert",
          sensorId,
          sensorName: name,
          severity,
          value: value.toString(),
          threshold: (alertType === "MAX_EXCEEDED" ? alertThreshold.max : alertThreshold.min).toString(),
          alertType,
        },
      });

      console.log(`[Function] Alert sent for ${sensorId}: ${alertMessage}`);

      // Log alert to database for history
      await db.collection("sensors").doc(sensorId).collection("alerts").add({
        type: alertType,
        value,
        threshold: alertType === "MAX_EXCEEDED" ? alertThreshold.max : alertThreshold.min,
        severity,
        message: alertMessage,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        sentToUser: true,
      });

    } catch (error) {
      console.error("[Function] Error processing reading:", error);
    }
  });

/**
 * 📤 Send notification via Expo Push Notification Service
 */
async function sendExpoNotification(expoPushToken, notification) {
  try {
    const expoApiUrl = "https://exp.host/--/api/v2/push/send";

    const response = await axios.post(expoApiUrl, {
      to: expoPushToken,
      sound: "default",
      title: notification.title,
      body: notification.body,
      data: notification.data,
      badge: 1,
      priority: "high",
    }, {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    });

    console.log("[Expo API] Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("[Expo API] Error sending notification:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * 🧪 CALLABLE FUNCTION: Trigger test alert for a sensor
 * Can be called from client app
 */
exports.triggerTestAlert = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  try {
    const { deviceId } = data;
    const userId = context.auth.uid;

    console.log("[Function] Test alert requested for device:", deviceId, "by user:", userId);

    // Get device
    const deviceDoc = await db.collection("devices").doc(deviceId).get();
    if (!deviceDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Device not found');
    }

    const deviceData = deviceDoc.data();
    if (deviceData.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Not your device');
    }

    // Get user's expo push token
    const userDoc = await db.collection("users").doc(userId).get();
    const expoPushToken = userDoc.exists ? userDoc.data()?.expoPushToken : null;

    console.log("[Function] Expo push token found:", !!expoPushToken);

    if (!expoPushToken) {
      console.log("[Function] ⚠️ No expo push token for user:", userId);
      return {
        success: true,
        message: "Alert created but push notification not sent (no token available)",
      };
    }

    // Send push notification with proper error handling
    const testMessage = {
      to: expoPushToken,
      sound: "default",
      title: `🧪 Test Alert - ${deviceData.label}`,
      body: "This is a test alert notification",
      data: {
        type: "testAlert",
        deviceId,
        deviceLabel: deviceData.label,
      },
    };

    console.log("[Function] Sending notification to token:", expoPushToken);
    console.log("[Function] Message payload:", JSON.stringify(testMessage));

    const response = await axios.post("https://exp.host/--/api/v2/push/send", testMessage, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log("[Function] Notification API response status:", response.status);
    console.log("[Function] Notification API response data:", JSON.stringify(response.data));

    // Check if response has an error status
    if (response.data.data && response.data.data.status === "error") {
      console.error("[Function] Notification error from Expo:", response.data.data.message);
      throw new functions.https.HttpsError(
        'internal',
        `Notification failed: ${response.data.data.message}`
      );
    }

    // Also check for errors array (alternate format)
    if (response.data.errors && response.data.errors.length > 0) {
      console.error("[Function] Notification errors:", response.data.errors);
      const error = response.data.errors[0];
      throw new functions.https.HttpsError(
        'internal',
        `Failed to send notification: ${error.message || 'Unknown error'}`
      );
    }

    console.log("[Function] ✅ Notification sent successfully");

    return {
      success: true,
      message: "Test alert and push notification sent successfully",
      notificationId: response.data.id,
    };
  } catch (error) {
    console.error("[Function] Error triggering test alert:", error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to trigger test alert: ' + (error.message || 'Unknown error')
    );
  }
});

/**
 * 🧹 Cleanup: Remove old alerts older than 30 days
 * Runs daily at 2 AM UTC
 */
exports.cleanupOldAlerts = functions.pubsub
  .schedule("0 2 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sensorsSnapshot = await db.collection("sensors").get();
      let deletedCount = 0;

      for (const sensorDoc of sensorsSnapshot.docs) {
        const alertsSnapshot = await db
          .collection("sensors")
          .doc(sensorDoc.id)
          .collection("alerts")
          .where("timestamp", "<", thirtyDaysAgo)
          .get();

        for (const alertDoc of alertsSnapshot.docs) {
          await alertDoc.ref.delete();
          deletedCount++;
        }
      }

      console.log(`[Function] Cleaned up ${deletedCount} old alerts`);
      return { success: true, deletedCount };
    } catch (error) {
      console.error("[Function] Error cleaning up alerts:", error);
      throw error;
    }
  });

/**
 * 🧪 Callable function to create test devices (admin only)
 * Used for testing device management features
 */
exports.createTestDevices = functions.https.onCall(async (data, context) => {
  try {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const testDevices = [
      { label: "Test Device 1" },
      { label: "Test Device 2" },
      { label: "Test Device 3" },
    ];

    const createdDevices = [];

    for (const device of testDevices) {
      try {
        // Check if device already exists
        const existing = await db
          .collection("devices")
          .where("label", "==", device.label)
          .get();

        if (existing.empty) {
          // Create unassigned device (no userId - available for anyone to claim)
          const docRef = await db.collection("devices").add({
            label: device.label,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            // No userId - device is unassigned and available to claim
          });

          createdDevices.push({
            id: docRef.id,
            label: device.label,
          });

          console.log("[Function] Created test device:", device.label, "ID:", docRef.id);
        } else {
          console.log("[Function] Test device already exists:", device.label);
        }
      } catch (error) {
        console.error("[Function] Error creating test device:", device.label, error);
      }
    }

    return {
      success: true,
      created: createdDevices,
      message: `Created ${createdDevices.length} test devices`,
    };
  } catch (error) {
    console.error("[Function] Error in createTestDevices:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to create test devices",
      error.message
    );
  }
});
