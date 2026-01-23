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

// Store frames in memory
let latestFrame = null;
let isCapturing = false;
let lastCaptureTime = 0;

let lastFramePath = null;

// Function to capture a frame using rpicam-still (libcamera)
async function captureFrame() {
  try {
    const timestamp = Date.now();
    const framePath = `/tmp/frame_${timestamp}.jpg`;
    
    console.log(`[START] Capturing frame at: ${framePath}`);
    
    // Use spawnSync instead of execSync for better handling
    const result = spawnSync('/usr/bin/rpicam-still', [
      '-o', framePath,
      '--width', '640',
      '--height', '480',
      '--quality', '80'
    ], {
      timeout: 8000,
      encoding: 'utf-8'
    });
    
    if (result.error) {
      console.error(`[ERROR] Spawn error:`, result.error.message);
      throw result.error;
    }
    
    if (result.status !== 0 && result.status !== null) {
      console.error(`[ERROR] Command failed with status ${result.status}`);
      console.error(`[STDERR]`, result.stderr);
      throw new Error(`rpicam-still failed: ${result.stderr}`);
    }
    
    // Check if file was created
    if (!fs.existsSync(framePath)) {
      console.error(`[ERROR] Frame file not created: ${framePath}`);
      throw new Error(`Frame file not created: ${framePath}`);
    }
    
    const stats = fs.statSync(framePath);
    console.log(`[SUCCESS] Frame captured: ${framePath} (${stats.size} bytes)`);
    
    // Delete old frame if exists
    if (lastFramePath && lastFramePath !== framePath && fs.existsSync(lastFramePath)) {
      try {
        fs.unlinkSync(lastFramePath);
        console.log(`[CLEANUP] Deleted old frame: ${lastFramePath}`);
      } catch (e) {
        console.error('[CLEANUP ERROR]', e.message);
      }
    }
    
    lastFramePath = framePath;
    return framePath;
  } catch (error) {
    console.error('[CAPTURE ERROR]:', error.message);
    return null;
  }
}

// Start capturing frames continuously in background
async function startCameraCapture() {
  console.log('🎥 Camera capture started...');
  setInterval(async () => {
    await captureFrame();
  }, 500); // Capture every 500ms
}

// Endpoint to get current frame
app.get('/camera/frame', async (req, res) => {
  try {
    console.log('[ENDPOINT] /camera/frame called');
    const framePath = await captureFrame();
    
    if (!framePath) {
      console.log('[ERROR] captureFrame() returned null');
      return res.status(500).json({ error: 'Frame capture returned null' });
    }
    
    if (!fs.existsSync(framePath)) {
      console.log('[ERROR] Frame file does not exist:', framePath);
      return res.status(500).json({ error: 'Frame file does not exist' });
    }
    
    // Read file and send directly
    const frameData = fs.readFileSync(framePath);
    console.log(`[SEND] Sending frame (${frameData.length} bytes)`);
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', frameData.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(frameData);
    
  } catch (error) {
    console.error('[ERROR] Frame endpoint error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get camera status
app.get('/camera/status', async (req, res) => {
  try {
    const result = execSync('rpicam-still --help 2>&1 | head -1', { encoding: 'utf-8' });
    res.json({
      status: 'ready',
      camera: 'libcamera (rpicam-still)',
      device_id: DEVICE_ID,
      port: PORT,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Debug endpoint - test capture directly
app.get('/camera/test', async (req, res) => {
  console.log('[DEBUG] Test endpoint called');
  try {
    const testPath = '/tmp/test_frame.jpg';
    
    const result = spawnSync('/usr/bin/rpicam-still', [
      '-o', testPath,
      '--width', '640',
      '--height', '480',
      '--quality', '80'
    ], {
      timeout: 8000,
      encoding: 'utf-8'
    });
    
    console.log('[DEBUG] Test capture completed with status:', result.status);
    
    if (result.error) {
      console.error('[DEBUG] Spawn error:', result.error);
      return res.status(500).json({ 
        status: 'error', 
        message: result.error.message
      });
    }
    
    if (result.status !== 0 && result.status !== null) {
      console.error('[DEBUG] Test failed with status', result.status);
      return res.status(500).json({ 
        status: 'error', 
        message: `Command failed with status ${result.status}`,
        stderr: result.stderr
      });
    }
    
    if (fs.existsSync(testPath)) {
      const size = fs.statSync(testPath).size;
      console.log('[DEBUG] Test file exists, size:', size, 'bytes');
      res.json({ 
        status: 'success', 
        message: 'Camera capture working',
        file: testPath,
        size: size
      });
    } else {
      console.log('[DEBUG] Test file not found');
      res.status(500).json({ status: 'error', message: 'Test file not created' });
    }
  } catch (error) {
    console.error('[ERROR] Test capture failed:', error.message);
    res.status(500).json({ 
      status: 'error', 
      message: error.message
    });
  }
});

// Simple web interface for testing
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Raspberry Pi Camera Stream</title>
      <style>
        body { font-family: Arial; text-align: center; padding: 20px; }
        img { max-width: 100%; border: 2px solid #333; margin: 20px 0; }
        .info { background: #f0f0f0; padding: 10px; border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>🎥 Raspberry Pi Camera Stream</h1>
      <div class="info">
        <p><strong>Device ID:</strong> ${DEVICE_ID}</p>
        <p><strong>Status:</strong> Running on port ${PORT}</p>
      </div>
      <h2>Live Stream</h2>
      <img src="/camera/frame?t=${Date.now()}" alt="Camera Feed" id="stream" />
      <script>
        // Auto-refresh frame every 500ms
        setInterval(() => {
          document.getElementById('stream').src = '/camera/frame?t=' + Date.now();
        }, 500);
      </script>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Camera server running on http://localhost:${PORT}`);
  console.log(`📸 Frame endpoint: http://localhost:${PORT}/camera/frame`);
  console.log(`📊 Status endpoint: http://localhost:${PORT}/camera/status`);
  console.log(`🌐 Web interface: http://localhost:${PORT}`);
  console.log(`\nDevice ID: ${DEVICE_ID}\n`);
  
  // Start continuous camera capture
  startCameraCapture();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down camera server...');
  process.exit(0);
});
