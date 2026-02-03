/**
 * HLS Camera Streaming Server for Windows Laptop
 * Converts webcam to HLS stream for smooth playback in React Native
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const VIDEO_DEVICE = 'Integrated Camera';
const HLS_DIR = path.join(__dirname, 'hls_stream');

// Enable CORS for React Native app
app.use(cors());
app.use(express.json());

// Serve HLS files
app.use('/hls', express.static(HLS_DIR));

// Create HLS directory
if (!fs.existsSync(HLS_DIR)) {
  fs.mkdirSync(HLS_DIR, { recursive: true });
}

let ffmpegProcess = null;

// Start HLS streaming
function startHLSStream() {
  console.log('\n📹 Starting HLS stream...');
  
  // FFmpeg command for HLS streaming
  const ffmpegArgs = [
    '-f', 'dshow',
    '-video_size', '640x480',
    '-framerate', '30',
    '-i', `video=${VIDEO_DEVICE}`,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-g', '30',  // Keyframe every second
    '-sc_threshold', '0',
    '-b:v', '1500k',
    '-maxrate', '1500k',
    '-bufsize', '3000k',
    '-f', 'hls',
    '-hls_time', '1',           // 1 second segments
    '-hls_list_size', '3',      // Keep last 3 segments
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', path.join(HLS_DIR, 'segment_%03d.ts'),
    path.join(HLS_DIR, 'stream.m3u8')
  ];

  ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

  ffmpegProcess.stdout.on('data', (data) => {
    // Suppress verbose output
  });

  ffmpegProcess.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('frame=')) {
      // Log frame progress occasionally
      if (Math.random() < 0.05) {
        console.log('📺 Streaming...');
      }
    }
  });

  ffmpegProcess.on('close', (code) => {
    console.log(`⚠️ FFmpeg process exited with code ${code}`);
    // Auto-restart on crash
    setTimeout(() => {
      console.log('🔄 Restarting stream...');
      startHLSStream();
    }, 2000);
  });

  ffmpegProcess.on('error', (err) => {
    console.error('❌ FFmpeg error:', err.message);
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  const streamExists = fs.existsSync(path.join(HLS_DIR, 'stream.m3u8'));
  res.json({
    status: 'ok',
    streaming: streamExists,
    streamUrl: `http://${req.hostname}:${PORT}/hls/stream.m3u8`
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       🎥 HLS Camera Streaming Server                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Server running on:`);
  console.log(`   - HLS Stream:  http://localhost:${PORT}/hls/stream.m3u8`);
  console.log(`   - Health:      http://localhost:${PORT}/health\n`);
  console.log(`📹 Camera: ${VIDEO_DEVICE}`);
  console.log(`📐 Resolution: 640x480@30fps`);
  console.log(`📁 HLS Output: ${HLS_DIR}\n`);
  
  // Start streaming
  startHLSStream();
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGTERM');
  }
  // Clean up HLS files
  if (fs.existsSync(HLS_DIR)) {
    fs.rmSync(HLS_DIR, { recursive: true, force: true });
  }
  process.exit(0);
});
