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
 * � HTTP ENDPOINT: Receive ML model alerts from remote devices
 * Remote devices POST their ML detection alerts to this endpoint
 * 
 * Expected request body:
 * {
 *   "deviceId": "firestore_device_id",
 *   "deviceIdentifier": "raspberry_pi_1",  // Human-readable name
 *   "mlAlert": {
 *     "notification_type": "Alert",
 *     "detected_objects": ["cattle", "buffalo"],
 *     "risk_label": "High",
 *     "predicted_risk": "High",
 *     "description": ["10 buffalo", "close proximity", "aggressive motion"],
 *     "screenshot": ["080120260001.jpeg"],
 *     "timestamp": 1705784400000,
 *     "model_version": "v2.1",
 *     "confidence_score": 0.95
 *   }
 * }
 */
exports.receiveMLAlert = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    console.log("[ML Alert] Received request from device");

    // Extract payload
    const { deviceId, deviceIdentifier, mlAlert } = req.body;

    // Validate required fields
    if (!deviceId || !deviceIdentifier || !mlAlert) {
      console.error("[ML Alert] Missing required fields");
      return res.status(400).json({
        success: false,
        error: "Missing required fields: deviceId, deviceIdentifier, mlAlert",
      });
    }

    // Validate device exists and get device info
    const deviceDoc = await db.collection("devices").doc(deviceId).get();
    if (!deviceDoc.exists) {
      console.error("[ML Alert] Device not found:", deviceId);
      return res.status(404).json({
        success: false,
        error: "Device not found",
      });
    }

    const deviceData = deviceDoc.data();
    const userId = deviceData.userId;

    if (!userId) {
      console.error("[ML Alert] Device not claimed by any user");
      return res.status(403).json({
        success: false,
        error: "Device is not registered to any user",
      });
    }

    // Validate ML alert data
    if (!mlAlert.detected_objects || !mlAlert.risk_label) {
      console.error("[ML Alert] Invalid ML alert data");
      return res.status(400).json({
        success: false,
        error: "Invalid ML alert data: missing detected_objects or risk_label",
      });
    }

    console.log("[ML Alert] Processing alert for device:", deviceIdentifier, "from user:", userId);

    // Store alert in Firestore under device's alerts subcollection
    const alertRef = await db
      .collection("devices")
      .doc(deviceId)
      .collection("alerts")
      .add({
        deviceId: deviceId,
        deviceIdentifier: deviceIdentifier,
        userId: userId,
        notificationType: mlAlert.notification_type || "Alert",
        detectedObjects: mlAlert.detected_objects || [],
        riskLabel: mlAlert.risk_label,
        predictedRisk: mlAlert.predicted_risk,
        description: mlAlert.description || [],
        screenshots: mlAlert.screenshot || [],
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        alertGeneratedAt: mlAlert.timestamp || Date.now(),
        modelVersion: mlAlert.model_version || null,
        confidenceScore: mlAlert.confidence_score || null,
        acknowledged: false,
        rating: null,
        ratingAccuracy: null,
        additionalData: mlAlert.additional_data || {},
      });

    console.log("[ML Alert] Alert stored with ID:", alertRef.id);

    // Get user's Expo push token to send push notification
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      console.warn("[ML Alert] User document not found, skipping push notification");
      return res.status(201).json({
        success: true,
        alertId: alertRef.id,
        message: "Alert received and stored, but user not found for push notification",
      });
    }

    const userData = userDoc.data();
    const expoPushToken = userData?.expoPushToken;

    if (!expoPushToken) {
      console.warn("[ML Alert] No push token for user, skipping push notification");
      return res.status(201).json({
        success: true,
        alertId: alertRef.id,
        message: "Alert received and stored, but no push token available",
      });
    }

    // Generate notification
    const riskMap = {
      critical: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "🟢",
    };

    const riskLevel = mlAlert.risk_label.toLowerCase();
    const riskEmoji = riskMap[riskLevel] || "🔵";

    const notificationTitle = `${riskEmoji} ${mlAlert.risk_label} Alert - ${deviceIdentifier}`;
    const detectedStr = mlAlert.detected_objects.join(", ");
    const descStr = mlAlert.description?.[0] || "ML detection alert";
    const notificationBody = `${detectedStr}: ${descStr}`;

    console.log("[ML Alert] Sending push notification to:", expoPushToken);

    // Send push notification via Expo
    try {
      const notificationPayload = {
        to: expoPushToken,
        sound: "default",
        title: notificationTitle,
        body: notificationBody,
        badge: 1,
        priority: "high",
        data: {
          type: "mlAlert",
          deviceId: deviceId,
          deviceIdentifier: deviceIdentifier,
          alertId: alertRef.id,
          riskLabel: mlAlert.risk_label,
          detectedObjects: detectedStr,
          description: descStr,
          timestamp: new Date().toISOString(),
        },
      };

      const expoResponse = await axios.post(
        "https://exp.host/--/api/v2/push/send",
        notificationPayload,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      console.log("[ML Alert] Expo API response:", expoResponse.status);

      // Check for errors in response
      if (expoResponse.data?.data?.status === "error") {
        console.error("[ML Alert] Expo error:", expoResponse.data.data.message);
        return res.status(201).json({
          success: true,
          alertId: alertRef.id,
          message: "Alert stored but push notification failed",
          warning: expoResponse.data.data.message,
        });
      }

      if (expoResponse.data?.errors?.length > 0) {
        console.error("[ML Alert] Expo errors:", expoResponse.data.errors);
        return res.status(201).json({
          success: true,
          alertId: alertRef.id,
          message: "Alert stored but push notification failed",
          warning: expoResponse.data.errors[0].message,
        });
      }

      console.log("[ML Alert] ✅ Push notification sent successfully");

      return res.status(201).json({
        success: true,
        alertId: alertRef.id,
        message: "Alert received, stored, and push notification sent",
      });
    } catch (expoError) {
      console.error("[ML Alert] Error sending Expo notification:", expoError.message);
      return res.status(201).json({
        success: true,
        alertId: alertRef.id,
        message: "Alert stored successfully",
        warning: "Push notification failed to send",
      });
    }
  } catch (error) {
    console.error("[ML Alert] Error processing ML alert:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process ML alert",
      details: error.message,
    });
  }
});

/**
 * 🧹 Cleanup: Remove old ML alerts older than 30 days
 * Runs daily at 2 AM UTC
 */
exports.cleanupOldMLAlerts = functions.pubsub
  .schedule("0 2 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const devicesSnapshot = await db.collection("devices").get();
      let deletedCount = 0;

      for (const deviceDoc of devicesSnapshot.docs) {
        const alertsSnapshot = await db
          .collection("devices")
          .doc(deviceDoc.id)
          .collection("alerts")
          .where("timestamp", "<", thirtyDaysAgo)
          .get();

        for (const alertDoc of alertsSnapshot.docs) {
          await alertDoc.ref.delete();
          deletedCount++;
        }
      }

      console.log(`[Cleanup] Deleted ${deletedCount} old ML alerts`);
      return { success: true, deletedCount };
    } catch (error) {
      console.error("[Cleanup] Error cleaning up old ML alerts:", error);
      throw error;
    }
  });

/**
 * 🧹 Cleanup: Remove old sensor alerts older than 30 days
 * Runs daily at 2 AM UTC
 */
exports.cleanupOldSensorAlerts = functions.pubsub
  .schedule("0 3 * * *")
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

      console.log(`[Cleanup] Deleted ${deletedCount} old sensor alerts`);
      return { success: true, deletedCount };
    } catch (error) {
      console.error("[Cleanup] Error cleaning up old sensor alerts:", error);
      throw error;
    }
  });

/**
 * �🧹 Cleanup: Remove old alerts older than 30 days
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

/**
 * 🤖 HTTP endpoint to receive ML alerts from remote devices
 * POST request with ML alert data
 */
exports.receiveMLAlert = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return res.status(400).json({ error: "Only POST requests allowed" });
  }

  try {
    const { deviceId, deviceIdentifier, detectedObjects, riskLabel, description, screenshots, confidenceScore, userId } = req.body;

    // Validate required fields
    if (!deviceId || !userId) {
      return res.status(400).json({ error: "Missing required: deviceId, userId" });
    }

    console.log("[ML Alert] Received alert from device:", deviceId);

    // Get user document to fetch FCM token
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.log("[ML Alert] User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    const fcmToken = userData.expoPushToken || userData.fcmToken;

    if (!fcmToken) {
      console.log("[ML Alert] No FCM token for user:", userId);
      return res.status(400).json({ error: "User has no FCM token registered" });
    }

    // Create alert document in Firestore
    const alertRef = db.collection("users").doc(userId).collection("mlAlerts").doc();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const alertData = {
      id: alertRef.id,
      deviceId,
      deviceIdentifier: deviceIdentifier || "Unknown Device",
      detectedObjects: detectedObjects || [],
      riskLabel: riskLabel || "medium",
      description: description || [],
      screenshots: screenshots || [],
      confidenceScore: confidenceScore || 0,
      timestamp,
      acknowledged: false,
      userRating: null,
      accuracyFeedback: null,
    };

    // Save to Firestore
    await alertRef.set(alertData);
    console.log("[ML Alert] Saved alert to Firestore:", alertRef.id);

    // Send push notification via Expo (not FCM)
    // Expo tokens start with ExponentPushToken[...]
    let messageId = null;
    let notificationStatus = "no_token";
    
    console.log("[ML Alert] FCM Token received:", fcmToken?.substring(0, 30) + "...");
    
    if (!fcmToken) {
      console.warn("[ML Alert] No FCM token available for user:", userId);
      notificationStatus = "no_token";
    } else if (fcmToken.startsWith("ExponentPushToken")) {
      try {
        console.log("[ML Alert] Sending Expo notification to token:", fcmToken.substring(0, 30) + "...");
        const response = await axios.post("https://exp.host/--/api/v2/push/send", {
          to: fcmToken,
          sound: "default",
          title: `🤖 ${riskLabel?.toUpperCase() || "ALERT"} - ${deviceIdentifier || "Unknown Device"}`,
          body: `Detected: ${detectedObjects?.join(", ") || "Object detection"}`,
          data: {
            alertId: alertRef.id,
            deviceId,
            riskLabel: riskLabel || "medium",
            confidenceScore: (confidenceScore * 100).toFixed(0).toString(),
          },
        });
        messageId = response.data.id;
        notificationStatus = "sent";
        console.log("[ML Alert] ✅ Expo push notification sent:", messageId);
      } catch (pushError) {
        console.error("[ML Alert] ❌ Failed to send Expo push notification:", pushError.message, pushError.response?.data);
        notificationStatus = "failed";
        // Continue anyway - alert is still saved in Firestore
      }
    } else {
      console.warn("[ML Alert] ⚠️ Token does not start with ExponentPushToken:", fcmToken?.substring(0, 30) + "...");
      notificationStatus = "invalid_token_format";
    }

    return res.status(200).json({
      success: true,
      alertId: alertRef.id,
      messageId,
      notificationStatus,
      message: "ML alert received and notification sent",
    });
  } catch (error) {
    console.error("[ML Alert] Error:", error);
    return res.status(500).json({
      error: "Failed to process ML alert",
      details: error.message,
    });
  }
});

/**
 * 🔍 Batch endpoint to receive multiple ML alerts at once
 */
exports.receiveMLAlertBatch = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return res.status(400).json({ error: "Only POST requests allowed" });
  }

  try {
    const { alerts } = req.body;

    if (!Array.isArray(alerts) || alerts.length === 0) {
      return res.status(400).json({ error: "Invalid alerts array" });
    }

    const results = [];

    for (const alert of alerts) {
      try {
        const { deviceId, userId, deviceIdentifier, detectedObjects, riskLabel, description, screenshots, confidenceScore } = alert;

        if (!deviceId || !userId) {
          results.push({
            deviceId,
            success: false,
            error: "Missing required fields",
          });
          continue;
        }

        // Get user FCM token
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
          results.push({
            deviceId,
            success: false,
            error: "User not found",
          });
          continue;
        }

        const fcmToken = userDoc.data().expoPushToken || userDoc.data().fcmToken;
        if (!fcmToken) {
          results.push({
            deviceId,
            success: false,
            error: "No FCM token",
          });
          continue;
        }

        // Save alert
        const alertRef = db.collection("users").doc(userId).collection("mlAlerts").doc();
        const alertData = {
          id: alertRef.id,
          deviceId,
          deviceIdentifier: deviceIdentifier || "Unknown Device",
          detectedObjects: detectedObjects || [],
          riskLabel: riskLabel || "medium",
          description: description || [],
          screenshots: screenshots || [],
          confidenceScore: confidenceScore || 0,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          acknowledged: false,
          userRating: null,
          accuracyFeedback: null,
        };

        await alertRef.set(alertData);

        // Send notification via Expo
        let notificationSent = false;
        if (fcmToken && fcmToken.startsWith("ExponentPushToken")) {
          try {
            await axios.post("https://exp.host/--/api/v2/push/send", {
              to: fcmToken,
              sound: "default",
              title: `🤖 ${riskLabel?.toUpperCase() || "ALERT"} - ${deviceIdentifier || "Unknown Device"}`,
              body: `Detected: ${detectedObjects?.join(", ") || "Object detection"}`,
              data: {
                alertId: alertRef.id,
                deviceId,
                riskLabel: riskLabel || "medium",
              },
            });
            notificationSent = true;
          } catch (pushError) {
            console.warn("[ML Alert Batch] Failed to send Expo notification:", pushError.message);
          }
        }

        results.push({
          deviceId,
          success: true,
          alertId: alertRef.id,
        });
      } catch (error) {
        results.push({
          deviceId: alert.deviceId,
          success: false,
          error: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("[ML Alert Batch] Error:", error);
    return res.status(500).json({
      error: "Failed to process batch",
      details: error.message,
    });
  }
});
