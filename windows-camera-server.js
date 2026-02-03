/**
 * Windows Webcam Server - Stream from Windows 11 Laptop Camera
 * Compatible with the existing Sensor App
 * 
 * Prerequisites:
 * - Node.js installed
 * - FFmpeg installed (https://ffmpeg.org/download.html)
 * 
 * Usage:
 * node windows-camera-server.js
 */

const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 3000;
const DEVICE_ID = process.env.DEVICE_ID || 'windows-laptop';
const VIDEO_DEVICE = process.env.VIDEO_DEVICE || 'Integrated Camera'; // Default Windows camera name
const FRAME_RATE = process.env.FRAME_RATE || 30;
const VIDEO_WIDTH = process.env.VIDEO_WIDTH || 640;
const VIDEO_HEIGHT = process.env.VIDEO_HEIGHT || 480;

const app = express();
app.use(cors());
app.use(express.json());

// Store latest frame
let latestFrame = null;
let isStreaming = false;
let ffmpegProcess = null;
let frameCount = 0;
let isCapturing = false; // Flag to prevent concurrent captures

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║       🎥 Windows Webcam Streaming Server                  ║');
console.log('║       Device: ' + DEVICE_ID.padEnd(42) + ' ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

/**
 * Capture a single frame from Windows webcam using FFmpeg
 */
function captureFrame() {
  return new Promise((resolve, reject) => {
    // Prevent concurrent captures
    if (isCapturing) {
      if (latestFrame) {
        resolve(latestFrame);
      } else {
        reject(new Error('Camera is busy'));
      }
      return;
    }
    
    isCapturing = true;
    const outputPath = path.join(__dirname, 'temp_frame.jpg');
    
    // FFmpeg command for Windows DirectShow
    // List devices with: ffmpeg -list_devices true -f dshow -i dummy
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'dshow',
      '-i', `video=${VIDEO_DEVICE}`,
      '-frames:v', '1',
      '-q:v', '2',
      '-s', `${VIDEO_WIDTH}x${VIDEO_HEIGHT}`,
      '-y',
      outputPath
    ]);

    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      isCapturing = false;
      if (code === 0 && fs.existsSync(outputPath)) {
        const frame = fs.readFileSync(outputPath);
        latestFrame = frame;
        frameCount++;
        resolve(frame);
      } else {
        reject(new Error(`FFmpeg failed: ${errorOutput}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Start continuous frame capture (MJPEG-style)
 */
function startContinuousCapture() {
  if (isStreaming) return;
  
  isStreaming = true;
  console.log('📹 Starting continuous capture...');

  const captureInterval = setInterval(async () => {
    if (!isStreaming) {
      clearInterval(captureInterval);
      return;
    }

    try {
      await captureFrame();
      if (frameCount % 10 === 0) {
        console.log(`📸 Captured ${frameCount} frames`);
      }
    } catch (err) {
      // Silently skip if camera is busy
      if (!err.message.includes('Camera is busy')) {
        console.error('Frame capture error:', err.message);
      }
    }
  }, 333); // Capture 3 frames per second for stability
}

/**
 * Start H.264 streaming using FFmpeg
 */
function startH264Stream() {
  if (ffmpegProcess) {
    console.log('⚠️  Stream already running');
    return;
  }

  console.log('🎬 Starting H.264 stream...');
  
  // FFmpeg H.264 streaming command
  ffmpegProcess = spawn('ffmpeg', [
    '-f', 'dshow',
    '-i', VIDEO_DEVICE,
    '-f', 'mpegts',
    '-codec:v', 'mpeg1video',
    '-s', `${VIDEO_WIDTH}x${VIDEO_HEIGHT}`,
    '-b:v', '1000k',
    '-bf', '0',
    '-r', FRAME_RATE.toString(),
    'http://localhost:' + PORT + '/stream-receiver'
  ]);

  ffmpegProcess.stderr.on('data', (data) => {
    // Uncomment for debugging
    // console.log(data.toString());
  });

  ffmpegProcess.on('close', (code) => {
    console.log(`FFmpeg process exited with code ${code}`);
    ffmpegProcess = null;
  });

  isStreaming = true;
}

/**
 * Stop streaming
 */
function stopStream() {
  if (ffmpegProcess) {
    console.log('🛑 Stopping stream...');
    ffmpegProcess.kill('SIGTERM');
    ffmpegProcess = null;
  }
  isStreaming = false;
}

// ============= API Endpoints =============

/**
 * GET /camera/frame - Return latest captured frame
 */
app.get('/camera/frame', async (req, res) => {
  try {
    // Start continuous capture if not already running
    if (!isStreaming) {
      startContinuousCapture();
    }
    
    // Return cached frame if available
    if (latestFrame) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(latestFrame);
    } else {
      // Wait for first frame if no cache
      console.log('⏳ Waiting for first frame...');
      let attempts = 0;
      const waitForFrame = setInterval(() => {
        attempts++;
        if (latestFrame) {
          clearInterval(waitForFrame);
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.send(latestFrame);
        } else if (attempts > 30) {
          clearInterval(waitForFrame);
          res.status(503).json({ error: 'Camera not ready', message: 'Waiting for first frame' });
        }
      }, 100);
    }
  } catch (error) {
    console.error('Error serving frame:', error.message);
    res.status(500).json({ error: 'Failed to serve frame', details: error.message });
  }
});

/**
 * GET /camera/status - Camera server status
 */
app.get('/camera/status', (req, res) => {
  res.json({
    ok: true,
    device_id: DEVICE_ID,
    streaming: isStreaming,
    platform: 'Windows 11',
    camera: 'Windows Webcam',
    codec: isStreaming ? 'MJPEG' : 'Still Images',
    resolution: `${VIDEO_WIDTH}x${VIDEO_HEIGHT}`,
    framerate: FRAME_RATE,
    frames_captured: frameCount,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /camera/start - Start streaming
 */
app.post('/camera/start', (req, res) => {
  startContinuousCapture();
  res.json({ success: true, message: 'Streaming started' });
});

/**
 * POST /camera/stop - Stop streaming
 */
app.post('/camera/stop', (req, res) => {
  stopStream();
  isStreaming = false;
  res.json({ success: true, message: 'Streaming stopped' });
});

/**
 * GET / - Web UI
 */
app.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Windows Webcam Stream</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 20px;
          padding: 30px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 800px;
          width: 100%;
        }
        h1 {
          color: #333;
          text-align: center;
          margin-bottom: 10px;
          font-size: 28px;
        }
        .device-id {
          text-align: center;
          color: #666;
          margin-bottom: 30px;
          font-size: 14px;
        }
        .video-container {
          background: #000;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 20px;
          position: relative;
          min-height: 400px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        #stream {
          max-width: 100%;
          max-height: 500px;
          display: block;
        }
        .controls {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        button {
          flex: 1;
          padding: 15px;
          font-size: 16px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s;
        }
        .btn-start {
          background: #10b981;
          color: white;
        }
        .btn-start:hover { background: #059669; }
        .btn-stop {
          background: #ef4444;
          color: white;
        }
        .btn-stop:hover { background: #dc2626; }
        .status {
          background: #f3f4f6;
          padding: 15px;
          border-radius: 10px;
          font-size: 14px;
          line-height: 1.8;
        }
        .status-label {
          font-weight: 600;
          color: #374151;
        }
        .status-value {
          color: #6b7280;
        }
        .loading {
          color: white;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎥 Windows Webcam Stream</h1>
        <div class="device-id">Device: ${DEVICE_ID}</div>
        
        <div class="video-container">
          <img id="stream" alt="Camera Stream" />
          <div class="loading" id="loading">Loading camera...</div>
        </div>
        
        <div class="controls">
          <button class="btn-start" onclick="startStream()">▶️ Start Stream</button>
          <button class="btn-stop" onclick="stopStream()">⏹️ Stop Stream</button>
        </div>
        
        <div class="status">
          <div><span class="status-label">Status:</span> <span class="status-value" id="status">Idle</span></div>
          <div><span class="status-label">Frames:</span> <span class="status-value" id="frames">0</span></div>
          <div><span class="status-label">Resolution:</span> <span class="status-value">${VIDEO_WIDTH}x${VIDEO_HEIGHT}</span></div>
          <div><span class="status-label">Frame Rate:</span> <span class="status-value">${FRAME_RATE} FPS</span></div>
        </div>
      </div>

      <script>
        let streamInterval = null;
        let isStreaming = false;

        function startStream() {
          if (isStreaming) return;
          
          isStreaming = true;
          document.getElementById('loading').style.display = 'none';
          document.getElementById('stream').style.display = 'block';
          
          // Start streaming on server
          fetch('/camera/start', { method: 'POST' })
            .then(res => res.json())
            .then(data => console.log('Stream started:', data));
          
          // Update frame at specified FPS
          streamInterval = setInterval(updateFrame, ${Math.floor(1000 / FRAME_RATE)});
          updateFrame();
          updateStatus();
        }

        function stopStream() {
          if (!isStreaming) return;
          
          isStreaming = false;
          clearInterval(streamInterval);
          
          // Stop streaming on server
          fetch('/camera/stop', { method: 'POST' })
            .then(res => res.json())
            .then(data => console.log('Stream stopped:', data));
          
          document.getElementById('stream').style.display = 'none';
          document.getElementById('loading').style.display = 'block';
          document.getElementById('loading').textContent = 'Stream stopped';
        }

        function updateFrame() {
          const img = document.getElementById('stream');
          img.src = '/camera/frame?t=' + Date.now();
        }

        function updateStatus() {
          fetch('/camera/status')
            .then(res => res.json())
            .then(data => {
              document.getElementById('status').textContent = data.streaming ? 'Streaming' : 'Idle';
              document.getElementById('frames').textContent = data.frames_captured || 0;
            })
            .catch(err => console.error('Status error:', err));
          
          if (isStreaming) {
            setTimeout(updateStatus, 2000);
          }
        }

        // Auto-start preview
        setTimeout(() => {
          document.getElementById('loading').textContent = 'Click "Start Stream" to begin';
        }, 1000);
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Server running on:');
  console.log(`   - Web UI:        http://localhost:${PORT}`);
  console.log(`   - Camera Frame:  http://localhost:${PORT}/camera/frame`);
  console.log(`   - Status:        http://localhost:${PORT}/camera/status`);
  console.log(`\n📹 Video Device:  ${VIDEO_DEVICE}`);
  console.log(`📐 Resolution:     ${VIDEO_WIDTH}x${VIDEO_HEIGHT}`);
  console.log(`⏱️  Frame Rate:     ${FRAME_RATE} FPS`);
  console.log(`\n💡 To use a different camera, list available devices with:`);
  console.log(`   ffmpeg -list_devices true -f dshow -i dummy`);
  console.log(`\n💡 Then set VIDEO_DEVICE environment variable:`);
  console.log(`   $env:VIDEO_DEVICE='video="Your Camera Name"'; node windows-camera-server.js`);
  console.log('\n⌛ Ready for connections...\n');
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  stopStream();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  stopStream();
  process.exit(0);
});
