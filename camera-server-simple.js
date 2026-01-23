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

let latestFrame = null;
let isCapturing = false;
let captureCount = 0;
let lastError = null;

console.log(`✅ Camera Server Started`);
console.log(`📸 Device ID: ${DEVICE_ID}`);

// Simple sync capture for immediate first frame
function captureFrameSync() {
  const tempPath = `/tmp/frame_sync_${Date.now()}.jpg`;
  const { spawnSync } = require('child_process');
  
  console.log('[INIT] Capturing initial frame...');
  
  const result = spawnSync('/usr/bin/rpicam-still', [
    '-o', tempPath,
    '--width', '640',
    '--height', '480',
    '--quality', '80'
  ], {
    timeout: 25000,
    stdio: 'pipe'
  });
  
  if (result.error) {
    console.error('[INIT] Error:', result.error.message);
    lastError = result.error.message;
    return false;
  }
  
  if (result.status === 0 && fs.existsSync(tempPath)) {
    try {
      latestFrame = fs.readFileSync(tempPath);
      fs.unlinkSync(tempPath);
      console.log(`[INIT] ✅ Got frame: ${latestFrame.length} bytes`);
      captureCount++;
      return true;
    } catch (e) {
      console.error('[INIT] Error reading frame:', e.message);
      lastError = e.message;
      return false;
    }
  } else {
    console.error(`[INIT] Capture failed with status ${result.status}`);
    lastError = `Status ${result.status}`;
    return false;
  }
}

// Background capture loop
function startBackgroundCapture() {
  console.log('[BACKGROUND] Starting capture loop every 10 seconds...');
  
  setInterval(() => {
    if (isCapturing) {
      console.log('[BACKGROUND] Already capturing, skip');
      return;
    }
    
    isCapturing = true;
    const tempPath = `/tmp/frame_bg_${Date.now()}.jpg`;
    const startTime = Date.now();
    
    const proc = spawn('/usr/bin/rpicam-still', [
      '-o', tempPath,
      '--width', '640',
      '--height', '480',
      '--quality', '80'
    ]);
    
    const timeout = setTimeout(() => {
      console.log('[BACKGROUND] Timeout, killing');
      proc.kill('SIGKILL');
      isCapturing = false;
    }, 25000);
    
    proc.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      
      if (code === 0 || code === null) {
        try {
          if (fs.existsSync(tempPath)) {
            latestFrame = fs.readFileSync(tempPath);
            fs.unlinkSync(tempPath);
            captureCount++;
            console.log(`[BACKGROUND] ✅ Frame ${captureCount}: ${latestFrame.length} bytes (${duration}ms)`);
            lastError = null;
          }
        } catch (e) {
          console.error('[BACKGROUND] Error:', e.message);
          lastError = e.message;
        }
      } else {
        console.error(`[BACKGROUND] Failed: code ${code} (${duration}ms)`);
        lastError = `Code ${code}`;
      }
      
      isCapturing = false;
    });
    
    proc.on('error', (err) => {
      clearTimeout(timeout);
      isCapturing = false;
      console.error('[BACKGROUND] Spawn error:', err.message);
      lastError = err.message;
    });
  }, 10000);
}

// GET /camera/frame
app.get('/camera/frame', (req, res) => {
  if (!latestFrame) {
    return res.status(503).send('No frame');
  }
  
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(latestFrame);
});

// GET /camera/status
app.get('/camera/status', (req, res) => {
  res.json({
    frame_ready: latestFrame !== null,
    frame_size: latestFrame ? latestFrame.length : 0,
    capturing: isCapturing,
    captures: captureCount,
    error: lastError
  });
});

// GET /
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Pi Camera</title>
  <style>
    body { background: #1a1a1a; color: #fff; font-family: Arial; text-align: center; padding: 20px; }
    img { max-width: 100%; max-height: 600px; border: 2px solid #444; margin: 20px 0; }
    #status { background: #333; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .spinner { border: 4px solid #444; border-top: 4px solid #4CAF50; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <h1>🎥 Raspberry Pi Camera</h1>
  <p>Device: ${DEVICE_ID}</p>
  
  <div id="loading" style="display:block;">
    <div class="spinner"></div>
    <p>Initializing camera...</p>
  </div>
  
  <img id="stream" style="display:none;" />
  <div id="status">-</div>

  <script>
    async function updateStatus() {
      try {
        const res = await fetch('/camera/status');
        const data = await res.json();
        
        console.log('Status:', data);
        document.getElementById('status').innerHTML = 
          'Frame: ' + (data.frame_size > 0 ? data.frame_size : 'waiting') + ' bytes | ' +
          'Count: ' + data.captures + ' | ' +
          'Error: ' + (data.error || 'none');
        
        if (data.frame_ready) {
          document.getElementById('loading').style.display = 'none';
          const img = document.getElementById('stream');
          img.style.display = 'block';
          img.src = '/camera/frame?t=' + Date.now();
          
          // Refresh every 8 seconds
          setInterval(() => {
            img.src = '/camera/frame?t=' + Date.now();
          }, 8000);
          
          return; // Stop polling
        }
      } catch (e) {
        console.error('Error:', e);
        document.getElementById('status').innerHTML = '❌ Error: ' + e.message;
      }
      
      // Poll every 2 seconds
      setTimeout(updateStatus, 2000);
    }
    
    updateStatus();
  </script>
</body>
</html>`);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌐 Server: http://0.0.0.0:${PORT}\n`);
  
  // Capture initial frame synchronously
  const success = captureFrameSync();
  
  if (!success) {
    console.error('⚠️  Initial capture failed, will try in background');
  }
  
  // Start background loop
  startBackgroundCapture();
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  process.exit(0);
});
