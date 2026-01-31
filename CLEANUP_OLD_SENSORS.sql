-- ============================================
-- CLEANUP: Remove Old Test Sensors
-- ============================================

-- First, delete all readings for old test sensors
DELETE FROM sensor_readings 
WHERE sensor_id IN (
  SELECT sensor_id FROM sensors 
  WHERE sensor_type IN ('test', 'memory', 'cpu', 'gpu', 'disk')
  OR sensor_name LIKE '%Test%'
  OR sensor_name LIKE '%Battery%'
  OR sensor_name LIKE '%GPU%'
  OR sensor_name LIKE '%Disk%'
  OR sensor_name LIKE '%Memory%'
  OR sensor_name LIKE '%CPU%'
);

-- Delete the test sensors
DELETE FROM sensors 
WHERE sensor_type IN ('test', 'memory', 'cpu', 'gpu', 'disk')
OR sensor_name LIKE '%Test%'
OR sensor_name LIKE '%Battery%'
OR sensor_name LIKE '%GPU%'
OR sensor_name LIKE '%Disk%'
OR sensor_name LIKE '%Memory%'
OR sensor_name LIKE '%CPU%';

-- ============================================
-- CREATE: DHT11 Sensor for Raspberry Pi
-- ============================================

-- Make sure you have the device registered first
-- This assumes you have a device with ID 'raspberry-pi-01'
-- If not, register it first:

INSERT INTO device_metadata (device_id, device_name, device_type, location, is_online)
VALUES ('raspberry-pi-01', 'Raspberry Pi - Main', 'raspberry_pi', 'Living Room', true)
ON CONFLICT (device_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;

-- Now create the DHT11 sensor
INSERT INTO sensors (
  device_id,
  sensor_id,
  sensor_name,
  sensor_type,
  location,
  unit,
  is_active,
  created_at
) VALUES (
  'raspberry-pi-01',
  'dht11-sensor-01',
  'DHT11 Sensor',
  'temperature_humidity',
  'Living Room',
  'C/%',
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (sensor_id) DO UPDATE SET 
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- OPTIONAL: Add data_type column if missing
-- ============================================

-- Check if data_type column exists, if not add it
-- (Run this only if you get "column does not exist" error)
/*
ALTER TABLE sensor_readings 
ADD COLUMN IF NOT EXISTS data_type VARCHAR(50) DEFAULT 'temperature';
*/

-- ============================================
-- VERIFY: Check current sensors
-- ============================================

-- View all sensors
SELECT * FROM sensors ORDER BY created_at DESC;

-- View sensors by device
SELECT * FROM sensors WHERE device_id = 'raspberry-pi-01';

-- Count sensors by type
SELECT sensor_type, COUNT(*) FROM sensors GROUP BY sensor_type;

-- View recent readings
SELECT sr.sensor_id, sr.value, sr.data_type, sr.time 
FROM sensor_readings sr
ORDER BY sr.time DESC
LIMIT 20;
