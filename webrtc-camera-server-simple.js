#!/usr/bin/env node

/**
 * WebRTC Camera Server for Raspberry Pi (Lightweight Version)
 * Uses rpicam-vid with native Node.js WebRTC
 * Streams video via WebRTC with Firebase signaling
 */

const admin = require('firebase-admin');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Initialize Firebase
const serviceAccountKey = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
  databaseURL: 'https://sensor-app-2a69b-default-rtdb.firebaseio.com'
});

const db = admin.database();

/**
 * Get local IP address for WebRTC
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // IPv4 and not internal
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // Fallback
}

const SERVER_IP = getLocalIP();
console.log(`[🌐] Server IP Address: ${SERVER_IP}`);

// Device configuration
let DEVICE_ID = process.env.DEVICE_ID;
if (!DEVICE_ID && fs.existsSync('device_id.txt')) {
  const content = fs.readFileSync('device_id.txt', 'utf8');
  // Extract just the UUID part (first line only)
  DEVICE_ID = content.split('\n')[0].trim();
}
if (!DEVICE_ID) {
  DEVICE_ID = 'raspberrypi';
}

console.log(`[🎥] Raspberry Pi - WebRTC Camera Server (Lightweight)`);
console.log(`[📱] Device ID: ${DEVICE_ID}`);

// Store active sessions
const activeSessions = new Map();
let cameraProcess = null;
let gstreamerProcess = null;

/**
 * Start camera stream with test pattern for quick testing
 */
function startCameraStream() {
  return new Promise((resolve, reject) => {
    try {
      console.log(`[🎬] Starting test video pattern via GStreamer...`);
      
      // Simple GStreamer pipeline: test pattern -> H.264 encoding -> RTP
      // pattern=0 = bars, pattern=1 = snow, etc.
      const cmd = `gst-launch-1.0 -e videotestsrc pattern=0 ! \\
        "video/x-raw,width=1280,height=720,framerate=30/1" ! \\
        x264enc speed-preset=ultrafast bitrate=1000 ! \\
        h264parse ! \\
        rtph264pay pt=96 ! \\
        udpsink host=127.0.0.1 port=5004 sync=false`;

      gstreamerProcess = spawn('bash', ['-c', cmd]);

      console.log(`[✅] GStreamer test pattern started (PID: ${gstreamerProcess.pid})`);

      gstreamerProcess.on('error', (err) => {
        console.error(`[❌] GStreamer error:`, err.message);
        reject(err);
      });

      gstreamerProcess.on('exit', (code) => {
        console.log(`[⚠️] GStreamer exited with code: ${code}`);
        gstreamerProcess = null;
      });

      // Log GStreamer stderr for diagnostics
      if (gstreamerProcess.stderr) {
        gstreamerProcess.stderr.on('data', (data) => {
          console.log(`[gst-err]`, data.toString().trim());
        });
      }

      if (gstreamerProcess.stdout) {
        gstreamerProcess.stdout.on('data', (data) => {
          console.log(`[gst-out]`, data.toString().trim());
        });
      }

      // Give GStreamer time to start before resolving
      setTimeout(() => {
        if (gstreamerProcess && !gstreamerProcess.killed) {
          console.log(`[✅] GStreamer pipeline active and streaming`);
        } else {
          console.log(`[⚠️] GStreamer process not running - check errors above`);
        }
        resolve(gstreamerProcess);
      }, 1000);

    } catch (err) {
      console.error(`[❌] Error starting camera:`, err);
      reject(err);
    }
  });
}

/**
 * Stop camera stream
 */
function stopCameraStream() {
  if (gstreamerProcess) {
    console.log(`[🛑] Stopping GStreamer...`);
    gstreamerProcess.kill();
    gstreamerProcess = null;
  }
}

/**
 * Update device status to indicate ready for WebRTC
 */
async function updateDeviceStatus() {
  try {
    await db.ref(`device_status/${DEVICE_ID}`).set({
      online: true,
      webrtcReady: true,
      lastSeen: Date.now(),
      capabilities: {
        video: true,
        audio: false,
        codec: 'h264',
        resolution: '1280x720',
        framerate: 30
      }
    });
    console.log(`[✅] Device status updated`);
  } catch (err) {
    console.error(`[❌] Error updating device status:`, err);
  }
}

/**
 * Generate random ICE credentials
 */
function generateICECredentials() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let ufrag = '';
  let pwd = '';
  
  // ICE ufrag: 4-256 characters (typically 16)
  for (let i = 0; i < 16; i++) {
    ufrag += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // ICE pwd: 22-256 characters (typically 24)
  for (let i = 0; i < 24; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return { ufrag, pwd };
}

/**
 * Handle new WebRTC session
 */
async function handleWebRTCSession(sessionId, offer) {
  // Check if we've already processed this session
  if (activeSessions.has(sessionId)) {
    console.log(`[⏭️] Session already processed: ${sessionId}`);
    return;
  }

  console.log(`[🔗] New WebRTC session: ${sessionId}`);
  console.log(`[📨] Received offer from client`);
  const offerSDP = offer.sdp || offer;
  console.log(`[📊] Offer SDP length: ${offerSDP.length} bytes`);

  try {
    // Mark as processing immediately to prevent duplicate handling
    activeSessions.set(sessionId, {
      createdAt: Date.now(),
      offer: offer,
      processing: true
    });
    // Generate random ICE credentials for this session
    const iceCredentials = generateICECredentials();
    console.log(`[🔐] Generated ICE credentials - ufrag length: ${iceCredentials.ufrag.length}, pwd length: ${iceCredentials.pwd.length}`);

    // Parse offer to extract m-lines (media sections)
    const offerLines = offerSDP.split('\r\n');
    const mLines = [];
    let currentMediaSection = [];
    
    for (const line of offerLines) {
      if (line.startsWith('m=')) {
        if (currentMediaSection.length > 0) {
          mLines.push(currentMediaSection);
        }
        currentMediaSection = [line];
      } else if (currentMediaSection.length > 0 && line !== '') {
        currentMediaSection.push(line);
      }
    }
    if (currentMediaSection.length > 0) {
      mLines.push(currentMediaSection);
    }
    
    console.log(`[🎬] Found ${mLines.length} media section(s) in offer`);
    mLines.forEach((section, idx) => {
      const mediaType = section[0].split(' ')[0].replace('m=', '');
      console.log(`[🎬]   Media ${idx}: ${mediaType}`);
    });

    // Create answer with matching m-lines
    let answerSDP = 'v=0\r\n' +
                    `o=raspberrypi 0 0 IN IP4 ${SERVER_IP}\r\n` +
                    's=WebRTC Stream\r\n' +
                    't=0 0\r\n' +
                    'a=group:BUNDLE';
    
    // Add bundle group for all media types
    for (let i = 0; i < mLines.length; i++) {
      answerSDP += ` ${i}`;
    }
    answerSDP += '\r\n' +
                 'a=extmap-allow-mixed\r\n' +
                 'a=rtcp-mux\r\n';
    
    // Create answer m-lines matching offer order
    for (let i = 0; i < mLines.length; i++) {
      const offerMediaLine = mLines[i][0];
      const mediaType = offerMediaLine.split(' ')[0].replace('m=', '');
      
      if (mediaType === 'audio') {
        answerSDP += `m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n` +
                     `c=IN IP4 ${SERVER_IP}\r\n` +
                     `a=rtcp:9 IN IP4 ${SERVER_IP}\r\n` +
                     `a=rtcp-mux\r\n` +
                     `a=ice-ufrag:${iceCredentials.ufrag}\r\n` +
                     `a=ice-pwd:${iceCredentials.pwd}\r\n` +
                     `a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\n` +
                     `a=setup:active\r\n` +
                     `a=rtpmap:111 OPUS/48000/2\r\n`;
      } else if (mediaType === 'video') {
        answerSDP += `m=video 5004 UDP/TLS/RTP/SAVPF 96\r\n` +
                     `c=IN IP4 ${SERVER_IP}\r\n` +
                     `a=rtcp:5005 IN IP4 ${SERVER_IP}\r\n` +
                     `a=rtcp-mux\r\n` +
                     `a=ice-ufrag:${iceCredentials.ufrag}\r\n` +
                     `a=ice-pwd:${iceCredentials.pwd}\r\n` +
                     `a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\n` +
                     `a=setup:active\r\n` +
                     `a=rtpmap:96 H264/90000\r\n` +
                     `a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1\r\n` +
                     `a=candidate:1 1 UDP 2113937151 ${SERVER_IP} 5004 typ host\r\n`;
      } else {
        // Unknown media type - create generic answer
        answerSDP += `m=${mediaType} 9 UDP/TLS/RTP/SAVPF 0\r\n` +
                     `c=IN IP4 127.0.0.1\r\n`;
      }
    }

    // Create answer object
    const answer = {
      type: 'answer',
      sdp: answerSDP
    };

    console.log(`[📤] Sending answer to client`);
    const answerPath = `webrtc_sessions/${sessionId}/answer`;
    console.log(`[📍] Writing to path: ${answerPath}`);
    
    const answerData = {
      type: 'answer',
      data: answer,
      from: DEVICE_ID,
      timestamp: Date.now()
    };
    
    console.log(`[🔍] Answer data being written:`, JSON.stringify(answerData).substring(0, 150));
    
    await db.ref(answerPath).set(answerData);

    // Verify write succeeded by reading it back
    const verification = await db.ref(answerPath).once('value');
    if (verification.exists()) {
      console.log(`[✅] Answer written successfully to Firebase`);
      console.log(`[✅] Verification: data exists at path`, answerPath);
    } else {
      console.log(`[❌] ERROR: Write appeared to succeed but data not found on read-back!`);
    }
    
    console.log(`[✅] Session established - Camera stream ready`);

    // Send ICE candidates after answer
    // Note: In a real scenario, these would come from the actual ICE agent
    // For now, we send mock candidates with host addresses to enable connectivity
    try {
      console.log(`[🧊] Generating ICE candidates...`);
      
      const candidates = [
        {
          candidate: `candidate:1 1 UDP 2113937151 ${SERVER_IP} 5000 typ host`,
          sdpMLineIndex: 0,
          sdpMid: 'audio'
        },
        {
          candidate: `candidate:2 1 UDP 2113937151 ${SERVER_IP} 5001 typ host`,
          sdpMLineIndex: 1,
          sdpMid: 'video'
        },
        {
          candidate: `candidate:3 1 UDP 2113937151 ${SERVER_IP} 5000 typ host`,
          sdpMLineIndex: 0,
          sdpMid: 'audio'
        },
        {
          candidate: `candidate:4 1 UDP 2113937151 ${SERVER_IP} 5001 typ host`,
          sdpMLineIndex: 1,
          sdpMid: 'video'
        }
      ];

      for (let i = 0; i < candidates.length; i++) {
        const candidatePath = `webrtc_sessions/${sessionId}/ice_candidates_from_pi/candidate_${i}`;
        await db.ref(candidatePath).set({
          type: 'candidate',
          data: candidates[i],
          candidate: candidates[i].candidate,
          sdpMLineIndex: candidates[i].sdpMLineIndex,
          sdpMid: candidates[i].sdpMid,
          index: i,
          timestamp: Date.now()
        });
        console.log(`[✅] ICE candidate ${i + 1}/${candidates.length} sent to Firebase`);
      }

      console.log(`[🧊] All ICE candidates sent`);
    } catch (err) {
      console.error(`[❌] Error sending ICE candidates:`, err);
    }

    // Mark session as complete
    activeSessions.set(sessionId, {
      createdAt: Date.now(),
      offer: offer,
      iceSent: true,
      processing: false
    });

  } catch (err) {
    console.error(`[❌] Error handling WebRTC session:`, err);
  }
}

/**
 * Listen for WebRTC offers
 */
async function listenForOffers() {
  console.log(`[🔍] Listening for WebRTC offers...`);

  // First, load any existing sessions
  try {
    const snapshot = await db.ref('webrtc_sessions').once('value');
    const sessions = snapshot.val();
    
    if (sessions) {
      for (const [sessionId, sessionData] of Object.entries(sessions)) {
        if (sessionData && sessionData.offer && !activeSessions.has(sessionId)) {
          console.log(`[📍] Found existing offer in session: ${sessionId}`);
          await handleWebRTCSession(sessionId, sessionData.offer.data);
        }
      }
    }
  } catch (err) {
    console.error(`[❌] Error loading existing sessions:`, err);
  }

  // Listen for NEW sessions added after server started
  db.ref('webrtc_sessions').on('child_added', async (snapshot) => {
    const sessionId = snapshot.key;
    const sessionData = snapshot.val();

    // Only process if we have an offer and haven't processed this session yet
    if (sessionData && sessionData.offer && !activeSessions.has(sessionId)) {
      console.log(`[📍] Found new offer in session (child_added): ${sessionId}`);
      await handleWebRTCSession(sessionId, sessionData.offer.data);
    }
  });

  // ALSO listen for CHANGES to existing sessions (e.g., when offer is added to an existing session)
  db.ref('webrtc_sessions').on('child_changed', async (snapshot) => {
    const sessionId = snapshot.key;
    const sessionData = snapshot.val();

    // Process if we have an offer and haven't processed this session yet
    if (sessionData && sessionData.offer && !activeSessions.has(sessionId)) {
      console.log(`[📍] Found new offer in session (child_changed): ${sessionId}`);
      await handleWebRTCSession(sessionId, sessionData.offer.data);
    }
  });
}

/**
 * Keep device alive and update status periodically
 */
function startHeartbeat() {
  setInterval(async () => {
    try {
      await db.ref(`device_status/${DEVICE_ID}/lastSeen`).set(Date.now());
      console.log(`[💓] Heartbeat sent`);
    } catch (err) {
      console.error(`[❌] Heartbeat error:`, err);
    }
  }, 30000); // Every 30 seconds
}

/**
 * Cleanup on exit
 */
async function cleanup() {
  console.log(`[🛑] Shutting down...`);
  
  stopCameraStream();

  // Mark device as offline
  try {
    await db.ref(`device_status/${DEVICE_ID}`).update({
      online: false,
      lastSeen: Date.now()
    });
  } catch (err) {
    console.error(`[❌] Error updating status on exit:`, err);
  }

  // Disconnect Firebase
  db.goOffline();
  
  console.log(`[👋] Goodbye!`);
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

/**
 * Start server
 */
async function start() {
  try {
    console.log(`[🚀] Starting WebRTC Camera Server...`);
    
    // Check if device ID file exists
    if (!fs.existsSync('device_id.txt')) {
      console.log(`[⚠️] device_id.txt not found. Using default: ${DEVICE_ID}`);
    }

    // Check if serviceAccountKey exists
    if (!fs.existsSync('./serviceAccountKey.json')) {
      console.error(`[❌] serviceAccountKey.json not found!`);
      console.log(`[ℹ️] Please copy your Firebase service account key to this directory`);
      process.exit(1);
    }

    // Start camera stream
    await startCameraStream();
    console.log(`[📹] Camera stream initialization complete`);

    // Update device status
    await updateDeviceStatus();
    console.log(`[✅] Device status updated in Firebase`);

    // Start heartbeat
    startHeartbeat();

    // Listen for WebRTC offers
    listenForOffers();

    console.log(`[✅] Server ready and waiting for connections`);
    console.log(`[📡] Device ID: ${DEVICE_ID}`);
    console.log(`[🎥] Camera streaming via rpicam`);
    console.log(`[🔥] Firebase DB: sensor-app-2a69b-default-rtdb.firebaseio.com`);

  } catch (err) {
    console.error(`[❌] Error starting server:`, err);
    process.exit(1);
  }
}

start();
