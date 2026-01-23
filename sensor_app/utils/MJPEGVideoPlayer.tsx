import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image, Animated } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

interface MJPEGVideoPlayerProps {
  streamUrl: string;
  deviceLabel?: string;
  onClose?: () => void;
}

export default function MJPEGVideoPlayer({
  streamUrl,
  deviceLabel = 'Camera',
  onClose
}: MJPEGVideoPlayerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uri, setUri] = useState('');
  const counterRef = useRef(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isFocused = useIsFocused();

  // Set initial URI
  useEffect(() => {
    if (isFocused) {
      updateFrame();
    }
  }, [isFocused, streamUrl]);

  // Update frame URI
  const updateFrame = () => {
    counterRef.current++;
    const baseUrl = streamUrl.replace('/stream.mjpeg', '');
    const newUri = `${baseUrl}/frame.jpg?t=${Date.now()}&fc=${counterRef.current}`;
    setUri(newUri);
    
    // Fade animation for smoother transition
    fadeAnim.setValue(0.8);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Refresh frame every 1.5 seconds to reduce blinking
  useEffect(() => {
    if (!isFocused || error) return;

    const interval = setInterval(() => {
      updateFrame();
    }, 1500);

    return () => clearInterval(interval);
  }, [isFocused, error, streamUrl]);

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setLoading(true);
              updateFrame();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>📹 {deviceLabel}</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.streamContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Connecting to camera...</Text>
          </View>
        )}

        <Animated.Image
          source={{ 
            uri: uri,
            cache: 'reload'
          }}
          style={[styles.stream, { opacity: fadeAnim }]}
          onLoad={() => {
            if (loading) {
              setLoading(false);
            }
          }}
          onError={(err) => {
            console.error('[Frame] Load error:', err);
            setError('Failed to load frame');
          }}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.streamInfo}>🌐 Streaming MJPEG</Text>
        <Text style={styles.streamUrl}>{streamUrl}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#333',
    borderRadius: 4,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  streamContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stream: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  streamInfo: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 4,
  },
  streamUrl: {
    color: '#888',
    fontSize: 10,
  },
});
