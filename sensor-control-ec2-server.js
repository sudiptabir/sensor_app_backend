require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.SENSOR_CONTROL_PORT || 3002);

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
  const apiKey = req.headers['x-api-key'];
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

async function ensureSensorSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sensors (
      sensor_id SERIAL PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      sensor_name VARCHAR(255) NOT NULL,
      sensor_type VARCHAR(64) NOT NULL DEFAULT 'dht11',
      pin_number INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT true,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      CONSTRAINT unique_device_sensor UNIQUE(device_id, sensor_name)
    )
  `);

  // Keep compatibility with older DBs where these columns may be missing.
  await pool.query("ALTER TABLE sensors ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true");
  await pool.query("ALTER TABLE sensors ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true");
  await pool.query("ALTER TABLE sensors ADD COLUMN IF NOT EXISTS pin_number INTEGER");
  await pool.query("ALTER TABLE sensors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_sensors_device_id ON sensors(device_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_sensors_device_pin ON sensors(device_id, pin_number)");
}

/**
 * Register or upsert a sensor record from the Pi side.
 * Protected by device secret + API key.
 */
app.post('/api/sensors/register', requireApiKey, requireDeviceSecret, async (req, res) => {
  try {
    const { deviceId, sensorName, sensorType, pinNumber } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const normalizedPinNumber = pinNumber === undefined || pinNumber === null || pinNumber === ''
      ? null
      : Number(pinNumber);

    if (normalizedPinNumber !== null && (!Number.isInteger(normalizedPinNumber) || normalizedPinNumber < 1 || normalizedPinNumber > 40)) {
      return res.status(400).json({ error: 'pinNumber must be an integer between 1 and 40' });
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
      INSERT INTO sensors (device_id, sensor_name, sensor_type, pin_number, is_active, enabled, created_at, updated_at)
      VALUES ($1, $2, $3, $4, true, true, NOW(), NOW())
      ON CONFLICT (device_id, sensor_name)
      DO UPDATE SET
        sensor_type = EXCLUDED.sensor_type,
        pin_number = COALESCE(EXCLUDED.pin_number, sensors.pin_number),
        is_active = true,
        updated_at = NOW()
      RETURNING sensor_id, device_id, sensor_name, sensor_type, pin_number, enabled, is_active, created_at, updated_at
      `,
      [
        deviceId,
        sensorName || 'DHT11 Sensor',
        sensorType || 'dht11',
        normalizedPinNumber,
      ]
    );

    return res.json({
      success: true,
      message: 'Sensor registered successfully',
      sensor: result.rows[0],
    });
  } catch (error) {
    console.error('Sensor register error:', error);
    return res.status(500).json({ error: 'Failed to register sensor', message: error.message });
  }
});

/**
 * Dynamically create a sensor from app side using label + pin number.
 */
app.post('/api/sensors', requireApiKey, async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { deviceId, sensorName, pinNumber, sensorType } = req.body || {};

    if (!userId) {
      return res.status(401).json({ error: 'x-user-id header is required' });
    }

    if (!deviceId || `${deviceId}`.trim() === '') {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const normalizedName = `${sensorName || ''}`.trim();
    if (!normalizedName) {
      return res.status(400).json({ error: 'sensorName is required' });
    }

    const normalizedPinNumber = Number(pinNumber);
    if (!Number.isInteger(normalizedPinNumber) || normalizedPinNumber < 1 || normalizedPinNumber > 40) {
      return res.status(400).json({ error: 'pinNumber must be an integer between 1 and 40' });
    }

    const userResult = await pool.query(
      'SELECT user_id, is_blocked FROM app_users WHERE user_id = $1',
      [userId]
    );

    if (userResult.rows.length > 0 && userResult.rows[0].is_blocked === true) {
      return res.status(403).json({ error: 'Access denied', reason: 'User is blocked' });
    }

    const deviceResult = await pool.query(
      'SELECT device_id, is_active FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (deviceResult.rows[0].is_active !== true) {
      return res.status(403).json({ error: 'Access denied', reason: 'Device is blocked' });
    }

    const pinInUseResult = await pool.query(
      `
      SELECT sensor_id, sensor_name
      FROM sensors
      WHERE device_id = $1 AND pin_number = $2 AND is_active = true
      LIMIT 1
      `,
      [deviceId, normalizedPinNumber]
    );

    if (pinInUseResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Pin already assigned',
        reason: `Pin ${normalizedPinNumber} is already used by ${pinInUseResult.rows[0].sensor_name}`,
      });
    }

    const result = await pool.query(
      `
      INSERT INTO sensors (device_id, sensor_name, sensor_type, pin_number, is_active, enabled, created_at, updated_at)
      VALUES ($1, $2, $3, $4, true, true, NOW(), NOW())
      ON CONFLICT (device_id, sensor_name)
      DO UPDATE SET
        sensor_type = EXCLUDED.sensor_type,
        pin_number = EXCLUDED.pin_number,
        is_active = true,
        enabled = true,
        updated_at = NOW()
      RETURNING sensor_id, device_id, sensor_name, sensor_type, pin_number, enabled, is_active, created_at, updated_at
      `,
      [deviceId, normalizedName, sensorType || 'gpio', normalizedPinNumber]
    );

    return res.status(201).json({
      success: true,
      message: 'Sensor added successfully',
      sensor: result.rows[0],
    });
  } catch (error) {
    console.error('Create sensor error:', error);
    return res.status(500).json({ error: 'Failed to create sensor', message: error.message });
  }
});

/**
 * List sensors. Optional filter by deviceId.
 */
app.get('/api/sensors', requireApiKey, async (req, res) => {
  try {
    const { deviceId } = req.query;

    let query = `
      SELECT sensor_id, device_id, sensor_name, sensor_type, pin_number, enabled, is_active, created_at, updated_at
      FROM sensors
      WHERE is_active = true
    `;
    const params = [];

    if (deviceId) {
      params.push(deviceId);
      query += ` AND device_id = $${params.length}`;
    }

    query += ' ORDER BY sensor_id ASC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Get sensors error:', error);
    return res.status(500).json({ error: 'Failed to fetch sensors', message: error.message });
  }
});

/**
 * Toggle sensor enabled state from app.
 * Only control command/state is handled (no sensor data ingestion).
 */
app.put('/api/sensors/:sensorId/state', requireApiKey, async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { enabled } = req.body;
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'x-user-id header is required' });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const userResult = await pool.query(
      'SELECT user_id, is_blocked FROM app_users WHERE user_id = $1',
      [userId]
    );

    if (userResult.rows.length > 0 && userResult.rows[0].is_blocked === true) {
      return res.status(403).json({
        error: 'Access denied',
        reason: 'User is blocked',
      });
    }

    const sensorResult = await pool.query(
      `
      SELECT s.sensor_id, s.device_id, s.sensor_name, s.sensor_type, s.pin_number, s.enabled, d.is_active AS device_active
      FROM sensors s
      JOIN devices d ON d.device_id = s.device_id
      WHERE s.sensor_id = $1
      `,
      [sensorId]
    );

    if (sensorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    if (sensorResult.rows[0].device_active !== true) {
      return res.status(403).json({
        error: 'Access denied',
        reason: 'Device is restricted',
      });
    }

    const updateResult = await pool.query(
      `
      UPDATE sensors
      SET enabled = $1,
          updated_at = NOW()
      WHERE sensor_id = $2
      RETURNING sensor_id, device_id, sensor_name, sensor_type, pin_number, enabled, is_active, created_at, updated_at
      `,
      [enabled, sensorId]
    );

    return res.json({
      success: true,
      message: `Sensor ${enabled ? 'enabled' : 'disabled'}`,
      sensor: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Update sensor state error:', error);
    return res.status(500).json({ error: 'Failed to update sensor state', message: error.message });
  }
});

/**
 * Soft-delete a sensor from app.
 * Marks sensor inactive and disabled so historical records remain intact.
 */
app.delete('/api/sensors/:sensorId', requireApiKey, async (req, res) => {
  try {
    const { sensorId } = req.params;
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'x-user-id header is required' });
    }

    const userResult = await pool.query(
      'SELECT user_id, is_blocked FROM app_users WHERE user_id = $1',
      [userId]
    );

    if (userResult.rows.length > 0 && userResult.rows[0].is_blocked === true) {
      return res.status(403).json({
        error: 'Access denied',
        reason: 'User is blocked',
      });
    }

    const sensorResult = await pool.query(
      `
      SELECT s.sensor_id, s.device_id, s.sensor_name, s.sensor_type, s.pin_number, s.enabled, s.is_active, d.is_active AS device_active
      FROM sensors s
      JOIN devices d ON d.device_id = s.device_id
      WHERE s.sensor_id = $1 AND s.is_active = true
      `,
      [sensorId]
    );

    if (sensorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    if (sensorResult.rows[0].device_active !== true) {
      return res.status(403).json({
        error: 'Access denied',
        reason: 'Device is restricted',
      });
    }

    const deleteResult = await pool.query(
      `
      UPDATE sensors
      SET is_active = false,
          enabled = false,
          updated_at = NOW()
      WHERE sensor_id = $1
      RETURNING sensor_id, device_id, sensor_name, sensor_type, pin_number, enabled, is_active, created_at, updated_at
      `,
      [sensorId]
    );

    return res.json({
      success: true,
      message: 'Sensor deleted successfully',
      sensor: deleteResult.rows[0],
    });
  } catch (error) {
    console.error('Delete sensor error:', error);
    return res.status(500).json({ error: 'Failed to delete sensor', message: error.message });
  }
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'healthy', service: 'sensor-control-api' });
  } catch (error) {
    return res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

async function start() {
  try {
    await ensureSensorSchema();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Sensor Control API running on http://0.0.0.0:${PORT}`);
      console.log('Routes: /api/sensors, /api/sensors/register, /api/sensors/:sensorId/state, /api/sensors/:sensorId, /health');
    });
  } catch (error) {
    console.error('Failed to start sensor-control server:', error);
    process.exit(1);
  }
}

start();

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
