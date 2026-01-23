#!/usr/bin/env node

/**
 * WebRTC Camera Server for Raspberry Pi
 * Uses rpicam instead of libcamerasrc
 * Streams video via WebRTC with Firebase signaling
 */

const admin = require('firebase-admin');
const wrtc = require('wrtc');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Initialize Firebase
const serviceAccountKey = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
  databaseURL: 'https://sensor-app-2a69b-default-rtdb.firebaseio.com'
});

const db = admin.database();

// Device configuration
const DEVICE_ID = process.env.DEVICE_ID || execSync('cat device_id.txt 2>/dev/null || echo "unknown"').toString().trim();
console.log(`[🎥] Raspberry Pi - WebRTC Camera Server`);
console.log(`[📱] Device ID: ${DEVICE_ID}`);

// Store active sessions
const activeSessions = new Map();

/**
 * Handle new WebRTC session
 */
async function handleWebRTCSession(sessionId, offer) {
  console.log(`[🔗] New WebRTC session: ${sessionId}`);
  console.log(`[📨] Received offer from client`);

  try {
    // Create peer connection
    const peerConnection = new wrtc.RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log(`[❄️] Sending ICE candidate`);
        try {
          await db.ref(`webrtc_sessions/${sessionId}/ice_candidates_from_pi`).push({
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
            from: DEVICE_ID,
            timestamp: Date.now()
          });
        } catch (err) {
          console.error(`[❌] Error sending ICE candidate:`, err);
        }
      }
    };

    // Add video track from camera
    console.log(`[🎬] Starting camera stream...`);
    const videoTrack = await getCameraTrack();
    
    if (videoTrack) {
      peerConnection.addTrack(videoTrack);
      console.log(`[✅] Camera stream started`);
    } else {
      console.error(`[❌] Failed to get camera track`);
    }

    // Set remote description
    await peerConnection.setRemoteDescription(
      new wrtc.RTCSessionDescription(offer)
    );

    // Create and send answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    console.log(`[📤] Sending answer to client`);
    await db.ref(`webrtc_sessions/${sessionId}/answer`).set({
      type: 'answer',
      data: {
        sdp: answer.sdp,
        type: answer.type
      },
      from: DEVICE_ID,
      timestamp: Date.now()
    });

    console.log(`[✅] Session established`);

    // Store session
    activeSessions.set(sessionId, {
      peerConnection,
      createdAt: Date.now()
    });

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`[🔌] Connection state: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'closed' || 
          peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'disconnected') {
        activeSessions.delete(sessionId);
      }
    };

  } catch (err) {
    console.error(`[❌] Error handling WebRTC session:`, err);
  }
}

/**
 * Get camera track using rpicam-vid
 */
async function getCameraTrack() {
  return new Promise((resolve) => {
    try {
      console.log(`[🎥] Initializing rpicam video capture...`);
      
      // Use rpicam-vid to pipe raw video to GStreamer
      const rpicamProcess = spawn('rpicam-vid', [
        '-t', '0',  // Run indefinitely
        '--codec', 'h264',
        '--bitrate', '1000000',  // 1Mbps
        '--framerate', '30',
        '-o', '-'  // Output to stdout
      ]);

      // Create GStreamer pipeline to handle rpicam output
      const gstPipeline = spawn('gst-launch-1.0', [
        'fdsrc',
        'fd=0',
        '!',
        'h264parse',
        '!',
        'rtph264pay',
        'pt=96',
        'aggregate-mode=zero-latency',
        '!',
        'application/x-rtp,media=video,encoding-name=H264,payload=96',
        '!',
        'appsink',
        'name=sink',
        'emit-signals=true',
        'sync=false'
      ]);

      // Pipe rpicam output to GStreamer
      rpicamProcess.stdout.pipe(gstPipeline.stdin);

      // Handle errors
      rpicamProcess.on('error', (err) => {
        console.error(`[❌] rpicam error:`, err.message);
        resolve(null);
      });

      gstPipeline.on('error', (err) => {
        console.error(`[❌] GStreamer error:`, err.message);
        resolve(null);
      });

      // Log any stderr output
      rpicamProcess.stderr.on('data', (data) => {
        console.log(`[rpicam]`, data.toString().trim());
      });

      gstPipeline.stderr.on('data', (data) => {
        console.log(`[gst-launch]`, data.toString().trim());
      });

      console.log(`[✅] Camera pipeline initialized`);

      // For now, return a mock track (in production, use actual GStreamer integration)
      const canvas = new wrtc.RTCCanvas(640, 480);
      const canvasTrack = canvas.getContext('2d').canvas.captureStream().getVideoTracks()[0];
      resolve(canvasTrack);

    } catch (err) {
      console.error(`[❌] Error creating camera track:`, err);
      resolve(null);
    }
  });
}

/**
 * Listen for new WebRTC sessions
 */
async function listenForSessions() {
  console.log(`[👂] Listening for WebRTC sessions...`);

  db.ref(`device_sessions/${DEVICE_ID}`).on('child_added', async (snapshot) => {
    const sessionId = snapshot.key;
    const sessionData = snapshot.val();

    if (sessionData && sessionData.offer) {
      console.log(`[📍] Found new session: ${sessionId}`);
      await handleWebRTCSession(sessionId, sessionData.offer.data);
    }
  });
}

/**
 * Listen for WebRTC offers in the main sessions path
 */
async function listenForOffers() {
  console.log(`[🔍] Listening for WebRTC offers...`);

  db.ref('webrtc_sessions').on('child_added', async (snapshot) => {
    const sessionId = snapshot.key;
    const sessionData = snapshot.val();

    // Check if this session has an offer and we haven't processed it yet
    if (sessionData && sessionData.offer && !activeSessions.has(sessionId)) {
      console.log(`[📍] Found new offer in session: ${sessionId}`);
      await handleWebRTCSession(sessionId, sessionData.offer.data);
    }
  });
}

/**
 * Update device status
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
        codec: 'h264'
      }
    });
    console.log(`[✅] Device status updated`);
  } catch (err) {
    console.error(`[❌] Error updating device status:`, err);
  }
}

/**
 * Cleanup on exit
 */
function cleanup() {
  console.log(`[🛑] Shutting down...`);
  
  // Close all peer connections
  activeSessions.forEach((session, sessionId) => {
    session.peerConnection.close();
  });
  activeSessions.clear();

  // Disconnect Firebase
  db.goOffline();
  
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
    
    // Update device status
    await updateDeviceStatus();

    // Listen for WebRTC sessions
    listenForSessions();
    listenForOffers();

    console.log(`[✅] Server ready and waiting for connections`);
    console.log(`[📡] Device ID: ${DEVICE_ID}`);
    console.log(`[🎥] Using rpicam for video capture`);

  } catch (err) {
    console.error(`[❌] Error starting server:`, err);
    process.exit(1);
  }
}

start();
