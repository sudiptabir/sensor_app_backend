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

app.get('/health', async (req, res) => {
  try {
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
