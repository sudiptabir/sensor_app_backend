import * as Notifications from "expo-notifications";
import { registerFCMToken, setupFCMListeners } from "../firebase/fcmService";

/**
 * Initialize push notifications and FCM
 */
export const initPushNotifications = async () => {
  try {
    console.log("[Notifications] Initializing push notifications");

    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Get permission status
    const permission = await Notifications.getPermissionsAsync();
    console.log("[Notifications] Permission status:", permission.status);

    if (permission.status !== "granted") {
      console.log("[Notifications] Requesting notification permissions");
      const newPermission = await Notifications.requestPermissionsAsync();
      
      if (newPermission.status === "granted") {
        console.log("[Notifications] ✅ Permission granted");
      } else {
        console.warn("[Notifications] Permission denied");
        return;
      }
    }

    // Register FCM token for server-side messaging
    await registerFCMToken();

    // Setup FCM listeners
    setupFCMListeners();

    console.log("[Notifications] ✅ Initialization complete");
    return true;
  } catch (error) {
    console.error("[Notifications] Error initializing:", error);
  }
};

/**
 * Send a local test notification
 */
export const sendTestNotification = async (
  title: string = "Test Alert",
  message: string = "This is a test notification"
) => {
  try {
    console.log("[Notifications] Sending test notification");
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        badge: 1,
        sound: true,
        data: {
          testData: true,
        },
      },
      trigger: {
        type: "time",
        seconds: 2,
      },
    });
    console.log("[Notifications] Test notification scheduled");
  } catch (error) {
    console.error("[Notifications] Error sending test notification:", error);
  }
};

/**
 * Send sensor alert notification with threshold info
 */
export const sendSensorAlert = async (
  sensorName: string,
  alertMessage: string,
  severity: "info" | "warning" | "error" = "warning",
  sensorId?: string,
  value?: number,
  threshold?: number
) => {
  try {
    const emoji = severity === "error" ? "🚨" : severity === "warning" ? "⚠️" : "ℹ️";
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} ${sensorName}`,
        body: alertMessage,
        badge: 1,
        sound: true,
        data: {
          sensorName,
          severity,
          type: "sensorAlert",
          sensorId: sensorId || "",
          value: value?.toString() || "",
          threshold: threshold?.toString() || "",
        },
      },
      trigger: {
        type: "time",
        seconds: 1,
      },
    });
    
    console.log("[Notifications] Sensor alert sent:", sensorName);
  } catch (error) {
    console.error("[Notifications] Error sending sensor alert:", error);
  }
};

/**
 * Send FCM alert from server/Cloud Function
 * Used when server sends notifications via Firebase Cloud Messaging
 */
export const sendFCMAlert = async (
  sensorName: string,
  value: number,
  threshold: number,
  severity: "info" | "warning" | "error" = "warning",
  sensorId?: string
) => {
  const emoji = severity === "error" ? "🚨" : severity === "warning" ? "⚠️" : "ℹ️";
  const alertMessage = `Value: ${value} (Threshold: ${threshold})`;
  
  await sendSensorAlert(
    sensorName,
    alertMessage,
    severity,
    sensorId,
    value,
    threshold
  );
};

/**
 * Setup notification listeners
 */
export const setupNotificationListeners = () => {
  // Handle notification received while app is in foreground
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log("[Notifications] Notification received (foreground):", notification);
    }
  );

  // Handle notification when user taps on it
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log("[Notifications] Notification tapped:", response);
      // You can add navigation logic here
    }
  );

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
};
