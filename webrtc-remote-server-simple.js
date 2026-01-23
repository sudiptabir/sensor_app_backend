#!/usr/bin/env node

/**
 * WebRTC Camera Server for Remote Raspberry Pi
 * Streams video from Pi camera to React Native app via WebRTC with Firebase signaling
 */

const admin = require('firebase-admin');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.SERVICE_ACCOUNT_KEY || './serviceAccountKey.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`[❌] Firebase service account key not found at: ${serviceAccountPath}`);
  console.error('[ℹ️] Copy serviceAccountKey.json to the server directory');
  process.exit(1);
}

const serviceAccountKey = require(path.resolve(serviceAccountPath));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
  databaseURL: process.env.DATABASE_URL || 'https://sensor-app-2a69b-default-rtdb.firebaseio.com'
});

const rtdb = admin.database();

// Get device ID from environment or file
let DEVICE_ID = process.env.DEVICE_ID;
if (!DEVICE_ID && fs.existsSync('device_id.txt')) {
  const content = fs.readFileSync('device_id.txt', 'utf8');
  DEVICE_ID = content.split('\n')[0].trim();
}
if (!DEVICE_ID) {
  DEVICE_ID = `raspberrypi-${os.hostname()}`;
}

// Server configuration
const SERVER_CONFIG = {
  deviceId: DEVICE_ID,
  port: parseInt(process.env.PORT || '3000'),
  useRealCamera: process.env.USE_REAL_CAMERA === 'true',
  videoSettings: {
    width: parseInt(process.env.VIDEO_WIDTH || '1280'),
    height: parseInt(process.env.VIDEO_HEIGHT || '720'),
    framerate: parseInt(process.env.VIDEO_FPS || '30'),
    bitrate: parseInt(process.env.VIDEO_BITRATE || '2000') // kbps for rpicam encoder
  }
};

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║   🎥 Remote WebRTC Camera Server                      ║');
console.log('║      Raspberry Pi → React Native App                  ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log(`[📱] Device ID: ${SERVER_CONFIG.deviceId}`);
console.log(`[🎬] Video: ${SERVER_CONFIG.videoSettings.width}x${SERVER_CONFIG.videoSettings.height}@${SERVER_CONFIG.videoSettings.framerate}fps`);
console.log(`[🔊] Bitrate: ${SERVER_CONFIG.videoSettings.bitrate}kbps`);
console.log(`[📍] Database: ${process.env.DATABASE_URL || 'default'}`);

// ============================================================================
// GLOBALS
// ============================================================================

const activeSessions = new Map();
let gstreamerProcess = null;
let sessionCheckInterval = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get local IP address for WebRTC connectivity
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Generate random ICE credentials
 */
function generateICECredentials() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let ufrag = '';
  let pwd = '';
  
  for (let i = 0; i < 16; i++) {
    ufrag += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  for (let i = 0; i < 24; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return { ufrag, pwd };
}

/**
 * Generate a simple SDP answer for the WebRTC connection
 */
function generateAnswerSDP(offer, iceCredentials) {
  // Parse offer to get video codec info
  const lines = offer.split('\n').map(l => l.replace(/\r/g, ''));  // Normalize line endings
  const mLineIndex = lines.findIndex(l => l.startsWith('m=video'));
  
  if (mLineIndex === -1) {
    console.log('[⚠️] No video m= line found in offer');
    return null;
  }

  // Extract codec details from offer
  const mLine = lines[mLineIndex];
  const parts = mLine.split(' ');
  const payloadTypes = parts.slice(3);

  // Check if offer has audio section that needs to be rejected
  const hasAudio = lines.some(l => l.startsWith('m=audio'));
  console.log(`[📋] Offer has audio: ${hasAudio}`);

  // Find H.264 payload type
  let h264PayloadType = '96';
  for (let i = mLineIndex; i < Math.min(mLineIndex + 10, lines.length); i++) {
    if (lines[i].includes('H264') || lines[i].includes('h264')) {
      const match = lines[i].match(/rtpmap:(\d+)/);
      if (match) {
        h264PayloadType = match[1];
        break;
      }
    }
  }

  // Get offer fingerprint - we need our own for the answer, not the client's
  // Generate a dummy server fingerprint (in production, use actual TLS certificate)
  function generateServerFingerprint() {
    // This is a valid SHA-256 fingerprint format
    // In production, derive this from the server's actual DTLS certificate
    const hex = '0123456789ABCDEF';
    let fingerprint = 'a=fingerprint:sha-256 ';
    
    // Generate 32 random bytes and format as hex pairs with colons
    const pairs = [];
    for (let i = 0; i < 32; i++) {
      const byte = Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
      pairs.push(byte);
    }
    fingerprint += pairs.join(':');
    
    return fingerprint;
  }
  
  const serverFingerprint = generateServerFingerprint();
  console.log(`[🔒] Generated server fingerprint: ${serverFingerprint.substring(0, 50)}...`);

  // Get offer setup - answer must have opposite role
  let setup = 'passive';  // Default to passive (answer is typically passive)
  let foundSetup = false;
  for (const line of lines) {
    if (line.startsWith('a=setup:')) {
      foundSetup = true;
      const offerSetup = line.split(':')[1].trim();
      // If offer says active, answer must be passive
      // If offer says passive, answer must be active  
      // If offer says actpass, answer should be active
      if (offerSetup === 'active') {
        setup = 'passive';
      } else if (offerSetup === 'passive') {
        setup = 'active';
      } else if (offerSetup === 'actpass') {
        setup = 'active';
      }
      console.log(`[📋] Offer setup: ${offerSetup} -> Answer setup: ${setup}`);
      break;
    }
  }
  if (!foundSetup) {
    console.log(`[📋] No setup found in offer, using default: ${setup}`);
  }

  // Create unique SSRC for this answer
  const ssrc = Math.floor(Math.random() * 100000000).toString();
  
  // Build answer SDP with consistent line endings (LF only)
  // Keep this minimal and RFC-compliant to work with react-native-webrtc
  const answerLines = [
    'v=0',
    `o=- ${Date.now()} 2 IN IP4 ${getLocalIP()}`,
    's=-',
    't=0 0'
  ];
  
  // Only include BUNDLE group if offer had it, and include both media indices
  if (hasAudio) {
    answerLines.push('a=group:BUNDLE 0 1');
  } else {
    answerLines.push('a=group:BUNDLE 0');
  }
  
  answerLines.push('a=msid-semantic: WMS stream');
  
  // Video section (always present)
  answerLines.push(`m=video 9 UDP/TLS/RTP/SAVPF ${h264PayloadType}`);
  answerLines.push('c=IN IP4 0.0.0.0');
  answerLines.push('a=rtcp:9 IN IP4 0.0.0.0');
  answerLines.push(`a=ice-ufrag:${iceCredentials.ufrag}`);
  answerLines.push(`a=ice-pwd:${iceCredentials.pwd}`);
  answerLines.push('a=ice-options:trickle');
  answerLines.push(serverFingerprint);
  answerLines.push(`a=setup:${setup}`);
  answerLines.push('a=mid:0');
  answerLines.push('a=sendonly');
  answerLines.push('a=rtcp-mux');
  answerLines.push(`a=rtpmap:${h264PayloadType} H264/90000`);
  answerLines.push('a=rtcp-fb:* goog-remb');
  answerLines.push('a=rtcp-fb:* transport-cc');
  answerLines.push(`a=fmtp:${h264PayloadType} level-asymmetry-allowed=1;packetization-mode=1`);
  answerLines.push(`a=ssrc:${ssrc} cname:${Math.random().toString(36).substr(2, 9)}`);
  answerLines.push(`a=ssrc:${ssrc} msid:stream videotrack`);
  
  // If offer had audio, reject it (port 0 means rejected)
  if (hasAudio) {
    answerLines.push('m=audio 0 UDP/TLS/RTP/SAVPF');  // Empty payload list for rejection
    answerLines.push('c=IN IP4 0.0.0.0');
    answerLines.push('a=mid:1');
    console.log('[📋] Added audio rejection (port 0) to answer');
  }

  const answer = answerLines.filter(line => line.trim().length > 0).join('\n');
  
  // Final cleanup: ensure only LF line endings
  return answer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Start the GStreamer video capture pipeline
 */
function startCameraStream() {
  return new Promise((resolve, reject) => {
    try {
      console.log('[🎬] Starting video capture...');

      // GStreamer pipeline for test pattern or real camera
      let pipeline;
      let cameraSource;
      if (SERVER_CONFIG.useRealCamera) {
        cameraSource = '📷 RPICAM (Real Camera)';
        // Real Raspberry Pi camera using rpicam (rpicamsrc plugin)
        // Note: rpicam-hello must work for this to function
        pipeline = `rpicamsrc name=src bitrate=${SERVER_CONFIG.videoSettings.bitrate}000 keyframe-interval=30 ! \
          video/x-h264,width=${SERVER_CONFIG.videoSettings.width},height=${SERVER_CONFIG.videoSettings.height},framerate=${SERVER_CONFIG.videoSettings.framerate}/1 ! \
          h264parse ! \
          rtph264pay pt=96 ! \
          udpsink host=127.0.0.1 port=5004 sync=false`;
      } else {
        cameraSource = '🎨 TEST PATTERN (Videotestsrc)';
        // Test pattern (useful for development/testing without real camera)
        // Uses x264enc for software encoding since videotestsrc outputs raw video
        pipeline = `videotestsrc pattern=0 is-live=true ! \
          "video/x-raw,width=${SERVER_CONFIG.videoSettings.width},height=${SERVER_CONFIG.videoSettings.height},framerate=${SERVER_CONFIG.videoSettings.framerate}/1" ! \
          x264enc speed-preset=ultrafast bitrate=${SERVER_CONFIG.videoSettings.bitrate} ! \
          h264parse ! \
          rtph264pay pt=96 ! \
          udpsink host=127.0.0.1 port=5004 sync=false`;
      }

      console.log(`[🎥] Camera source: ${cameraSource}`);
      console.log(`[📹] Pipeline: ${pipeline.substring(0, 80)}...`);

      gstreamerProcess = spawn('bash', ['-c', `gst-launch-1.0 -e ${pipeline}`]);

      gstreamerProcess.on('error', (err) => {
        console.error(`[❌] GStreamer error:`, err.message);
        reject(err);
      });

      gstreamerProcess.on('exit', (code) => {
        console.log(`[⚠️] GStreamer exited with code: ${code}`);
        gstreamerProcess = null;
      });

      // Log both stdout and stderr
      if (gstreamerProcess.stdout) {
        gstreamerProcess.stdout.on('data', (data) => {
          const msg = data.toString().trim();
          if (msg && msg.length > 0) {
            console.log(`[gst-out] ${msg}`);
          }
        });
      }
      
      if (gstreamerProcess.stderr) {
        gstreamerProcess.stderr.on('data', (data) => {
          const msg = data.toString().trim();
          if (msg && msg.length > 0) {
            console.log(`[gst-err] ${msg}`);
          }
        });
      }

      // Give GStreamer time to initialize
      setTimeout(() => {
        if (gstreamerProcess && !gstreamerProcess.killed) {
          console.log(`[✅] Camera streaming started - ${cameraSource}`);
          console.log(`[🚀] Ready for WebRTC connections on UDP port 5004`);
          resolve(gstreamerProcess);
        } else {
          reject(new Error('GStreamer failed to start'));
        }
      }, 2000);

    } catch (err) {
      console.error(`[❌] Error starting camera:`, err);
      reject(err);
    }
  });
}

/**
 * Stop the camera stream
 */
function stopCameraStream() {
  if (gstreamerProcess) {
    console.log(`[🛑] Stopping GStreamer...`);
    gstreamerProcess.kill('SIGTERM');
    setTimeout(() => {
      if (gstreamerProcess && !gstreamerProcess.killed) {
        gstreamerProcess.kill('SIGKILL');
      }
    }, 2000);
  }
}

/**
 * Update device status in Firebase
 */
async function updateDeviceStatus(status = {}) {
  try {
    const statusPath = `device_status/${SERVER_CONFIG.deviceId}`;
    await rtdb.ref(statusPath).set({
      online: true,
      webrtcReady: true,
      lastSeen: Date.now(),
      capabilities: {
        video: true,
        audio: false,
        codec: 'h264',
        resolution: `${SERVER_CONFIG.videoSettings.width}x${SERVER_CONFIG.videoSettings.height}`,
        framerate: SERVER_CONFIG.videoSettings.framerate,
        bitrate: SERVER_CONFIG.videoSettings.bitrate
      },
      ipAddress: getLocalIP(),
      ...status
    });
    console.log(`[✅] Device status updated`);
  } catch (err) {
    console.error(`[❌] Error updating device status:`, err);
  }
}

/**
 * Monitor and cleanup old sessions
 */
function startSessionMonitor() {
  sessionCheckInterval = setInterval(async () => {
    const now = Date.now();
    const MAX_SESSION_AGE = 5 * 60 * 1000; // 5 minutes

    for (const [sessionId, session] of activeSessions.entries()) {
      const age = now - session.createdAt;
      
      if (age > MAX_SESSION_AGE) {
        console.log(`[🧹] Cleaning up old session: ${sessionId}`);
        activeSessions.delete(sessionId);
      }
    }

    // Log active sessions count
    if (activeSessions.size > 0) {
      console.log(`[📊] Active sessions: ${activeSessions.size}`);
    }
  }, 30000); // Check every 30 seconds
}

/**
 * Handle a new WebRTC session from client
 */
async function handleWebRTCSession(sessionId, offer) {
  if (activeSessions.has(sessionId)) {
    console.log(`[⏭️] Session already being processed: ${sessionId}`);
    return;
  }

  console.log(`\n[🔗] ═══════════════════════════════════════════════════════`);
  console.log(`[🔗] New WebRTC Session: ${sessionId}`);
  console.log(`[🔗] ═══════════════════════════════════════════════════════`);

  try {
    // Mark session as processing
    activeSessions.set(sessionId, {
      createdAt: Date.now(),
      offer: offer,
      processing: true
    });

    // Validate offer
    const offerData = offer.data || offer;
    if (!offerData || !offerData.sdp) {
      throw new Error('Invalid offer: missing SDP');
    }

    console.log(`[📨] Received offer (${offerData.sdp.length} bytes)`);

    // Generate answer
    const iceCredentials = generateICECredentials();
    const answerSDP = generateAnswerSDP(offerData.sdp, iceCredentials);

    if (!answerSDP) {
      throw new Error('Failed to generate answer SDP');
    }

    console.log(`[📤] Generated answer SDP (${answerSDP.length} bytes)`);

    // Write answer to Firebase
    const answerPath = `webrtc_sessions/${sessionId}/answer`;
    await rtdb.ref(answerPath).set({
      type: 'answer',
      data: {
        sdp: answerSDP,
        type: 'answer'
      },
      from: SERVER_CONFIG.deviceId,
      timestamp: Date.now()
    });

    console.log(`[✅] Answer sent to client via Firebase`);

    // Update session record
    activeSessions.set(sessionId, {
      ...activeSessions.get(sessionId),
      processing: false,
      answered: true,
      iceCredentials
    });

  } catch (err) {
    console.error(`[❌] Error handling session:`, err.message);
    activeSessions.delete(sessionId);
    
    // Update session status to error
    try {
      await rtdb.ref(`webrtc_sessions/${sessionId}/status`).set('error');
    } catch (e) {
      // Ignore Firebase errors during error handling
    }
  }
}

/**
 * Poll for new WebRTC sessions
 */
function startSessionListener() {
  const pollInterval = setInterval(async () => {
    try {
      const snapshot = await rtdb.ref(`webrtc_sessions`).once('value');
      const sessions = snapshot.val();

      if (!sessions) {
        return;
      }

      for (const [sessionId, sessionData] of Object.entries(sessions)) {
        // Only process sessions for this device
        if (sessionData.deviceId !== SERVER_CONFIG.deviceId) {
          continue;
        }

        // Skip if we're already processing this session
        if (activeSessions.has(sessionId)) {
          continue;
        }

        // Check if offer exists
        if (sessionData.offer) {
          await handleWebRTCSession(sessionId, sessionData.offer);
        }
      }
    } catch (err) {
      console.error(`[❌] Error polling sessions:`, err.message);
    }
  }, 1000); // Poll every 1 second

  return pollInterval;
}

/**
 * Send ICE candidate for a session
 */
async function sendICECandidate(sessionId, candidate) {
  try {
    const candidatesRef = rtdb.ref(`webrtc_sessions/${sessionId}/ice_candidates_from_server`).push();
    await candidatesRef.set({
      candidate: candidate.candidate || candidate,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid,
      from: SERVER_CONFIG.deviceId,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn(`[⚠️] Warning sending ICE candidate:`, err.message);
  }
}

/**
 * Generate a simple ICE candidate from local IP
 */
async function generateAndSendICECandidates(sessionId) {
  try {
    const localIP = getLocalIP();
    const candidates = [
      {
        candidate: `candidate:0 1 UDP ${Math.floor(Math.random() * 1000000)} ${localIP} 19302 typ host`,
        sdpMLineIndex: 0,
        sdpMid: '0'
      }
    ];

    for (const candidate of candidates) {
      await sendICECandidate(sessionId, candidate);
    }

    console.log(`[📡] Sent ${candidates.length} ICE candidates`);
  } catch (err) {
    console.warn(`[⚠️] Error sending ICE candidates:`, err.message);
  }
}

// ============================================================================
// STARTUP AND SHUTDOWN
// ============================================================================

async function startup() {
  try {
    console.log('\n[⏳] Starting up...\n');

    // Start camera stream
    try {
      await startCameraStream();
    } catch (err) {
      console.error(`[⚠️] Failed to start camera stream:`, err.message);
      console.error('[ℹ️] Continuing anyway - WebRTC signaling will still work');
    }

    // Update device status
    await updateDeviceStatus();

    // Start listening for sessions
    startSessionListener();

    // Start session cleanup monitor
    startSessionMonitor();

    console.log('[✅] Server ready for WebRTC connections\n');

  } catch (err) {
    console.error(`[❌] Startup failed:`, err);
    process.exit(1);
  }
}

function shutdown() {
  console.log(`\n[🛑] Shutting down gracefully...\n`);

  // Stop camera
  stopCameraStream();

  // Clear intervals
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }

  // Update status
  rtdb.ref(`device_status/${SERVER_CONFIG.deviceId}`).update({
    online: false,
    lastSeen: Date.now()
  }).catch(() => {
    // Ignore errors during shutdown
  });

  setTimeout(() => {
    console.log(`[✅] Shutdown complete`);
    process.exit(0);
  }, 2000);
}

// ============================================================================
// PROCESS HANDLERS
// ============================================================================

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('uncaughtException', (err) => {
  console.error(`[💥] Uncaught exception:`, err);
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  console.error(`[💥] Unhandled rejection:`, reason);
  shutdown();
});

// ============================================================================
// START SERVER
// ============================================================================

startup().catch(err => {
  console.error(`[❌] Fatal error:`, err);
  process.exit(1);
});
