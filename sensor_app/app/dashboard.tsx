import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView, FlatList, TouchableOpacity, Alert, TextInput, Modal, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { useState, useEffect } from "react";
import { listenToUserDevices, updateDeviceLabel, listenToDeviceReadings, getAvailableDevicesForUser, claimDevice, unclaimDevice, listenToUserAlerts, updateAlertRating } from "../db/firestore";
import { useRouter } from "expo-router";
import { initPushNotifications, sendTestNotification, setupNotificationListeners } from "../utils/notifications";
import { triggerTestAlert } from "../utils/testAlerts";
import { getCameraStreamUrl, getCameraWebUIUrl, getDeviceStreamingInfo } from "../utils/cameraStreaming";
import MJPEGVideoPlayer from "../utils/MJPEGVideoPlayer";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loggingOut, setLoggingOut] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
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
  const [readingsUnsubscribes, setReadingsUnsubscribes] = useState<(() => void)[]>([]);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedAccuracy, setSelectedAccuracy] = useState<boolean | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedDeviceForVideo, setSelectedDeviceForVideo] = useState<any | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [streamingMode, setStreamingMode] = useState<"http" | "webrtc">("http");

  // Listen to alerts real-time
  useEffect(() => {
    console.log("[Dashboard] Setting up alerts listener");
    const unsubscribe = listenToUserAlerts((data) => {
      console.log("[Dashboard] Alerts updated:", data.length);
      setAlerts(data);
      setLoading(false);
    });
    setUnsubscribeAlerts(() => unsubscribe);
    return unsubscribe;
  }, []);

  // Listen to devices real-time
  useEffect(() => {
    console.log("[Dashboard] Setting up device listener");
    const unsubscribe = listenToUserDevices((data) => {
      console.log("[Dashboard] Devices updated:", data.length);
      console.log("[Dashboard] Device data:", JSON.stringify(data, null, 2));
      setDevices(data);

      // Unsubscribe from previous readings listeners
      readingsUnsubscribes.forEach((unsub) => unsub());

      // Only setup readings listeners if user is still authenticated
      if (!auth.currentUser) {
        console.log("[Dashboard] User not authenticated - skipping readings listeners");
        setReadingsUnsubscribes([]);
        return;
      }

      // Setup readings listeners for each device
      const newUnsubscribes: (() => void)[] = [];
      data.forEach((device) => {
        const readingsUnsub = listenToDeviceReadings(device.id, (readings) => {
          setDeviceReadings((prev) => ({
            ...prev,
            [device.id]: readings,
          }));
        }, 5);
        newUnsubscribes.push(readingsUnsub);
      });
      setReadingsUnsubscribes(newUnsubscribes);
    });
    setUnsubscribeDevices(() => unsubscribe);
    return unsubscribe;
  }, []);

  // Cleanup listeners when user logs out
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        // User logged out - cleanup all listeners
        console.log("[Dashboard] Auth state changed to null - cleaning up listeners");
        if (unsubscribeAlerts) {
          unsubscribeAlerts();
          setUnsubscribeAlerts(null);
        }
        if (unsubscribeDevices) {
          unsubscribeDevices();
          setUnsubscribeDevices(null);
        }
        readingsUnsubscribes.forEach((unsub) => unsub());
        setReadingsUnsubscribes([]);
      }
    });
    return unsubscribeAuth;
  }, [unsubscribeAlerts, unsubscribeDevices, readingsUnsubscribes]);

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
      if (unsubscribeAlerts) unsubscribeAlerts();
      if (unsubscribeDevices) unsubscribeDevices();
      // Unsubscribe from all readings listeners
      readingsUnsubscribes.forEach((unsub) => unsub());
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
      await updateAlertRating(selectedAlert.deviceId, selectedAlert.id, selectedRating, selectedAccuracy);
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
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => setShowProfileModal(true)}
        >
          <Text style={styles.profileButtonText}>👤</Text>
        </TouchableOpacity>
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
            <MaterialIcons name="notifications" size={20} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.navItemText}>Alerts</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, activeTab === "devices" && styles.navItemActive]}
          onPress={() => setActiveTab("devices")}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <MaterialIcons name="computer" size={20} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.navItemText}>Devices</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert History</Text>

          {loading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No alerts yet</Text>
              <Text style={styles.emptySubtext}>Alerts will appear here when readings exceed thresholds</Text>
            </View>
          ) : (
            <FlatList
              data={alerts}
              scrollEnabled={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.alertCard}
                  onPress={() => handleOpenRatingModal(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.alertHeader}>
                    <Text style={styles.alertDeviceLabel}>{item.deviceLabel}</Text>
                    <Text style={styles.alertTimestamp}>
                      {new Date(item.timestamp?.toDate?.() || item.timestamp).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.alertMessage}>{item.message}</Text>
                  {item.type && (
                    <Text style={styles.alertType}>Type: {item.type}</Text>
                  )}
                  {item.rating ? (
                    <View style={styles.alertFeedbackContainer}>
                      <Text style={styles.alertAccuracy}>
                        {item.accuracy ? "✅ Accurate" : "❌ Inaccurate"}
                      </Text>
                      <Text style={styles.alertRating}>⭐ Rating: {item.rating}/10</Text>
                    </View>
                  ) : (
                    <Text style={styles.alertRatingPrompt}>👆 Tap to rate</Text>
                  )}
                </TouchableOpacity>
              )}
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
              <Text style={styles.addButtonText}>➕ Add</Text>
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
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.testBtn]}
                        onPress={async () => {
                          try {
                            await triggerTestAlert(item.id, item.name || item.label || item.id);
                            Alert.alert("Success", "Alert notification sent!");
                          } catch (error) {
                            console.error("Error sending alert:", error);
                            Alert.alert("Error", "Failed to send alert notification");
                          }
                        }}
                      >
                        <Text style={styles.actionBtnText}>🔔</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.editBtn]}
                        onPress={() => {
                          setSelectedDeviceForVideo(item);
                          setShowVideoPlayer(true);
                        }}
                      >
                        <Text style={styles.actionBtnText}>📹</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.deleteBtn]}
                        onPress={() => handleUnclaimDevice(item.id, item.label)}
                      >
                        <Text style={styles.actionBtnText}>🗑️</Text>
                      </TouchableOpacity>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    flexDirection: "row",
    gap: 8,
    marginLeft: 12,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  editBtn: {
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
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
    fontSize: 16,
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
});

