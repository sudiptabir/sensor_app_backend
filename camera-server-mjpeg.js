const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { spawn } = require('child_process');

const DEVICE_ID = fs.readFileSync('./device_id.txt', 'utf-8').trim();
const app = express();
app.use(cors());

let latestFrame = null;
let frameTimestamp = 0;
let isCapturing = false;

console.log('🎥 Starting MJPEG camera server...');

// Capture frames continuously every 300ms (~3 fps)
setInterval(() => {
  if (isCapturing) return;
  
  isCapturing = true;
  const tempPath = `/tmp/frame_${Date.now()}.jpg`;
  
  const proc = spawn('/usr/bin/rpicam-still', [
    '-o', tempPath,
    '--width', '640',
    '--height', '480',
    '--quality', '80'
  ]);
  
  const timeout = setTimeout(() => {
    proc.kill();
    isCapturing = false;
  }, 5000);
  
  proc.on('close', () => {
    clearTimeout(timeout);
    try {
      if (fs.existsSync(tempPath)) {
        latestFrame = fs.readFileSync(tempPath);
        frameTimestamp = Date.now();
        fs.unlinkSync(tempPath);
      }
    } catch (e) {
      console.error('Error:', e.message);
    }
    isCapturing = false;
  });
}, 300); // Capture every 300ms for smooth video

// MJPEG Stream endpoint - real video feed!
app.get('/camera/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  const frameInterval = setInterval(() => {
    if (latestFrame) {
      res.write(
        '--myboundary\r\n' +
        'Content-Type: image/jpeg\r\n' +
        'Content-Length: ' + latestFrame.length + '\r\n\r\n'
      );
      res.write(latestFrame);
      res.write('\r\n');
    }
  }, 100); // Send frame every 100ms
  
  req.on('close', () => {
    clearInterval(frameInterval);
  });
});

// Single frame endpoint (for React Native Image component)
app.get('/camera/frame', (req, res) => {
  if (!latestFrame) {
    return res.status(503).send('No frame yet');
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.end(latestFrame);
});

// Status endpoint
app.get('/camera/status', (req, res) => {
  res.json({
    ok: true,
    device_id: DEVICE_ID,
    frame_size: latestFrame ? latestFrame.length : 0,
    timestamp: frameTimestamp
  });
});

// Web interface with MJPEG stream
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pi Camera</title>
      <style>
        body { background: #1a1a1a; color: #fff; font-family: Arial; text-align: center; padding: 20px; }
        img { max-width: 90%; max-height: 600px; margin: 20px 0; border: 2px solid #444; }
        #stream-container { background: #000; padding: 20px; border-radius: 10px; }
      </style>
    </head>
    <body>
      <h1>🎥 Live Camera Stream</h1>
      <p>Device: ${DEVICE_ID}</p>
      <div id="stream-container">
        <img id="stream" src="/camera/stream" alt="Live Stream" />
      </div>
      <p id="status">Connecting...</p>
      <script>
        setInterval(async () => {
          try {
            const res = await fetch('/camera/status');
            const data = await res.json();
            document.getElementById('status').innerHTML = '📊 Frame size: ' + data.frame_size + ' bytes';
          } catch (e) {
            document.getElementById('status').innerHTML = '⚠️ ' + e.message;
          }
        }, 2000);
      </script>
    </body>
    </html>
  `);
});

// Start server
app.listen(3000, '0.0.0.0', () => {
  console.log('✅ Server running on port 3000');
  console.log('📹 MJPEG Stream: http://localhost:3000/camera/stream');
  console.log('🌐 Web UI: http://localhost:3000');
});
