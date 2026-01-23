/**
 * Firebase WebRTC Signaling Service
 * Handles offer/answer/ICE candidate exchange for WebRTC connections
 */

import { rtdb } from '../firebase/firebaseConfig';
import { ref, set, get, remove, push, onValue } from 'firebase/database';

// Ensure rtdb is properly initialized
if (!rtdb) {
  throw new Error('Firebase Realtime Database not initialized');
}

export interface RTCSignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  timestamp: number;
}

/**
 * Initialize WebRTC connection session in Firebase
 * Structure: /webrtc_sessions/{sessionId}
 */
export async function createRTCSession(deviceId: string, userId: string) {
  const sessionId = `${deviceId}_${Date.now()}`;
  const sessionRef = ref(rtdb, `webrtc_sessions/${sessionId}`);
  
  console.log('[WebRTC] 🆕 Creating new session:', sessionId);
  console.log('[WebRTC] 🆕 Device ID:', deviceId);
  
  await set(sessionRef, {
    deviceId,
    userId,
    createdAt: Date.now(),
    status: 'pending',
    peers: {}
  });

  console.log('[WebRTC] ✅ Session created successfully');
  return sessionId;
}

/**
 * Send offer from client to Pi
 */
export async function sendOffer(sessionId: string, userId: string, offer: RTCSessionDescription) {
  const offerRef = ref(rtdb, `webrtc_sessions/${sessionId}/offer`);
  
  try {
    console.log('[WebRTC] 📤 Attempting to send offer to:', `webrtc_sessions/${sessionId}/offer`);
    console.log('[WebRTC] 📤 Offer details - type:', offer.type, '- SDP length:', offer.sdp?.length);
    
    await set(offerRef, {
      type: 'offer',
      data: {
        sdp: offer.sdp,
        type: offer.type
      },
      from: userId,
      timestamp: Date.now()
    });
    
    console.log('[WebRTC] ✅ Offer written successfully to Firebase');
  } catch (err) {
    console.error('[WebRTC] ❌ ERROR writing offer:', err);
    throw err;
  }
}

/**
 * Send ICE candidate from client
 */
export async function sendICECandidate(
  sessionId: string,
  userId: string,
  candidate: RTCIceCandidate
) {
  const candidatesRef = ref(rtdb, `webrtc_sessions/${sessionId}/ice_candidates`);
  const newCandidateRef = push(candidatesRef);
  
  try {
    await set(newCandidateRef, {
      candidate: candidate.candidate,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid,
      from: userId,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('[WebRTC] Warning sending ICE candidate:', err);
  }
}

/**
 * Listen for answer from Pi using polling (more reliable than onValue in React Native)
 */
export function listenForAnswer(sessionId: string, callback: (answer: RTCSessionDescription) => void) {
  let lastTimestamp = Date.now();
  let answered = false;
  let pollCount = 0;
  
  console.log('[WebRTC] 🎯 Starting answer polling for session:', sessionId);
  console.log('[WebRTC] 🎯 Will poll path: webrtc_sessions/' + sessionId + '/answer');
  
  const pollInterval = setInterval(async () => {
    pollCount++;
    
    try {
      const answerRef = ref(rtdb, `webrtc_sessions/${sessionId}/answer`);
      
      if (pollCount === 1 || pollCount % 10 === 0) {
        console.log(`[WebRTC] 🎯 Poll attempt #${pollCount} at ${new Date().toLocaleTimeString()}`);
      }
      
      const snapshot = await get(answerRef);
      
      if (pollCount % 10 === 0) {
        console.log('[WebRTC] Answer poll cycle', pollCount, '- exists:', snapshot.exists(), '- data:', snapshot.exists() ? 'got data' : 'null');
      }
      
      if (snapshot.exists() && !answered) {
        const data = snapshot.val();
        console.log('[WebRTC] ✅✅✅ ANSWER FOUND via polling (cycle', pollCount, ')!!!');
        console.log('[WebRTC] 🔍 Full answer data structure:');
        console.log('[WebRTC]', JSON.stringify(data, null, 2));
        
        if (data && data.data && data.data.sdp) {
          answered = true;
          clearInterval(pollInterval);
          
          try {
            console.log('[WebRTC] 📞 Calling answer callback with:', { type: data.data.type, sdpLength: data.data.sdp.length });
            callback({
              type: data.data.type as RTCSdpType,
              sdp: data.data.sdp
            });
            console.log('[WebRTC] ✅ Answer callback executed successfully');
          } catch (e) {
            console.error('[WebRTC] Error processing answer:', e);
          }
        } else {
          console.log('[WebRTC] ⚠️⚠️⚠️ Answer data incomplete!');
          console.log('[WebRTC]   - data.data exists?', !!data.data);
          if (data.data) console.log('[WebRTC]   - data.data.sdp exists?', !!data.data.sdp);
          console.log('[WebRTC]   - data.type:', data.type);
          console.log('[WebRTC]   - data.from:', data.from);
          console.log('[WebRTC]   - data.timestamp:', data.timestamp);
        }
      } else if (!snapshot.exists() && pollCount % 20 === 0) {
        console.log('[WebRTC] 🔄 Still waiting for answer (cycle', pollCount, '- no data yet)');
      }
    } catch (err) {
      console.error('[WebRTC] Error polling for answer:', err);
    }
  }, 500); // Poll every 500ms

  // Return unsubscribe function
  return () => {
    console.log('[WebRTC] 🛑 Stopping answer polling after', pollCount, 'cycles - answered:', answered);
    clearInterval(pollInterval);
  };
}

/**
 * Listen for ICE candidates from Pi using polling (more reliable than onValue in React Native)
 */
export function listenForICECandidates(
  sessionId: string,
  callback: (candidate: RTCIceCandidate) => void
) {
  const processedCandidates = new Set<string>();
  let pollCount = 0;
  
  console.log('[WebRTC] Starting ICE candidate polling for session:', sessionId);
  
  const pollInterval = setInterval(async () => {
    pollCount++;
    
    try {
      const candidatesRef = ref(rtdb, `webrtc_sessions/${sessionId}/ice_candidates_from_pi`);
      const snapshot = await get(candidatesRef);
      
      if (pollCount % 10 === 0) {
        console.log('[WebRTC] ICE poll cycle', pollCount, '- exists:', snapshot.exists());
      }
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // data is an object of candidates keyed by push ID
        Object.entries(data).forEach(([key, candidateData]: [string, any]) => {
          // Skip if we've already processed this candidate
          if (processedCandidates.has(key)) return;
          
          if (candidateData && candidateData.candidate) {
            processedCandidates.add(key);
            console.log('[WebRTC] ✅ Processing ICE candidate from poll (cycle', pollCount, '):', key);
            
            try {
              // In React Native, pass candidate data directly without wrapping
              callback({
                candidate: candidateData.candidate,
                sdpMLineIndex: candidateData.sdpMLineIndex,
                sdpMid: candidateData.sdpMid
              });
              console.log('[WebRTC] ✅ ICE candidate callback executed');
            } catch (e) {
              console.error('[WebRTC] Error processing ICE candidate:', e);
            }
          }
        });
      }
    } catch (err) {
      console.error('[WebRTC] Error polling for ICE candidates:', err);
    }
  }, 500); // Poll every 500ms

  // Return unsubscribe function
  return () => {
    console.log('[WebRTC] Stopping ICE candidate polling after', pollCount, 'cycles');
    clearInterval(pollInterval);
  };
}

/**
 * Send ICE candidate from Pi
 */
export async function sendICECandidateFromPi(
  sessionId: string,
  piId: string,
  candidate: RTCIceCandidate
) {
  const candidatesRef = ref(rtdb, `webrtc_sessions/${sessionId}/ice_candidates_from_pi`);
  const newCandidateRef = push(candidatesRef);
  
  await set(newCandidateRef, {
    candidate: candidate.candidate,
    sdpMLineIndex: candidate.sdpMLineIndex,
    sdpMid: candidate.sdpMid,
    from: piId,
    timestamp: Date.now()
  });
}

/**
 * Send answer from Pi
 */
export async function sendAnswer(sessionId: string, piId: string, answer: RTCSessionDescription) {
  const answerRef = ref(rtdb, `webrtc_sessions/${sessionId}/answer`);
  await set(answerRef, {
    type: 'answer',
    data: {
      sdp: answer.sdp,
      type: answer.type
    },
    from: piId,
    timestamp: Date.now()
  });
}

/**
 * Listen for offer on Pi - using onValue instead of on
 */
export function listenForOfferOnPi(
  sessionId: string,
  callback: (offer: RTCSessionDescription) => void
) {
  const offerRef = ref(rtdb, `webrtc_sessions/${sessionId}/offer`);
  
  const unsubscribe = onValue(
    offerRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data && data.data) {
          try {
            callback({
              type: data.data.type as RTCSdpType,
              sdp: data.data.sdp
            });
            console.log('[WebRTC] Offer received on Pi');
          } catch (e) {
            console.error('[WebRTC] Error processing offer:', e);
          }
        }
      }
    },
    (error) => {
      console.error('[WebRTC] Error listening for offer:', error);
    }
  );

  return unsubscribe;
}

/**
 * Clean up RTC session
 */
export async function cleanupRTCSession(sessionId: string) {
  const sessionRef = ref(rtdb, `webrtc_sessions/${sessionId}`);
  await remove(sessionRef);
}

/**
 * Get device for connection
 */
export async function getDeviceForStreaming(deviceId: string) {
  const deviceRef = ref(rtdb, `devices/${deviceId}`);
  const snapshot = await get(deviceRef);
  return snapshot.val();
}

/**
 * Check if device is online and ready for WebRTC
 */
export async function isDeviceReadyForWebRTC(deviceId: string): Promise<boolean> {
  const statusRef = ref(rtdb, `device_status/${deviceId}`);
  const snapshot = await get(statusRef);
  
  if (!snapshot.exists()) return false;
  
  const status = snapshot.val();
  return status.online === true && status.webrtcReady === true;
}

/**
 * Update device WebRTC status
 */
export async function updateDeviceWebRTCStatus(deviceId: string, ready: boolean) {
  const statusRef = ref(rtdb, `device_status/${deviceId}`);
  await set(statusRef, {
    online: true,
    webrtcReady: ready,
    lastSeen: Date.now()
  });
}
