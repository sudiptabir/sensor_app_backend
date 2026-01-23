const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { spawn } = require('child_process');

const DEVICE_ID = fs.readFileSync('./device_id.txt', 'utf-8').trim();
const app = express();
app.use(cors());

let latestFrame = null;
let isCapturing = false;

console.log('🎥 Starting camera server...');

// Background capture - runs every 10 seconds
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
  }, 25000);
  
  proc.on('close', () => {
    clearTimeout(timeout);
    try {
      if (fs.existsSync(tempPath)) {
        latestFrame = fs.readFileSync(tempPath);
        fs.unlinkSync(tempPath);
        console.log('✅ Frame:', latestFrame.length, 'bytes');
      }
    } catch (e) {
      console.error('❌ Error:', e.message);
    }
    isCapturing = false;
  });
}, 10000);

// API endpoints
app.get('/camera/frame', (req, res) => {
  if (!latestFrame) {
    return res.status(503).send('No frame yet');
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.end(latestFrame);
});

app.get('/camera/status', (req, res) => {
  res.json({
    ok: true,
    device_id: DEVICE_ID,
    frame_size: latestFrame ? latestFrame.length : 0
  });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pi Camera</title>
      <style>
        body { background: #1a1a1a; color: #fff; font-family: Arial; text-align: center; padding: 20px; }
        img { max-width: 90%; max-height: 600px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>🎥 Camera Stream</h1>
      <p>Device: ${DEVICE_ID}</p>
      <img id="img" src="/camera/frame" />
      <p id="status">Loading...</p>
      <script>
        setInterval(() => {
          document.getElementById('img').src = '/camera/frame?t=' + Date.now();
        }, 8000);
        
        setInterval(async () => {
          try {
            const res = await fetch('/camera/status');
            const data = await res.json();
            document.getElementById('status').innerHTML = 'Frame: ' + data.frame_size + ' bytes';
          } catch (e) {
            document.getElementById('status').innerHTML = 'Error: ' + e.message;
          }
        }, 3000);
      </script>
    </body>
    </html>
  `);
});

// Start server
app.listen(3000, '0.0.0.0', () => {
  console.log('✅ Server running on port 3000');
});
