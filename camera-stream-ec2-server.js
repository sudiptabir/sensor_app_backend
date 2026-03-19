require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Readable } = require('stream');

const app = express();
const PORT = Number(process.env.CAMERA_STREAM_PORT || 3003);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'sensor_db',
  user: process.env.DB_USER || 'sensor_admin',
  password: process.env.DB_PASSWORD || 'sensor_admin_pass123',
});

app.use(cors());
app.use(express.json());

function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const expectedApiKey = process.env.API_KEY;

  if (!expectedApiKey) {
    return res.status(503).json({ error: 'API key not configured on server' });
  }

  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  return next();
}

function requireDeviceSecret(req, res, next) {
  const providedSecret = req.headers['x-device-secret'];
  const expectedSecret = process.env.DEVICE_REGISTRATION_SECRET;

  if (!expectedSecret) {
    return res.status(503).json({ error: 'Device secret not configured on server' });
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Invalid device secret' });
  }

  return next();
}

function getRequestUserId(req) {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    return '';
  }

  if (Array.isArray(userId)) {
    return String(userId[0] || '').trim();
  }

  return String(userId).trim();
}

async function validateViewAccess(userId, deviceId) {
  const userResult = await pool.query(
    'SELECT user_id, is_blocked FROM app_users WHERE user_id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return { ok: false, status: 403, error: 'Access denied', reason: 'User is not registered in admin portal' };
  }

  if (userResult.rows[0].is_blocked === true) {
    return { ok: false, status: 403, error: 'Access denied', reason: 'User is blocked' };
  }

  const deviceResult = await pool.query(
    'SELECT device_id, is_active FROM devices WHERE device_id = $1',
    [deviceId]
  );

  if (deviceResult.rows.length === 0) {
    return { ok: false, status: 404, error: 'Device not found' };
  }

  if (deviceResult.rows[0].is_active !== true) {
    return { ok: false, status: 403, error: 'Access denied', reason: 'Device is blocked' };
  }

  return { ok: true };
}

async function requireCameraViewAccess(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'x-user-id header or userId query parameter is required' });
    }

    const { deviceId } = req.params;
    const access = await validateViewAccess(userId, deviceId);
    if (!access.ok) {
      return res.status(access.status).json({
        error: access.error,
        ...(access.reason ? { reason: access.reason } : {}),
      });
    }

    req.viewerUserId = userId;
    return next();
  } catch (error) {
    console.error('Camera access check error:', error);
    return res.status(500).json({ error: 'Failed to validate camera access', message: error.message });
  }
}

async function ensureCameraSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_camera_streams (
      device_id VARCHAR(255) PRIMARY KEY,
      stream_url TEXT NOT NULL,
      frame_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query('ALTER TABLE device_camera_streams ADD COLUMN IF NOT EXISTS frame_url TEXT');
  await pool.query('ALTER TABLE device_camera_streams ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true');
  await pool.query('ALTER TABLE device_camera_streams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()');
  await pool.query('CREATE INDEX IF NOT EXISTS ix_camera_streams_active ON device_camera_streams(is_active)');
}

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return `http://${trimmed}`;
  }

  return trimmed;
}

function deriveFrameUrl(streamUrl) {
  if (!streamUrl) {
    return null;
  }

  if (streamUrl.endsWith('/stream.mjpeg')) {
    return `${streamUrl.slice(0, -'/stream.mjpeg'.length)}/frame.jpg`;
  }

  return null;
}

async function getCameraSource(deviceId) {
  const result = await pool.query(
    `
    SELECT device_id, stream_url, frame_url, is_active, updated_at
    FROM device_camera_streams
    WHERE device_id = $1 AND is_active = true
    LIMIT 1
    `,
    [deviceId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

app.post('/api/camera/register', requireApiKey, requireDeviceSecret, async (req, res) => {
  try {
    const { deviceId, streamUrl, frameUrl } = req.body || {};

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const normalizedStreamUrl = normalizeUrl(streamUrl);
    const normalizedFrameUrl = normalizeUrl(frameUrl);

    if (!normalizedStreamUrl) {
      return res.status(400).json({ error: 'streamUrl is required' });
    }

    const deviceCheck = await pool.query(
      'SELECT device_id, is_active FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const result = await pool.query(
      `
      INSERT INTO device_camera_streams (device_id, stream_url, frame_url, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, true, NOW(), NOW())
      ON CONFLICT (device_id)
      DO UPDATE SET
        stream_url = EXCLUDED.stream_url,
        frame_url = EXCLUDED.frame_url,
        is_active = true,
        updated_at = NOW()
      RETURNING device_id, stream_url, frame_url, is_active, updated_at
      `,
      [deviceId, normalizedStreamUrl, normalizedFrameUrl || null]
    );

    return res.json({
      success: true,
      message: 'Camera stream registered successfully',
      camera: result.rows[0],
    });
  } catch (error) {
    console.error('Camera register error:', error);
    return res.status(500).json({ error: 'Failed to register camera stream', message: error.message });
  }
});

app.get('/api/camera/device/:deviceId', requireApiKey, requireCameraViewAccess, async (req, res) => {
  try {
    const source = await getCameraSource(req.params.deviceId);

    if (!source) {
      return res.status(404).json({ error: 'Camera stream not registered for this device' });
    }

    return res.json({
      deviceId: source.device_id,
      streamUrl: source.stream_url,
      frameUrl: source.frame_url || deriveFrameUrl(source.stream_url),
      isActive: source.is_active,
      updatedAt: source.updated_at,
    });
  } catch (error) {
    console.error('Camera metadata error:', error);
    return res.status(500).json({ error: 'Failed to fetch camera metadata', message: error.message });
  }
});

app.get('/api/camera/:deviceId/frame.jpg', requireApiKey, requireCameraViewAccess, async (req, res) => {
  try {
    const source = await getCameraSource(req.params.deviceId);

    if (!source) {
      return res.status(404).json({ error: 'Camera stream not registered for this device' });
    }

    const frameUrl = source.frame_url || deriveFrameUrl(source.stream_url);
    if (!frameUrl) {
      return res.status(400).json({ error: 'frameUrl is not configured for this device' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let upstream;
    try {
      upstream = await fetch(frameUrl, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Accept: 'image/jpeg,*/*',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      return res.status(502).json({
        error: 'Upstream camera frame fetch failed',
        status: upstream.status,
      });
    }

    const frameBuffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Content-Length', String(frameBuffer.length));
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).end(frameBuffer);
  } catch (error) {
    const message = error && error.name === 'AbortError'
      ? 'Camera frame request timed out'
      : error.message;

    console.error('Camera frame proxy error:', message);
    return res.status(502).json({ error: 'Failed to proxy camera frame', message });
  }
});

app.get('/api/camera/:deviceId/stream.mjpeg', requireApiKey, requireCameraViewAccess, async (req, res) => {
  try {
    const source = await getCameraSource(req.params.deviceId);

    if (!source) {
      return res.status(404).json({ error: 'Camera stream not registered for this device' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let upstream;
    try {
      upstream = await fetch(source.stream_url, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Accept: 'multipart/x-mixed-replace,image/jpeg,*/*',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok || !upstream.body) {
      return res.status(502).json({
        error: 'Upstream camera stream fetch failed',
        status: upstream.status,
      });
    }

    res.status(200);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'multipart/x-mixed-replace; boundary=BOUNDARY');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const bodyStream = Readable.fromWeb(upstream.body);

    req.on('close', () => {
      controller.abort();
      bodyStream.destroy();
    });

    bodyStream.on('error', (streamErr) => {
      console.error('Upstream MJPEG stream error:', streamErr.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Camera stream interrupted' });
      } else {
        res.end();
      }
    });

    bodyStream.pipe(res);
    return;
  } catch (error) {
    const message = error && error.name === 'AbortError'
      ? 'Camera stream request timed out'
      : error.message;

    console.error('Camera stream proxy error:', message);
    return res.status(502).json({ error: 'Failed to proxy camera stream', message });
  }
});

// WebRTC viewer page — opens in Chrome, streams via WebRTC from Pi
app.get('/api/camera/:deviceId/webrtc', requireApiKey, requireCameraViewAccess, async (req, res) => {
  const deviceId = req.params.deviceId;

  // Firebase web SDK config — these are safe to expose in client HTML (same as Firebase docs)
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_WEB_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'rutag-app.firebaseapp.com',
    databaseURL: process.env.FIREBASE_DB_URL || 'https://rutag-app-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: process.env.FIREBASE_PROJECT_ID || 'rutag-app',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'rutag-app.appspot.com',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WebRTC Live Stream — ${deviceId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0d0d0d;
      color: #e0e0e0;
      font-family: 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      min-height: 100dvh;
      padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
    }
    h1 { font-size: clamp(1rem, 3.6vw, 1.3rem); margin-bottom: 6px; color: #4ade80; }
    .device-id { font-size: clamp(0.72rem, 2.6vw, 0.82rem); color: #6b7280; margin-bottom: 12px; }
    #video-container {
      position: relative;
      width: min(100%, 1120px);
      max-width: 1120px;
      background: #111;
      border-radius: 16px;
      overflow: hidden;
      aspect-ratio: 16/9;
      border: 2px solid #1f2937;
      height: min(calc((100vw - 24px) * 9 / 16), calc(100dvh - 170px));
      min-height: 240px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    }
    #remoteVideo {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    #overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.75);
      transition: opacity 0.4s;
    }
    #overlay.hidden { opacity: 0; pointer-events: none; }
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid #374151;
      border-top-color: #4ade80;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
      margin-bottom: 14px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #status { font-size: 0.95rem; color: #9ca3af; text-align: center; padding: 0 20px; }
    #error-box {
      display: none;
      background: #7f1d1d;
      color: #fca5a5;
      border-radius: 8px;
      padding: 14px 20px;
      margin-top: 16px;
      max-width: 1120px;
      width: min(100%, 1120px);
      font-size: 0.9rem;
    }
    #player-controls {
      margin-top: 10px;
      max-width: 1120px;
      width: min(100%, 1120px);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .control-btn {
      border: 1px solid #374151;
      background: #111827;
      color: #e5e7eb;
      border-radius: 10px;
      padding: 8px 14px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s ease, border-color 0.2s ease;
    }
    .control-btn:hover {
      background: #1f2937;
      border-color: #4b5563;
    }
    #info-bar {
      margin-top: 12px;
      font-size: 0.78rem;
      color: #4b5563;
      max-width: 1120px;
      width: min(100%, 1120px);
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .badge {
      background: #1f2937;
      border-radius: 6px;
      padding: 4px 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #374151; }
    .dot.green { background: #4ade80; }
    .dot.yellow { background: #fbbf24; }
    @media (max-width: 768px) {
      body {
        justify-content: flex-start;
      }
      #video-container {
        width: 100%;
        height: min(calc((100vw - 24px) * 9 / 16), calc(100dvh - 140px));
        border-radius: 14px;
      }
      #status {
        font-size: 0.88rem;
      }
      .badge {
        font-size: 0.74rem;
      }
      #player-controls {
        justify-content: center;
      }
      .control-btn {
        width: 100%;
        max-width: 300px;
      }
    }
    @media (max-width: 768px) and (orientation: landscape) {
      body {
        padding-top: max(8px, env(safe-area-inset-top));
        padding-bottom: max(8px, env(safe-area-inset-bottom));
      }
      h1, .device-id {
        margin-bottom: 6px;
      }
      #video-container {
        width: min(calc((100dvh - 84px) * 16 / 9), 100%);
        height: calc(100dvh - 84px);
        max-width: none;
      }
      #info-bar {
        margin-top: 8px;
      }
    }
  </style>
</head>
<body>
  <h1>📹 WebRTC Live Stream</h1>
  <div class="device-id">Device: ${deviceId}</div>

  <div id="video-container">
    <video id="remoteVideo" autoplay playsinline muted></video>
    <div id="overlay">
      <div class="spinner"></div>
      <div id="status">Connecting to device…</div>
    </div>
  </div>

  <div id="player-controls">
    <button id="fullscreen-btn" class="control-btn" type="button">Fullscreen</button>
  </div>

  <div id="error-box"></div>

  <div id="info-bar">
    <div class="badge"><div class="dot" id="conn-dot"></div><span id="conn-label">Disconnected</span></div>
    <div class="badge"><div class="dot" id="ice-dot"></div><span id="ice-label">ICE: —</span></div>
    <div class="badge" id="resolution-badge" style="display:none"><span id="resolution-label"></span></div>
  </div>

  <!-- Firebase App + RTDB SDK (compat) -->
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>

  <script>
    const DEVICE_ID = ${JSON.stringify(deviceId)};
    const FB_CONFIG = ${JSON.stringify(firebaseConfig)};

    const statusEl = document.getElementById('status');
    const overlayEl = document.getElementById('overlay');
    const errorBoxEl = document.getElementById('error-box');
    const connDot = document.getElementById('conn-dot');
    const connLabel = document.getElementById('conn-label');
    const iceDot = document.getElementById('ice-dot');
    const iceLabel = document.getElementById('ice-label');
    const resolutionBadge = document.getElementById('resolution-badge');
    const resolutionLabel = document.getElementById('resolution-label');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const videoContainer = document.getElementById('video-container');
    const remoteVideo = document.getElementById('remoteVideo');

    function isFullscreenActive() {
      return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    }

    function updateFullscreenButtonLabel() {
      fullscreenBtn.textContent = isFullscreenActive() ? 'Exit Fullscreen' : 'Fullscreen';
    }

    async function toggleFullscreen() {
      try {
        if (!isFullscreenActive()) {
          if (videoContainer.requestFullscreen) {
            await videoContainer.requestFullscreen();
          } else if (videoContainer.webkitRequestFullscreen) {
            videoContainer.webkitRequestFullscreen();
          } else if (remoteVideo.webkitEnterFullscreen) {
            remoteVideo.webkitEnterFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        }
      } catch (err) {
        console.warn('Fullscreen toggle failed:', err);
      }
      updateFullscreenButtonLabel();
    }

    fullscreenBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', updateFullscreenButtonLabel);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButtonLabel);
    updateFullscreenButtonLabel();

    function setStatus(msg) { statusEl.textContent = msg; }
    function showError(msg) {
      errorBoxEl.style.display = 'block';
      errorBoxEl.textContent = '⚠️ ' + msg;
      setStatus('Connection failed.');
    }
    function setConnState(state) {
      const isConnected = state === 'connected';
      connDot.className = 'dot ' + (isConnected ? 'green' : state === 'connecting' ? 'yellow' : '');
      connLabel.textContent = state.charAt(0).toUpperCase() + state.slice(1);
      if (isConnected) overlayEl.classList.add('hidden');
    }

    firebase.initializeApp(FB_CONFIG);
    const db = firebase.database();

    const ICE_SERVERS = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ];

    async function startWebRTC() {
      try {
        // 1. Check if device is ready
        setStatus('Checking device status…');
        const statusSnap = await db.ref('device_status/' + DEVICE_ID).once('value');
        const deviceStatus = statusSnap.val();
        if (!deviceStatus || !deviceStatus.webrtcReady) {
          showError('Device is not ready for WebRTC. Make sure webrtc-browser-stream-server.js is running on the Pi.');
          return;
        }

        // 2. Create session in Firebase
        setStatus('Creating session…');
        const sessionId = DEVICE_ID + '_' + Date.now();
        const sessionRef = db.ref('webrtc_sessions/' + sessionId);

        await sessionRef.set({
          deviceId: DEVICE_ID,
          clientType: 'browser',
          createdAt: Date.now(),
          status: 'waiting_for_offer',
        });

        // Clean up session when page closes
        window.addEventListener('beforeunload', () => {
          sessionRef.remove().catch(() => {});
        });

        // 3. Create RTCPeerConnection
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onconnectionstatechange = () => setConnState(pc.connectionState);
        pc.oniceconnectionstatechange = () => {
          iceDot.className = 'dot ' + (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed' ? 'green' : pc.iceConnectionState === 'checking' ? 'yellow' : '');
          iceLabel.textContent = 'ICE: ' + pc.iceConnectionState;
        };

        // Show video when track arrives
        pc.ontrack = async (event) => {
          const video = remoteVideo;
          const inboundStream = event.streams && event.streams[0]
            ? event.streams[0]
            : new MediaStream([event.track]);

          if (video.srcObject !== inboundStream) {
            video.srcObject = inboundStream;
          }

          const updateResolution = () => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              resolutionLabel.textContent = video.videoWidth + '×' + video.videoHeight;
              resolutionBadge.style.display = 'flex';
              overlayEl.classList.add('hidden');
              setStatus('Live video connected.');
            }
          };

          video.onloadedmetadata = updateResolution;
          video.onresize = updateResolution;

          try {
            await video.play();
          } catch (_) {
            // Ignore autoplay edge cases; metadata/resize hooks still update UI.
          }
        };

        // Receive video track (transceivers for one-way video from Pi)
        pc.addTransceiver('video', { direction: 'recvonly' });

        // Send ICE candidates to Firebase as they're gathered
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sessionRef.child('ice_candidates').push({
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
              from: 'browser',
              timestamp: Date.now(),
            }).catch(() => {});
          }
        };

        // 4. Create offer
        setStatus('Creating WebRTC offer…');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await sessionRef.child('offer').set({
          type: 'offer',
          data: { sdp: offer.sdp, type: offer.type },
          from: 'browser',
          timestamp: Date.now(),
        });

        // 5. Wait for answer from Pi (poll every 500ms, timeout 30s)
        setStatus('Waiting for Pi to answer…');
        const answer = await waitForValue(sessionRef.child('answer'), 30000, 500);
        if (!answer || !answer.data) {
          showError('Pi did not respond within 30 seconds. Make sure the Pi WebRTC server is running.');
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(answer.data));
        setStatus('Answer received, exchanging ICE candidates…');

        // 6. Listen for ICE candidates from Pi
        const seenCandidates = new Set();
        sessionRef.child('ice_candidates_from_pi').on('child_added', async (snap) => {
          const cand = snap.val();
          const key = snap.key;
          if (!cand || seenCandidates.has(key)) return;
          seenCandidates.add(key);
          try {
            await pc.addIceCandidate(new RTCIceCandidate({
              candidate: cand.candidate,
              sdpMLineIndex: cand.sdpMLineIndex,
              sdpMid: cand.sdpMid,
            }));
          } catch (e) { /* ignore stale candidates */ }
        });

      } catch (err) {
        console.error('WebRTC error:', err);
        showError(err.message || 'Unknown error occurred.');
      }
    }

    // Poll a Firebase ref until it has a value
    function waitForValue(ref, timeoutMs, intervalMs) {
      return new Promise((resolve) => {
        const start = Date.now();
        const poll = setInterval(async () => {
          try {
            const snap = await ref.once('value');
            if (snap.exists()) {
              clearInterval(poll);
              resolve(snap.val());
            } else if (Date.now() - start > timeoutMs) {
              clearInterval(poll);
              resolve(null);
            }
          } catch (_) {
            clearInterval(poll);
            resolve(null);
          }
        }, intervalMs);
      });
    }

    startWebRTC();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).end(html);
});

app.get('/health', async (req, res) => {  try {
    await pool.query('SELECT 1');
    return res.json({
      status: 'healthy',
      service: 'camera-stream-api',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      status: 'unhealthy',
      service: 'camera-stream-api',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

async function startServer() {
  try {
    await ensureCameraSchema();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Camera Stream API listening on port ${PORT}`);
      console.log('Routes: /api/camera/register, /api/camera/device/:deviceId, /api/camera/:deviceId/frame.jpg, /api/camera/:deviceId/stream.mjpeg, /health');
    });
  } catch (error) {
    console.error('Failed to start camera stream API:', error);
    process.exit(1);
  }
}

startServer();
