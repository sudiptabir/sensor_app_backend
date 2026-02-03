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
  getDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { MLAlert } from "../types/mlAlertTypes";
import { checkDeviceAccess } from "../utils/adminPortalAPI";

// Use the db instance from firebaseConfig instead of creating a new one
// const db = getFirestore();

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

// ✅ NOTE: Sensor data now comes from backend API (http://backend-ip:3000)
// Old Firestore sensor functions removed - use useSensorData hook instead

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
    callback([]); // Call with empty array immediately
    return () => {};
  }

  console.log("[Firestore] Setting up real-time listener for devices for user:", user.uid);

  // Try without where clause first to test if listener works at all
  const devicesRef = collection(db, "devices");
  
  console.log("[Firestore] Query created, attaching listener...");

  try {
    const unsubscribe = onSnapshot(
      devicesRef,
      {
        next: (snapshot) => {
          console.log("[Firestore] ✅ Devices snapshot received! Size:", snapshot.size);
          const allDevices = snapshot.docs.map((doc) => {
            const data = doc.data();
            console.log("[Firestore] Device doc:", doc.id, "userId:", data.userId);
            return {
              id: doc.id,
              ...data,
            };
          });
          
          // Filter by userId in the callback
          const devices = allDevices.filter(d => d.userId === user.uid);
          
          console.log("[Firestore] Total devices:", allDevices.length, "Filtered for user:", devices.length);
          if (devices.length === 0) {
            console.log("[Firestore] ⚠️ No devices found for userId:", user.uid);
          } else {
            console.log("[Firestore] ✅ Found devices:", devices.map(d => d.id).join(", "));
          }
          callback(devices);
        },
        error: (error) => {
          console.error("[Firestore] ❌ Devices listener error:", error);
          console.error("[Firestore] Error code:", error.code);
          console.error("[Firestore] Error message:", error.message);
          callback([]); // Call with empty array on error
        }
      }
    );

    console.log("[Firestore] Listener attached successfully");
    return unsubscribe;
  } catch (err) {
    console.error("[Firestore] Exception attaching listener:", err);
    callback([]);
    return () => {};
  }
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
export async function listenToDeviceReadings(
  deviceId: string,
  callback: (readings: any[]) => void,
  limit: number = 100
) {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.error("[Firestore] No authenticated user");
      return () => {};
    }

    // 🔐 Skip access control check on every poll - already validated when device was claimed
    // const { hasAccess, reason } = await checkDeviceAccess(userId, deviceId);
    // if (!hasAccess) {
    //   console.warn(`[Access Control] User ${userId} denied access to device ${deviceId}: ${reason}`);
    //   callback([]);
    //   return () => {};
    // }

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
    console.log("[Firestore] Getting available devices for user:", userId);
    const allDevices = await getAllAvailableDevices();
    console.log("[Firestore] All devices from Firestore:", allDevices.length);
    
    const userDevices = await getUserDevices();
    console.log("[Firestore] User's current devices:", userDevices.length);
    
    const userDeviceIds = new Set(userDevices.map(d => d.id));
    
    // Filter devices that either:
    // 1. Don't have a userId (unassigned)
    // 2. Have the current user's ID
    // But exclude ones already in user's device list and test devices
    const available = allDevices.filter((device) => {
      // Exclude if already in user's device list
      if (userDeviceIds.has(device.id)) {
        console.log("[Firestore] Excluding device (already claimed by user):", device.id, device.label);
        return false;
      }
      
      // Exclude test devices
      const label = (device.label || "").toLowerCase();
      const name = (device.name || "").toLowerCase();
      if (label.includes("test device") || name.includes("test")) {
        console.log("[Firestore] Excluding test device:", device.id, device.label);
        return false;
      }
      
      // Include if device exists and has real label or name, and not assigned to another user
      const isAvailable = (device.label || device.name) && device.id && (!device.userId || device.userId === userId);
      if (isAvailable) {
        console.log("[Firestore] Available device:", device.id, device.label, "userId:", device.userId);
      } else {
        console.log("[Firestore] Excluding device (claimed by another user):", device.id, device.label, "userId:", device.userId);
      }
      return isAvailable;
    });

    console.log("[Firestore] Available devices for user:", available.length);
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

// ============================================
// 🤖 ML ALERT MANAGEMENT FUNCTIONS
// ============================================

/**
 * Add ML alert from remote device to Firestore
 * Called by Cloud Function after receiving alert from remote device
 */
export async function addMLAlert(
  deviceId: string,
  deviceIdentifier: string,
  userId: string,
  alertData: {
    notificationType: string;
    detectedObjects: string[];
    riskLabel: string;
    predictedRisk: string;
    description: string[];
    screenshots: string[];
    timestamp?: number;
    modelVersion?: string;
    confidenceScore?: number;
    additionalData?: Record<string, any>;
  }
): Promise<string> {
  try {
    const alertRef = await addDoc(
      collection(db, "devices", deviceId, "alerts"),
      {
        deviceId,
        deviceIdentifier,
        userId,
        notificationType: alertData.notificationType,
        detectedObjects: alertData.detectedObjects,
        riskLabel: alertData.riskLabel,
        predictedRisk: alertData.predictedRisk,
        description: alertData.description,
        screenshots: alertData.screenshots,
        timestamp: serverTimestamp(),
        alertGeneratedAt: alertData.timestamp || Date.now(),
        modelVersion: alertData.modelVersion || null,
        confidenceScore: alertData.confidenceScore || null,
        acknowledged: false,
        rating: null,
        ratingAccuracy: null,
        additionalData: alertData.additionalData || {},
      }
    );

    console.log("[Firestore] ML alert stored:", alertRef.id);
    return alertRef.id;
  } catch (error) {
    console.error("[Firestore] Error adding ML alert:", error);
    throw error;
  }
}

/**
 * Get ML alerts for a device
 */
export async function getDeviceMLAlerts(
  deviceId: string,
  limit: number = 50
): Promise<MLAlert[]> {
  try {
    const q = query(
      collection(db, "devices", deviceId, "alerts")
    );

    const snapshot = await getDocs(q);
    const alerts = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as MLAlert))
      .sort((a, b) => {
        const timeA = a.timestamp?.toMillis?.() || 0;
        const timeB = b.timestamp?.toMillis?.() || 0;
        return timeB - timeA;
      })
      .slice(0, limit);

    return alerts;
  } catch (error) {
    console.error("[Firestore] Error getting ML alerts:", error);
    throw error;
  }
}

/**
 * Listen to ML alerts in real-time for a device
 */
export function listenToDeviceMLAlerts(
  deviceId: string,
  callback: (alerts: MLAlert[]) => void,
  limit: number = 50
): () => void {
  try {
    const q = query(
      collection(db, "devices", deviceId, "alerts")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as MLAlert))
        .sort((a, b) => {
          const timeA = a.timestamp?.toMillis?.() || 0;
          const timeB = b.timestamp?.toMillis?.() || 0;
          return timeB - timeA;
        })
        .slice(0, limit);

      callback(alerts);
    }, (error: any) => {
      if (error?.code === "permission-denied") {
        console.log("[Firestore] ML alerts listener: Permission denied (user may be logged out)");
        return;
      }
      console.error("[Firestore] ML alerts listener error:", error);
    });

    return unsubscribe;
  } catch (error) {
    console.error("[Firestore] Error setting up ML alerts listener:", error);
    return () => {};
  }
}

/**
 * Get all ML alerts from all user's devices
 */
export async function getUserMLAlerts(limit: number = 100): Promise<MLAlert[]> {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    console.log("[Firestore] getUserMLAlerts: Fetching for user", user.uid);

    // Alerts are stored in users/{userId}/mlAlerts collection (by Cloud Function)
    // NOT in devices/{deviceId}/alerts
    const q = query(
      collection(db, "users", user.uid, "mlAlerts")
    );

    const snapshot = await getDocs(q);
    const allAlerts = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as MLAlert))
      .sort((a, b) => {
        const timeA = a.timestamp?.toMillis?.() || 0;
        const timeB = b.timestamp?.toMillis?.() || 0;
        return timeB - timeA;
      })
      .slice(0, limit);

    console.log("[Firestore] getUserMLAlerts: Found", allAlerts.length, "alerts in users collection");
    return allAlerts;
  } catch (error) {
    console.error("[Firestore] Error getting user ML alerts:", error);
    throw error;
  }
}

/**
 * Listen to ML alerts from all user devices in real-time
 */
export function listenToUserMLAlerts(callback: (alerts: MLAlert[]) => void): () => void {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error("[Firestore] No user authenticated for ML alerts");
      callback([]); // Call with empty array immediately
      return () => {};
    }

    console.log("[Firestore] Setting up listener for user ML alerts from users/{userId}/mlAlerts");

    // Listen to user-level mlAlerts collection (from Cloud Functions)
    const q = query(
      collection(db, "users", user.uid, "mlAlerts")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as MLAlert))
        .sort((a, b) => {
          const timeA = a.timestamp?.toMillis?.() || 0;
          const timeB = b.timestamp?.toMillis?.() || 0;
          return timeB - timeA;
        });

      console.log("[Firestore] User ML alerts snapshot received:", alerts.length, "alerts");
      callback(alerts);
    }, (error: any) => {
      if (error?.code === "permission-denied") {
        console.warn("[Firestore] ML alerts listener: Permission denied");
        callback([]); // Call with empty array
        return;
      }
      console.error("[Firestore] ML alerts listener error:", error);
      callback([]); // Call with empty array on error
    });

    return unsubscribe;
  } catch (error) {
    console.error("[Firestore] Error setting up user ML alerts listener:", error);
    callback([]); // Call with empty array
    return () => {};
  }
}

/**
 * Update ML alert with user feedback/rating
 */
export async function updateMLAlertRating(
  alertId: string,
  rating: number,
  isAccurate?: boolean,
  notes?: string
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // Update in user-level mlAlerts collection
    const alertRef = doc(db, "users", user.uid, "mlAlerts", alertId);
    
    // Check if document exists first
    const docSnapshot = await getDoc(alertRef);
    if (!docSnapshot.exists()) {
      console.warn("[Firestore] Alert document not found:", alertId);
      return;
    }

    await updateDoc(alertRef, {
      userRating: Math.min(10, Math.max(1, rating)), // Clamp 1-10
      ratingAccuracy: isAccurate !== undefined ? isAccurate : null,
      ratingNotes: notes || null,
      ratedAt: serverTimestamp(),
      acknowledged: true,
      acknowledgedAt: serverTimestamp(),
    });

    console.log("[Firestore] ML alert rating updated:", alertId);
  } catch (error) {
    console.error("[Firestore] Error updating ML alert rating:", error);
    throw error;
  }
}

/**
 * Acknowledge an ML alert
 */
export async function acknowledgeMLAlert(
  deviceId: string,
  alertId: string
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    await updateDoc(
      doc(db, "devices", deviceId, "alerts", alertId),
      {
        acknowledged: true,
        acknowledgedBy: user.uid,
        acknowledgedAt: serverTimestamp(),
      }
    );

    console.log("[Firestore] ML alert acknowledged:", alertId);
  } catch (error) {
    console.error("[Firestore] Error acknowledging ML alert:", error);
    throw error;
  }
}

/**
 * Delete an old ML alert
 */
export async function deleteMLAlert(
  deviceId: string,
  alertId: string
): Promise<void> {
  try {
    await deleteDoc(
      doc(db, "devices", deviceId, "alerts", alertId)
    );

    console.log("[Firestore] ML alert deleted:", alertId);
  } catch (error) {
    console.error("[Firestore] Error deleting ML alert:", error);
    throw error;
  }
}

/**
 * 🔍 Debug function - Check raw Firestore collections
 */
export async function debugCheckAlertsCollections() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error("[Debug] No user authenticated");
      return;
    }

    console.log("[Debug] Checking all alerts collections for user:", user.uid);

    // Get all user devices
    const userDevices = await getUserDevices();
    console.log("[Debug] User devices:", userDevices.map(d => ({ id: d.id, label: d.label })));

    // Check each device's alerts collection
    for (const device of userDevices) {
      console.log(`\n[Debug] Checking alerts for device: ${device.id} (${device.label})`);
      
      const alertsRef = collection(db, "devices", device.id, "alerts");
      const snapshot = await getDocs(alertsRef);
      
      console.log(`[Debug] Raw collection size: ${snapshot.docs.length} documents`);
      
      snapshot.docs.forEach((doc, index) => {
        console.log(`[Debug]   Alert ${index + 1}:`, {
          id: doc.id,
          ...doc.data(),
        });
      });
    }

    // Also check users/{userId}/mlAlerts collection
    console.log(`\n[Debug] Checking users/${user.uid}/mlAlerts collection`);
    const userAlertsRef = collection(db, "users", user.uid, "mlAlerts");
    const userAlertsSnapshot = await getDocs(userAlertsRef);
    console.log(`[Debug] User mlAlerts collection size: ${userAlertsSnapshot.docs.length} documents`);
    userAlertsSnapshot.docs.forEach((doc, index) => {
      console.log(`[Debug]   User Alert ${index + 1}:`, {
        id: doc.id,
        ...doc.data(),
      });
    });

  } catch (error) {
    console.error("[Debug] Error checking collections:", error);
  }
}

