#!/usr/bin/env node

/**
 * Raspberry Pi WebRTC Camera Server
 * Streams camera via WebRTC using gstreamer and simple-peer
 * Uses Firebase for signaling
 */

// Load environment variables from .env file
require('dotenv').config();

const admin = require('firebase-admin');
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');

// Firebase initialization
const serviceAccountPath = process.env.FIREBASE_KEY_PATH || './serviceAccountKey.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase key not found at:', serviceAccountPath);
  process.exit(1);
}

const firebaseDbUrl = process.env.FIREBASE_DB_URL;
if (!firebaseDbUrl) {
  console.error('❌ FIREBASE_DB_URL not set in .env file');
  console.error('📝 Please add FIREBASE_DB_URL to your .env file');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: firebaseDbUrl
});

const db = admin.database();
const firestore = admin.firestore();
const DEVICE_ID = process.env.DEVICE_ID || 'raspberry-pi-' + os.hostname();
const PORT = process.env.WEBRTC_PORT || 8000;
let FIRESTORE_DEVICE_ID = null; // Will be populated on startup

console.log(`
╔════════════════════════════════════════════════════╗
║    🎥 Raspberry Pi - WebRTC Camera Server         ║
║    Device ID: ${DEVICE_ID.padEnd(30)} ║
╚════════════════════════════════════════════════════╝
`);

/**
 * Simple GStreamer WebRTC pipeline using gst-rtsp-server
 * Alternative approach: use mediasoup or janus
 */

class WebRTCCameraServer {
  constructor() {
    this.peerConnections = new Map();
    this.sessionId = null;
    this.listeningForOffer = false;
  }

  /**
   * Start listening for WebRTC connections
   */
  async startListening() {
    // Find the Firestore device ID first
    await this.findFirestoreDeviceId();
    
    console.log('📡 WebRTC server ready, waiting for connections...');
    console.log('📍 Signaling via Firebase at: device_sessions/' + DEVICE_ID);

    // Update device status
    await this.updateDeviceStatus(true);

    // Listen for new sessions
    this.listenForSessions();
  }

  /**
   * Listen for incoming WebRTC sessions
   */
  listenForSessions() {
    const sessionsRef = db.ref('webrtc_sessions');
    
    sessionsRef.on('child_added', async (snapshot) => {
      const sessionData = snapshot.val();
      const sessionId = snapshot.key;

      // Only process sessions for this device
      if (sessionData.deviceId !== DEVICE_ID) return;
      if (this.sessionId !== null) return; // Only one session at a time

      console.log('✅ New WebRTC session:', sessionId);
      this.sessionId = sessionId;

      try {
        await this.handleWebRTCSession(sessionId);
      } catch (error) {
        console.error('❌ WebRTC session error:', error.message);
        this.sessionId = null;
      }
    });
  }

  /**
   * Handle a WebRTC session
   * In production, use simple-peer or mediasoup library
   */
  async handleWebRTCSession(sessionId) {
    console.log('🔗 Handling WebRTC session:', sessionId);

    // Listen for offer from client
    const offerRef = db.ref(`webrtc_sessions/${sessionId}/offer`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Offer timeout'));
      }, 30000);

      offerRef.once('value', async (snapshot) => {
        clearTimeout(timeout);

        if (!snapshot.exists()) {
          reject(new Error('No offer received'));
          return;
        }

        const offerData = snapshot.val();
        console.log('📨 Received offer from client');

        try {
          // In a real implementation, you would:
          // 1. Create RTCPeerConnection
          // 2. Set remote description (offer)
          // 3. Create answer
          // 4. Send answer back
          // 5. Exchange ICE candidates
          // 6. Stream camera video

          // For now, send a demo response
          await this.sendAnswerResponse(sessionId);
          console.log('✅ Session established');
          
          // Start camera stream
          await this.startCameraStream(sessionId);
          
          resolve();
        } catch (error) {
          reject(error);
        }
      }, (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Send answer response to client
   */
  async sendAnswerResponse(sessionId) {
    // Dummy answer - in production use real WebRTC
    const answerRef = db.ref(`webrtc_sessions/${sessionId}/answer`);
    
    await answerRef.set({
      type: 'answer',
      data: {
        type: 'answer',
        sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n...' // Truncated for demo
      },
      from: DEVICE_ID,
      timestamp: Date.now()
    });

    console.log('📤 Sent answer to client');
  }

  /**
   * Start camera stream via GStreamer
   */
  async startCameraStream(sessionId) {
    console.log('🎬 Starting camera stream...');

    // GStreamer pipeline for H.264 encoding
    const pipeline = [
      'libcamerasrc',           // Raspberry Pi camera source
      '!', 'video/x-raw,width=640,height=480,framerate=30/1',
      '!', 'videoconvert',
      '!', 'x264enc speed-preset=ultrafast',
      '!', 'rtph264pay',
      '!', 'application/x-rtp'
    ];

    try {
      const gstProc = spawn('gst-launch-1.0', pipeline);

      gstProc.stdout.on('data', (data) => {
        console.log('GStreamer:', data.toString().trim());
      });

      gstProc.stderr.on('data', (data) => {
        console.log('GStreamer:', data.toString().trim());
      });

      gstProc.on('error', (err) => {
        console.error('❌ GStreamer error:', err.message);
      });

      // Store for cleanup
      this.streamProcess = gstProc;
      
      console.log('✅ Camera stream started');
    } catch (error) {
      console.warn('⚠️ GStreamer not available (install with: sudo apt-get install gstreamer1.0-plugins-base gstreamer1.0-plugins-good)');
      console.log('📝 Continuing without actual streaming for now...');
    }
  }

  /**
   * Find this device in Firestore and get its document ID
   */
  async findFirestoreDeviceId() {
    try {
      const devicesRef = firestore.collection('devices');
      const snapshot = await devicesRef.where('deviceId', '==', DEVICE_ID).limit(1).get();
      
      if (!snapshot.empty) {
        FIRESTORE_DEVICE_ID = snapshot.docs[0].id;
        console.log('✅ Found Firestore device ID:', FIRESTORE_DEVICE_ID);
        return FIRESTORE_DEVICE_ID;
      }
      
      console.warn('⚠️ Device not found in Firestore with deviceId:', DEVICE_ID);
      console.log('📝 Using environment DEVICE_ID for status updates:', DEVICE_ID);
      FIRESTORE_DEVICE_ID = DEVICE_ID;
      return FIRESTORE_DEVICE_ID;
    } catch (error) {
      console.error('❌ Error finding Firestore device:', error.message);
      FIRESTORE_DEVICE_ID = DEVICE_ID;
      return FIRESTORE_DEVICE_ID;
    }
  }

  /**
   * Update device status in Firebase
   */
  async updateDeviceStatus(online) {
    const deviceIdForStatus = FIRESTORE_DEVICE_ID || DEVICE_ID;
    const statusRef = db.ref(`device_status/${deviceIdForStatus}`);
    await statusRef.set({
      online,
      webrtcReady: online,
      lastSeen: Date.now(),
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch()
    });
  }

  /**
   * Cleanup
   */
  async cleanup() {
    if (this.streamProcess) {
      this.streamProcess.kill();
    }
    if (this.sessionId) {
      const sessionRef = db.ref(`webrtc_sessions/${this.sessionId}`);
      await sessionRef.remove();
    }
    await this.updateDeviceStatus(false);
  }
}

// Start server
const server = new WebRTCCameraServer();

async function start() {
  try {
    await server.startListening();
  } catch (error) {
    console.error('❌ Failed to start:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏹️  Shutting down...');
  await server.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⏹️  Shutting down...');
  await server.cleanup();
  process.exit(0);
});

start();
