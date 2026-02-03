#!/usr/bin/env node

/**
 * WebRTC Camera Server for Windows Laptop
 * Streams video from Windows webcam to React Native app via WebRTC with Firebase signaling
 * Based on webrtc-remote-server-simple.js but adapted for Windows DirectShow cameras
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
  DEVICE_ID = `windows-laptop-${os.hostname()}`;
}

// Server configuration
const SERVER_CONFIG = {
  deviceId: DEVICE_ID,
  port: parseInt(process.env.PORT || '3000'),
  videoDevice: process.env.VIDEO_DEVICE || 'video="Integrated Camera"',
  videoSettings: {
    width: parseInt(process.env.VIDEO_WIDTH || '640'),
    height: parseInt(process.env.VIDEO_HEIGHT || '480'),
    framerate: parseInt(process.env.VIDEO_FPS || '30'),
    bitrate: parseInt(process.env.VIDEO_BITRATE || '2000')
  }
};

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║   🎥 Windows WebRTC Camera Server                     ║');
console.log('║      Laptop → React Native App                        ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log(`[📱] Device ID: ${SERVER_CONFIG.deviceId}`);
console.log(`[🎬] Video: ${SERVER_CONFIG.videoSettings.width}x${SERVER_CONFIG.videoSettings.height}@${SERVER_CONFIG.videoSettings.framerate}fps`);
console.log(`[🔊] Bitrate: ${SERVER_CONFIG.videoSettings.bitrate}kbps`);
console.log(`[📹] Camera: ${SERVER_CONFIG.videoDevice}`);

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
  const lines = offer.split('\n').map(l => l.replace(/\r/g, ''));
  const mLineIndex = lines.findIndex(l => l.startsWith('m=video'));
  
  if (mLineIndex === -1) {
    console.log('[⚠️] No video m= line found in offer');
    return null;
  }

  const mLine = lines[mLineIndex];
  const parts = mLine.split(' ');
  const payloadTypes = parts.slice(3);
  const hasAudio = lines.some(l => l.startsWith('m=audio'));

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

  function generateServerFingerprint() {
    const hex = '0123456789ABCDEF';
    let fingerprint = '';
    for (let i = 0; i < 32; i++) {
      if (i > 0 && i % 2 === 0) fingerprint += ':';
      fingerprint += hex[Math.floor(Math.random() * 16)];
    }
    return fingerprint;
  }

  const serverIP = getLocalIP();
  const fingerprint = generateServerFingerprint();

  let answerSDP = `v=0\r\n`;
  answerSDP += `o=- ${Date.now()} 2 IN IP4 ${serverIP}\r\n`;
  answerSDP += `s=-\r\n`;
  answerSDP += `t=0 0\r\n`;
  answerSDP += `a=group:BUNDLE 0\r\n`;
  answerSDP += `a=msid-semantic: WMS *\r\n`;

  if (hasAudio) {
    answerSDP += `m=audio 0 UDP/TLS/RTP/SAVPF 111\r\n`;
    answerSDP += `c=IN IP4 0.0.0.0\r\n`;
    answerSDP += `a=inactive\r\n`;
  }

  answerSDP += `m=video 5004 UDP/TLS/RTP/SAVPF ${h264PayloadType}\r\n`;
  answerSDP += `c=IN IP4 ${serverIP}\r\n`;
  answerSDP += `a=rtcp:5005 IN IP4 ${serverIP}\r\n`;
  answerSDP += `a=rtcp-mux\r\n`;
  answerSDP += `a=mid:0\r\n`;
  answerSDP += `a=sendonly\r\n`;
  answerSDP += `a=rtpmap:${h264PayloadType} H264/90000\r\n`;
  answerSDP += `a=fmtp:${h264PayloadType} packetization-mode=1;profile-level-id=42e01f\r\n`;
  answerSDP += `a=ice-ufrag:${iceCredentials.ufrag}\r\n`;
  answerSDP += `a=ice-pwd:${iceCredentials.pwd}\r\n`;
  answerSDP += `a=ice-options:trickle\r\n`;
  answerSDP += `a=fingerprint:sha-256 ${fingerprint}\r\n`;
  answerSDP += `a=setup:active\r\n`;
  answerSDP += `a=candidate:1 1 UDP 2130706431 ${serverIP} 5004 typ host\r\n`;

  return answerSDP;
}

/**
 * Start the GStreamer video capture pipeline for Windows
 */
function startCameraStream() {
  return new Promise((resolve, reject) => {
    try {
      console.log('[🎬] Starting Windows camera capture...');

      // GStreamer pipeline for Windows DirectShow camera
      const pipeline = `ksvideosrc device-index=0 ! \
        video/x-raw,width=${SERVER_CONFIG.videoSettings.width},height=${SERVER_CONFIG.videoSettings.height},framerate=${SERVER_CONFIG.videoSettings.framerate}/1 ! \
        videoconvert ! \
        x264enc speed-preset=ultrafast tune=zerolatency bitrate=${SERVER_CONFIG.videoSettings.bitrate} key-int-max=30 ! \
        h264parse ! \
        rtph264pay pt=96 ! \
        udpsink host=127.0.0.1 port=5004 sync=false`;

      console.log(`[🎥] Camera source: Windows Webcam (DirectShow)`);
      console.log(`[📹] Pipeline: ${pipeline.substring(0, 80)}...`);

      const gstArgs = pipeline.split(/\s+/).filter(a => a.length > 0);
      gstreamerProcess = spawn('gst-launch-1.0', gstArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let started = false;
      const startTimeout = setTimeout(() => {
        if (!started) {
          console.log('[✅] GStreamer pipeline started (timeout - assuming success)');
          started = true;
          resolve();
        }
      }, 3000);

      gstreamerProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (!started && (output.includes('PLAYING') || output.includes('Setting pipeline to PLAYING'))) {
          clearTimeout(startTimeout);
          started = true;
          console.log('[✅] GStreamer pipeline confirmed PLAYING');
          resolve();
        }
      });

      gstreamerProcess.stderr.on('data', (data) => {
        const err = data.toString();
        if (err.includes('ERROR') || err.includes('WARN')) {
          console.log('[GStreamer]', err.trim());
        }
        if (!started && err.includes('Setting pipeline to PLAYING')) {
          clearTimeout(startTimeout);
          started = true;
          console.log('[✅] GStreamer pipeline started');
          resolve();
        }
      });

      gstreamerProcess.on('error', (err) => {
        clearTimeout(startTimeout);
        console.error('[❌] Failed to start GStreamer:', err.message);
        reject(err);
      });

      gstreamerProcess.on('close', (code) => {
        console.log(`[🛑] GStreamer process exited with code ${code}`);
        gstreamerProcess = null;
      });

    } catch (err) {
      console.error('[❌] Error starting camera stream:', err);
      reject(err);
    }
  });
}

/**
 * Stop camera stream
 */
function stopCameraStream() {
  if (gstreamerProcess) {
    console.log('[🛑] Stopping camera stream...');
    gstreamerProcess.kill('SIGTERM');
    gstreamerProcess = null;
  }
}

/**
 * Update device status in Firebase
 */
async function updateDeviceStatus() {
  try {
    const deviceRef = rtdb.ref(`device_status/${SERVER_CONFIG.deviceId}`);
    await deviceRef.set({
      online: true,
      webrtcReady: true,
      lastSeen: Date.now(),
      platform: 'windows',
      videoConfig: SERVER_CONFIG.videoSettings,
      hostname: os.hostname()
    });
    console.log('[✅] Device status updated in Firebase');
  } catch (err) {
    console.error('[❌] Failed to update device status:', err.message);
  }
}

/**
 * Process WebRTC session
 */
async function processWebRTCSession(sessionId, offerData) {
  try {
    console.log(`\n[📞] Processing WebRTC session: ${sessionId}`);
    console.log(`[📥] Offer type: ${offerData?.data?.type}`);
    console.log(`[📥] Offer SDP length: ${offerData?.data?.sdp?.length || 0} chars`);

    if (!offerData?.data?.sdp) {
      console.error('[❌] Invalid offer data - no SDP');
      return;
    }

    const iceCredentials = generateICECredentials();
    console.log(`[🔐] Generated ICE credentials`);

    const answerSDP = generateAnswerSDP(offerData.data.sdp, iceCredentials);
    if (!answerSDP) {
      console.error('[❌] Failed to generate answer SDP');
      return;
    }

    console.log(`[📤] Answer SDP length: ${answerSDP.length} chars`);

    if (!gstreamerProcess) {
      console.log('[🎥] Starting camera stream for new connection...');
      await startCameraStream();
    }

    const answerRef = rtdb.ref(`webrtc_sessions/${sessionId}/answer`);
    await answerRef.set({
      type: 'answer',
      data: {
        sdp: answerSDP,
        type: 'answer'
      },
      from: SERVER_CONFIG.deviceId,
      timestamp: Date.now()
    });

    console.log('[✅] Answer sent to Firebase');
    activeSessions.set(sessionId, {
      startTime: Date.now(),
      deviceId: SERVER_CONFIG.deviceId
    });

  } catch (err) {
    console.error('[❌] Error processing session:', err.message);
  }
}

/**
 * Listen for new WebRTC offers
 */
async function listenForOffers() {
  console.log('[👂] Listening for WebRTC offers...');
  
  const sessionsRef = rtdb.ref('webrtc_sessions');
  
  sessionsRef.on('child_added', async (snapshot) => {
    const sessionId = snapshot.key;
    const sessionData = snapshot.val();
    
    if (!sessionData) return;
    
    const deviceId = sessionData.deviceId;
    if (deviceId !== SERVER_CONFIG.deviceId) {
      return;
    }
    
    if (activeSessions.has(sessionId)) {
      return;
    }
    
    console.log(`\n[🆕] New session detected: ${sessionId}`);
    
    if (sessionData.offer && sessionData.offer.data) {
      await processWebRTCSession(sessionId, sessionData.offer);
    } else {
      const offerRef = rtdb.ref(`webrtc_sessions/${sessionId}/offer`);
      offerRef.on('value', async (offerSnapshot) => {
        const offerData = offerSnapshot.val();
        if (offerData && !activeSessions.has(sessionId)) {
          await processWebRTCSession(sessionId, offerData);
        }
      });
    }
  });
}

/**
 * Clean up old sessions
 */
async function cleanupOldSessions() {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.startTime > maxAge) {
      console.log(`[🧹] Cleaning up old session: ${sessionId}`);
      activeSessions.delete(sessionId);
      
      try {
        await rtdb.ref(`webrtc_sessions/${sessionId}`).remove();
      } catch (err) {
        console.warn('[⚠️] Failed to remove old session:', err.message);
      }
    }
  }
}

/**
 * Start server
 */
async function start() {
  try {
    console.log('\n[🚀] Starting Windows WebRTC Camera Server...');
    
    await updateDeviceStatus();
    listenForOffers();
    
    sessionCheckInterval = setInterval(cleanupOldSessions, 5 * 60 * 1000);
    
    console.log('[✅] Server ready and waiting for connections');
    console.log(`[📡] Device ID: ${SERVER_CONFIG.deviceId}`);
    console.log(`[🎥] Camera: ${SERVER_CONFIG.videoDevice}`);
    console.log('\n💡 In your app, tap the camera icon on this device to start streaming!\n');
    
  } catch (err) {
    console.error('[❌] Error starting server:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[🛑] Shutting down...');
  stopCameraStream();
  if (sessionCheckInterval) clearInterval(sessionCheckInterval);
  
  try {
    const deviceRef = rtdb.ref(`device_status/${SERVER_CONFIG.deviceId}`);
    await deviceRef.update({ online: false });
  } catch (err) {
    console.warn('[⚠️] Failed to update device status on shutdown');
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[🛑] Received SIGTERM, shutting down...');
  stopCameraStream();
  if (sessionCheckInterval) clearInterval(sessionCheckInterval);
  
  try {
    const deviceRef = rtdb.ref(`device_status/${SERVER_CONFIG.deviceId}`);
    await deviceRef.update({ online: false });
  } catch (err) {
    console.warn('[⚠️] Failed to update device status on shutdown');
  }
  
  process.exit(0);
});

// Start the server
start();
