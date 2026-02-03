import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import {
  RTCPeerConnection,
  RTCView,
  RTCIceCandidate,
  RTCSessionDescription,
} from 'react-native-webrtc';

interface WebRTCVideoViewProps {
  signalingUrl?: string;
  deviceId: string;
  onConnectionStateChange?: (state: string) => void;
}

// Default signaling URL - update this if your laptop IP changes
const DEFAULT_SIGNALING_URL = "http://192.168.43.211:8080/signal";

export const WebRTCVideoView: React.FC<WebRTCVideoViewProps> = ({
  signalingUrl = DEFAULT_SIGNALING_URL,
  deviceId,
  onConnectionStateChange,
}) => {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [connectionState, setConnectionState] = useState<string>('connecting');
  const signalingIntervalRef = useRef<any>(null);

  useEffect(() => {
    initializeWebRTC();
    return () => {
      cleanup();
    };
  }, [signalingUrl, deviceId]);

  const initializeWebRTC = async () => {
    try {
      console.log('[WebRTC] Initializing peer connection...');
      
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302'] },
          { urls: ['stun:stun1.l.google.com:19302'] },
        ],
      });

      peerConnectionRef.current = peerConnection;

      // Handle remote stream
      (peerConnection as any).onaddstream = (event: any) => {
        console.log('[WebRTC] Remote stream added');
        setRemoteStream(event.stream);
        updateConnectionState('connected');
      };

      // Handle connection state changes
      (peerConnection as any).onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', peerConnection.connectionState);
        updateConnectionState(peerConnection.connectionState);
      };

      // Handle ICE connection state changes
      (peerConnection as any).oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state:', peerConnection.iceConnectionState);
        updateConnectionState(peerConnection.iceConnectionState);
      };

      // Handle ICE candidates
      (peerConnection as any).onicecandidate = (event: any) => {
        if (event.candidate) {
          console.log('[WebRTC] New ICE candidate');
          sendSignalingMessage({
            type: 'ice-candidate',
            candidate: event.candidate,
            deviceId: deviceId,
          });
        }
      };

      // Connect to signaling server
      await connectToSignaling(peerConnection);
      
      // Poll for answers and ICE candidates
      startSignalingPolling();
    } catch (error) {
      console.error('[WebRTC] Initialization error:', error);
      updateConnectionState('failed');
    }
  };

  const connectToSignaling = async (pc: RTCPeerConnection) => {
    try {
      console.log('[WebRTC] Creating offer...');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      await pc.setLocalDescription(offer);
      console.log('[WebRTC] Offer created, sending to server...');

      // Send offer to signaling server
      await sendSignalingMessage({
        type: 'offer',
        sdp: offer.sdp,
        deviceId: deviceId,
      });
    } catch (error) {
      console.error('[WebRTC] Signaling error:', error);
      updateConnectionState('failed');
    }
  };

  const sendSignalingMessage = async (message: any) => {
    try {
      console.log('[WebRTC] Sending message:', message.type);
      
      const response = await fetch(signalingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[WebRTC] Received response:', data.type);
        
        if (data.sdp && data.type === 'answer' && peerConnectionRef.current) {
          console.log('[WebRTC] Setting remote description (answer)');
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription({
              sdp: data.sdp,
              type: 'answer',
            })
          );
        }
        
        if (data.candidate && peerConnectionRef.current) {
          console.log('[WebRTC] Adding ICE candidate');
          try {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(data.candidate)
            );
          } catch (e) {
            console.warn('[WebRTC] Error adding ICE candidate:', e);
          }
        }
      } else {
        console.error('[WebRTC] Signaling server error:', response.status);
      }
    } catch (error) {
      console.error('[WebRTC] Send message error:', error);
    }
  };

  const startSignalingPolling = () => {
    // Poll for answers and ICE candidates every 1 second
    signalingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${signalingUrl}?deviceId=${deviceId}`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.sdp && data.type === 'answer' && peerConnectionRef.current) {
            if (peerConnectionRef.current.remoteDescription === null) {
              console.log('[WebRTC] Setting remote description from poll');
              await peerConnectionRef.current.setRemoteDescription(
                new RTCSessionDescription({
                  sdp: data.sdp,
                  type: 'answer',
                })
              );
            }
          }
          
          if (data.candidates && Array.isArray(data.candidates)) {
            for (const candidate of data.candidates) {
              try {
                await peerConnectionRef.current?.addIceCandidate(
                  new RTCIceCandidate(candidate)
                );
              } catch (e) {
                console.warn('[WebRTC] Error adding ICE candidate from poll:', e);
              }
            }
          }
        }
      } catch (error) {
        console.warn('[WebRTC] Polling error:', error);
      }
    }, 1000);
  };

  const updateConnectionState = (state: string) => {
    setConnectionState(state);
    onConnectionStateChange?.(state);
  };

  const cleanup = () => {
    if (signalingIntervalRef.current) {
      clearInterval(signalingIntervalRef.current);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  return (
    <View style={styles.container}>
      {remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.video}
          objectFit="cover"
        />
      ) : (
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.placeholderText}>
            {connectionState === 'connecting' && 'Connecting to video stream...'}
            {connectionState === 'connected' && 'Connected'}
            {connectionState === 'failed' && 'Connection failed'}
            {connectionState === 'disconnected' && 'Disconnected'}
          </Text>
          <Text style={styles.stateText}>{connectionState}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  stateText: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
  },
});
