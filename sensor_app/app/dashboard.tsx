import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView, FlatList, TouchableOpacity, Alert, TextInput, Modal, Linking, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { useState, useEffect, useRef } from "react";
import { listenToUserDevices, updateDeviceLabel, listenToDeviceReadings, getAvailableDevicesForUser, claimDevice, unclaimDevice, listenToUserAlerts, updateAlertRating, listenToUserMLAlerts, updateMLAlertRating, getUserMLAlerts, debugCheckAlertsCollections } from "../db/firestore";
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
import StyledAlert, { StyledAlertProps } from "../components/StyledAlert";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, query, where, Timestamp } from 'firebase/firestore';
import { SvgUri } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [alertRetentionDays, setAlertRetentionDays] = useState<7 | 15 | 30 | 0>(30); // Default 30 days (1 month), 0 = never
  const [streamingMode, setStreamingMode] = useState<"http" | "webrtc">("http");
  const [showMLAlertDetailModal, setShowMLAlertDetailModal] = useState(false);
  const [selectedMLAlert, setSelectedMLAlert] = useState<MLAlert | null>(null);
  const [mlAlertRating, setMLAlertRating] = useState<number | null>(null);
  const [mlAlertAccuracy, setMLAlertAccuracy] = useState<boolean | null>(null);
  // Test notification state removed
  
  // Styled Alert States
  const [styledAlertVisible, setStyledAlertVisible] = useState(false);
  const [styledAlertConfig, setStyledAlertConfig] = useState<StyledAlertProps>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });
  
  // Track which alerts have already been notified
  const [showSensorControlModal, setShowSensorControlModal] = useState(false);
  const [selectedDeviceForSensorControl, setSelectedDeviceForSensorControl] = useState<any | null>(null);
  const [deviceSensors, setDeviceSensors] = useState<any[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<any | null>(null);
  const [loadingSensors, setLoadingSensors] = useState(false);

  // Track which alerts have already been notified
  const shownNotificationsRef = useRef<Set<string>>(new Set());

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
        const currentUser = auth.currentUser;
        console.log("[Dashboard] Starting ML alerts poll...");
        console.log("[Dashboard] Current user ID:", currentUser?.uid);
        
        // Debug: Check what's actually in Firestore
        await debugCheckAlertsCollections();
        
        // Use the proper getUserMLAlerts function that fetches from devices collection
        const alerts = await getUserMLAlerts(100);

        console.log("[Dashboard] ML Alerts polling: Found", alerts.length, "alerts");
        // Debug: log first alert's fields
        if (alerts.length > 0) {
          console.log("[Dashboard] First alert fields:", Object.keys(alerts[0]));
          console.log("[Dashboard] First alert ratingAccuracy:", alerts[0].ratingAccuracy);
        } else {
          console.warn("[Dashboard] No alerts found from getUserMLAlerts");
          console.warn("[Dashboard] Expected alerts in: users/" + currentUser?.uid + "/mlAlerts");
        }
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
        // Still try to set loading to false so UI doesn't show spinner forever
        setLoading(false);
        setMLAlerts([]);
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

  // Load alert retention setting on mount
  useEffect(() => {
    loadAlertRetentionSetting();
  }, []);

  // Auto-delete old alerts periodically
  useEffect(() => {
    // Run immediately
    autoDeleteOldAlerts();
    
    // Run every hour (instead of every minute for longer retention periods)
    const interval = setInterval(autoDeleteOldAlerts, 3600000); // 1 hour
    
    return () => clearInterval(interval);
  }, [alertRetentionDays]);

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

  // Helper function to show styled alerts
  const showStyledAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' | 'question' = 'info',
    buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
  ) => {
    setStyledAlertConfig({
      visible: true,
      title,
      message,
      type,
      buttons: buttons || [{ text: 'OK', style: 'default' }],
      onClose: () => setStyledAlertVisible(false),
    });
    setStyledAlertVisible(true);
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
      showStyledAlert("Feedback Saved", `Alert marked as ${accuracyText} and rated ${selectedRating}/10`, "success");
    } catch (error: any) {
      showStyledAlert("Error", "Failed to save feedback", "error");
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
      showStyledAlert("Success", `Device "${label}" added to your account!`, "success");
      setShowAddModal(false);
      setAvailableDevices([]);
    } catch (error) {
      console.error("[Dashboard] Error claiming device:", error);
      showStyledAlert("Error", "Failed to add device", "error");
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
    showStyledAlert(
      "Remove Device",
      `Are you sure you want to remove "${label}" from your devices?\n\n(The device will not be deleted, just removed from your account)`,
      "question",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setStyledAlertVisible(false);
            try {
              await unclaimDevice(deviceId);
              console.log("[Dashboard] Device unclaimed:", deviceId);
              showStyledAlert("Success", "Device removed from your account", "success");
            } catch (error) {
              console.error("[Dashboard] Error unclaiming device:", error);
              showStyledAlert("Error", "Failed to remove device", "error");
            }
          },
        },
      ]
    );
  };

  const getLatestReading = (deviceId: string) => {
    const readings = deviceReadings[deviceId] || [];
    if (readings.length === 0) return null;
    return readings[0];
  };

  // Fetch sensors for a device
  const fetchDeviceSensors = async (deviceId: string) => {
    try {
      setLoadingSensors(true);
      const API_URL = process.env.EXPO_PUBLIC_API_URL;
      const API_KEY = process.env.EXPO_PUBLIC_API_KEY;
      const userId = auth.currentUser?.uid;

      const response = await fetch(
        `${API_URL}/api/sensors?deviceId=${deviceId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY || '',
            'x-user-id': userId || '',
          },
        }
      );

      if (response.ok) {
        const sensors = await response.json();
        setDeviceSensors(sensors);
        console.log('[Dashboard] Fetched sensors:', sensors.length);
      } else {
        console.error('[Dashboard] Failed to fetch sensors:', response.status);
        showStyledAlert('Error', 'Failed to fetch sensors', 'error');
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching sensors:', error);
      showStyledAlert('Error', 'Failed to fetch sensors', 'error');
    } finally {
      setLoadingSensors(false);
    }
  };

  // Toggle sensor state
  const toggleSensorState = async (sensor: any) => {
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL;
      const API_KEY = process.env.EXPO_PUBLIC_API_KEY;
      const userId = auth.currentUser?.uid;

      const newState = !sensor.enabled;
      
      const response = await fetch(
        `${API_URL}/api/sensors/${sensor.sensor_id}/state`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY || '',
            'x-user-id': userId || '',
          },
          body: JSON.stringify({ enabled: newState }),
        }
      );

      if (response.ok) {
        // Update local state
        setDeviceSensors(prev =>
          prev.map(s =>
            s.sensor_id === sensor.sensor_id ? { ...s, enabled: newState } : s
          )
        );
        setSelectedSensor({ ...sensor, enabled: newState });
        showStyledAlert(
          'Success',
          `${sensor.sensor_name} ${newState ? 'enabled' : 'disabled'}`,
          'success'
        );
      } else if (response.status === 403) {
        // User is blocked
        const errorData = await response.json();
        showStyledAlert(
          'Access Denied', 
          errorData.details || errorData.reason || 'You do not have permission to control this sensor',
          'error'
        );
      } else {
        showStyledAlert('Error', 'Failed to update sensor state', 'error');
      }
    } catch (error) {
      console.error('[Dashboard] Error toggling sensor:', error);
      showStyledAlert('Error', 'Failed to update sensor state', 'error');
    }
  };

  // Load alert retention setting
  const loadAlertRetentionSetting = async () => {
    try {
      const saved = await AsyncStorage.getItem('alertRetentionDays');
      if (saved) {
        setAlertRetentionDays(parseInt(saved) as 7 | 15 | 30 | 0);
      }
    } catch (error) {
      console.error('[Dashboard] Error loading retention setting:', error);
    }
  };

  // Save alert retention setting
  const saveAlertRetentionSetting = async (days: 7 | 15 | 30 | 0) => {
    try {
      await AsyncStorage.setItem('alertRetentionDays', days.toString());
      setAlertRetentionDays(days);
      
      if (days === 0) {
        showStyledAlert('Success', 'Alerts will never be auto-deleted', 'success');
      } else {
        showStyledAlert('Success', `Alerts older than ${days} days will be auto-deleted`, 'success');
      }
    } catch (error) {
      console.error('[Dashboard] Error saving retention setting:', error);
      showStyledAlert('Error', 'Failed to save setting', 'error');
    }
  };

  // Auto-delete old alerts
  const autoDeleteOldAlerts = async () => {
    try {
      // Skip if retention is set to "never"
      if (alertRetentionDays === 0) {
        return;
      }

      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const db = getFirestore();
      const alertsRef = collection(db, 'users', userId, 'mlAlerts');
      
      // Calculate cutoff time
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - alertRetentionDays);
      
      // Query old alerts
      const q = query(
        alertsRef,
        where('timestamp', '<', Timestamp.fromDate(cutoffTime))
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('[Dashboard] No old alerts to delete');
        return;
      }

      // Delete old alerts
      const deletePromises = snapshot.docs.map(docSnapshot => 
        deleteDoc(doc(db, 'users', userId, 'mlAlerts', docSnapshot.id))
      );
      
      await Promise.all(deletePromises);
      console.log(`[Dashboard] Deleted ${snapshot.size} old alerts (older than ${alertRetentionDays} days)`);
    } catch (error) {
      console.error('[Dashboard] Error auto-deleting alerts:', error);
    }
  };

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
                
                // Support both old and new field names for backward compatibility
                const ratingAccuracy = item.ratingAccuracy !== undefined ? item.ratingAccuracy : (item as any).accuracyFeedback;
                
                // Debug log
                if (ratingAccuracy !== null && ratingAccuracy !== undefined) {
                  console.log("[Dashboard] Alert", item.id, 'ratingAccuracy:', ratingAccuracy);
                }

                return (
                  <TouchableOpacity
                    style={[
                      styles.mlAlertCard,
                      { 
                        borderLeftColor: riskColors[riskLevel] || "#FFD700", 
                        borderLeftWidth: 4,
                        backgroundColor: ratingAccuracy === true ? "#E8F5E9" : ratingAccuracy === false ? "#FFEBEE" : "#fff"
                      },
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
                      {/* Accuracy Feedback Badge - Always Show */}
                      <View style={[
                        styles.accuracyBadge,
                        ratingAccuracy === true ? styles.accurateBadge : ratingAccuracy === false ? styles.inaccurateBadge : styles.unratedBadge
                      ]}>
                        <Text style={styles.accuracyBadgeText}>
                          {ratingAccuracy === true ? "✓ Accurate" : ratingAccuracy === false ? "✗ Inaccurate" : "⭘ Not rated"}
                        </Text>
                      </View>
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
                    </View>

                    <View style={styles.deviceActions}>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.sensorBtn]}
                          onPress={() => {
                            setSelectedDeviceForSensorControl(item);
                            setShowSensorControlModal(true);
                            fetchDeviceSensors(item.id);
                          }}
                        >
                          <MaterialIcons name="settings-remote" size={20} />
                          <Text style={styles.actionBtnLabel}>Sensor Control</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.editBtn]}
                          onPress={() => {
                            setSelectedDeviceForVideo(item);
                            setShowVideoPlayer(true);
                          }}
                        >
                          <MaterialIcons name="videocam" size={20} />
                          <Text style={styles.actionBtnLabel}>Camera</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.deleteBtn]}
                          onPress={() => handleUnclaimDevice(item.id, item.label || item.name || "Unnamed Device")}
                        >
                          <MaterialIcons name="delete" size={20} />
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

                {!selectedMLAlert.rating && !selectedMLAlert.userRating && mlAlertAccuracy !== null && mlAlertRating !== null && (
                  <TouchableOpacity
                    style={[styles.button, styles.submitButton]}
                    onPress={async () => {
                      try {
                        // Alerts are in users/{userId}/mlAlerts collection, use updateMLAlertRating
                        await updateMLAlertRating(
                          selectedMLAlert.id!,
                          mlAlertRating,
                          mlAlertAccuracy
                        );
                        
                        // Update local state immediately to reflect the change
                        setMLAlerts(prevAlerts => 
                          prevAlerts.map(alert => 
                            alert.id === selectedMLAlert.id 
                              ? { ...alert, userRating: mlAlertRating, ratingAccuracy: mlAlertAccuracy, ratedAt: new Date() }
                              : alert
                          )
                        );
                        
                        showStyledAlert("Feedback Saved", "Thank you for rating this alert", "success");
                        setShowMLAlertDetailModal(false);
                        setSelectedMLAlert(null);
                        setMLAlertRating(null);
                        setMLAlertAccuracy(null);
                      } catch (error) {
                        showStyledAlert("Error", "Failed to save feedback", "error");
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
              style={styles.settingsButton}
              onPress={() => {
                setShowProfileModal(false);
                setShowSettingsModal(true);
              }}
            >
              <Text style={styles.settingsButtonText}>⚙️ Settings</Text>
            </TouchableOpacity>

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

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <TouchableOpacity
          style={styles.profileModalOverlay}
          activeOpacity={1}
          onPress={() => setShowSettingsModal(false)}
        >
          <View style={styles.profileModalContent}>
            <View style={styles.profileHeader}>
              <Text style={styles.settingsTitle}>⚙️ Settings</Text>
              <TouchableOpacity
                onPress={() => setShowSettingsModal(false)}
                style={styles.profileCloseBtn}
              >
                <Text style={styles.profileCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Alert Auto-Delete</Text>
              <Text style={styles.settingsDescription}>
                Automatically delete alerts older than:
              </Text>

              <TouchableOpacity
                style={[
                  styles.settingsOption,
                  alertRetentionDays === 7 && styles.settingsOptionActive
                ]}
                onPress={() => saveAlertRetentionSetting(7)}
              >
                <View style={styles.settingsOptionContent}>
                  <Text style={[
                    styles.settingsOptionText,
                    alertRetentionDays === 7 && styles.settingsOptionTextActive
                  ]}>
                    7 days
                  </Text>
                  {alertRetentionDays === 7 && (
                    <Text style={styles.settingsCheckmark}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.settingsOption,
                  alertRetentionDays === 15 && styles.settingsOptionActive
                ]}
                onPress={() => saveAlertRetentionSetting(15)}
              >
                <View style={styles.settingsOptionContent}>
                  <Text style={[
                    styles.settingsOptionText,
                    alertRetentionDays === 15 && styles.settingsOptionTextActive
                  ]}>
                    15 days
                  </Text>
                  {alertRetentionDays === 15 && (
                    <Text style={styles.settingsCheckmark}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.settingsOption,
                  alertRetentionDays === 30 && styles.settingsOptionActive
                ]}
                onPress={() => saveAlertRetentionSetting(30)}
              >
                <View style={styles.settingsOptionContent}>
                  <Text style={[
                    styles.settingsOptionText,
                    alertRetentionDays === 30 && styles.settingsOptionTextActive
                  ]}>
                    1 month (30 days)
                  </Text>
                  {alertRetentionDays === 30 && (
                    <Text style={styles.settingsCheckmark}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.settingsOption,
                  alertRetentionDays === 0 && styles.settingsOptionActive
                ]}
                onPress={() => saveAlertRetentionSetting(0)}
              >
                <View style={styles.settingsOptionContent}>
                  <Text style={[
                    styles.settingsOptionText,
                    alertRetentionDays === 0 && styles.settingsOptionTextActive
                  ]}>
                    Never (keep all alerts)
                  </Text>
                  {alertRetentionDays === 0 && (
                    <Text style={styles.settingsCheckmark}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>

              <Text style={styles.settingsNote}>
                {alertRetentionDays === 0 
                  ? "ℹ️ All alerts will be kept indefinitely"
                  : `ℹ️ Alerts newer than ${alertRetentionDays} days will be kept`
                }
              </Text>
            </View>
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
              <MJPEGVideoPlayer
                streamUrl={`http://${selectedDeviceForVideo?.ipAddress || selectedDeviceForVideo?.ip_address}:8080/stream.mjpeg`}
                deviceLabel={selectedDeviceForVideo?.label || selectedDeviceForVideo?.name || 'Camera'}
                onClose={() => {
                  setShowVideoPlayer(false);
                  setSelectedDeviceForVideo(null);
                }}
              />
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

      {/* Sensor Control Modal */}
      <Modal
        visible={showSensorControlModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSensorControlModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎛️ Sensor Control</Text>
            <Text style={styles.modalSubtitle}>
              {selectedDeviceForSensorControl?.label || selectedDeviceForSensorControl?.name}
            </Text>

            {loadingSensors ? (
              <ActivityIndicator size="large" style={{ marginVertical: 20 }} />
            ) : deviceSensors.length === 0 ? (
              <Text style={styles.emptyText}>No sensors found</Text>
            ) : selectedSensor ? (
              // Sensor Detail View
              <View style={styles.sensorDetailContainer}>
                <TouchableOpacity
                  onPress={() => setSelectedSensor(null)}
                  style={styles.backButton}
                >
                  <MaterialIcons name="arrow-back" size={24} color="#7C3AED" />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>

                <View style={styles.sensorDetailCard}>
                  <Text style={styles.sensorDetailName}>{selectedSensor.sensor_name}</Text>
                  <Text style={styles.sensorDetailType}>{selectedSensor.sensor_type}</Text>
                  
                  <View style={styles.sensorStateContainer}>
                    <Text style={styles.stateLabel}>Status:</Text>
                    <View style={[
                      styles.stateBadge,
                      selectedSensor.enabled ? styles.enabledBadge : styles.disabledBadge
                    ]}>
                      <Text style={styles.stateBadgeText}>
                        {selectedSensor.enabled ? '🟢 Enabled' : '🔴 Disabled'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      selectedSensor.enabled ? styles.disableButton : styles.enableButton
                    ]}
                    onPress={() => toggleSensorState(selectedSensor)}
                  >
                    <MaterialIcons
                      name={selectedSensor.enabled ? "toggle-on" : "toggle-off"}
                      size={24}
                      color="#fff"
                    />
                    <Text style={styles.toggleButtonText}>
                      {selectedSensor.enabled ? 'Turn Off' : 'Turn On'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Sensors List View
              <FlatList
                data={deviceSensors}
                scrollEnabled={true}
                keyExtractor={(item) => item.sensor_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.sensorListItem}
                    onPress={() => setSelectedSensor(item)}
                  >
                    <View style={styles.sensorListItemContent}>
                      <Text style={styles.sensorListItemName}>{item.sensor_name}</Text>
                      <Text style={styles.sensorListItemType}>{item.sensor_type}</Text>
                    </View>
                    <View style={[
                      styles.sensorListItemBadge,
                      item.enabled ? styles.enabledBadge : styles.disabledBadge
                    ]}>
                      <Text style={styles.sensorListItemBadgeText}>
                        {item.enabled ? '🟢' : '🔴'}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#999" />
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowSensorControlModal(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Styled Alert Component */}
      <StyledAlert 
        visible={styledAlertVisible}
        title={styledAlertConfig.title}
        message={styledAlertConfig.message}
        type={styledAlertConfig.type}
        buttons={styledAlertConfig.buttons}
        onClose={() => setStyledAlertVisible(false)}
      />
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
  settingsButton: {
    backgroundColor: "#6D28D9",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  settingsTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
  },
  settingsSection: {
    marginTop: 20,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  settingsDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  settingsOption: {
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  settingsOptionActive: {
    backgroundColor: "#E9D5FF",
    borderColor: "#7C3AED",
  },
  settingsOptionContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingsOptionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  settingsOptionTextActive: {
    color: "#7C3AED",
    fontWeight: "bold",
  },
  settingsCheckmark: {
    fontSize: 20,
    color: "#7C3AED",
    fontWeight: "bold",
  },
  settingsNote: {
    fontSize: 13,
    color: "#666",
    marginTop: 12,
    fontStyle: "italic",
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
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    backgroundColor: "#fff",
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
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 8,
  },
  accuracyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  accurateBadge: {
    backgroundColor: "#4CAF50",
  },
  inaccurateBadge: {
    backgroundColor: "#F44336",
  },
  unratedBadge: {
    backgroundColor: "#9E9E9E",
  },
  accuracyBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
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
  sensorDetailContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#7C3AED',
    fontWeight: '600',
  },
  sensorDetailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
  },
  sensorDetailName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  sensorDetailType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  sensorStateContainer: {
    marginBottom: 20,
  },
  stateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  stateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  enabledBadge: {
    backgroundColor: '#E8F5E9',
  },
  disabledBadge: {
    backgroundColor: '#FFEBEE',
  },
  stateBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  enableButton: {
    backgroundColor: '#4CAF50',
  },
  disableButton: {
    backgroundColor: '#F44336',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  sensorListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  sensorListItemContent: {
    flex: 1,
  },
  sensorListItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sensorListItemType: {
    fontSize: 12,
    color: '#999',
  },
  sensorListItemBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sensorListItemBadgeText: {
    fontSize: 20,
  },
});

