const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Device info
const DEVICE_ID = '8f4735de-1b38-4a1d-9875-c319fb48edd7';
let isStreaming = false;
let streamClient = null;

// H.264 video streaming endpoint
app.get('/camera/stream', (req, res) => {
  console.log('📹 New H.264 stream client connected');
  
  // Set response headers for H.264 raw video stream
  res.writeHead(200, {
    'Content-Type': 'video/h264',
    'Connection': 'close',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  });

  // Start rpicam-vid if not already streaming
  if (!isStreaming) {
    isStreaming = true;
    streamClient = res;

    // rpicam-vid output to stdout, then pipe to client
    const proc = spawn('/usr/bin/rpicam-vid', [
      '--width', '640',
      '--height', '480',
      '--framerate', '30',
      '--bitrate', '2000000',  // 2 Mbps
      '--timeout', '0',         // infinite
      '--codec', 'h264',
      '-o', '-'                 // output to stdout
    ]);

    console.log('✅ rpicam-vid started with H.264 encoding');

    // Pipe video stream to client
    proc.stdout.pipe(res);

    // Handle client disconnect
    req.on('close', () => {
      console.log('❌ Stream client disconnected');
      proc.kill();
      isStreaming = false;
      streamClient = null;
    });

    // Handle errors
    proc.on('error', (err) => {
      console.error('❌ rpicam-vid error:', err.message);
      isStreaming = false;
      streamClient = null;
    });

    proc.stderr.on('data', (data) => {
      console.log('rpicam-vid:', data.toString().trim());
    });

    proc.on('close', () => {
      console.log('⚠️ rpicam-vid process closed');
      isStreaming = false;
      streamClient = null;
    });
  } else {
    // Stream already active, pipe to new client
    console.log('⚠️ Stream already active, new client waiting...');
    res.end();
  }
});

// Still image endpoint (captures single frame from H.264 stream if needed)
app.get('/camera/frame', (req, res) => {
  console.log('📸 Still frame requested');
  
  // Capture single frame using rpicam-still
  const tempPath = `/tmp/frame_${Date.now()}.jpg`;
  const proc = spawn('/usr/bin/rpicam-still', [
    '-o', tempPath,
    '--width', '640',
    '--height', '480',
    '--quality', '80'
  ]);

  const timeout = setTimeout(() => {
    proc.kill();
    res.status(500).json({ ok: false, error: 'Capture timeout' });
  }, 30000);

  proc.on('close', () => {
    clearTimeout(timeout);
    try {
      if (fs.existsSync(tempPath)) {
        const frame = fs.readFileSync(tempPath);
        res.setHeader('Content-Type', 'image/jpeg');
        res.send(frame);
        fs.unlinkSync(tempPath);
        console.log(`✅ Frame: ${frame.length} bytes`);
      } else {
        res.status(500).json({ ok: false, error: 'Frame not created' });
      }
    } catch (e) {
      console.error('❌ Frame error:', e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  proc.on('error', (err) => {
    clearTimeout(timeout);
    console.error('❌ Capture error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  });
});

// Status endpoint
app.get('/camera/status', (req, res) => {
  res.json({
    ok: true,
    device_id: DEVICE_ID,
    streaming: isStreaming,
    codec: 'H.264',
    resolution: '640x480',
    framerate: 30,
    bitrate: '2 Mbps',
    timestamp: new Date().toISOString()
  });
});

// Web UI for H.264 streaming
app.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pi Camera - H.264 Streaming</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: #f0f0f0;
        }
        .container {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #333; }
        .info { color: #666; font-size: 14px; margin: 10px 0; }
        .status {
          padding: 10px;
          margin: 10px 0;
          border-radius: 4px;
          background: #e8f5e9;
          border-left: 4px solid #4caf50;
        }
        .status.streaming { background: #fff3e0; border-left-color: #ff9800; }
        button {
          background: #2196F3;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          margin: 5px 0;
        }
        button:hover { background: #1976D2; }
        .video-container {
          margin: 20px 0;
          text-align: center;
          background: #000;
          border-radius: 4px;
          padding: 10px;
          min-height: 400px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        video {
          max-width: 100%;
          max-height: 500px;
          border-radius: 4px;
        }
        .controls {
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎥 Pi Camera - H.264 Streaming</h1>
        <div class="info">Device ID: ${DEVICE_ID}</div>
        <div class="info">Codec: H.264 (better compression, lower bandwidth)</div>
        <div class="info">Resolution: 640×480 @ 30 fps</div>
        
        <div class="status" id="statusBox">
          <strong>Status:</strong> <span id="statusText">Loading...</span>
        </div>

        <div class="controls">
          <button onclick="startStream()">▶ Start H.264 Stream</button>
          <button onclick="stopStream()">⏹ Stop Stream</button>
          <button onclick="refreshStatus()">🔄 Refresh Status</button>
        </div>

        <div class="video-container" id="videoContainer">
          <p style="color: #999;">Video will appear here when streaming</p>
          <video id="videoStream" controls></video>
        </div>
      </div>

      <script>
        let mediaSource = null;
        let sourceBuffer = null;
        let isPlaying = false;

        async function startStream() {
          console.log('Starting H.264 stream...');
          const video = document.getElementById('videoStream');
          
          try {
            // Create MediaSource for H.264 video
            if ('MediaSource' in window) {
              mediaSource = new MediaSource();
              video.src = URL.createObjectURL(mediaSource);
              
              mediaSource.addEventListener('sourceopen', async () => {
                sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
                
                // Fetch H.264 stream
                const response = await fetch('/camera/stream');
                const reader = response.body.getReader();
                
                isPlaying = true;
                document.getElementById('statusText').textContent = '▶ Streaming...';
                document.getElementById('statusBox').className = 'status streaming';
                
                while (isPlaying) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  try {
                    sourceBuffer.appendBuffer(value);
                  } catch (e) {
                    console.error('Buffer error:', e);
                  }
                }
              });
            } else {
              alert('MediaSource not supported. Try a modern browser.');
            }
          } catch (err) {
            console.error('Stream error:', err);
            document.getElementById('statusText').textContent = '❌ Stream failed: ' + err.message;
          }
        }

        function stopStream() {
          console.log('Stopping stream...');
          isPlaying = false;
          const video = document.getElementById('videoStream');
          video.pause();
          video.src = '';
          if (mediaSource) {
            mediaSource.endOfStream();
          }
          document.getElementById('statusText').textContent = 'Stopped';
          document.getElementById('statusBox').className = 'status';
        }

        async function refreshStatus() {
          try {
            const response = await fetch('/camera/status');
            const data = await response.json();
            console.log('Status:', data);
            
            if (data.streaming) {
              document.getElementById('statusText').textContent = '▶ Streaming active';
              document.getElementById('statusBox').className = 'status streaming';
            } else {
              document.getElementById('statusText').textContent = '⏸ Not streaming';
              document.getElementById('statusBox').className = 'status';
            }
          } catch (err) {
            console.error('Status error:', err);
          }
        }

        // Refresh status on load
        refreshStatus();
        
        // Auto-refresh status every 5 seconds
        setInterval(refreshStatus, 5000);
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         🎥 Pi Camera - H.264 Streaming Server             ║
║                 Device: ${DEVICE_ID}                ║
╚════════════════════════════════════════════════════════════╝

✅ Server running on:
   - Web UI:        http://192.168.132.207:${PORT}
   - H.264 Stream:  http://192.168.132.207:${PORT}/camera/stream
   - Still Frame:   http://192.168.132.207:${PORT}/camera/frame
   - Status JSON:   http://192.168.132.207:${PORT}/camera/status

📡 Codec: H.264 (2 Mbps, 30 fps, 640×480)
⏱️  Startup: ${new Date().toISOString()}
  `);
});
