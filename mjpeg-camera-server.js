#!/usr/bin/env node

/**
 * MJPEG Camera Server
 * Streams camera video via MJPEG (Motion JPEG) over HTTP
 * Simple, reliable, works with any HTTP client
 */

const http = require('http');
const { spawn } = require('child_process');
const admin = require('firebase-admin');

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
const DEVICE_ID = require('os').hostname().toLowerCase().replace(/[^a-z0-9-]/g, '');

// Server config
const HTTP_PORT = process.env.MJPEG_PORT || 8080;
const FRAMERATE = 15;
const QUALITY = 80;

console.log(`\n🎥 MJPEG Camera Server`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Device ID: ${DEVICE_ID}`);
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      device: DEVICE_ID,
      port: HTTP_PORT,
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
  console.log(`📹 Stream URL: http://<device-ip>:${HTTP_PORT}/stream.mjpeg`);
  console.log(`💓 Health check: http://<device-ip>:${HTTP_PORT}/health`);

  // Update Firebase with streaming info
  db.ref(`devices/${DEVICE_ID}`).update({
    streaming_enabled: true,
    streaming_url: `http://<your-pi-ip>:${HTTP_PORT}/stream.mjpeg`,
    streaming_type: 'mjpeg',
    last_updated: new Date().getTime()
  }).catch(err => console.error('Firebase update error:', err.message));
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
