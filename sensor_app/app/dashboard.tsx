import { View, Text, StyleSheet, ActivityIndicator, ScrollView, FlatList, TouchableOpacity, Modal, Linking, Image, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { useState, useEffect, useRef } from "react";
import { listenToUserDevices, updateDeviceLabel, listenToDeviceReadings, getAvailableDevicesForUser, claimDevice, unclaimDevice, updateAlertRating, listenToUserMLAlerts, updateMLAlertRating } from "../db/firestore";
import { useRouter } from "expo-router";
import { initPushNotifications, setupNotificationListeners } from "../utils/notifications";
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
import { getStorage, ref as storageRef, getDownloadURL } from 'firebase/storage';
import { SvgUri } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loggingOut, setLoggingOut] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(!!auth.currentUser);
  const [mlAlerts, setMLAlerts] = useState<MLAlert[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"alerts" | "devices">("alerts");
  const [deviceReadings, setDeviceReadings] = useState<{[key: string]: any[]}>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [claimingDeviceId, setClaimingDeviceId] = useState<string | null>(null);
  const [unsubscribeDevices, setUnsubscribeDevices] = useState<(() => void) | null>(null);
  const [unsubscribeMLAlerts, setUnsubscribeMLAlerts] = useState<(() => void) | null>(null);
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
  const [showAlertImageModal, setShowAlertImageModal] = useState(false);
  const [selectedAlertImageUri, setSelectedAlertImageUri] = useState('');
  const [selectedAlertImageSource, setSelectedAlertImageSource] = useState('');
  const [alertImageLoading, setAlertImageLoading] = useState(false);
  const [alertImageError, setAlertImageError] = useState<string | null>(null);
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
  const [newSensorLabel, setNewSensorLabel] = useState('');
  const [newSensorPin, setNewSensorPin] = useState('');
  const [addingSensor, setAddingSensor] = useState(false);
  const [deletingSensorId, setDeletingSensorId] = useState<number | null>(null);
  const sensorControlBaseUrl = (process.env.EXPO_PUBLIC_SENSOR_CONTROL_URL || process.env.EXPO_PUBLIC_ADMIN_PORTAL_URL || 'http://13.205.201.82').replace(/\/$/, '');
  const sensorControlApiUrl = `${sensorControlBaseUrl}/sensor-api`;
  const cameraApiUrl = `${sensorControlBaseUrl}/camera-api`;
  const appApiKey = process.env.EXPO_PUBLIC_API_KEY || '';

  const getDirectDeviceStreamUrl = (device: any, metadata?: any): string => {
    const metadataStreamUrl = `${metadata?.streamUrl || metadata?.stream_url || ''}`.trim();
    if (metadataStreamUrl) {
      return metadataStreamUrl;
    }

    const deviceStreamUrl = `${device?.streaming_url || device?.streamUrl || ''}`.trim();
    if (deviceStreamUrl) {
      return deviceStreamUrl;
    }

    const deviceIp = `${device?.ipAddress || device?.ip_address || ''}`.trim();
    if (deviceIp) {
      return `http://${deviceIp}:8080/stream.mjpeg`;
    }

    return '';
  };

  const getCameraProxyStreamUrl = (device: any): string => {
    const resolvedCameraStreamUrl = `${device?.resolvedCameraStreamUrl || ''}`.trim();
    if (resolvedCameraStreamUrl) {
      return resolvedCameraStreamUrl;
    }

    const deviceId = device?.id || device?.deviceId || device?.device_id;
    if (!deviceId) {
      return '';
    }

    return `${cameraApiUrl}/api/camera/${encodeURIComponent(deviceId)}/stream.mjpeg`;
  };

  // Track which alerts have already been notified
  const shownNotificationsRef = useRef<Set<string>>(new Set());
  const mlAlertsRef = useRef<MLAlert[]>([]);
  const readingsUnsubscribesRef = useRef<(() => void)[]>([]);

  const cleanupDeviceReadingListeners = () => {
    readingsUnsubscribesRef.current.forEach((unsub) => {
      if (typeof unsub === "function") unsub();
    });
    readingsUnsubscribesRef.current = [];
  };

  // ✅ NEW: Monitor auth state changes and control polling
  useEffect(() => {
    console.log("[Dashboard] Setting up auth state listener");
    
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        console.log("[Dashboard] ✅ User authenticated:", currentUser.uid);
        setIsUserLoggedIn(true);
      } else {
        console.log("[Dashboard] 🚫 User logged out, stopping listeners...");
        setIsUserLoggedIn(false);
        setDevices([]);
        setMLAlerts([]);
        cleanupDeviceReadingListeners();
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Listen to ML alerts in real-time from users/{userId}/mlAlerts.
  useEffect(() => {
    if (!isUserLoggedIn) {
      setMLAlerts([]);
      return;
    }

    console.log("[Dashboard] Setting up real-time ML alerts listener");

    const unsubscribe = listenToUserMLAlerts((alerts) => {
      setMLAlerts(alerts);
      setLoading(false);

      alerts.forEach((alert) => {
        if (!alert.id || shownNotificationsRef.current.has(alert.id)) {
          return;
        }

        try {
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
              seconds: 1,
            },
          }).catch((error) => {
            console.error("[Dashboard] ❌ Failed to schedule notification:", error);
          });
        } catch (error) {
          console.error("[Dashboard] Exception scheduling notification:", error);
        }

        shownNotificationsRef.current.add(alert.id);
      });
    });

    setUnsubscribeMLAlerts(() => unsubscribe);

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [isUserLoggedIn]);

  // Setup notification tap handler to navigate to alert details
  useEffect(() => {
    mlAlertsRef.current = mlAlerts;
  }, [mlAlerts]);

  useEffect(() => {
    console.log("[Dashboard] Setting up notification tap handler");
    
    const notificationTapSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const alertId = response.notification.request.content.data?.alertId;
      
      if (alertId) {
        console.log("[Dashboard] Notification tapped for alert:", alertId);
        
        // Use a ref so listener setup happens once and still sees latest alerts.
        const alert = mlAlertsRef.current.find((a) => a.id === alertId);
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
  }, []);

  // Listen to owned devices in real-time and attach readings listeners for visible devices.
  useEffect(() => {
    if (!isUserLoggedIn) {
      setDevices([]);
      cleanupDeviceReadingListeners();
      return;
    }

    console.log("[Dashboard] Setting up real-time device listener");

    const unsubscribe = listenToUserDevices((userDevices) => {
      console.log("[Dashboard] Realtime: Found", userDevices.length, "devices for user");
      setDevices(userDevices);
      setLoading(false);

      cleanupDeviceReadingListeners();

      if (!auth.currentUser) {
        console.log("[Dashboard] User not authenticated - skipping readings listeners");
        return;
      }

      const newUnsubscribes: (() => void)[] = [];
      userDevices.forEach((device) => {
        const readingsUnsub = listenToDeviceReadings(
          device.id,
          (readings) => {
            setDeviceReadings((prev) => ({
              ...prev,
              [device.id]: readings,
            }));
          },
          5
        );
        newUnsubscribes.push(readingsUnsub);
      });

      readingsUnsubscribesRef.current = newUnsubscribes;
    });

    setUnsubscribeDevices(() => unsubscribe);

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      cleanupDeviceReadingListeners();
    };
  }, [isUserLoggedIn]);

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
      if (unsubscribeMLAlerts && typeof unsubscribeMLAlerts === 'function') unsubscribeMLAlerts();
      if (unsubscribeDevices && typeof unsubscribeDevices === 'function') unsubscribeDevices();
      // Unsubscribe from all readings listeners
      cleanupDeviceReadingListeners();
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
    buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
    inputConfig?: StyledAlertProps['inputConfig'],
    buttonLayout?: StyledAlertProps['buttonLayout']
  ) => {
    setStyledAlertConfig({
      visible: true,
      title,
      message,
      type,
      buttons: inputConfig ? undefined : (buttons || [{ text: 'OK', style: 'default' }]),
      inputConfig,
      buttonLayout,
      onClose: () => setStyledAlertVisible(false),
    });
    setStyledAlertVisible(true);
  };

  const resolveAlertImageUri = async (imageSource: string): Promise<string> => {
    const raw = `${imageSource || ''}`.trim();
    if (!raw) {
      throw new Error('Image path is empty');
    }

    if (
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('data:image/') ||
      raw.startsWith('file://')
    ) {
      return raw;
    }

    if (raw.startsWith('gs://')) {
      const storage = getStorage();
      const fileRef = storageRef(storage, raw);
      return getDownloadURL(fileRef);
    }

    if (raw.startsWith('/')) {
      return `${sensorControlBaseUrl}${raw}`;
    }

    return raw;
  };

  const openAlertImage = async (imageSource: string) => {
    setShowAlertImageModal(true);
    setSelectedAlertImageSource(imageSource || '');
    setSelectedAlertImageUri('');
    setAlertImageError(null);
    setAlertImageLoading(true);

    try {
      const resolvedUri = await resolveAlertImageUri(imageSource);
      setSelectedAlertImageUri(resolvedUri);
    } catch (error: any) {
      const message = error?.message || 'Unable to load image';
      setAlertImageError(message);
    } finally {
      setAlertImageLoading(false);
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
        showStyledAlert(
          "No More Devices Left",
          "All available devices have been added. Remove a device from your account to add it again, or wait for a new device to register.",
          "info"
        );
        return;
      }

      setAvailableDevices(available);
      setShowAddModal(true);
    } catch (error) {
      console.error("[Dashboard] Error fetching available devices:", error);
      showStyledAlert("Error", "Failed to fetch available devices", "error");
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

  const handleUpdateLabel = (deviceId: string, currentLabel?: string) => {
    showStyledAlert(
      'Update Device Label',
      'Enter new label for this device',
      'question',
      undefined,
      {
        enabled: true,
        initialValue: (currentLabel || '').trim(),
        placeholder: 'Device label',
        maxLength: 40,
        submitText: 'OK',
        cancelText: 'Cancel',
        onSubmit: (inputValue) => submitUpdatedLabel(deviceId, inputValue),
      }
    );
  };

  const submitUpdatedLabel = async (deviceId: string, inputValue: string) => {
    const newLabel = inputValue.trim();
    if (!newLabel) {
      showStyledAlert('Missing Label', 'Please enter a device label', 'warning');
      return;
    }

    try {
      await updateDeviceLabel(deviceId, newLabel);
      console.log('[Dashboard] Label updated:', deviceId);
      setStyledAlertVisible(false);
      showStyledAlert('Success', 'Device label updated', 'success');
    } catch (error) {
      console.error('[Dashboard] Error updating label:', error);
      showStyledAlert('Error', 'Failed to update label', 'error');
    }
  };

  const handleUnclaimDevice = (deviceId: string, label: string) => {
    showStyledAlert(
      "Remove Device",
      `Are you sure you want to remove "${label}" from your devices?\n\n(The device will not be deleted, just removed from your account)`,
      "question",
      [
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
        { text: "Cancel", style: "cancel" },
      ],
      undefined,
      'stacked'
    );
  };

  const handleDeleteMLAlert = (alert: MLAlert) => {
    if (!alert?.id || !alert?.deviceId) {
      showStyledAlert('Error', 'Alert details are incomplete', 'error');
      return;
    }

    showStyledAlert(
      'Delete Alert',
      'This will permanently remove the alert from your history.',
      'question',
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setStyledAlertVisible(false);
            try {
              await deleteAlert(alert.deviceId, alert.id);
              setShowMLAlertDetailModal(false);
              setSelectedMLAlert(null);
              setMLAlertRating(null);
              setMLAlertAccuracy(null);
              showStyledAlert('Deleted', 'Alert has been removed', 'success');
            } catch (error) {
              console.error('[Dashboard] Error deleting alert:', error);
              showStyledAlert('Error', 'Failed to delete alert', 'error');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      undefined,
      'stacked'
    );
  };

  const handleLogoutConfirmation = () => {
    showStyledAlert(
      'Logout',
      'Do you want to sign out of RuTAG-HACS now?',
      'question',
      [
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setStyledAlertVisible(false);
            await handleLogout();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      undefined,
      'stacked'
    );
  };

  const getLatestReading = (deviceId: string) => {
    const readings = deviceReadings[deviceId] || [];
    if (readings.length === 0) return null;
    return readings[0];
  };

  // Validate camera access/registration before opening the video modal.
  const openDeviceCamera = async (device: any) => {
    try {
      const deviceId = device?.id || device?.deviceId || device?.device_id;
      const userId = auth.currentUser?.uid || '';
      const directStreamUrl = getDirectDeviceStreamUrl(device);
      const proxyStreamUrl = `${cameraApiUrl}/api/camera/${encodeURIComponent(deviceId || '')}/stream.mjpeg`;

      if (!deviceId) {
        showStyledAlert('Camera Unavailable', 'Device ID is missing for this camera.', 'error');
        return;
      }

      if (!appApiKey) {
        if (directStreamUrl) {
          setSelectedDeviceForVideo({
            ...device,
            resolvedCameraStreamUrl: directStreamUrl,
            useProxyCamera: false,
          });
          setShowVideoPlayer(true);
          showStyledAlert('Using Direct Camera', 'Proxy API key is missing, so the app is using direct camera stream from the device.', 'warning');
          return;
        }

        showStyledAlert('Camera Unavailable', 'EXPO_PUBLIC_API_KEY is not configured in the app and no direct stream URL is available.', 'error');
        return;
      }

      if (!userId) {
        showStyledAlert('Camera Unavailable', 'You need to be signed in to view camera stream.', 'error');
        return;
      }

      const metadataUrl = `${cameraApiUrl}/api/camera/device/${encodeURIComponent(deviceId)}?apiKey=${encodeURIComponent(appApiKey)}&userId=${encodeURIComponent(userId)}`;
      const response = await fetch(metadataUrl);

      if (response.ok) {
        let metadata: any = {};
        try {
          metadata = await response.json();
        } catch {
          metadata = {};
        }

        const directStreamFromMetadata = getDirectDeviceStreamUrl(device, metadata);

        // Probe one frame first so we fail fast with a clear message if EC2 cannot reach the Pi URL.
        const frameProbeUrl = `${cameraApiUrl}/api/camera/${encodeURIComponent(deviceId)}/frame.jpg?apiKey=${encodeURIComponent(appApiKey)}&userId=${encodeURIComponent(userId)}&t=${Date.now()}`;
        const frameProbe = await fetch(frameProbeUrl);

        if (!frameProbe.ok) {
          if (frameProbe.status === 502) {
            if (directStreamFromMetadata) {
              setSelectedDeviceForVideo({
                ...device,
                resolvedCameraStreamUrl: directStreamFromMetadata,
                useProxyCamera: false,
              });
              setShowVideoPlayer(true);
              showStyledAlert(
                'Using Direct Camera',
                'EC2 proxy cannot reach the camera right now. Opened direct stream from device metadata.',
                'warning'
              );
              return;
            }

            showStyledAlert(
              'Camera Not Reachable',
              'Camera is registered, but EC2 cannot reach the stream URL. If the Pi registered a private IP (like 192.168.x.x), set CAMERA_PUBLIC_STREAM_URL and CAMERA_PUBLIC_FRAME_URL to a public/tunnel URL and restart mjpeg-camera-server.js.',
              'error'
            );
            return;
          }

          if (frameProbe.status === 403) {
            showStyledAlert('Access Denied', 'User or device is blocked by admin.', 'error');
            return;
          }

          if (frameProbe.status === 404) {
            showStyledAlert('Camera Not Ready', 'Camera stream entry was not found. Restart mjpeg-camera-server.js on the device.', 'error');
            return;
          }

          showStyledAlert('Camera Unavailable', `Unable to load camera frame (${frameProbe.status}).`, 'error');
          return;
        }

        setSelectedDeviceForVideo({
          ...device,
          resolvedCameraStreamUrl: proxyStreamUrl,
          useProxyCamera: true,
        });
        setShowVideoPlayer(true);
        return;
      }

      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        errorData = {};
      }

      if (response.status === 404) {
        if (directStreamUrl) {
          setSelectedDeviceForVideo({
            ...device,
            resolvedCameraStreamUrl: directStreamUrl,
            useProxyCamera: false,
          });
          setShowVideoPlayer(true);
          showStyledAlert('Using Direct Camera', 'Camera is not registered in proxy API yet. Opened direct camera stream from device info.', 'warning');
          return;
        }

        showStyledAlert(
          'Camera Not Ready',
          'Camera stream is not registered yet. Start mjpeg-camera-server.js on the device and try again.',
          'error'
        );
        return;
      }

      if (response.status === 403) {
        showStyledAlert(
          'Access Denied',
          errorData.reason || 'User or device is blocked by admin.',
          'error'
        );
        return;
      }

      if (response.status === 401) {
        showStyledAlert('Camera Unavailable', 'Authentication required. Please sign in again.', 'error');
        return;
      }

      showStyledAlert(
        'Camera Unavailable',
        errorData.reason || errorData.error || `Failed to open camera (${response.status})`,
        'error'
      );
    } catch (error) {
      console.error('[Dashboard] Error opening camera:', error);

      const directStreamUrl = getDirectDeviceStreamUrl(device);
      if (directStreamUrl) {
        setSelectedDeviceForVideo({
          ...device,
          resolvedCameraStreamUrl: directStreamUrl,
          useProxyCamera: false,
        });
        setShowVideoPlayer(true);
        showStyledAlert('Using Direct Camera', 'Could not reach camera API, so the app opened direct stream from the device.', 'warning');
        return;
      }

      showStyledAlert('Camera Unavailable', 'Failed to contact camera API.', 'error');
    }
  };

  // Open browser with WebRTC live stream for device
  const openBrowserWebRTC = async (device: any) => {
    const deviceId = device?.id || device?.deviceId || device?.device_id;
    const userId = auth.currentUser?.uid || '';

    if (!deviceId) {
      showStyledAlert('Error', 'Device ID is missing.', 'error');
      return;
    }

    if (!userId) {
      showStyledAlert('Error', 'You must be signed in to stream video.', 'error');
      return;
    }

    const webrtcUrl = `${cameraApiUrl}/api/camera/${encodeURIComponent(deviceId)}/webrtc?userId=${encodeURIComponent(userId)}&apiKey=${encodeURIComponent(appApiKey)}`;

    try {
      const supported = await Linking.canOpenURL(webrtcUrl);
      if (!supported) {
        showStyledAlert('Error', 'Cannot open browser on this device.', 'error');
        return;
      }
      await Linking.openURL(webrtcUrl);
    } catch (error) {
      console.error('[Dashboard] Error opening WebRTC browser stream:', error);
      showStyledAlert('Error', 'Failed to open browser for video streaming.', 'error');
    }
  };

  // Fetch sensors for a device
  const fetchDeviceSensors = async (deviceId: string) => {
    try {
      setLoadingSensors(true);
      const API_KEY = process.env.EXPO_PUBLIC_API_KEY;
      const userId = auth.currentUser?.uid;

      const response = await fetch(
        `${sensorControlApiUrl}/api/sensors?deviceId=${deviceId}`,
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
      const API_KEY = process.env.EXPO_PUBLIC_API_KEY;
      const userId = auth.currentUser?.uid;

      const newState = !sensor.enabled;
      
      const response = await fetch(
        `${sensorControlApiUrl}/api/sensors/${sensor.sensor_id}/state`,
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

  const addSensorToDevice = async () => {
    try {
      const API_KEY = process.env.EXPO_PUBLIC_API_KEY;
      const userId = auth.currentUser?.uid;
      const deviceId = selectedDeviceForSensorControl?.id || selectedDeviceForSensorControl?.device_id;
      const sensorName = newSensorLabel.trim();
      const pinNumber = Number(newSensorPin);

      if (!deviceId) {
        showStyledAlert('Error', 'Device ID is missing.', 'error');
        return;
      }

      if (!sensorName) {
        showStyledAlert('Validation Error', 'Please enter sensor label.', 'error');
        return;
      }

      if (!Number.isInteger(pinNumber) || pinNumber < 1 || pinNumber > 40) {
        showStyledAlert('Validation Error', 'Pin number must be between 1 and 40.', 'error');
        return;
      }

      setAddingSensor(true);

      const response = await fetch(`${sensorControlApiUrl}/api/sensors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY || '',
          'x-user-id': userId || '',
        },
        body: JSON.stringify({
          deviceId,
          sensorName,
          pinNumber,
          sensorType: 'gpio',
        }),
      });

      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
        setNewSensorLabel('');
        setNewSensorPin('');
        await fetchDeviceSensors(deviceId);
        showStyledAlert('Success', `${sensorName} added on pin ${pinNumber}`, 'success');
        return;
      }

      if (response.status === 409) {
        showStyledAlert('Pin Already Used', responseData.reason || 'Pin number is already assigned.', 'warning');
        return;
      }

      showStyledAlert('Error', responseData.reason || responseData.error || 'Failed to add sensor', 'error');
    } catch (error) {
      console.error('[Dashboard] Error adding sensor:', error);
      showStyledAlert('Error', 'Failed to add sensor', 'error');
    } finally {
      setAddingSensor(false);
    }
  };

  const deleteSensorFromDevice = (sensor: any) => {
    if (!sensor?.sensor_id) {
      showStyledAlert('Error', 'Invalid sensor selected.', 'error');
      return;
    }

    showStyledAlert(
      'Delete Sensor',
      `Are you sure you want to delete "${sensor.sensor_name}"?`,
      'question',
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setStyledAlertVisible(false);
            try {
              const API_KEY = process.env.EXPO_PUBLIC_API_KEY;
              const userId = auth.currentUser?.uid;
              const deviceId = selectedDeviceForSensorControl?.id || selectedDeviceForSensorControl?.device_id;

              setDeletingSensorId(sensor.sensor_id);

              const response = await fetch(
                `${sensorControlApiUrl}/api/sensors/${sensor.sensor_id}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY || '',
                    'x-user-id': userId || '',
                  },
                }
              );

              const responseData = await response.json().catch(() => ({}));

              if (response.ok) {
                setDeviceSensors((prev) => prev.filter((s) => s.sensor_id !== sensor.sensor_id));
                setSelectedSensor(null);

                if (deviceId) {
                  await fetchDeviceSensors(deviceId);
                }

                showStyledAlert('Deleted', `${sensor.sensor_name} removed successfully`, 'success');
                return;
              }

              showStyledAlert(
                'Error',
                responseData.reason || responseData.error || 'Failed to delete sensor',
                'error'
              );
            } catch (error) {
              console.error('[Dashboard] Error deleting sensor:', error);
              showStyledAlert('Error', 'Failed to delete sensor', 'error');
            } finally {
              setDeletingSensorId(null);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      undefined,
      'stacked'
    );
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
        <Text style={styles.appTitle}>RuTAG-HACS</Text>
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
                const ratingScore = typeof item.rating === "number"
                  ? item.rating
                  : (typeof (item as any).userRating === "number" ? (item as any).userRating : null);
                
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
                      {ratingScore !== null && (
                        <View style={styles.ratingScoreBadge}>
                          <Text style={styles.ratingScoreText}>⭐ {ratingScore}/10</Text>
                        </View>
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
                    </View>

                    <View style={styles.deviceActions}>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.sensorBtn]}
                          onPress={() => {
                            setSelectedDeviceForSensorControl(item);
                            setSelectedSensor(null);
                            setNewSensorLabel('');
                            setNewSensorPin('');
                            setShowSensorControlModal(true);
                            fetchDeviceSensors(item.id);
                          }}
                        >
                          <MaterialIcons name="settings-remote" size={20} />
                          <Text style={styles.actionBtnLabel}>Sensor Control</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.editBtn]}
                          onPress={() => openDeviceCamera(item)}
                        >
                          <MaterialIcons name="videocam" size={20} />
                          <Text style={styles.actionBtnLabel}>Camera</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.webrtcBtn]}
                          onPress={() => openBrowserWebRTC(item)}
                        >
                          <MaterialIcons name="open-in-browser" size={20} />
                          <Text style={styles.actionBtnLabel}>Open Browser for Video Streaming</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.renameBtn]}
                          onPress={() => handleUpdateLabel(item.id, item.label || item.name || "")}
                        >
                          <MaterialIcons name="edit" size={20} />
                          <Text style={styles.actionBtnLabel}>Rename</Text>
                        </TouchableOpacity>
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
              <TouchableOpacity
                style={[
                  styles.closeButton,
                  claimingDeviceId !== null && styles.buttonDisabled,
                ]}
                onPress={() => {
                  setShowAddModal(false);
                  setAvailableDevices([]);
                }}
                disabled={claimingDeviceId !== null}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowRatingModal(false);
          setSelectedAlert(null);
          setSelectedRating(null);
          setSelectedAccuracy(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.ratingModalContent,
              {
                paddingTop: insets.top + 24,
                paddingBottom: Math.max(insets.bottom + 24, 32),
              },
            ]}
          >
            <View style={styles.ratingModalBody}>
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
                        <View style={styles.ratingButtonLabelWrap}>
                          <Text
                            style={[
                              styles.ratingButtonText,
                              selectedRating === rating && styles.ratingButtonTextSelected,
                            ]}
                            includeFontPadding={false}
                            allowFontScaling={false}
                          >
                            {rating}
                          </Text>
                        </View>
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
            </View>

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
            <View
              style={[
                styles.mlAlertDetailModal,
                {
                  paddingTop: insets.top + 16,
                  paddingBottom: Math.max(insets.bottom + 20, 32),
                },
              ]}
            >
              <ScrollView
                style={styles.mlAlertDetailScroll}
                contentContainerStyle={styles.mlAlertDetailScrollContent}
                showsVerticalScrollIndicator={true}
              >
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
                      <View key={idx} style={styles.screenshotItemRow}>
                        <Text numberOfLines={1} style={styles.screenshotPathText}>
                          📸 {img}
                        </Text>
                        <TouchableOpacity
                          style={styles.viewImageButton}
                          onPress={() => openAlertImage(img)}
                        >
                          <Text style={styles.viewImageButtonText}>View Image</Text>
                        </TouchableOpacity>
                      </View>
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
                                <View style={styles.ratingButtonLabelWrap}>
                                  <Text
                                    style={[
                                      styles.ratingButtonText,
                                      mlAlertRating === rating && styles.ratingButtonTextSelected,
                                    ]}
                                    includeFontPadding={false}
                                    allowFontScaling={false}
                                  >
                                    {rating}
                                  </Text>
                                </View>
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
                  style={[styles.button, styles.closeButton]}
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
                    onPress={() => handleDeleteMLAlert(selectedMLAlert)}
                  >
                    <Text style={styles.buttonText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* Alert Image Modal */}
      <Modal
        visible={showAlertImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAlertImageModal(false);
          setSelectedAlertImageUri('');
          setSelectedAlertImageSource('');
          setAlertImageLoading(false);
          setAlertImageError(null);
        }}
      >
        <View style={styles.alertImageOverlay}>
          <View style={styles.alertImageContainer}>
            <View style={styles.alertImageHeader}>
              <Text style={styles.alertImageTitle}>Alert Image</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAlertImageModal(false);
                  setSelectedAlertImageUri('');
                  setSelectedAlertImageSource('');
                  setAlertImageLoading(false);
                  setAlertImageError(null);
                }}
              >
                <Text style={styles.alertImageCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.alertImageBody}>
              {alertImageLoading ? (
                <View style={styles.alertImageStateBox}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.alertImageStateText}>Loading image...</Text>
                </View>
              ) : alertImageError ? (
                <View style={styles.alertImageStateBox}>
                  <Text style={styles.alertImageErrorText}>Failed to load image</Text>
                  <Text style={styles.alertImageSourceText}>{selectedAlertImageSource}</Text>
                  <Text style={styles.alertImageHintText}>{alertImageError}</Text>
                </View>
              ) : selectedAlertImageUri ? (
                <Image
                  source={{ uri: selectedAlertImageUri }}
                  style={styles.alertImagePreview}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.alertImageStateBox}>
                  <Text style={styles.alertImageHintText}>No image selected</Text>
                </View>
              )}
            </View>

            <View style={styles.alertImageFooter}>
              <TouchableOpacity
                style={styles.alertImageFooterButton}
                onPress={() => {
                  setShowAlertImageModal(false);
                  setSelectedAlertImageUri('');
                  setSelectedAlertImageSource('');
                  setAlertImageLoading(false);
                  setAlertImageError(null);
                }}
              >
                <Text style={styles.alertImageFooterButtonText}>Close</Text>
              </TouchableOpacity>

              {selectedAlertImageUri.startsWith('http://') || selectedAlertImageUri.startsWith('https://') ? (
                <TouchableOpacity
                  style={[styles.alertImageFooterButton, styles.alertImageOpenExternalButton]}
                  onPress={() => {
                    Linking.openURL(selectedAlertImageUri).catch(() => {
                      showStyledAlert('Error', 'Could not open image URL', 'error');
                    });
                  }}
                >
                  <Text style={styles.alertImageFooterButtonText}>Open External</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
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
                handleLogoutConfirmation();
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
                streamUrl={getCameraProxyStreamUrl(selectedDeviceForVideo)}
                deviceLabel={selectedDeviceForVideo?.label || selectedDeviceForVideo?.name || 'Camera'}
                apiKey={(selectedDeviceForVideo as any)?.useProxyCamera ? appApiKey : ''}
                userId={(selectedDeviceForVideo as any)?.useProxyCamera ? (auth.currentUser?.uid || '') : ''}
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
        onRequestClose={() => {
          setShowSensorControlModal(false);
          setSelectedSensor(null);
          setNewSensorLabel('');
          setNewSensorPin('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              styles.sensorControlModalContent,
              { paddingBottom: Math.max(insets.bottom + 20, 32) },
            ]}
          >
            <Text style={styles.modalTitle}>🎛️ Sensor Control</Text>
            <Text style={styles.modalSubtitle}>
              {selectedDeviceForSensorControl?.label || selectedDeviceForSensorControl?.name}
            </Text>

            {loadingSensors ? (
              <ActivityIndicator size="large" style={{ marginVertical: 20 }} />
            ) : (
              <>
                {!selectedSensor && (
                  <View style={styles.addSensorCard}>
                    <Text style={styles.addSensorTitle}>Add New Sensor</Text>
                    <View style={styles.addSensorInputRow}>
                      <TextInput
                        placeholder="Sensor label"
                        value={newSensorLabel}
                        onChangeText={setNewSensorLabel}
                        style={styles.addSensorInput}
                        placeholderTextColor="#94A3B8"
                      />
                      <TextInput
                        placeholder="Pin"
                        value={newSensorPin}
                        onChangeText={setNewSensorPin}
                        style={[styles.addSensorInput, styles.addSensorPinInput]}
                        placeholderTextColor="#94A3B8"
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.addSensorButton, addingSensor && styles.addSensorButtonDisabled]}
                      onPress={addSensorToDevice}
                      disabled={addingSensor}
                    >
                      {addingSensor ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.addSensorButtonText}>Add Sensor</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {selectedSensor ? (
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
                      <Text style={styles.sensorDetailPin}>Pin: {selectedSensor.pin_number ?? 'Not assigned'}</Text>

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

                      <TouchableOpacity
                        style={[
                          styles.deleteSensorButton,
                          deletingSensorId === selectedSensor.sensor_id && styles.deleteSensorButtonDisabled,
                        ]}
                        onPress={() => deleteSensorFromDevice(selectedSensor)}
                        disabled={deletingSensorId === selectedSensor.sensor_id}
                      >
                        {deletingSensorId === selectedSensor.sensor_id ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <MaterialIcons name="delete-outline" size={22} color="#fff" />
                            <Text style={styles.deleteSensorButtonText}>Delete Sensor</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : deviceSensors.length === 0 ? (
                  <Text style={styles.emptyText}>No sensors found. Add one to start controlling sensors.</Text>
                ) : (
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
                          <Text style={styles.sensorListItemPin}>Pin: {item.pin_number ?? 'N/A'}</Text>
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
              </>
            )}

            <TouchableOpacity
              style={[
                styles.sensorControlCloseButton,
                { marginBottom: Math.max(insets.bottom, 12) },
              ]}
              onPress={() => {
                setShowSensorControlModal(false);
                setSelectedSensor(null);
                setNewSensorLabel('');
                setNewSensorPin('');
              }}
              activeOpacity={0.85}
            >
              <MaterialIcons name="close" size={18} color="#FFFFFF" />
              <Text style={styles.sensorControlCloseButtonText}>Close Panel</Text>
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
        buttonLayout={styledAlertConfig.buttonLayout}
        buttons={styledAlertConfig.buttons}
        inputConfig={styledAlertConfig.inputConfig}
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
  renameBtn: {
    backgroundColor: "#FFF3E0",
    borderColor: "#FB8C00",
  },
  webrtcBtn: {
    backgroundColor: "#E8F5E9",
    borderColor: "#4CAF50",
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
    paddingVertical: 12,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  profileCloseBtnText: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "bold",
    lineHeight: 22,
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
    marginTop: 12,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  settingsButton: {
    backgroundColor: "#6D28D9",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
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
    width: "100%",
    height: "100%",
    padding: 24,
    elevation: 10,
  },
  ratingModalBody: {
    flex: 1,
    justifyContent: "center",
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
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ddd",
    overflow: "hidden",
  },
  ratingButtonLabelWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingButtonSelected: {
    backgroundColor: "#FF9800",
    borderColor: "#FF9800",
  },
  ratingButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#666",
    textAlign: "center",
    lineHeight: 16,
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
    justifyContent: "center",
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
    marginVertical: 4,
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
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    height: "100%",
    width: "100%",
  },
  sensorControlModalContent: {
    justifyContent: "flex-start",
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#DC2626",
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 34,
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
    backgroundColor: "#DC2626",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 4,
  },
  primaryButton: {
    backgroundColor: "#00FF41",
    borderRadius: 8,
  },
  modeButton: {
    backgroundColor: "#2196F3",
    paddingVertica8: 10,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 8,
  },
  buttonText: {
    color: "#FFFFFF",
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
    textAlign: "center",
  },
  ratingScoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#FFF3E0",
    borderWidth: 1,
    borderColor: "#FFB74D",
  },
  ratingScoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#E65100",
    textAlign: "center",
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
    width: "100%",
    height: "100%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  mlAlertDetailScroll: {
    flex: 1,
  },
  mlAlertDetailScrollContent: {
    paddingBottom: 16,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#DC2626",
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 34,
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
  screenshotItemRow: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  screenshotPathText: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 8,
  },
  viewImageButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewImageButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  alertImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  alertImageContainer: {
    width: '100%',
    maxWidth: 520,
    height: '84%',
    backgroundColor: '#111827',
    borderRadius: 12,
    overflow: 'hidden',
  },
  alertImageHeader: {
    height: 52,
    backgroundColor: '#1F2937',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertImageTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  alertImageCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DC2626',
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
  },
  alertImageBody: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertImageStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  alertImageStateText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 14,
  },
  alertImageErrorText: {
    color: '#FCA5A5',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  alertImageHintText: {
    color: '#CBD5E1',
    fontSize: 13,
    textAlign: 'center',
  },
  alertImageSourceText: {
    color: '#93C5FD',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertImagePreview: {
    width: '100%',
    height: '100%',
  },
  alertImageFooter: {
    minHeight: 58,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  alertImageFooterButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  alertImageOpenExternalButton: {
    backgroundColor: '#2563EB',
  },
  alertImageFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
    marginBottom: 6,
  },
  sensorDetailPin: {
    fontSize: 13,
    color: '#64748B',
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
    borderRadius: 8,
  },
  disableButton: {
    backgroundColor: '#F44336',
    borderRadius: 8,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteSensorButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#B91C1C',
  },
  deleteSensorButtonDisabled: {
    opacity: 0.7,
  },
  deleteSensorButtonText: {
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
  sensorListItemPin: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  addSensorCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  addSensorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3730A3',
    marginBottom: 10,
  },
  addSensorInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  addSensorInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  addSensorPinInput: {
    maxWidth: 92,
    textAlign: 'center',
  },
  addSensorButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSensorButtonDisabled: {
    opacity: 0.7,
  },
  addSensorButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
  sensorControlCloseButton: {
    marginTop: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#DC2626",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 160,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  sensorControlCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

