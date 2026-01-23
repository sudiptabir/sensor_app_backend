import * as Notifications from "expo-notifications";
import { doc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth } from "./firebaseConfig";
import { db } from "./firebaseConfig";

/**
 * 📱 Get and store Expo push token
 * This token allows the server to send push notifications to this device
 */
export const registerFCMToken = async () => {
  try {
    console.log("[FCM] Registering device token");

    // Get Expo push token
    const token = await Notifications.getExpoPushTokenAsync();
    console.log("[FCM] Expo push token:", token.data);

    // Store token in user's Firestore document for server-side messaging
    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, "users", user.uid);
      // Use setDoc with merge option to create or update
      await setDoc(
        userRef,
        {
          expoPushToken: token.data,
          tokenUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log("[FCM] ✅ Token stored in Firestore");
    }

    return token.data;
  } catch (error: any) {
    console.warn("[FCM] Warning registering token:", error.message);
    // Don't fail - token registration is optional for local testing
    // Cloud Functions will gracefully handle missing tokens
    return null;
  }
};

/**
 * 🔔 Handle incoming FCM messages and local notifications
 */
export const setupFCMListeners = () => {
  try {
    console.log("[FCM] Setting up notification handlers");

    // Handle notification when app is in foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("[FCM] 📬 Notification received in foreground:", notification);
        handleNotificationReceived(notification);
      }
    );

    // Handle notification tap/response
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("[FCM] 👆 Notification tapped:", response);
        handleNotificationResponse(response);
      }
    );

    console.log("[FCM] ✅ Listeners setup complete");

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  } catch (error) {
    console.error("[FCM] Error setting up listeners:", error);
  }
};

/**
 * Process received notifications
 */
export const handleNotificationReceived = (notification: Notifications.Notification) => {
  const data = notification.request.content.data;

  if (data.type === "sensorAlert") {
    console.log("[FCM] 🚨 Sensor alert received:", {
      sensorName: data.sensorName,
      severity: data.severity,
      value: data.value,
      threshold: data.threshold,
    });
  }
};

/**
 * Handle notification tap
 */
export const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
  const data = response.notification.request.content.data;

  if (data.type === "sensorAlert") {
    console.log("[FCM] Navigating to sensor:", data.sensorId);
    // TODO: Navigate to sensor detail screen with router
    // router.push(`/sensor/${data.sensorId}`);
  }
};
