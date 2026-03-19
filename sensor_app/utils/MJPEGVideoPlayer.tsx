import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

interface MJPEGVideoPlayerProps {
  streamUrl: string;
  deviceLabel?: string;
  apiKey?: string;
  userId?: string;
  onClose?: () => void;
}

export default function MJPEGVideoPlayer({
  streamUrl,
  deviceLabel = 'Camera',
  apiKey = '',
  userId = '',
  onClose
}: MJPEGVideoPlayerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uri, setUri] = useState('');
  const [pendingUri, setPendingUri] = useState('');
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const counterRef = useRef(0);
  const pendingUriRef = useRef('');
  const isFocused = useIsFocused();
  const hasFrameUri = typeof uri === 'string' && uri.trim().length > 0;

  const FRAME_REFRESH_MS = 2000;

  const buildFrameUri = () => {
    counterRef.current++;
    const [streamPath] = streamUrl.split('?');
    const baseUrl = streamPath.replace('/stream.mjpeg', '');
    const apiKeyQuery = apiKey ? `apiKey=${encodeURIComponent(apiKey)}&` : '';
    const userIdQuery = userId ? `userId=${encodeURIComponent(userId)}&` : '';
    return `${baseUrl}/frame.jpg?${apiKeyQuery}${userIdQuery}t=${Date.now()}&fc=${counterRef.current}`;
  };

  // Set initial URI
  useEffect(() => {
    if (isFocused && streamUrl) {
      setError(null);
      setLoading(true);
      setPendingUri('');
      setIsFetchingNext(false);
      updateFrame();
    } else if (isFocused && !streamUrl) {
      setError('Camera stream is not configured for this device');
    }
  }, [isFocused, streamUrl, apiKey, userId]);

  // Queue next frame for preloading. Visible frame is swapped only after load.
  const updateFrame = () => {
    if (!streamUrl || isFetchingNext) {
      return;
    }

    const newUri = buildFrameUri();
    pendingUriRef.current = newUri;
    setPendingUri(newUri);
    setIsFetchingNext(true);
  };

  // Optional polling loop. Disabled when FRAME_REFRESH_MS <= 0.
  useEffect(() => {
    if (!isFocused || error || !streamUrl || FRAME_REFRESH_MS <= 0) return;

    const interval = setInterval(() => {
      updateFrame();
    }, FRAME_REFRESH_MS);

    return () => clearInterval(interval);
  }, [isFocused, error, streamUrl, apiKey, userId, isFetchingNext]);

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

        {hasFrameUri ? (
          <Image
            source={{ 
              uri: uri,
              cache: 'reload'
            }}
            style={styles.stream}
            onLoad={() => {
              if (loading) {
                setLoading(false);
              }
            }}
            onError={(err) => {
              const nativeError = (err as any)?.nativeEvent?.error;
              console.error('[Frame] Load error:', nativeError || err);
              if (typeof nativeError === 'string' && nativeError.trim()) {
                setError(`Failed to load frame: ${nativeError}`);
              } else {
                setError('Failed to load frame (camera unavailable or access denied)');
              }
            }}
          />
        ) : (
          <Text style={styles.loadingText}>Preparing first frame...</Text>
        )}

        {pendingUri ? (
          <Image
            source={{
              uri: pendingUri,
              cache: 'reload'
            }}
            style={styles.preloadFrame}
            onLoad={() => {
              const nextFrameUri = pendingUriRef.current;
              if (!nextFrameUri) {
                setIsFetchingNext(false);
                return;
              }

              setUri(nextFrameUri);
              setPendingUri('');
              setIsFetchingNext(false);

              if (loading) {
                setLoading(false);
              }
            }}
            onError={() => {
              setPendingUri('');
              setIsFetchingNext(false);
            }}
          />
        ) : null}
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 22,
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
  preloadFrame: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
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
