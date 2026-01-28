#!/usr/bin/env node

/**
 * MJPEG Camera Server
 * Streams camera video via MJPEG (Motion JPEG) over HTTP
 * Simple, reliable, works with any HTTP client
 */

const http = require('http');
const { spawn } = require('child_process');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    databaseURL: process.env.FIREBASE_REALTIME_DB || 'https://sensor-app-2a69b-default-rtdb.firebaseio.com'
  });
  console.log('✅ Firebase initialized');
} catch (err) {
  console.error('❌ Firebase init error:', err.message);
  process.exit(1);
}

const db = admin.database();
const firestore = admin.firestore();

// Get device ID - try multiple sources
function getDeviceID() {
  // 1. Try device_id.txt file (most reliable for registered devices)
  try {
    const deviceIdPath = path.join(__dirname, 'device_id.txt');
    if (fs.existsSync(deviceIdPath)) {
      const deviceId = fs.readFileSync(deviceIdPath, 'utf8').trim();
      if (deviceId) {
        console.log('📋 Device ID loaded from device_id.txt');
        return deviceId;
      }
    }
  } catch (err) {
    console.warn('⚠️  Could not read device_id.txt:', err.message);
  }

  // 2. Fallback to hostname (for backward compatibility)
  const hostname = require('os').hostname().toLowerCase().replace(/[^a-z0-9-]/g, '');
  console.log('📋 Using hostname as device ID:', hostname);
  return hostname;
}

const DEVICE_ID = getDeviceID();

// Get local IP address (for remote access)
function getLocalIPAddress() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4Value && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Server config
const HTTP_PORT = process.env.MJPEG_PORT || 8080;
const LOCAL_IP = getLocalIPAddress();
const FRAMERATE = 15;
const QUALITY = 80;

console.log(`\n🎥 MJPEG Camera Server`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Device ID: ${DEVICE_ID}`);
console.log(`Local IP: ${LOCAL_IP}`);
console.log(`Port: ${HTTP_PORT}`);
console.log(`Framerate: ${FRAMERATE} fps`);
console.log(`JPEG Quality: ${QUALITY}%`);

// Global frame buffer - keeps the latest JPEG frame
let latestFrame = null;
let frameCount = 0;
let lastLogTime = Date.now();
let cameraProcess = null;

// Start persistent camera process
function startCameraStream() {
  console.log('\n🚀 Starting persistent camera stream...');

  cameraProcess = spawn('rpicam-vid', [
    '--codec', 'mjpeg',
    '--framerate', FRAMERATE.toString(),
    '--timeout', '0',
    '-o', '-'
  ]);

  let buffer = Buffer.alloc(0);

  // Handle camera stdout - extract JPEG frames and keep latest
  cameraProcess.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    // Look for JPEG frame boundaries (FFD8 = start, FFD9 = end)
    let startIdx = buffer.indexOf(Buffer.from([0xFF, 0xD8]));
    
    while (startIdx !== -1) {
      let endIdx = buffer.indexOf(Buffer.from([0xFF, 0xD9]), startIdx);
      
      if (endIdx === -1) {
        // Incomplete frame - keep the data for next chunk
        buffer = buffer.slice(startIdx);
        break;
      }

      // Extract complete JPEG frame and save as latest
      latestFrame = buffer.slice(startIdx, endIdx + 2);
      frameCount++;
      
      // Log performance every 5 seconds
      const now = Date.now();
      if (now - lastLogTime > 5000) {
        console.log(`📊 Captured ${frameCount} frames (latest: ${latestFrame.length} bytes)`);
        frameCount = 0;
        lastLogTime = now;
      }
      
      // Continue looking for next frame
      startIdx = buffer.indexOf(Buffer.from([0xFF, 0xD8]), endIdx);
    }
  });

  cameraProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes('GStreamer')) {
      console.log(`[camera] ${msg}`);
    }
  });

  cameraProcess.on('error', (err) => {
    console.error('❌ Camera error:', err.message);
    console.log('🔄 Restarting camera in 3 seconds...');
    setTimeout(startCameraStream, 3000);
  });

  cameraProcess.on('exit', (code) => {
    console.log(`⚠️  Camera process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      console.log('🔄 Restarting camera in 3 seconds...');
      setTimeout(startCameraStream, 3000);
    }
  });
}

// Start the camera stream on server startup
startCameraStream();

// MJPEG HTTP Server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // MJPEG stream endpoint (legacy - kept for compatibility)
  if (url.pathname === '/stream.mjpeg' || url.pathname === '/') {
    console.log(`📡 Client connected: ${req.socket.remoteAddress}`);

    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=BOUNDARY',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    // Send the boundary to start streaming
    res.write(`--BOUNDARY\r\n`);

    // Set up frame sending from persistent camera buffer
    let lastFrameTime = Date.now();
    let frameCount = 0;
    let sentFrames = new Set();

    const interval = setInterval(() => {
      if (latestFrame && !sentFrames.has(latestFrame)) {
        sentFrames.add(latestFrame);

        // Send as multipart frame
        res.write(`Content-Type: image/jpeg\r\n`);
        res.write(`Content-Length: ${latestFrame.length}\r\n`);
        res.write(`\r\n`);
        res.write(latestFrame);
        res.write(`\r\n--BOUNDARY\r\n`);

        frameCount++;

        // Log performance every 5 seconds
        const now = Date.now();
        if (now - lastFrameTime > 5000) {
          const fps = (frameCount / ((now - lastFrameTime) / 1000)).toFixed(1);
          console.log(`📊 Stream fps: ${fps}`);
          frameCount = 0;
          lastFrameTime = now;
        }
      }
    }, 50); // Check for new frames every 50ms

    // Client disconnect
    req.on('close', () => {
      console.log(`📡 Client disconnected: ${req.socket.remoteAddress}`);
      clearInterval(interval);
    });

    return;
  }

  // Single JPEG frame endpoint (for Image component)
  if (url.pathname === '/frame.jpg') {
    if (!latestFrame) {
      console.log('⚠️  /frame.jpg requested but no frame available yet');
      res.writeHead(503);
      res.end('Camera not ready - no frames yet');
      return;
    }

    // Add headers to prevent caching
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': latestFrame.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET'
    });
    res.end(latestFrame);
    return;
  }

  // Health check endpoint
  if (url.pathname === '/health') {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ 
      status: 'ok', 
      device: DEVICE_ID,
      port: HTTP_PORT,
      localIP: LOCAL_IP,
      hasFrames: latestFrame !== null,
      frameCount: frameCount,
      streamEndpoints: {
        mjpeg: `/stream.mjpeg`,
        frame: `/frame.jpg`,
        health: `/health`
      },
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

// Start server
server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`\n✅ MJPEG server listening on http://0.0.0.0:${HTTP_PORT}`);
  console.log(`📹 Local Stream URL: http://${LOCAL_IP}:${HTTP_PORT}/stream.mjpeg`);
  console.log(`📹 Single Frame URL: http://${LOCAL_IP}:${HTTP_PORT}/frame.jpg`);
  console.log(`💓 Health check: http://${LOCAL_IP}:${HTTP_PORT}/health`);
  console.log(`\n⚠️  For remote access from mobile app:`);
  console.log(`   1. Ensure port ${HTTP_PORT} is forwarded on your router`);
  console.log(`   2. Use your public IP or set up dynamic DNS`);
  console.log(`   3. Update ipAddress field in Firebase device entry`);

  // Update both Realtime Database and Firestore
  const streamingData = {
    streaming_enabled: true,
    streaming_url: `http://${LOCAL_IP}:${HTTP_PORT}/stream.mjpeg`,
    streaming_type: 'mjpeg',
    streaming_port: HTTP_PORT,
    ipAddress: LOCAL_IP,
    ip_address: LOCAL_IP,
    last_updated: new Date().getTime()
  };

  // Update Realtime Database
  db.ref(`devices/${DEVICE_ID}`).update(streamingData)
    .then(() => console.log('✅ Realtime Database updated'))
    .catch(err => console.error('❌ Realtime Database update error:', err.message));

  // Update Firestore (where the app reads device info)
  firestore.collection('devices').doc(DEVICE_ID).update({
    ipAddress: LOCAL_IP,
    ip_address: LOCAL_IP,
    streaming_enabled: true,
    streaming_url: `http://${LOCAL_IP}:${HTTP_PORT}/stream.mjpeg`,
    streaming_type: 'mjpeg',
    streaming_port: HTTP_PORT,
    lastSeen: admin.firestore.FieldValue.serverTimestamp()
  })
    .then(() => console.log('✅ Firestore updated with streaming info'))
    .catch(err => console.error('❌ Firestore update error:', err.message));
});

server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.close();
  process.exit(0);
});
