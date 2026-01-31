import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView, FlatList, TouchableOpacity, Alert, TextInput, Modal, Linking, Share, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { useState, useEffect, useRef } from "react";
import { listenToUserDevices, updateDeviceLabel, listenToDeviceReadings, getAvailableDevicesForUser, claimDevice, unclaimDevice, listenToUserAlerts, updateAlertRating, listenToUserMLAlerts, updateMLAlertRating } from "../db/firestore";
import { useRouter } from "expo-router";
import { initPushNotifications, setupNotificationListeners } from "../utils/notifications";
import { getCameraStreamUrl, getCameraWebUIUrl, getDeviceStreamingInfo } from "../utils/cameraStreaming";
import { rateMLAlert, acknowledgeAlert, deleteAlert } from "../utils/mlAlertHandler";
import MJPEGVideoPlayer from "../utils/MJPEGVideoPlayer";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import type { MLAlert } from "../types/mlAlertTypes";
import SensorCard from "../components/SensorCard";
import IconButton from "../components/IconButton";
import * as FileSystem from 'expo-file-system';
import RNFS from 'react-native-fs';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loggingOut, setLoggingOut] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [mlAlerts, setMLAlerts] = useState<MLAlert[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"alerts" | "devices">("alerts");
  const [deviceReadings, setDeviceReadings] = useState<{[key: string]: any[]}>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [claimingDeviceId, setClaimingDeviceId] = useState<string | null>(null);
  const [unsubscribeAlerts, setUnsubscribeAlerts] = useState<(() => void) | null>(null);
  const [unsubscribeDevices, setUnsubscribeDevices] = useState<(() => void) | null>(null);
  const [unsubscribeMLAlerts, setUnsubscribeMLAlerts] = useState<(() => void) | null>(null);
  const [readingsUnsubscribes, setReadingsUnsubscribes] = useState<(() => void)[]>([]);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedAccuracy, setSelectedAccuracy] = useState<boolean | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedDeviceForVideo, setSelectedDeviceForVideo] = useState<any | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [streamingMode, setStreamingMode] = useState<"http" | "webrtc">("http");
  const [showMLAlertDetailModal, setShowMLAlertDetailModal] = useState(false);
  const [selectedMLAlert, setSelectedMLAlert] = useState<MLAlert | null>(null);
  const [mlAlertRating, setMLAlertRating] = useState<number | null>(null);
  const [mlAlertAccuracy, setMLAlertAccuracy] = useState<boolean | null>(null);
  const [sendingTestNotification, setSendingTestNotification] = useState<string | null>(null);
  
  // Track which alerts have already been notified
  const shownNotificationsRef = useRef<Set<string>>(new Set());

  // Data Recording States
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [selectedDeviceForRecording, setSelectedDeviceForRecording] = useState<any | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<5 | 10>(5);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedData, setRecordedData] = useState<any[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordedDataRef = useRef<any[]>([]);

  // Polling interval ref for devices
  const devicesPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Polling interval ref for ML alerts
  const mlAlertsPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Listen to alerts real-time
  useEffect(() => {
    console.log("[Dashboard] Setting up alerts listener");
    const unsubscribe = listenToUserAlerts((data) => {
      console.log("[Dashboard] Alerts updated:", data.length);
      setAlerts(data);
    });
    setUnsubscribeAlerts(unsubscribe);
    return unsubscribe;
  }, []);

  // Poll ML alerts with fallback (onSnapshot not working reliably)
  useEffect(() => {
    console.log("[Dashboard] Setting up ML alerts polling (fallback from real-time listener)");

    const pollMLAlerts = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const firestore = getFirestore();
        const alertsRef = collection(firestore, 'users', userId, 'mlAlerts');
        const snapshot = await getDocs(alertsRef);
        
        const alerts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as MLAlert[];

        console.log("[Dashboard] ML Alerts polling: Found", alerts.length, "alerts");
        setMLAlerts(alerts);
        setLoading(false);

        // Show local notification for NEW alerts only
        alerts.forEach((alert) => {
          if (alert.id && !shownNotificationsRef.current.has(alert.id)) {
            console.log("[Dashboard] New alert detected, showing notification:", alert.id);
            
            try {
              // Schedule local notification immediately
              Notifications.scheduleNotificationAsync({
                content: {
                  title: `🤖 ${alert.riskLabel?.toUpperCase() || "ALERT"}`,
                  body: `${alert.detectedObjects?.join(", ") || "Detection"} - ${alert.deviceIdentifier || "Unknown Device"}`,
                  badge: 1,
                  sound: true,
                  data: {
                    alertId: alert.id,
                    riskLabel: alert.riskLabel,
                    detectedObjects: alert.detectedObjects?.join(", "),
                  },
                },
                trigger: {
                  type: "time" as const,
                  seconds: 1, // Show immediately
                },
              }).then(() => {
                console.log("[Dashboard] ✅ Notification scheduled for alert:", alert.id);
              }).catch((error) => {
                console.error("[Dashboard] ❌ Failed to schedule notification:", error);
              });
            } catch (error) {
              console.error("[Dashboard] Exception scheduling notification:", error);
            }
            
            shownNotificationsRef.current.add(alert.id);
          }
        });
      } catch (error) {
        console.error("[Dashboard] Error polling ML alerts:", error);
      }
    };

    // Poll every 5 seconds for ML alerts
    pollMLAlerts();
    mlAlertsPollingRef.current = setInterval(pollMLAlerts, 5000);

    return () => {
      if (mlAlertsPollingRef.current) clearInterval(mlAlertsPollingRef.current);
    };
  }, []);

  // Setup notification tap handler to navigate to alert details
  useEffect(() => {
    console.log("[Dashboard] Setting up notification tap handler");
    
    const notificationTapSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const alertId = response.notification.request.content.data?.alertId;
      
      if (alertId) {
        console.log("[Dashboard] Notification tapped for alert:", alertId);
        
        // Find the alert in mlAlerts
        const alert = mlAlerts.find((a) => a.id === alertId);
        if (alert) {
          console.log("[Dashboard] Found alert, opening detail modal");
          setSelectedMLAlert(alert);
          setShowMLAlertDetailModal(true);
          setActiveTab("alerts");
        } else {
          console.warn("[Dashboard] Alert not found in mlAlerts for ID:", alertId);
        }
      }
    });

    return () => {
      notificationTapSubscription.remove();
    };
  }, [mlAlerts]);

  // Listen to devices with polling (fallback from onSnapshot)
  useEffect(() => {
    console.log("[Dashboard] Setting up device polling (fallback from real-time listener)");
    
    // Initial fetch
    const pollDevices = async () => {
      try {
        const db = getFirestore();
        const devicesRef = collection(db, "devices");
        const snapshot = await getDocs(devicesRef);
        
        const allDevices = snapshot.docs.map((doc) => {
          const data = doc.data();
          return { id: doc.id, ...data };
        });
        
        // Filter for current user
        const userDevices = allDevices.filter(d => d.userId === auth.currentUser?.uid);
        
        console.log("[Dashboard] Polling: Found", userDevices.length, "devices for user");
        setDevices(userDevices);
        setLoading(false);

        // Unsubscribe from previous readings listeners
        readingsUnsubscribes.forEach((unsub) => {
          if (typeof unsub === 'function') unsub();
        });

        // Only setup readings listeners if user is still authenticated
        if (!auth.currentUser) {
          console.log("[Dashboard] User not authenticated - skipping readings listeners");
          setReadingsUnsubscribes([]);
          return;
        }

        // Setup readings listeners for each device
        const newUnsubscribes: (() => void)[] = [];
        userDevices.forEach((device) => {
        const readingsUnsub = listenToDeviceReadings(device.id, (readings) => {
          setDeviceReadings((prev) => ({
            ...prev,
            [device.id]: readings,
          }));
        }, 5);
        newUnsubscribes.push(readingsUnsub);
        });
        setReadingsUnsubscribes(newUnsubscribes);
      } catch (error) {
        console.error("[Dashboard] Error polling devices:", error);
        setLoading(false);
      }
    };

    // Poll every 15 seconds (was 5s, causing rate limit)
    pollDevices();
    devicesPollingRef.current = setInterval(pollDevices, 15000);

    return () => {
      if (devicesPollingRef.current) clearInterval(devicesPollingRef.current);
    };
  }, [readingsUnsubscribes]);

  // Cleanup listeners when user logs out
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        // User logged out - cleanup all listeners
        console.log("[Dashboard] Auth state changed to null - cleaning up listeners");
        if (unsubscribeAlerts) {
          if (typeof unsubscribeAlerts === 'function') unsubscribeAlerts();
          setUnsubscribeAlerts(null);
        }
        // ML alerts now uses polling, not listener
        setUnsubscribeMLAlerts(null);
        
        if (unsubscribeDevices) {
          if (typeof unsubscribeDevices === 'function') unsubscribeDevices();
          setUnsubscribeDevices(null);
        }
        if (devicesPollingRef.current) clearInterval(devicesPollingRef.current);
        if (mlAlertsPollingRef.current) clearInterval(mlAlertsPollingRef.current);
        readingsUnsubscribes.forEach((unsub) => {
          if (typeof unsub === 'function') unsub();
        });
        setReadingsUnsubscribes([]);
      }
    });
    return unsubscribeAuth;
  }, [unsubscribeAlerts, unsubscribeMLAlerts, unsubscribeDevices, readingsUnsubscribes]);

  // Initialize push notifications
  useEffect(() => {
    const setupNotifications = async () => {
      await initPushNotifications();
      setupNotificationListeners();
    };
    setupNotifications();
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      // Unsubscribe from all listeners before logout
      if (unsubscribeAlerts && typeof unsubscribeAlerts === 'function') unsubscribeAlerts();
      if (unsubscribeMLAlerts && typeof unsubscribeMLAlerts === 'function') unsubscribeMLAlerts();
      if (unsubscribeDevices && typeof unsubscribeDevices === 'function') unsubscribeDevices();
      // Clear polling intervals
      if (devicesPollingRef.current) clearInterval(devicesPollingRef.current);
      if (mlAlertsPollingRef.current) clearInterval(mlAlertsPollingRef.current);
      // Unsubscribe from all readings listeners
      readingsUnsubscribes.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
      await signOut(auth);
    } catch (err) {
      console.error("❌ Logout failed:", err);
      setLoggingOut(false);
    }
  };

  const handleOpenRatingModal = (alert: any) => {
    setSelectedAlert(alert);
    setSelectedRating(alert.rating || null);
    setShowRatingModal(true);
  };

  const handleSubmitRating = async () => {
    if (!selectedAlert || selectedRating === null || selectedAccuracy === null) return;
    
    try {
      // For ML alerts (from users/{userId}/mlAlerts collection)
      if (!selectedAlert.deviceId) {
        await updateMLAlertRating(selectedAlert.id, selectedRating, selectedAccuracy);
      } else {
        // For sensor alerts (from devices/{deviceId}/alerts collection)
        await updateAlertRating(selectedAlert.deviceId, selectedAlert.id, selectedRating, selectedAccuracy);
      }
      setShowRatingModal(false);
      setSelectedAlert(null);
      setSelectedRating(null);
      setSelectedAccuracy(null);
      const accuracyText = selectedAccuracy ? "accurate" : "inaccurate";
      Alert.alert("✅ Feedback Saved", `Alert marked as ${accuracyText} and rated ${selectedRating}/10`);
    } catch (error: any) {
      Alert.alert("Error", "Failed to save feedback");
      console.error("[Dashboard] Rating error:", error);
    }
  };

  const handleAddDevice = async () => {
    try {
      setLoadingAvailable(true);
      const available = await getAvailableDevicesForUser();
      
      if (available.length === 0) {
        Alert.alert(
          "No More Devices Left",
          "All available devices have been added. Remove a device from your account to add it again, or wait for a new device to register."
        );
        return;
      }

      setAvailableDevices(available);
      setShowAddModal(true);
    } catch (error) {
      console.error("[Dashboard] Error fetching available devices:", error);
      Alert.alert("Error", "Failed to fetch available devices");
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleClaimDevice = async (deviceId: string, label: string) => {
    try {
      setClaimingDeviceId(deviceId);
      await claimDevice(deviceId);
      Alert.alert("Success", `Device "${label}" added to your account!`);
      setShowAddModal(false);
      setAvailableDevices([]);
    } catch (error) {
      console.error("[Dashboard] Error claiming device:", error);
      Alert.alert("Error", "Failed to add device");
    } finally {
      setClaimingDeviceId(null);
    }
  };

  const handleUpdateLabel = (deviceId: string) => {
    Alert.prompt(
      "Update Device Label",
      "Enter new label for this device",
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Update",
          onPress: async (newLabel: string | undefined) => {
            if (!newLabel?.trim()) return;
            try {
              await updateDeviceLabel(deviceId, newLabel.trim());
              console.log("[Dashboard] Label updated:", deviceId);
            } catch (error) {
              console.error("[Dashboard] Error updating label:", error);
              Alert.alert("Error", "Failed to update label");
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const handleUnclaimDevice = (deviceId: string, label: string) => {
    Alert.alert(
      "Remove Device",
      `Are you sure you want to remove "${label}" from your devices?\n\n(The device will not be deleted, just removed from your account)`,
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Remove",
          onPress: async () => {
            try {
              await unclaimDevice(deviceId);
              console.log("[Dashboard] Device unclaimed:", deviceId);
              Alert.alert("Success", "Device removed from your account");
            } catch (error) {
              console.error("[Dashboard] Error unclaiming device:", error);
              Alert.alert("Error", "Failed to remove device");
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  const getLatestReading = (deviceId: string) => {
    const readings = deviceReadings[deviceId] || [];
    if (readings.length === 0) return null;
    return readings[0];
  };

  // Send test notification for a device
  const handleSendTestNotification = async (device: any) => {
    try {
      setSendingTestNotification(device.id);
      const userId = auth.currentUser?.uid;
      
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const deviceName = device.label || device.name || 'Unnamed Device';
      
      // Create test alert data
      const testAlert: MLAlert = {
        deviceId: device.id,
        deviceIdentifier: deviceName,
        riskLabel: 'Test',
        detectedObjects: ['Test Notification'],
        description: [`This is a test notification from ${deviceName}`, 'Testing notification system'],
        confidenceScore: 0.95,
        screenshots: [],
        timestamp: new Date() as any,
        alertGeneratedAt: Date.now(),
        modelVersion: 'test-v1.0',
        acknowledged: false
      };

      // Save to Firestore (the listener will automatically send notification)
      const firestore = getFirestore();
      const alertRef = await addDoc(
        collection(firestore, 'users', userId, 'mlAlerts'),
        {
          ...testAlert,
          timestamp: serverTimestamp()
        }
      );

      console.log('[TestNotification] Alert saved to Firestore:', alertRef.id);
      console.log('[TestNotification] Notification will be sent by listener');
      Alert.alert('✅ Test Sent', `Test notification sent for ${deviceName}`);
      
    } catch (error: any) {
      console.error('[TestNotification] Error:', error);
      Alert.alert('Error', `Failed to send test notification: ${error.message}`);
    } finally {
      setSendingTestNotification(null);
    }
  };

  // ============================================
  // DATA RECORDING FUNCTIONS
  // ============================================

  const startRecording = async () => {
    if (!selectedDeviceForRecording) return;

    setIsRecording(true);
    setRecordedData([]);
    recordedDataRef.current = [];
    setRecordingStartTime(new Date());
    setShowRecordingModal(false);

    console.log('[Recording] Started for device:', selectedDeviceForRecording.name, 'Duration:', recordingDuration, 'min');

    Alert.alert(
      "Recording Started",
      `Recording sensor data for ${recordingDuration} minutes...`,
      [{ text: "OK" }]
    );

    // Fetch sensor data immediately, then every 5 seconds
    const fetchData = async () => {
      try {
        const API_URL = process.env.EXPO_PUBLIC_API_URL;
        const API_KEY = process.env.EXPO_PUBLIC_API_KEY;
        const userId = auth.currentUser?.uid;

        console.log('[Recording] Fetching data...', API_URL);

        // Fetch all sensors for this device
        const sensorsResponse = await fetch(
          `${API_URL}/api/sensors?deviceId=${selectedDeviceForRecording.id}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': API_KEY || '',
              'x-user-id': userId || '',
            },
          }
        );

        if (!sensorsResponse.ok) {
          console.log('[Recording] Sensors fetch failed:', sensorsResponse.status);
          throw new Error('Failed to fetch sensors');
        }
        
        const sensors = await sensorsResponse.json();
        console.log('[Recording] Found sensors:', sensors.length);

        // Fetch latest reading for each sensor
        for (const sensor of sensors) {
          const readingsResponse = await fetch(
            `${API_URL}/api/readings/${sensor.sensor_id}?hours=1&limit=1`,
            {
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY || '',
                'x-user-id': userId || '',
              },
            }
          );

          if (readingsResponse.ok) {
            const readings = await readingsResponse.json();
            if (readings.length > 0) {
              const dataPoint = {
                deviceId: selectedDeviceForRecording.id,
                deviceName: selectedDeviceForRecording.label || selectedDeviceForRecording.name,
                sensorId: sensor.sensor_id,
                sensorName: sensor.sensor_name,
                sensorType: sensor.sensor_type,
                timestamp: new Date(readings[0].time),
                value: readings[0].value,
                unit: sensor.unit,
              };
              console.log('[Recording] Data point:', sensor.sensor_name, readings[0].value);
              recordedDataRef.current.push(dataPoint);
              setRecordedData(prev => [...prev, dataPoint]);
            }
          }
        }
      } catch (error) {
        console.error('[Recording] Error fetching data:', error);
      }
    };

    // Fetch immediately
    await fetchData();
    
    // Then fetch every 5 seconds
    const intervalId = setInterval(fetchData, 5000);

    recordingIntervalRef.current = intervalId;

    // Stop recording after specified duration
    setTimeout(() => {
      stopRecording();
    }, recordingDuration * 60 * 1000);
  };

  const stopRecording = () => {
    const dataCount = recordedDataRef.current.length;
    console.log('[Recording] Stopping... Total data points:', dataCount);
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    setIsRecording(false);

    if (dataCount > 0) {
      exportToCSV();
    } else {
      console.log('[Recording] No data captured!');
      Alert.alert('No Data', 'No data was recorded during this session. Please check if the device is sending data.');
    }
  };

  const exportToCSV = async () => {
    const dataToExport = recordedDataRef.current;
    if (dataToExport.length === 0) {
      console.log('[Export] No data in ref');
      return;
    }

    try {
      console.log('[Export] Exporting', dataToExport.length, 'data points');
      
      const firstTimestamp = dataToExport[0].timestamp.getTime();
      const lastTimestamp = dataToExport[dataToExport.length - 1].timestamp.getTime();
      const deviceName = dataToExport[0].deviceName.replace(/[^a-z0-9]/gi, '_');
      
      const fileName = `${deviceName}_${firstTimestamp}_${lastTimestamp}.csv`;

      // Create CSV content
      const csvHeader = 'Timestamp,Device Name,Sensor Name,Sensor Type,Value,Unit\n';
      const csvRows = dataToExport.map(row => 
        `${row.timestamp.toISOString()},${row.deviceName},${row.sensorName},${row.sensorType},${row.value},${row.unit}`
      ).join('\n');

      const csvContent = csvHeader + csvRows;
      console.log('[Export] CSV size:', csvContent.length, 'bytes');

      if (Platform.OS === 'android') {
        // Use react-native-fs for reliable file system access on Android
        const downloadsPath = RNFS.DownloadDirectoryPath;
        const filePath = `${downloadsPath}/${fileName}`;
        
        console.log('[Export] Writing to Downloads:', filePath);
        
        // Write CSV to Downloads folder
        await RNFS.writeFile(filePath, csvContent, 'utf8');
        
        console.log('[Export] File written successfully');

        Alert.alert(
          'Export Complete',
          `Recorded ${dataToExport.length} data points.\n\nFile saved to Downloads:\n${fileName}\n\nYou can open it with Excel, Google Sheets, or any spreadsheet app.`,
          [
            { 
              text: 'Open File', 
              onPress: () => {
                // Try to share/open the file
                Share.share({
                  title: 'Open CSV File',
                  message: `File saved: ${fileName}`,
                  url: `file://${filePath}`,
                }).catch(err => console.log('[Export] Share error:', err));
              }
            },
            { text: 'OK' }
          ]
        );
      } else {
        // Fallback for iOS or web
        const result = await Share.share({
          title: 'Export Sensor Data CSV',
          message: `${fileName}\n\n${csvContent}`,
        });

        if (result.action === Share.sharedAction) {
          Alert.alert(
            'Export Complete',
            `Recorded ${dataToExport.length} data points.\n\nShared as text - copy and paste into Excel/Sheets.`,
            [{ text: 'OK' }]
          );
        }
      }

      // Clear recorded data
      setRecordedData([]);
      recordedDataRef.current = [];
      setRecordingStartTime(null);
    } catch (error) {
      console.error('[Export] Error:', error);
      Alert.alert('Export Failed', `Could not export data: ${error.message}`);
    }
  };

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const user = auth.currentUser;

  return (
    <LinearGradient
      colors={["#7C3AED", "#6D28D9"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <ScrollView 
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
      >
      {/* Header with Profile and Title */}
      <View style={styles.headerContainer}>
        <IconButton
          icon="profile"
          size={28}
          color="#FFFFFF"
          onPress={() => setShowProfileModal(true)}
          style={styles.profileButton}
        />
        <Text style={styles.appTitle}>Sensor App</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === "alerts" && styles.navItemActive]}
          onPress={() => setActiveTab("alerts")}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <IconButton
              icon="alert"
              size={20}
              color="#ffffff"
              onPress={() => {}}
              style={{ margin: 0, padding: 0, marginRight: 6 }}
            />
            <Text style={styles.navItemText}>Alerts</Text>
            {mlAlerts.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{mlAlerts.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, activeTab === "devices" && styles.navItemActive]}
          onPress={() => setActiveTab("devices")}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <IconButton
              icon="devices"
              size={20}
              color="#ffffff"
              onPress={() => {}}
              style={{ margin: 0, padding: 0, marginRight: 6 }}
            />
            <Text style={styles.navItemText}>Devices</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 Detection Alerts</Text>

          {loading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : mlAlerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No alerts yet</Text>
              <Text style={styles.emptySubtext}>Alerts from remote ML models will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={mlAlerts}
              scrollEnabled={false}
              keyExtractor={(item) => item.id || `${item.deviceId}-${item.timestamp}`}
              renderItem={({ item }) => {
                const riskColors: { [key: string]: string } = {
                  critical: "#FF0000",
                  high: "#FF6B00",
                  medium: "#FFD700",
                  low: "#00AA00",
                };
                const riskEmojis: { [key: string]: string } = {
                  critical: "🔴",
                  high: "🟠",
                  medium: "🟡",
                  low: "🟢",
                };
                const riskLevel = item.riskLabel?.toLowerCase() || "medium";

                return (
                  <TouchableOpacity
                    style={[
                      styles.mlAlertCard,
                      { borderLeftColor: riskColors[riskLevel] || "#FFD700", borderLeftWidth: 4 },
                      // Add background color based on accuracy feedback
                      item.accuracyFeedback === true && { backgroundColor: "#E8F5E9" }, // Light green for accurate
                      item.accuracyFeedback === false && { backgroundColor: "#FFEBEE" }, // Light red for inaccurate
                    ]}
                    onPress={() => {
                      setSelectedMLAlert(item);
                      setShowMLAlertDetailModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.mlAlertHeader}>
                      <Text style={styles.mlAlertTitle}>
                        {riskEmojis[riskLevel]} {item.riskLabel} - {item.deviceIdentifier}
                      </Text>
                      <Text style={styles.mlAlertTime}>
                        {item.timestamp?.toDate?.().toLocaleTimeString?.()}
                      </Text>
                    </View>

                    <Text style={styles.mlAlertObjects}>
                      🔍 {item.detectedObjects?.join(", ") || "No objects"}
                    </Text>

                    {item.description && item.description.length > 0 && (
                      <Text style={styles.mlAlertDescription} numberOfLines={2}>
                        📝 {item.description[0]}
                      </Text>
                    )}

                    <View style={styles.mlAlertFooter}>
                      {item.confidenceScore !== null && item.confidenceScore !== undefined && (
                        <Text style={styles.mlAlertConfidence}>
                          📊 {(item.confidenceScore * 100).toFixed(0)}%
                        </Text>
                      )}
                      {item.screenshots && item.screenshots.length > 0 && (
                        <Text style={styles.mlAlertScreenshot}>
                          📸 {item.screenshots.length} image
                        </Text>
                      )}
                      {item.acknowledged && (
                        <Text style={styles.mlAlertAcknowledged}>✅</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Devices Tab */}
      {activeTab === "devices" && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Connected Devices</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddDevice}
            >
              <IconButton
                icon="add"
                size={20}
                color="#FFFFFF"
                onPress={() => {}}
                style={{ margin: 0, padding: 0 }}
              />
              <Text style={styles.addButtonText}> Add</Text>
            </TouchableOpacity>
          </View>

          {devices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No devices yet</Text>
              <Text style={styles.emptySubtext}>Add your first device to get started</Text>
            </View>
          ) : (
            <FlatList
              data={devices}
              scrollEnabled={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const latestReading = getLatestReading(item.id);
                return (
                  <View style={styles.deviceCard}>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceLabel}>{item.label || item.name || "Unnamed Device"}</Text>
                      <Text style={styles.deviceId}>{item.id}</Text>
                      
                      {latestReading && (
                        <View style={styles.readingInfo}>
                          <Text style={styles.readingValue}>
                            📊 Latest: {latestReading.value?.toFixed?.(2) ?? latestReading.value}
                          </Text>
                          <Text style={styles.readingTime}>
                            {latestReading.timestamp?.toDate?.().toLocaleTimeString?.()}
                          </Text>
                        </View>
                      )}

                      {deviceReadings[item.id]?.length > 0 && (
                        <Text style={styles.readingCount}>
                          📈 {deviceReadings[item.id].length} readings
                        </Text>
                      )}
                    </View>

                    <View style={styles.deviceActions}>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.sensorBtn]}
                          onPress={() => {
                            router.push({
                              pathname: "/sensor-list",
                              params: {
                                deviceId: item.id,
                                deviceName: item.label || item.name || "Unnamed Device",
                              },
                            });
                          }}
                        >
                          <Text style={styles.actionBtnText}>📊</Text>
                          <Text style={styles.actionBtnLabel}>Sensors</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.editBtn]}
                          onPress={() => {
                            setSelectedDeviceForVideo(item);
                            setShowVideoPlayer(true);
                          }}
                        >
                          <Text style={styles.actionBtnText}>📹</Text>
                          <Text style={styles.actionBtnLabel}>Camera</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.recordBtn]}
                          onPress={() => {
                            setSelectedDeviceForRecording(item);
                            setShowRecordingModal(true);
                          }}
                        >
                          <Text style={styles.actionBtnText}>{isRecording && selectedDeviceForRecording?.id === item.id ? '⏹️' : '⏺️'}</Text>
                          <Text style={styles.actionBtnLabel}>Record</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.testBtn]}
                          onPress={() => handleSendTestNotification(item)}
                          disabled={sendingTestNotification === item.id}
                        >
                          {sendingTestNotification === item.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Text style={styles.actionBtnText}>🧪</Text>
                              <Text style={styles.actionBtnLabel}>Test</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.deleteBtn]}
                          onPress={() => handleUnclaimDevice(item.id, item.label)}
                        >
                          <Text style={styles.actionBtnText}>🗑️</Text>
                          <Text style={styles.actionBtnLabel}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Add Device Modal - Select from Available Devices */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Available Device</Text>
            <Text style={styles.modalSubtitle}>Select a device to add to your account</Text>

            {loadingAvailable ? (
              <ActivityIndicator size="large" style={styles.loader} />
            ) : availableDevices.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No devices available</Text>
                <Text style={styles.emptySubtext}>Wait for remote devices to register</Text>
              </View>
            ) : (
              <FlatList
                data={availableDevices}
                scrollEnabled={true}
                keyExtractor={(item) => item.id}
                style={styles.deviceListModal}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.availableDeviceItem,
                      claimingDeviceId === item.id && styles.availableDeviceItemLoading
                    ]}
                    onPress={() => handleClaimDevice(item.id, item.label || item.name)}
                    disabled={claimingDeviceId !== null}
                  >
                    <View style={styles.availableDeviceInfo}>
                      <Text style={styles.availableDeviceLabel}>{item.label || item.name}</Text>
                      <Text style={styles.availableDeviceId}>ID: {item.id}</Text>
                    </View>
                    {claimingDeviceId === item.id && (
                      <ActivityIndicator size="small" color="#007AFF" />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}

            <View style={styles.modalButtons}>
              <Button
                title="Close"
                onPress={() => {
                  setShowAddModal(false);
                  setAvailableDevices([]);
                }}
                disabled={claimingDeviceId !== null}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowRatingModal(false);
          setSelectedAlert(null);
          setSelectedRating(null);
          setSelectedAccuracy(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModalContent}>
            {selectedAccuracy === null ? (
              <>
                <Text style={styles.ratingModalTitle}>Was this alert accurate?</Text>
                <Text style={styles.ratingModalSubtitle}>
                  {selectedAlert?.deviceLabel}: {selectedAlert?.message}
                </Text>

                <View style={styles.accuracyButtonsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.accuracyButton,
                      styles.accuracyButtonYes,
                      selectedAccuracy === true && styles.accuracyButtonSelected,
                    ]}
                    onPress={() => setSelectedAccuracy(true)}
                  >
                    <Text style={styles.accuracyButtonText}>✅ Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.accuracyButton,
                      styles.accuracyButtonNo,
                      selectedAccuracy === false && styles.accuracyButtonSelected,
                    ]}
                    onPress={() => setSelectedAccuracy(false)}
                  >
                    <Text style={styles.accuracyButtonText}>❌ No</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.ratingModalTitle}>Rate this Alert</Text>
                <Text style={styles.ratingModalSubtitle}>
                  Accuracy: {selectedAccuracy ? "✅ Accurate" : "❌ Inaccurate"}
                </Text>

                <View style={styles.ratingScale}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                    <TouchableOpacity
                      key={rating}
                      style={[
                        styles.ratingButton,
                        selectedRating === rating && styles.ratingButtonSelected,
                      ]}
                      onPress={() => setSelectedRating(rating)}
                    >
                      <Text
                        style={[
                          styles.ratingButtonText,
                          selectedRating === rating && styles.ratingButtonTextSelected,
                        ]}
                      >
                        {rating}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {selectedRating !== null && (
                  <Text style={styles.ratingFeedback}>
                    {selectedRating <= 3
                      ? "😞 Poor"
                      : selectedRating <= 6
                      ? "😐 Average"
                      : selectedRating <= 8
                      ? "😊 Good"
                      : "😍 Excellent"}
                  </Text>
                )}
              </>
            )}

            <View style={styles.ratingModalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setShowRatingModal(false);
                  setSelectedAlert(null);
                  setSelectedRating(null);
                  setSelectedAccuracy(null);
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              {selectedAccuracy !== null && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.submitButton,
                    selectedRating === null && styles.buttonDisabled,
                  ]}
                  onPress={handleSubmitRating}
                  disabled={selectedRating === null}
                >
                  <Text style={styles.buttonText}>Submit</Text>
                </TouchableOpacity>
              )}
              {selectedAccuracy === null && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.submitButton,
                  ]}
                  onPress={() => {
                    // Proceed to rating after selecting accuracy
                  }}
                >
                  <Text style={styles.buttonText}>Next</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ML Alert Detail Modal */}
      <Modal
        visible={showMLAlertDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowMLAlertDetailModal(false);
          setSelectedMLAlert(null);
          setMLAlertRating(null);
          setMLAlertAccuracy(null);
        }}
      >
        {selectedMLAlert && (
          <View style={styles.modalOverlay}>
            <View style={styles.mlAlertDetailModal}>
              <ScrollView showsVerticalScrollIndicator={true}>
                {/* Header */}
                <View style={styles.mlAlertDetailHeader}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowMLAlertDetailModal(false);
                      setSelectedMLAlert(null);
                      setMLAlertRating(null);
                      setMLAlertAccuracy(null);
                    }}
                  >
                    <Text style={styles.mlAlertCloseBtn}>✕</Text>
                  </TouchableOpacity>
                  <Text style={styles.mlAlertDetailTitle}>
                    {selectedMLAlert.riskLabel} Alert
                  </Text>
                </View>

                {/* Device Info */}
                <View style={styles.mlAlertDetailSection}>
                  <Text style={styles.mlAlertDetailLabel}>Device</Text>
                  <Text style={styles.mlAlertDetailValue}>{selectedMLAlert.deviceIdentifier}</Text>
                  <Text style={styles.mlAlertDetailSubtext}>{selectedMLAlert.deviceId}</Text>
                </View>

                {/* Time */}
                <View style={styles.mlAlertDetailSection}>
                  <Text style={styles.mlAlertDetailLabel}>Alert Time</Text>
                  <Text style={styles.mlAlertDetailValue}>
                    {selectedMLAlert.timestamp?.toDate?.().toLocaleString?.() || new Date(selectedMLAlert.alertGeneratedAt || 0).toLocaleString()}
                  </Text>
                </View>

                {/* Risk Level */}
                <View style={styles.mlAlertDetailSection}>
                  <Text style={styles.mlAlertDetailLabel}>Risk Level</Text>
                  <Text style={[
                    styles.mlAlertDetailValue,
                    {
                      color: selectedMLAlert.riskLabel.toLowerCase() === "critical" ? "#FF0000"
                        : selectedMLAlert.riskLabel.toLowerCase() === "high" ? "#FF6B00"
                        : selectedMLAlert.riskLabel.toLowerCase() === "medium" ? "#FFD700"
                        : "#00AA00",
                    }
                  ]}>
                    {selectedMLAlert.riskLabel}
                  </Text>
                </View>

                {/* Detected Objects */}
                <View style={styles.mlAlertDetailSection}>
                  <Text style={styles.mlAlertDetailLabel}>Detected Objects</Text>
                  <Text style={styles.mlAlertDetailValue}>
                    {selectedMLAlert.detectedObjects?.join(", ") || "None"}
                  </Text>
                </View>

                {/* Description */}
                {selectedMLAlert.description && selectedMLAlert.description.length > 0 && (
                  <View style={styles.mlAlertDetailSection}>
                    <Text style={styles.mlAlertDetailLabel}>Details</Text>
                    {selectedMLAlert.description.map((desc, idx) => (
                      <Text key={idx} style={styles.mlAlertDetailValue}>
                        • {desc}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Confidence Score */}
                {selectedMLAlert.confidenceScore !== null && selectedMLAlert.confidenceScore !== undefined && (
                  <View style={styles.mlAlertDetailSection}>
                    <Text style={styles.mlAlertDetailLabel}>Model Confidence</Text>
                    <Text style={styles.mlAlertDetailValue}>
                      {(selectedMLAlert.confidenceScore * 100).toFixed(1)}%
                    </Text>
                  </View>
                )}

                {/* Screenshots */}
                {selectedMLAlert.screenshots && selectedMLAlert.screenshots.length > 0 && (
                  <View style={styles.mlAlertDetailSection}>
                    <Text style={styles.mlAlertDetailLabel}>Screenshots ({selectedMLAlert.screenshots.length})</Text>
                    {selectedMLAlert.screenshots.map((img, idx) => (
                      <Text key={idx} style={styles.mlAlertDetailValue}>
                        📸 {img}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Model Version */}
                {selectedMLAlert.modelVersion && (
                  <View style={styles.mlAlertDetailSection}>
                    <Text style={styles.mlAlertDetailLabel}>Model Version</Text>
                    <Text style={styles.mlAlertDetailValue}>{selectedMLAlert.modelVersion}</Text>
                  </View>
                )}

                {/* Rating Section */}
                <View style={styles.mlAlertDetailSection}>
                  <Text style={styles.mlAlertDetailLabel}>Your Feedback</Text>
                  
                  {!selectedMLAlert.rating ? (
                    <>
                      <Text style={styles.mlAlertDetailSubtext}>Is this alert accurate?</Text>
                      <View style={styles.accuracyButtonsContainer}>
                        <TouchableOpacity
                          style={[
                            styles.accuracyButton,
                            styles.accuracyButtonYes,
                            mlAlertAccuracy === true && styles.accuracyButtonSelected,
                          ]}
                          onPress={() => setMLAlertAccuracy(true)}
                        >
                          <Text style={styles.accuracyButtonText}>✅ Accurate</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.accuracyButton,
                            styles.accuracyButtonNo,
                            mlAlertAccuracy === false && styles.accuracyButtonSelected,
                          ]}
                          onPress={() => setMLAlertAccuracy(false)}
                        >
                          <Text style={styles.accuracyButtonText}>❌ Inaccurate</Text>
                        </TouchableOpacity>
                      </View>

                      {mlAlertAccuracy !== null && (
                        <View style={{ marginTop: 20 }}>
                          <Text style={styles.mlAlertDetailSubtext}>Rate this alert (1-10)</Text>
                          <View style={styles.ratingScale}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                              <TouchableOpacity
                                key={rating}
                                style={[
                                  styles.ratingButton,
                                  mlAlertRating === rating && styles.ratingButtonSelected,
                                ]}
                                onPress={() => setMLAlertRating(rating)}
                              >
                                <Text
                                  style={[
                                    styles.ratingButtonText,
                                    mlAlertRating === rating && styles.ratingButtonTextSelected,
                                  ]}
                                >
                                  {rating}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}
                    </>
                  ) : (
                    <View>
                      <Text style={styles.mlAlertDetailValue}>
                        {selectedMLAlert.ratingAccuracy ? "✅ Marked as Accurate" : "❌ Marked as Inaccurate"}
                      </Text>
                      <Text style={styles.mlAlertDetailValue}>
                        ⭐ Rating: {selectedMLAlert.rating}/10
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.mlAlertDetailButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowMLAlertDetailModal(false);
                    setSelectedMLAlert(null);
                    setMLAlertRating(null);
                    setMLAlertAccuracy(null);
                  }}
                >
                  <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>

                {!selectedMLAlert.rating && mlAlertAccuracy !== null && mlAlertRating !== null && (
                  <TouchableOpacity
                    style={[styles.button, styles.submitButton]}
                    onPress={async () => {
                      try {
                        // For user-level ML alerts (from polling), use updateMLAlertRating directly
                        if (!selectedMLAlert.deviceId) {
                          await updateMLAlertRating(
                            selectedMLAlert.id!,
                            mlAlertRating,
                            mlAlertAccuracy
                          );
                        } else {
                          // For device-level alerts, use rateMLAlert
                          await rateMLAlert(
                            selectedMLAlert.deviceId,
                            selectedMLAlert.id!,
                            mlAlertRating,
                            mlAlertAccuracy
                          );
                        }
                        Alert.alert("✅ Feedback Saved", "Thank you for rating this alert");
                        setShowMLAlertDetailModal(false);
                        setSelectedMLAlert(null);
                        setMLAlertRating(null);
                        setMLAlertAccuracy(null);
                      } catch (error) {
                        Alert.alert("Error", "Failed to save feedback");
                      }
                    }}
                  >
                    <Text style={styles.buttonText}>Submit Feedback</Text>
                  </TouchableOpacity>
                )}

                {selectedMLAlert.rating && (
                  <TouchableOpacity
                    style={[styles.button, styles.deleteButton]}
                    onPress={async () => {
                      try {
                        await deleteAlert(selectedMLAlert.deviceId, selectedMLAlert.id!);
                        Alert.alert("✅ Deleted", "Alert has been removed");
                        setShowMLAlertDetailModal(false);
                        setSelectedMLAlert(null);
                      } catch (error) {
                        Alert.alert("Error", "Failed to delete alert");
                      }
                    }}
                  >
                    <Text style={styles.buttonText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* Profile Modal */}
      <Modal
        visible={showProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <TouchableOpacity
          style={styles.profileModalOverlay}
          activeOpacity={1}
          onPress={() => setShowProfileModal(false)}
        >
          <View style={styles.profileModalContent}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileIcon}>👤</Text>
              <TouchableOpacity
                onPress={() => setShowProfileModal(false)}
                style={styles.profileCloseBtn}
              >
                <Text style={styles.profileCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.displayName || "User"}</Text>
              {user?.email && <Text style={styles.profileEmail}>{user.email}</Text>}
            </View>

            <View style={styles.profileDivider} />

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => {
                setShowProfileModal(false);
                handleLogout();
              }}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.logoutButtonText}>🚪 Logout</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Video Player Modal */}
      <Modal
        visible={showVideoPlayer}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowVideoPlayer(false);
          setSelectedDeviceForVideo(null);
        }}
      >
        <View style={styles.videoPlayerOverlay}>
          <View style={styles.videoPlayerContainer}>
            <View style={styles.videoPlayerHeader}>
              <Text style={styles.videoPlayerTitle}>
                📹 {selectedDeviceForVideo?.label || "Device"} - Live Feed
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowVideoPlayer(false);
                  setSelectedDeviceForVideo(null);
                }}
              >
                <Text style={styles.videoPlayerCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.videoPlayerContent}>
              {selectedDeviceForVideo?.ipAddress || selectedDeviceForVideo?.ip_address ? (
                <MJPEGVideoPlayer
                  streamUrl={`http://${selectedDeviceForVideo.ipAddress || selectedDeviceForVideo.ip_address}:8080/stream.mjpeg`}
                  deviceLabel={selectedDeviceForVideo?.name || "Camera"}
                  onClose={() => {
                    setShowVideoPlayer(false);
                    setSelectedDeviceForVideo(null);
                  }}
                />
              ) : (
                <View style={styles.videoPlaceholder}>
                  <Text style={styles.videoPlaceholderText}>🎥</Text>
                  <Text style={styles.videoPlaceholderLabel}>No Camera Connected</Text>
                  <Text style={styles.videoPlaceholderSubtext}>
                    This device does not have a camera or IP address configured
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.videoPlayerFooter}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowVideoPlayer(false);
                  setSelectedDeviceForVideo(null);
                }}
              >
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Data Recording Settings Modal */}
      <Modal
        visible={showRecordingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRecordingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⏺️ Record Sensor Data</Text>
            <Text style={styles.modalSubtitle}>
              {selectedDeviceForRecording?.label || selectedDeviceForRecording?.name}
            </Text>

            <View style={styles.recordingOptions}>
              <Text style={styles.optionLabel}>Recording Duration:</Text>
              
              <TouchableOpacity
                style={[
                  styles.durationButton,
                  recordingDuration === 5 && styles.durationButtonActive
                ]}
                onPress={() => setRecordingDuration(5)}
              >
                <Text style={[
                  styles.durationButtonText,
                  recordingDuration === 5 && styles.durationButtonTextActive
                ]}>
                  5 Minutes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.durationButton,
                  recordingDuration === 10 && styles.durationButtonActive
                ]}
                onPress={() => setRecordingDuration(10)}
              >
                <Text style={[
                  styles.durationButtonText,
                  recordingDuration === 10 && styles.durationButtonTextActive
                ]}>
                  10 Minutes
                </Text>
              </TouchableOpacity>

              <Text style={styles.recordingInfo}>
                ℹ️ Data will be collected every 5 seconds and saved as CSV file
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowRecordingModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.startButton]}
                onPress={startRecording}
              >
                <Text style={[styles.modalButtonText, styles.startButtonText]}>
                  Start Recording
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "transparent",
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
  },
  navBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.2)",
    marginBottom: 15,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  navItem: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  navItemActive: {
    borderBottomColor: "#ffffff",
  },
  navItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  deviceCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#7C3AED",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: "#6B7280",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  readingInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  readingValue: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 4,
  },
  readingTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  readingCount: {
    fontSize: 12,
    color: "#7C3AED",
    marginTop: 4,
    fontWeight: "600",
  },
  deviceActions: {
    marginTop: 12,
    gap: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 70,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  editBtn: {
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
  },
  sensorBtn: {
    backgroundColor: "#F3E5F5",
    borderColor: "#9C27B0",
  },
  testBtn: {
    backgroundColor: "#FCE4EC",
    borderColor: "#FF9800",
  },
  deleteBtn: {
    backgroundColor: "#FFEBEE",
    borderColor: "#F44336",
  },
  actionBtnText: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionBtnLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#333",
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  deviceHeaderButtons: {
    flexDirection: "row",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  addButton: {
    backgroundColor: "#10B981",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  loader: {
    marginVertical: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#1F2937",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6B7280",
  },
  alertCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#7C3AED",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  alertDeviceLabel: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#7C3AED",
  },
  alertTimestamp: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  alertMessage: {
    fontSize: 14,
    color: "#1F2937",
    marginBottom: 8,
    fontWeight: "500",
  },
  alertType: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
  },
  alertFeedbackContainer: {
    marginTop: 8,
  },
  alertAccuracy: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    color: "#00FF41",
  },
  alertRating: {
    fontSize: 13,
    color: "#00FF41",
    fontWeight: "600",
  },
  alertRatingPrompt: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginTop: 8,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.2)",
  },
  appTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 56,
  },
  profileButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 2,
    borderColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  profileButtonText: {
    fontSize: 28,
    color: "#ffffff",
  },
  profileModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  profileModalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    width: "80%",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  profileIcon: {
    fontSize: 32,
    color: "#7C3AED",
  },
  profileCloseBtn: {
    padding: 8,
  },
  profileCloseBtnText: {
    fontSize: 24,
    color: "#6B7280",
    fontWeight: "bold",
  },
  profileInfo: {
    marginBottom: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  profileEmail: {
    fontSize: 14,
    color: "#6B7280",
  },
  profileDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 16,
  },
  logoutButton: {
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  ratingModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    paddingBottom: 60,
    width: "85%",
    maxWidth: 400,
    elevation: 10,
  },
  ratingModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  ratingModalSubtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
    fontStyle: "italic",
  },
  ratingScale: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 8,
  },
  ratingButton: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ddd",
  },
  ratingButtonSelected: {
    backgroundColor: "#FF9800",
    borderColor: "#FF9800",
  },
  ratingButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#666",
  },
  ratingButtonTextSelected: {
    color: "#fff",
  },
  ratingFeedback: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    color: "#FF9800",
  },
  ratingModalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  accuracyButtonsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  accuracyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  accuracyButtonYes: {
    backgroundColor: "#E8F5E9",
    borderColor: "#4CAF50",
  },
  accuracyButtonNo: {
    backgroundColor: "#FFEBEE",
    borderColor: "#F44336",
  },
  accuracyButtonSelected: {
    borderColor: "#FF9800",
    borderWidth: 3,
  },
  accuracyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  submitButton: {
    backgroundColor: "#FF9800",
    flex: 1,
  },
  cancelButton: {
    backgroundColor: "#999",
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  sensorCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
  },
  sensorInfo: {
    flex: 1,
  },
  sensorName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  sensorType: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  sensorLocation: {
    fontSize: 12,
    color: "#999",
  },
  sensorThreshold: {
    fontSize: 12,
    color: "#FF6B35",
    marginTop: 4,
    fontWeight: "500",
  },
  sensorArrow: {
    fontSize: 20,
    color: "#0066cc",
    marginLeft: 10,
  },
  testButtonContainer: {
    marginHorizontal: 0,
    marginBottom: 10,
    marginTop: -5,
    paddingHorizontal: 15,
  },
  footer: {
    marginBottom: 30,
  },
  notifSection: {
    marginTop: 15,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  deviceListModal: {
    maxHeight: 400,
    marginBottom: 16,
  },
  availableDeviceItem: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  availableDeviceItemLoading: {
    opacity: 0.6,
  },
  availableDeviceInfo: {
    flex: 1,
  },
  availableDeviceLabel: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  availableDeviceId: {
    fontSize: 12,
    color: "#999",
    fontFamily: "monospace",
  },
  claimBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  claimBtnLoading: {
    opacity: 0.6,
  },
  claimBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  modalButtons: {
    marginTop: 16,
  },
  // Video Player Styles
  videoPlayerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-start",
    paddingTop: 40,
  },
  videoPlayerContainer: {
    height: "55%",
    backgroundColor: "#000",
    borderRadius: 8,
    marginHorizontal: 0,
    overflow: "hidden",
    elevation: 10,
  },
  videoPlayerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  videoPlayerTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
  },
  videoPlayerCloseBtn: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
  },
  videoPlayerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  videoStreamContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111",
  },
  streamInfo: {
    color: "#00FF41",
    fontSize: 11,
    fontFamily: "monospace",
    marginBottom: 10,
    paddingHorizontal: 10,
    textAlign: "center",
  },
  streamPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    width: "100%",
    backgroundColor: "#222",
    borderRadius: 4,
  },
  streamStatus: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00FF41",
    marginBottom: 8,
  },
  streamDetails: {
    fontSize: 12,
    color: "#999",
    marginTop: 5,
  },
  videoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    width: "100%",
    backgroundColor: "#222",
    borderRadius: 4,
  },
  videoPlaceholderText: {
    fontSize: 48,
    marginBottom: 10,
  },
  videoPlaceholderLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 5,
  },
  videoPlaceholderSubtext: {
    fontSize: 12,
    color: "#aaa",
    fontStyle: "italic",
  },
  videoPlayerFooter: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  closeButton: {
    backgroundColor: "#FF9800",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 4,
  },
  primaryButton: {
    backgroundColor: "#00FF41",
  },
  modeButton: {
    backgroundColor: "#2196F3",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 8,
  },
  buttonText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 14,
  },
  // ML Alert Styles
  badge: {
    backgroundColor: "#FF5252",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  mlAlertCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  mlAlertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  mlAlertTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  mlAlertTime: {
    fontSize: 12,
    color: "#999",
    marginLeft: 8,
  },
  mlAlertObjects: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontWeight: "500",
  },
  mlAlertDescription: {
    fontSize: 13,
    color: "#777",
    marginBottom: 8,
    lineHeight: 18,
  },
  mlAlertFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  mlAlertConfidence: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  mlAlertScreenshot: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  mlAlertAcknowledged: {
    fontSize: 16,
  },
  mlAlertDetailModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    marginTop: "auto",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  mlAlertDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  mlAlertDetailTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    flex: 1,
    marginLeft: 12,
  },
  mlAlertCloseBtn: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#999",
    padding: 8,
  },
  mlAlertDetailSection: {
    marginBottom: 18,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  mlAlertDetailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 6,
  },
  mlAlertDetailValue: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
    lineHeight: 20,
  },
  mlAlertDetailSubtext: {
    fontSize: 13,
    color: "#999",
    marginBottom: 10,
  },
  mlAlertDetailButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  deleteButton: {
    backgroundColor: "#FF5252",
  },
  // Recording Button Style
  recordBtn: {
    backgroundColor: "#FFEBEE",
    borderColor: "#FF5722",
  },
  // Test Notification Button Style
  testBtn: {
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
  },
  // Recording Modal Styles
  recordingOptions: {
    marginVertical: 20,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  durationButton: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  durationButtonActive: {
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
  },
  durationButtonText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    fontWeight: "500",
  },
  durationButtonTextActive: {
    color: "#2196F3",
    fontWeight: "bold",
  },
  recordingInfo: {
    fontSize: 13,
    color: "#666",
    marginTop: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  startButton: {
    backgroundColor: "#4CAF50",
  },
  startButtonText: {
    color: "#fff",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },

  // Saved Files Styles
  savedFileCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedFileIcon: {
    marginRight: 12,
  },
  savedFileInfo: {
    flex: 1,
  },
  savedFileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  savedFileDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  savedFileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  shareBtn: {
    backgroundColor: '#2196F3',
  },
});
