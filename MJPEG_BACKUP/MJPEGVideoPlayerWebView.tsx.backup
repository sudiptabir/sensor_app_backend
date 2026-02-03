import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useIsFocused } from '@react-navigation/native';

interface MJPEGVideoPlayerWebViewProps {
  streamUrl: string;
  deviceLabel?: string;
  onClose?: () => void;
}

export default function MJPEGVideoPlayerWebView({
  streamUrl,
  deviceLabel = 'Camera',
  onClose
}: MJPEGVideoPlayerWebViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFocused = useIsFocused();

  const frameUrl = streamUrl.replace('/stream.mjpeg', '') + '/frame.jpg';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * {
          margin: 0;
          padding: 0;
        }
        body {
          background: #000;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100vw;
          height: 100vh;
        }
        .container {
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .loading {
          color: white;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <img id="stream" alt="camera stream" />
      </div>
      <script>
        const img = document.getElementById('stream');
        let counter = 0;
        
        function updateFrame() {
          img.src = '${frameUrl}?t=' + Date.now() + '&c=' + (counter++);
        }
        
        // Update frame every 1 second
        setInterval(updateFrame, 1000);
        updateFrame(); // Initial load
      </script>
    </body>
    </html>
  `;

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
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!isFocused) {
    return null;
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
        
        <WebView
          source={{ html: htmlContent }}
          style={styles.webview}
          scalesPageToFit={true}
          scrollEnabled={false}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Failed to load camera stream');
          }}
          originWhitelist={['*']}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.streamInfo}>🌐 Streaming MJPEG (WebView)</Text>
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
  },
  streamContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
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
    paddingHorizontal: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#ff9500',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    color: '#999',
    fontSize: 11,
  },
});
