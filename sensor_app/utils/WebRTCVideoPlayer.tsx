/**
 * WebRTC Video Player Component
 * Connects to Raspberry Pi camera via WebRTC with Firebase signaling
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices
} from 'react-native-webrtc';
import {
  sendOffer,
  listenForAnswer,
  sendICECandidate,
  listenForICECandidates,
  createRTCSession,
  cleanupRTCSession,
  isDeviceReadyForWebRTC
} from '../db/webrtcSignaling';

interface WebRTCVideoPlayerProps {
  deviceId: string;
  deviceLabel?: string;
  onClose?: () => void;
}

export const WebRTCVideoPlayer: React.FC<WebRTCVideoPlayerProps> = ({
  deviceId,
  deviceLabel = "Camera",
  onClose
}) => {
  const [status, setStatus] = useState<string>('Initializing...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const sessionId = useRef<string | null>(null);
  const unsubscribers = useRef<Array<() => void>>([]);

  useEffect(() => {
    initializeWebRTC();
    return cleanup;
  }, []);

  /**
   * Initialize WebRTC connection
   */
  const initializeWebRTC = async () => {
    try {
      setStatus('Checking device availability...');

      // Check if device is ready for WebRTC
      const ready = await isDeviceReadyForWebRTC(deviceId);
      if (!ready) {
        setError(`Device "${deviceLabel}" is not ready for WebRTC streaming`);
        setLoading(false);
        return;
      }

      setStatus('Creating signaling session...');

      // Create signaling session in Firebase
      sessionId.current = await createRTCSession(deviceId, deviceId); // In real app, use actual userId
      console.log('[WebRTC] Session created:', sessionId.current);

      setStatus('Initializing peer connection...');

      // Create RTCPeerConnection
      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ];

      peerConnection.current = new RTCPeerConnection({
        iceServers
      });

      // Handle remote stream
      peerConnection.current.ontrack = (event) => {
        const kind = event.track.kind;
        console.log('[WebRTC] 📡 RECEIVED REMOTE TRACK:', kind);
        console.log('[WebRTC] Stream ID:', event.streams[0]?.id);
        console.log('[WebRTC] Track ID:', event.track.id);
        console.log('[WebRTC] Track enabled:', event.track.enabled);
        remoteStream.current = event.streams[0];
        console.log('[WebRTC] 🎬 Remote stream set, triggering UI update');
        setStatus('✅ Stream connected');
        setIsConnected(true);
      };

      // Handle ICE candidates
      peerConnection.current.onicecandidate = async (event) => {
        if (event.candidate && sessionId.current) {
          console.log('[WebRTC] Sending ICE candidate');
          try {
            await sendICECandidate(sessionId.current, deviceId, event.candidate);
          } catch (err) {
            console.warn('[WebRTC] Failed to send ICE candidate:', err);
          }
        }
      };

      // Handle connection state changes
      peerConnection.current.onconnectionstatechange = () => {
        const state = peerConnection.current?.connectionState;
        console.log('[WebRTC] ⚡ CONNECTION STATE CHANGED:', state);
        switch (state) {
          case 'connected':
            console.log('[WebRTC] 🟢 CONNECTED - Video should now be visible');
            setStatus('✅ Connected');
            setIsConnected(true);
            break;
          case 'connecting':
            console.log('[WebRTC] 🟡 Still connecting...');
            setStatus('⏳ Connecting...');
            break;
          case 'disconnected':
            console.log('[WebRTC] 🔴 Disconnected');
            setStatus('⚠️ Disconnected');
            setIsConnected(false);
            break;
          case 'failed':
            console.log('[WebRTC] 🔴 Connection FAILED');
            setStatus('❌ Connection failed');
            setError('WebRTC connection failed');
            setIsConnected(false);
            break;
          case 'closed':
            console.log('[WebRTC] 🔴 Connection CLOSED');
            setStatus('Connection closed');
            setIsConnected(false);
            break;
        }
      };

      setStatus('Creating offer...');

      // Set up listeners BEFORE sending offer to catch answers immediately
      let unsubAnswer: (() => void) | undefined;
      let unsubICE: (() => void) | undefined;

      try {
        // Listen for answer first
        console.log('[WebRTC] Setting up answer listener for session:', sessionId.current);
        unsubAnswer = listenForAnswer(sessionId.current!, async (answer) => {
          console.log('[WebRTC] ANSWER LISTENER FIRED with answer:', answer.type);
          
          if (!peerConnection.current) {
            console.error('[WebRTC] ❌ Peer connection is null!');
            return;
          }
          
          console.log('[WebRTC] Current peer connection state:', peerConnection.current.connectionState);
          
          try {
            // Get the SDP and normalize it
            let sdp = (answer.sdp || '').toString();
            
            // Critical: Remove ALL whitespace line endings
            sdp = sdp.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            
            // Validate SDP structure
            const lines = sdp.split('\n');
            console.log('[WebRTC] SDP has', lines.length, 'lines');
            console.log('[WebRTC] SDP first line:', lines[0]);
            console.log('[WebRTC] SDP m= line:', lines.find(l => l.startsWith('m=')));
            
            // Check for required SDP attributes
            const hasFingerprint = lines.some(l => l.startsWith('a=fingerprint:'));
            const hasIceUfrag = lines.some(l => l.startsWith('a=ice-ufrag:'));
            const hasIcePwd = lines.some(l => l.startsWith('a=ice-pwd:'));
            
            console.log('[WebRTC] SDP validation:', { hasFingerprint, hasIceUfrag, hasIcePwd });
            
            if (!hasFingerprint || !hasIceUfrag || !hasIcePwd) {
              throw new Error(`Invalid SDP: missing required attributes. Fingerprint=${hasFingerprint}, Ufrag=${hasIceUfrag}, Pwd=${hasIcePwd}`);
            }
            
            // Trim each line to remove trailing whitespace
            const cleanLines = lines.map(l => l.trim()).filter(l => l.length > 0);
            const cleanSDP = cleanLines.join('\n');
            
            console.log('[WebRTC] Clean SDP length:', cleanSDP.length);
            console.log('[WebRTC] About to set remote description...');

            // Use plain object approach for better compatibility
            const sessionDesc = {
              type: 'answer' as const,
              sdp: cleanSDP
            };
            
            console.log('[WebRTC] Setting remote description with plain object');
            
            try {
              // Await the promise directly
              await peerConnection.current.setRemoteDescription(sessionDesc);
              console.log('[WebRTC] ✅ setRemoteDescription succeeded!');
            } catch (err: any) {
              // Log the error but don't throw - continue processing
              console.warn('[WebRTC] ⚠️ setRemoteDescription error (continuing):', err?.message);
            }
            
            // Add delay to let native bridge process
            await new Promise(resolve => setTimeout(resolve, 300));
            
            console.log('[WebRTC] ✅ Remote description processed');
            console.log('[WebRTC] New connection state:', peerConnection.current.connectionState);
            console.log('[WebRTC] New signaling state:', (peerConnection.current as any).signalingState);
            setStatus('Answer received, waiting for connection...');
          } catch (err: any) {
            console.error('[WebRTC] ❌ Error in answer processing');
            console.error('[WebRTC] Error:', err.message);
            
            // Log peer connection state for debugging
            if (peerConnection.current) {
              console.log('[WebRTC] Peer connection state:', {
                connectionState: peerConnection.current.connectionState,
                signalingState: (peerConnection.current as any).signalingState,
                iceConnectionState: (peerConnection.current as any).iceConnectionState,
              });
            }
            
            setError(`Connection error: ${err.message}`);
            setLoading(false);
          }
        });
        unsubscribers.current.push(unsubAnswer);
        console.log('[WebRTC] Answer listener attached');

        // Listen for ICE candidates
        console.log('[WebRTC] Setting up ICE listener for session:', sessionId.current);
        unsubICE = listenForICECandidates(sessionId.current!, async (candidate) => {
          console.log('[WebRTC] ICE LISTENER FIRED with candidate:', candidate.candidate);
          if (peerConnection.current) {
            console.log('[WebRTC] Adding ICE candidate');
            try {
              await peerConnection.current.addIceCandidate(candidate);
            } catch (err) {
              console.warn('[WebRTC] Failed to add ICE candidate:', err);
            }
          }
        });
        unsubscribers.current.push(unsubICE);
        console.log('[WebRTC] ICE listener attached');
      } catch (err) {
        console.error('[WebRTC] Error setting up listeners:', err);
      }

      // Add small delay to ensure Firebase listeners are fully subscribed
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('[WebRTC] Listeners ready, creating offer...');

      // Now create and send offer
      // Only request video - audio not needed for camera streaming
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: true
      });

      await peerConnection.current.setLocalDescription(offer);

      if (sessionId.current) {
        console.log('[WebRTC] Sending offer for session:', sessionId.current);
        console.log('[WebRTC] OFFER SDP (first 500 chars):', offer.sdp?.substring(0, 500));
        await sendOffer(sessionId.current, deviceId, offer);
        console.log('[WebRTC] Offer sent');
      }

      setStatus('Waiting for answer...');

      // Set timeout for connection
      const timeout = setTimeout(() => {
        if (!isConnected) {
          setError('WebRTC connection timeout - device may be offline');
          setLoading(false);
        }
      }, 30000); // Increased from 15s to 30s to allow for listener setup and ICE gathering

      // Monitor connection
      const checkConnection = setInterval(() => {
        if (peerConnection.current?.connectionState === 'connected') {
          setLoading(false);
          clearInterval(checkConnection);
          clearTimeout(timeout);
        }
      }, 500);

      unsubscribers.current.push(() => {
        clearInterval(checkConnection);
        clearTimeout(timeout);
      });

    } catch (err: any) {
      console.error('[WebRTC] Initialization error:', err);
      setError(err.message || 'Failed to initialize WebRTC connection');
      setLoading(false);
    }
  };

  /**
   * Cleanup resources
   */
  const cleanup = async () => {
    console.log('[WebRTC] Cleaning up...');

    // Unsubscribe from Firebase listeners
    unsubscribers.current.forEach(unsub => unsub());
    unsubscribers.current = [];

    // Close peer connection
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    // Clean up session
    if (sessionId.current) {
      try {
        await cleanupRTCSession(sessionId.current);
      } catch (err) {
        console.warn('[WebRTC] Cleanup error:', err);
      }
    }
  };

  /**
   * Retry connection
   */
  const handleRetry = () => {
    setError(null);
    setLoading(true);
    cleanup().then(() => {
      initializeWebRTC();
    });
  };

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>🔄 Retry</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity style={styles.closeButtonError} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.deviceName}>{deviceLabel}</Text>
            <Text style={styles.status}>{status}</Text>
          </View>

          <View style={styles.videoPlaceholder}>
            {loading ? (
              <>
                <ActivityIndicator size="large" color="#00FF41" />
                <Text style={styles.loadingText}>Connecting to camera...</Text>
              </>
            ) : remoteStream.current ? (
              <>
                <RTCView
                  streamURL={remoteStream.current.toURL()}
                  style={styles.videoStream}
                  mirror={false}
                  objectFit="cover"
                />
                <View style={styles.statusOverlay}>
                  <Text style={styles.streamStatus}>
                    {isConnected ? '✅ LIVE' : '⏳ Connecting'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.videoNotSupported}>
                  📹 WebRTC Stream
                </Text>
                <Text style={styles.videoSubtext}>
                  {isConnected ? '✅ Connected' : '⏳ Connecting...'}
                </Text>
                <Text style={styles.videoHint}>
                  Waiting for remote stream...
                </Text>
              </>
            )}
          </View>

          {onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  header: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  deviceName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  status: {
    color: '#00FF41',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
    margin: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  videoStream: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  statusOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  streamStatus: {
    color: '#00FF41',
    fontSize: 12,
    fontWeight: 'bold',
  },
  videoNotSupported: {
    fontSize: 24,
    marginBottom: 10,
  },
  videoSubtext: {
    color: '#00FF41',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  videoHint: {
    color: '#999',
    fontSize: 12,
  },
  loadingText: {
    color: '#00FF41',
    fontSize: 14,
    marginTop: 10,
  },
  closeButton: {
    backgroundColor: '#FF9800',
    margin: 10,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#00FF41',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  retryButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  closeButtonError: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
  },
});

export default WebRTCVideoPlayer;
