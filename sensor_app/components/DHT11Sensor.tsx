import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

interface SensorReading {
  sensor_id: string;
  temperature: number | null;
  humidity: number | null;
  timestamp: string;
}

interface DHT11SensorProps {
  sensorId: string;
  sensorName?: string;
  deviceId?: string;
}

export const DHT11Sensor: React.FC<DHT11SensorProps> = ({
  sensorId,
  sensorName = 'DHT11 Sensor',
  deviceId,
}) => {
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [sensorEnabled, setSensorEnabled] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch latest sensor reading
  const fetchSensorData = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/api/sensors/${sensorId}/latest`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sensor data: ${response.status}`);
      }
      
      const data = await response.json();
      setReading(data);
      setSensorEnabled(true);
    } catch (err) {
      console.error('Sensor fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sensor data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Control sensor on/off
  const controlSensor = async (action: 'on' | 'off') => {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/api/sensors/${sensorId}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`Failed to control sensor: ${response.status}`);
      }

      const data = await response.json();
      setSensorEnabled(action === 'on');
      
      Alert.alert(
        'Success',
        `Sensor turned ${action.toUpperCase()}`,
        [{ text: 'OK', onPress: fetchSensorData }]
      );
    } catch (err) {
      console.error('Control error:', err);
      setError(err instanceof Error ? err.message : 'Failed to control sensor');
      Alert.alert('Error', 'Failed to control sensor');
    }
  };

  // Refresh data
  const onRefresh = () => {
    setRefreshing(true);
    fetchSensorData();
  };

  // Initial fetch
  useEffect(() => {
    fetchSensorData();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchSensorData, 5000);
    
    return () => clearInterval(interval);
  }, [sensorId]);

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      style={styles.container}
    >
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Sensor Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.sensorName}>{sensorName}</Text>
          <Text style={styles.sensorId}>ID: {sensorId}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sensorEnabled ? '#10b981' : '#ef4444' }]}>
          <Text style={styles.statusText}>{sensorEnabled ? 'ACTIVE' : 'INACTIVE'}</Text>
        </View>
      </View>

      {/* Readings */}
      <View style={styles.readingsContainer}>
        {/* Temperature */}
        <View style={styles.readingCard}>
          <View style={styles.readingHeader}>
            <Ionicons name="thermometer" size={28} color="#ef4444" />
            <Text style={styles.readingLabel}>Temperature</Text>
          </View>
          <Text style={styles.readingValue}>
            {reading?.temperature !== null && reading?.temperature !== undefined
              ? `${reading.temperature.toFixed(1)}°C`
              : 'No data'}
          </Text>
          <Text style={styles.readingTime}>
            {reading?.timestamp
              ? new Date(reading.timestamp).toLocaleTimeString()
              : '--:--:--'}
          </Text>
        </View>

        {/* Humidity */}
        <View style={styles.readingCard}>
          <View style={styles.readingHeader}>
            <Ionicons name="water" size={28} color="#3b82f6" />
            <Text style={styles.readingLabel}>Humidity</Text>
          </View>
          <Text style={styles.readingValue}>
            {reading?.humidity !== null && reading?.humidity !== undefined
              ? `${reading.humidity.toFixed(1)}%`
              : 'No data'}
          </Text>
          <Text style={styles.readingTime}>
            {reading?.timestamp
              ? new Date(reading.timestamp).toLocaleTimeString()
              : '--:--:--'}
          </Text>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlContainer}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            { backgroundColor: sensorEnabled ? '#ef4444' : '#10b981' },
          ]}
          onPress={() => controlSensor(sensorEnabled ? 'off' : 'on')}
        >
          <Ionicons
            name={sensorEnabled ? 'power' : 'power-outline'}
            size={24}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.controlButtonText}>
            {sensorEnabled ? 'TURN OFF' : 'TURN ON'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#3b82f6" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Sensor Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sensor Type:</Text>
          <Text style={styles.infoValue}>DHT11</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sensor ID:</Text>
          <Text style={styles.infoValue}>{sensorId}</Text>
        </View>
        {deviceId && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Device ID:</Text>
            <Text style={styles.infoValue}>{deviceId}</Text>
          </View>
        )}
        {reading?.timestamp && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last Update:</Text>
            <Text style={styles.infoValue}>
              {new Date(reading.timestamp).toLocaleString()}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sensorName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  sensorId: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#991b1b',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  readingsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  readingCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  readingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  readingLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  readingValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  readingTime: {
    fontSize: 10,
    color: '#9ca3af',
  },
  controlContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#10b981',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refreshButtonText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
  },
});

export default DHT11Sensor;
