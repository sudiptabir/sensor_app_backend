import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "../firebase/firebaseConfig";
import { getFirestore } from "firebase/firestore";

const db = getFirestore();

/**
 * Generate test sensors and readings for development
 */
export const generateTestData = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("No user authenticated");

  console.log("[TestData] Generating test data for user:", user.uid);

  const sensors = [
    {
      name: "Living Room Temperature",
      type: "temperature",
      location: "Living Room",
      unit: "°C",
      description: "Main living area temperature sensor",
    },
    {
      name: "Bedroom Humidity",
      type: "humidity",
      location: "Bedroom",
      unit: "%",
      description: "Bedroom humidity monitoring",
    },
    {
      name: "Kitchen Pressure",
      type: "pressure",
      location: "Kitchen",
      unit: "hPa",
      description: "Atmospheric pressure sensor",
    },
    {
      name: "Motion Detector",
      type: "motion",
      location: "Hallway",
      unit: "boolean",
      description: "Motion detection in hallway",
    },
  ];

  try {
    // Create sensors and their readings
    for (const sensorData of sensors) {
      console.log("[TestData] Creating sensor:", sensorData.name);

      const sensorRef = await addDoc(collection(db, "sensors"), {
        ...sensorData,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log("[TestData] Sensor created with ID:", sensorRef.id);

      // Add sample readings
      const readings = generateSampleReadings(sensorData.type);
      
      for (const reading of readings) {
        await addDoc(
          collection(db, "sensors", sensorRef.id, "readings"),
          {
            value: reading.value,
            timestamp: reading.timestamp,
          }
        );
      }

      console.log("[TestData] Added", readings.length, "readings for", sensorData.name);
    }

    console.log("[TestData] ✅ Test data generation complete!");
    return true;
  } catch (error) {
    console.error("[TestData] ❌ Error generating test data:", error);
    throw error;
  }
};

/**
 * Generate sample readings based on sensor type
 */
function generateSampleReadings(type: string): Array<{ value: number; timestamp: any }> {
  const now = new Date();
  const readings = [];

  // Generate 24 hourly readings
  for (let i = 0; i < 24; i++) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    let value: number;

    switch (type) {
      case "temperature":
        // Random temperature between 18-28°C with some variation
        value = 20 + Math.random() * 8 + Math.sin(i / 24 * Math.PI) * 3;
        break;
      case "humidity":
        // Random humidity between 30-70%
        value = 40 + Math.random() * 30 + Math.sin(i / 24 * Math.PI) * 10;
        break;
      case "pressure":
        // Random pressure between 1010-1020 hPa
        value = 1013 + Math.random() * 10 + Math.sin(i / 24 * Math.PI) * 3;
        break;
      case "motion":
        // Random boolean-like values (0 or 1)
        value = Math.random() > 0.7 ? 1 : 0;
        break;
      default:
        value = Math.random() * 100;
    }

    readings.push({
      value: Math.round(value * 100) / 100,
      timestamp,
    });
  }

  return readings;
}

/**
 * Delete all test data for current user
 */
export const deleteTestData = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("No user authenticated");

  console.log("[TestData] Deleting test data for user:", user.uid);

  try {
    const sensorsRef = collection(db, "sensors");
    const querySnapshot = await (
      await import("firebase/firestore")
    ).getDocs(
      (await import("firebase/firestore")).query(
        sensorsRef,
        (await import("firebase/firestore")).where("userId", "==", user.uid)
      )
    );

    let deleted = 0;
    for (const doc of querySnapshot.docs) {
      await (await import("firebase/firestore")).deleteDoc(
        (await import("firebase/firestore")).doc(db, "sensors", doc.id)
      );
      deleted++;
    }

    console.log("[TestData] ✅ Deleted", deleted, "sensors and all their readings");
    return true;
  } catch (error) {
    console.error("[TestData] ❌ Error deleting test data:", error);
    throw error;
  }
};
