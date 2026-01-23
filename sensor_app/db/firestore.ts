import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  getFirestore,
} from "firebase/firestore";
import { auth } from "../firebase/firebaseConfig";
import { getFunctions, httpsCallable } from "firebase/functions";

const db = getFirestore();

/**
 * 🔍 Firestore Collections Structure:
 * 
 * - devices/{deviceId}
 *   - label: string (e.g., "Device A", "Device 1")
 *   - userId: string (owner)
 *   - createdAt: timestamp
 *   - lastSeen: timestamp
 * 
 * - devices/{deviceId}/readings/{readingId}
 *   - value: number
 *   - timestamp: timestamp
 * 
 * - devices/{deviceId}/alerts/{alertId}
 *   - type: string
 *   - message: string
 *   - createdAt: timestamp
 *
 * - sensors/{sensorId}
 *   - name: string
 *   - type: string (temperature, humidity, etc)
 *   - location: string
 *   - userId: string (owner)
 *   - unit?: string
 *   - description?: string
 *   - alertThreshold?: { min: number, max: number }
 *   - createdAt: timestamp
 *   - updatedAt: timestamp
 * 
 * - sensors/{sensorId}/readings/{readingId}
 *   - value: number
 *   - timestamp: timestamp
 * 
 * - users/{userId}
 *   - email: string
 *   - expoPushToken: string (for server-side notifications)
 *   - tokenUpdatedAt: timestamp
 */

/**
 * Listen to real-time sensor updates for current user
 */
export const listenToUserSensors = (callback: (sensors: any[]) => void) => {
  const user = auth.currentUser;
  if (!user) {
    console.error("[Firestore] No user authenticated");
    return () => {};
  }

  console.log("[Firestore] Setting up real-time listener for user:", user.uid);

  const q = query(
    collection(db, "sensors"),
    where("userId", "==", user.uid)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const sensors = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(sensors);
  }, (error) => {
    console.error("[Firestore] Listener error:", error);
  });

  return unsubscribe;
};

/**
 * Get all sensors for current user (one-time fetch)
 */
export async function getUserSensors() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("User not authenticated");

  try {
    const q = query(
      collection(db, "sensors"),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("[Firestore] Error getting sensors:", error);
    throw error;
  }
}

/**
 * Add a new sensor for current user
 */
export async function addSensor(sensorData: {
  name: string;
  type: string;
  location: string;
  unit?: string;
  description?: string;
  alertThreshold?: { min?: number; max?: number };
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user authenticated");

  try {
    const docRef = await addDoc(collection(db, "sensors"), {
      ...sensorData,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log("[Firestore] Sensor added:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("[Firestore] Error adding sensor:", error);
    throw error;
  }
}

/**
 * Update sensor alert thresholds
 */
export async function updateSensorAlertThreshold(
  sensorId: string,
  threshold: { min?: number; max?: number }
) {
  try {
    await updateDoc(doc(db, "sensors", sensorId), {
      alertThreshold: threshold,
      updatedAt: serverTimestamp(),
    });
    console.log("[Firestore] Alert threshold updated:", sensorId);
  } catch (error) {
    console.error("[Firestore] Error updating alert threshold:", error);
    throw error;
  }
}

/**
 * Get sensor alert thresholds
 */
export async function getSensorAlertThreshold(sensorId: string) {
  try {
    const docSnap = await getDocs(
      query(
        collection(db, "sensors"),
        where("__name__", "==", sensorId)
      )
    );
    
    if (docSnap.empty) return null;
    
    const sensorData = docSnap.docs[0].data();
    return sensorData.alertThreshold || null;
  } catch (error) {
    console.error("[Firestore] Error getting alert threshold:", error);
    return null;
  }
}

/**
 * Delete a sensor
 */
export async function deleteSensorData(sensorId: string) {
  try {
    await deleteDoc(doc(db, "sensors", sensorId));
    console.log("[Firestore] Sensor deleted:", sensorId);
  } catch (error) {
    console.error("[Firestore] Error deleting sensor:", error);
    throw error;
  }
}

/**
 * Add sensor reading/data point
 */
export async function addSensorReadingData(
  sensorId: string,
  reading: {
    value: number;
    timestamp?: Date;
  }
) {
  try {
    const docRef = await addDoc(
      collection(db, "sensors", sensorId, "readings"),
      {
        ...reading,
        timestamp: reading.timestamp || serverTimestamp(),
      }
    );
    console.log("[Firestore] Reading added:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("[Firestore] Error adding reading:", error);
    throw error;
  }
}

/**
 * Listen to sensor readings in real-time
 */
export function listenToSensorReadingsData(
  sensorId: string,
  callback: (readings: any[]) => void,
  limit: number = 100
) {
  try {
    const q = query(
      collection(db, "sensors", sensorId, "readings")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const readings = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => {
          const timeA = a.timestamp?.toMillis?.() || 0;
          const timeB = b.timestamp?.toMillis?.() || 0;
          return timeB - timeA;
        })
        .slice(0, limit);

      callback(readings);
    }, (error) => {
      console.error("[Firestore] Readings listener error:", error);
    });

    return unsubscribe;
  } catch (error) {
    console.error("[Firestore] Error setting up readings listener:", error);
    return () => {};
  }
}

// ============================================
// 📱 DEVICE MANAGEMENT FUNCTIONS
// ============================================

/**
 * Listen to real-time device updates for current user
 */
export const listenToUserDevices = (callback: (devices: any[]) => void) => {
  const user = auth.currentUser;
  if (!user) {
    console.error("[Firestore] No user authenticated");
    return () => {};
  }

  console.log("[Firestore] Setting up real-time listener for devices for user:", user.uid);

  const q = query(
    collection(db, "devices"),
    where("userId", "==", user.uid)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const devices = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(devices);
  }, (error) => {
    console.error("[Firestore] Devices listener error:", error);
  });

  return unsubscribe;
};

/**
 * Get all devices for current user (one-time fetch)
 */
export async function getUserDevices() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("User not authenticated");

  try {
    const q = query(
      collection(db, "devices"),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("[Firestore] Error getting devices:", error);
    throw error;
  }
}

/**
 * Add a new device for current user
 * Remote devices will call this or create it directly
 */
export async function addDevice(deviceData: {
  label: string;
  deviceId?: string;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user authenticated");

  try {
    // If no deviceId provided, use auto-generated document ID
    const finalDeviceId = deviceData.deviceId || undefined;
    
    const deviceDoc = {
      label: deviceData.label,
      userId: user.uid,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    };

    let docRef;
    if (finalDeviceId) {
      // Create with specific device ID
      await updateDoc(doc(db, "devices", finalDeviceId), deviceDoc);
      docRef = { id: finalDeviceId };
    } else {
      // Auto-generate device ID
      docRef = await addDoc(collection(db, "devices"), deviceDoc);
    }

    console.log("[Firestore] Device added:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("[Firestore] Error adding device:", error);
    throw error;
  }
}

/**
 * Update device label
 */
export async function updateDeviceLabel(
  deviceId: string,
  label: string
) {
  try {
    await updateDoc(doc(db, "devices", deviceId), {
      label: label,
      lastSeen: serverTimestamp(),
    });
    console.log("[Firestore] Device label updated:", deviceId);
  } catch (error) {
    console.error("[Firestore] Error updating device label:", error);
    throw error;
  }
}

/**
 * Claim an existing device (add userId to it)
 */
export async function claimExistingDevice(deviceId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user authenticated");

  try {
    await updateDoc(doc(db, "devices", deviceId), {
      userId: user.uid,
      lastSeen: serverTimestamp(),
    });
    console.log("[Firestore] Device claimed:", deviceId);
    return deviceId;
  } catch (error) {
    console.error("[Firestore] Error claiming device:", error);
    throw error;
  }
}

/**
 * Delete a device
 */
export async function deleteDevice(deviceId: string) {
  try {
    await deleteDoc(doc(db, "devices", deviceId));
    console.log("[Firestore] Device deleted:", deviceId);
  } catch (error) {
    console.error("[Firestore] Error deleting device:", error);
    throw error;
  }
}

/**
 * Add device reading/data point
 */
export async function addDeviceReading(
  deviceId: string,
  reading: {
    value: number;
    timestamp?: Date;
  }
) {
  try {
    const docRef = await addDoc(
      collection(db, "devices", deviceId, "readings"),
      {
        ...reading,
        timestamp: reading.timestamp || serverTimestamp(),
      }
    );
    console.log("[Firestore] Device reading added:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("[Firestore] Error adding device reading:", error);
    throw error;
  }
}

/**
 * Listen to device readings in real-time
 */
export function listenToDeviceReadings(
  deviceId: string,
  callback: (readings: any[]) => void,
  limit: number = 100
) {
  try {
    const q = query(
      collection(db, "devices", deviceId, "readings")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const readings = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => {
          const timeA = a.timestamp?.toMillis?.() || 0;
          const timeB = b.timestamp?.toMillis?.() || 0;
          return timeB - timeA;
        })
        .slice(0, limit);

      callback(readings);
    }, (error: any) => {
      // Silently ignore permission errors (happens when user logs out)
      if (error?.code === "permission-denied") {
        console.log("[Firestore] Readings listener: Permission denied (user may be logged out)");
        return;
      }
      console.error("[Firestore] Readings listener error:", error);
    });

    return unsubscribe;
  } catch (error) {
    console.error("[Firestore] Error setting up readings listener:", error);
    return () => {};
  }
}

/**
 * Get ALL devices from Firestore (for device selection)
 */
export async function getAllAvailableDevices() {
  try {
    const querySnapshot = await getDocs(collection(db, "devices"));
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("[Firestore] Error getting all devices:", error);
    throw error;
  }
}

/**
 * Get unassigned devices (devices without a userId or with different userId)
 * Also filters out devices already assigned to current user
 */
export async function getAvailableDevicesForUser() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("User not authenticated");

  try {
    const allDevices = await getAllAvailableDevices();
    const userDevices = await getUserDevices();
    
    const userDeviceIds = new Set(userDevices.map(d => d.id));
    
    // Filter devices that either:
    // 1. Don't have a userId (unassigned)
    // 2. Have the current user's ID
    // But exclude ones already in user's device list and test devices
    const available = allDevices.filter((device) => {
      // Exclude if already in user's device list
      if (userDeviceIds.has(device.id)) {
        return false;
      }
      
      // Exclude test devices
      const label = (device.label || "").toLowerCase();
      const name = (device.name || "").toLowerCase();
      if (label.includes("test device") || name.includes("test")) {
        console.log("[Firestore] Excluding test device:", device.id, device.label);
        return false;
      }
      
      // Include if device exists and has real label or name
      return (device.label || device.name) && device.id;
    });

    console.log("[Firestore] Available devices for user:", available);
    return available;
  } catch (error) {
    console.error("[Firestore] Error getting available devices:", error);
    throw error;
  }
}

/**
 * Claim a device for the current user
 */
export async function claimDevice(deviceId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user authenticated");

  try {
    await updateDoc(doc(db, "devices", deviceId), {
      userId: user.uid,
      claimedAt: serverTimestamp(),
    });
    console.log("[Firestore] Device claimed:", deviceId);
    return deviceId;
  } catch (error) {
    console.error("[Firestore] Error claiming device:", error);
    throw error;
  }
}

/**
 * Unclaim a device (remove user association, don't delete)
 */
export async function unclaimDevice(deviceId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user authenticated");

  try {
    await updateDoc(doc(db, "devices", deviceId), {
      userId: null,
    });
    console.log("[Firestore] Device unclaimed:", deviceId);
    return deviceId;
  } catch (error) {
    console.error("[Firestore] Error unclaiming device:", error);
    throw error;
  }
}

/**
 * Create test unassigned devices via Cloud Function
 * This uses admin SDK on the backend to bypass security rules
 */
export async function createTestDevices() {
  try {
    const functions = getFunctions();
    const createTestDevicesFunction = httpsCallable(functions, "createTestDevices");
    
    const result = await createTestDevicesFunction({});
    console.log("[Firestore] Test devices created via Cloud Function:", result.data);
    return result.data.created || [];
  } catch (error) {
    console.error("[Firestore] Error calling createTestDevices Cloud Function:", error);
    throw error;
  }
}

/**
 * Listen to all alerts from owned devices
 */
export function listenToUserAlerts(callback: (alerts: any[]) => void) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user authenticated");

    const unsubscribes: (() => void)[] = [];

    // Query all devices owned by user
    const devicesQuery = query(
      collection(db, "devices"),
      where("userId", "==", user.uid)
    );

    const unsubscribeDevices = onSnapshot(devicesQuery, (devicesSnapshot) => {
      // Unsubscribe from previous alert listeners
      unsubscribes.forEach(unsub => unsub());
      unsubscribes.length = 0;

      const allAlerts: any[] = [];
      let completedListeners = 0;
      const totalDevices = devicesSnapshot.docs.length;

      if (totalDevices === 0) {
        callback([]);
        return;
      }

      // For each device, listen to its alerts
      devicesSnapshot.docs.forEach((deviceDoc) => {
        const alertsRef = collection(db, "devices", deviceDoc.id, "alerts");
        
        const unsubscribeAlerts = onSnapshot(alertsRef, (alertsSnapshot) => {
          // Clear previous alerts for this device
          const deviceAlerts = allAlerts.filter(alert => alert.deviceId !== deviceDoc.id);

          // Add new alerts from this device
          alertsSnapshot.docs.forEach((alertDoc) => {
            deviceAlerts.push({
              id: alertDoc.id,
              deviceId: deviceDoc.id,
              deviceLabel: deviceDoc.data().name || deviceDoc.data().label,
              ...alertDoc.data(),
            });
          });

          // Update allAlerts with this device's alerts
          allAlerts.length = 0;
          devicesSnapshot.docs.forEach((device) => {
            const thisDeviceAlerts = deviceAlerts.filter(a => a.deviceId === device.id);
            allAlerts.push(...thisDeviceAlerts);
          });

          // Sort by timestamp descending (latest first)
          allAlerts.sort((a, b) => {
            const timeA = a.timestamp?.toMillis?.() || 0;
            const timeB = b.timestamp?.toMillis?.() || 0;
            return timeB - timeA;
          });

          callback(allAlerts);
        }, (error) => {
          // Silently handle permission denied errors
          if (error.code !== "permission-denied") {
            console.error("[Firestore] Error listening to alerts:", error);
          }
        });

        unsubscribes.push(unsubscribeAlerts);
      });
    });

    return () => {
      unsubscribeDevices();
      unsubscribes.forEach(unsub => unsub());
    };
  } catch (error) {
    console.error("[Firestore] Error in listenToUserAlerts:", error);
    return () => {};
  }
}

/**
 * Update the rating for a specific alert
 */
export async function updateAlertRating(deviceId: string, alertId: string, rating: number, accuracy: boolean) {
  try {
    const alertRef = doc(db, "devices", deviceId, "alerts", alertId);
    await updateDoc(alertRef, {
      accuracy: accuracy,
      rating: rating,
      ratedAt: serverTimestamp(),
    });
    console.log("[Firestore] Alert feedback updated - Accuracy:", accuracy, "Rating:", rating);
  } catch (error) {
    console.error("[Firestore] Error updating alert feedback:", error);
    throw error;
  }
}

/**
 * Delete test devices from Firestore
 */
export async function deleteTestDevices() {
  try {
    const devicesSnapshot = await getDocs(collection(db, "devices"));
    let deletedCount = 0;

    for (const docSnapshot of devicesSnapshot.docs) {
      const device = docSnapshot.data();
      const deviceLabel = device.label || "";
      const deviceName = device.name || "";
      
      // Delete devices with "Test Device" in label
      if (deviceLabel.toLowerCase().includes("test device")) {
        await deleteDoc(doc(db, "devices", docSnapshot.id));
        console.log("[Firestore] Deleted test device:", docSnapshot.id, deviceLabel);
        deletedCount++;
      }
    }

    console.log("[Firestore] Cleanup complete - Deleted", deletedCount, "test devices");
    return deletedCount;
  } catch (error) {
    console.error("[Firestore] Error deleting test devices:", error);
    throw error;
  }
}

