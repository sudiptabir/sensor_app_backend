const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');

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

// Store latest frame path (pre-captured)
let latestFramePath = '/tmp/camera_latest.jpg';
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
      console.log(`[BACKGROUND] Still capturing... (${elapsed}ms elapsed)`);
      return;
    }
    
    isCapturing = true;
    captureStartTime = Date.now();
    const tempPath = `/tmp/camera_${Date.now()}.jpg`;
    
    console.log(`[BACKGROUND] Starting capture...`);
    
    // Use spawn (non-blocking) instead of execSync
    const proc = spawn('/usr/bin/rpicam-still', [
      '-o', tempPath,
      '--width', '640',
      '--height', '480',
      '--quality', '80'
    ]);
    
    // Increase timeout to 20 seconds (rpicam-still can be slow)
    const timeout = setTimeout(() => {
      console.log('[BACKGROUND] ⏱️  Capture timeout (20s), killing process');
      proc.kill('SIGKILL');
      isCapturing = false;
    }, 20000);
    
    proc.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - captureStartTime;
      
      if (!isCapturing) {
        console.log(`[BACKGROUND] Process already marked as done`);
        return;
      }
      
      isCapturing = false;
      
      if (code === 0 || code === null) {
        // Successfully captured
        if (fs.existsSync(tempPath)) {
          try {
            if (fs.existsSync(latestFramePath)) {
              fs.unlinkSync(latestFramePath);
            }
            fs.renameSync(tempPath, latestFramePath);
            const size = fs.statSync(latestFramePath).size;
            console.log(`[BACKGROUND] ✅ Frame captured in ${duration}ms (${size} bytes)`);
          } catch (e) {
            console.error('[BACKGROUND] Error renaming file:', e.message);
          }
        } else {
          console.log(`[BACKGROUND] ⚠️  Frame file not created: ${tempPath}`);
        }
      } else {
        console.error(`[BACKGROUND] ❌ Capture failed with code ${code} after ${duration}ms`);
      }
    });
    
    proc.on('error', (err) => {
      clearTimeout(timeout);
      isCapturing = false;
      console.error('[BACKGROUND] Spawn error:', err.message);
    });
    
  }, 10000); // Attempt capture every 10 seconds
}

// GET /camera/frame - Return latest captured frame (instant)
app.get('/camera/frame', (req, res) => {
  try {
    if (!fs.existsSync(latestFramePath)) {
      console.log('[FRAME] No frame available yet');
      return res.status(503).json({ error: 'No frame available yet' });
    }
    
    const frameData = fs.readFileSync(latestFramePath);
    console.log(`[FRAME] Sending frame (${frameData.length} bytes)`);
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', frameData.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(frameData);
    
  } catch (error) {
    console.error('[FRAME] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /camera/status
app.get('/camera/status', (req, res) => {
  const frameExists = fs.existsSync(latestFramePath);
  const frameSize = frameExists ? fs.statSync(latestFramePath).size : 0;
  
  res.json({
    status: 'ok',
    device_id: DEVICE_ID,
    camera: 'libcamera (rpicam-still)',
    port: PORT,
    frame_ready: frameExists,
    frame_size: frameSize,
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
        .info { background: white; padding: 20px; border-radius: 10px; display: inline-block; }
        h1 { color: #333; }
        p { margin: 10px 0; }
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
      <img src="/camera/frame?t=${Date.now()}" alt="Camera Feed" id="stream" />
      <p id="status">Loading...</p>
      <script>
        // Refresh frame every 3 seconds
        setInterval(() => {
          const img = document.getElementById('stream');
          img.src = '/camera/frame?t=' + Date.now();
        }, 3000);
        
        // Show status
        setInterval(async () => {
          try {
            const res = await fetch('/camera/status');
            const data = await res.json();
            document.getElementById('status').innerText = 
              'Frame size: ' + data.frame_size + ' bytes | ' +
              'Capturing: ' + (data.capturing ? 'Yes' : 'No');
          } catch (e) {
            document.getElementById('status').innerText = 'Error: ' + e.message;
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
