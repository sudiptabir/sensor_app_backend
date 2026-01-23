const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Initialize Firebase
const serviceAccount = require('./serviceAccountKey.json');
const DEVICE_ID = fs.readFileSync('./device_id.txt', 'utf-8').trim();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const app = express();
const PORT = 3000;

app.use(cors());

// Store frames in memory (buffer) instead of file
let latestFrame = null;
let isCapturing = false;
let captureStartTime = 0;

console.log(`✅ Camera Server Started`);
console.log(`📸 Device ID: ${DEVICE_ID}`);
console.log(`🌐 Port: ${PORT}`);

// Pre-capture frames continuously in background (non-blocking)
function startBackgroundCapture() {
  console.log('[BACKGROUND] Starting continuous capture...');
  
  setInterval(() => {
    if (isCapturing) {
      const elapsed = Date.now() - captureStartTime;
      if (elapsed > 5000) {
        console.log(`[BACKGROUND] ⏱️  Capture taking too long (${elapsed}ms)`);
      }
      return;
    }
    
    isCapturing = true;
    captureStartTime = Date.now();
    const tempPath = `/tmp/camera_${Date.now()}.jpg`;
    
    console.log(`[BACKGROUND] 📸 Starting capture...`);
    
    // Use spawn (non-blocking) 
    const proc = spawn('/usr/bin/rpicam-still', [
      '-o', tempPath,
      '--width', '640',
      '--height', '480',
      '--quality', '80'
    ]);
    
    // Timeout after 20 seconds
    const timeout = setTimeout(() => {
      console.log('[BACKGROUND] ⏱️  Timeout, killing process');
      proc.kill('SIGKILL');
      isCapturing = false;
    }, 20000);
    
    proc.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - captureStartTime;
      
      if (!isCapturing) return;
      
      isCapturing = false;
      
      if (code === 0 || code === null) {
        // Try to read the file into memory
        try {
          if (fs.existsSync(tempPath)) {
            latestFrame = fs.readFileSync(tempPath);
            const size = latestFrame.length;
            console.log(`[BACKGROUND] ✅ Frame ready (${size} bytes, captured in ${duration}ms)`);
            
            // Clean up temp file
            try {
              fs.unlinkSync(tempPath);
            } catch (e) {
              console.error('[CLEANUP] Error:', e.message);
            }
          } else {
            console.log(`[BACKGROUND] ⚠️  File not found: ${tempPath}`);
          }
        } catch (e) {
          console.error('[BACKGROUND] Error reading frame:', e.message);
          isCapturing = false;
        }
      } else {
        console.error(`[BACKGROUND] ❌ Capture failed (code ${code}, ${duration}ms)`);
      }
    });
    
    proc.on('error', (err) => {
      clearTimeout(timeout);
      isCapturing = false;
      console.error('[BACKGROUND] Spawn error:', err.message);
    });
    
  }, 10000); // Attempt capture every 10 seconds
}

// GET /camera/frame - Return latest captured frame instantly
app.get('/camera/frame', (req, res) => {
  try {
    if (!latestFrame) {
      console.log('[FRAME] ⚠️  No frame available yet');
      return res.status(503).json({ error: 'No frame available yet' });
    }
    
    console.log(`[FRAME] 📤 Sending ${latestFrame.length} bytes`);
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', latestFrame.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    
    // Send frame data directly
    res.end(latestFrame);
    
  } catch (error) {
    console.error('[FRAME] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /camera/status
app.get('/camera/status', (req, res) => {
  res.json({
    status: 'ok',
    device_id: DEVICE_ID,
    camera: 'libcamera (rpicam-still)',
    port: PORT,
    frame_ready: latestFrame !== null,
    frame_size: latestFrame ? latestFrame.length : 0,
    capturing: isCapturing,
    timestamp: new Date().toISOString()
  });
});

// GET / - Web interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Raspberry Pi Camera Stream</title>
      <style>
        body { font-family: Arial; text-align: center; padding: 20px; background: #f0f0f0; }
        img { max-width: 100%; border: 3px solid #333; margin: 20px 0; border-radius: 10px; }
        .info { background: white; padding: 20px; border-radius: 10px; display: inline-block; margin: 10px 0; }
        h1 { color: #333; }
        p { margin: 10px 0; }
        #status { color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <h1>🎥 Raspberry Pi Camera Stream</h1>
      <div class="info">
        <p><strong>Device ID:</strong> ${DEVICE_ID}</p>
        <p><strong>Status:</strong> Running</p>
        <p><strong>Port:</strong> ${PORT}</p>
      </div>
      <h2>Live Stream</h2>
      <img src="/camera/frame?t=${Date.now()}" alt="Camera Feed" id="stream" style="max-width: 800px; height: auto;" />
      <p id="status">Initializing...</p>
      <script>
        // Refresh frame every 5 seconds
        setInterval(() => {
          const img = document.getElementById('stream');
          const newSrc = '/camera/frame?t=' + Date.now();
          img.src = newSrc;
          console.log('Refreshing frame...');
        }, 5000);
        
        // Show status every 3 seconds
        setInterval(async () => {
          try {
            const response = await fetch('/camera/status');
            const data = await response.json();
            document.getElementById('status').innerText = 
              '📊 Frame: ' + data.frame_size + ' bytes | ' +
              '📸 Capturing: ' + (data.capturing ? 'Yes' : 'No');
          } catch (e) {
            document.getElementById('status').innerText = '❌ Error: ' + e.message;
          }
        }, 3000);
      </script>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Camera server running on http://0.0.0.0:${PORT}`);
  console.log(`📸 Frame endpoint: http://localhost:${PORT}/camera/frame`);
  console.log(`📊 Status endpoint: http://localhost:${PORT}/camera/status`);
  console.log(`🌐 Web interface: http://localhost:${PORT}\n`);
  
  // Start continuous background capture
  startBackgroundCapture();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down camera server...');
  process.exit(0);
});
