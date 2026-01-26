-- PostgreSQL Schema for Sensor Data
-- Run this file after connecting to sensor_db

-- ============================================
-- 1. SENSORS TABLE (Metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS sensors (
  sensor_id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  sensor_name VARCHAR(255) NOT NULL,
  sensor_type VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  unit VARCHAR(50),
  min_value FLOAT,
  max_value FLOAT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_device_sensor UNIQUE(device_id, sensor_name)
);

CREATE INDEX IF NOT EXISTS ix_sensors_device_id ON sensors(device_id);
CREATE INDEX IF NOT EXISTS ix_sensors_type ON sensors(sensor_type);

-- ============================================
-- 2. SENSOR READINGS TABLE (Time-Series Data)
-- ============================================
CREATE TABLE IF NOT EXISTS sensor_readings (
  time TIMESTAMP NOT NULL,
  sensor_id INT NOT NULL REFERENCES sensors(sensor_id) ON DELETE CASCADE,
  value FLOAT NOT NULL,
  quality INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS ix_sensor_readings_sensor_id_time 
ON sensor_readings (sensor_id, time DESC);

CREATE INDEX IF NOT EXISTS ix_sensor_readings_time 
ON sensor_readings (time DESC);

-- ============================================
-- 3. DEVICE METADATA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS device_metadata (
  device_id VARCHAR(255) PRIMARY KEY,
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(50), -- IoT, Raspberry Pi, Arduino, etc.
  location VARCHAR(255),
  firmware_version VARCHAR(50),
  ip_address VARCHAR(15),
  last_online TIMESTAMP,
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_device_metadata_online 
ON device_metadata(is_online);

-- ============================================
-- 4. ALERT RULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS alert_rules (
  rule_id SERIAL PRIMARY KEY,
  sensor_id INT NOT NULL REFERENCES sensors(sensor_id) ON DELETE CASCADE,
  rule_name VARCHAR(255) NOT NULL,
  condition VARCHAR(50), -- above, below, equals, between
  threshold_value FLOAT NOT NULL,
  threshold_value_max FLOAT,
  is_active BOOLEAN DEFAULT true,
  alert_severity VARCHAR(20), -- critical, high, medium, low
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sensor_id, rule_name)
);

-- ============================================
-- 5. TEST DATA - SAMPLE SENSORS
-- ============================================
-- LAPTOP Device (Single Device Setup)
INSERT INTO device_metadata (device_id, device_name, device_type, location, is_online)
VALUES 
  ('192b7a8c-972d-4429-ac28-4bc73e9a8809', 'LAPTOP-14678VIP', 'PC', 'Office', true)
ON CONFLICT DO NOTHING;

-- LAPTOP Sensors (5 sensors for PC monitoring)
INSERT INTO sensors (device_id, sensor_name, sensor_type, location, unit, min_value, max_value)
VALUES 
  ('192b7a8c-972d-4429-ac28-4bc73e9a8809', 'CPU Temperature', 'temperature', 'LAPTOP-14678VIP', 'C', 20, 80),
  ('192b7a8c-972d-4429-ac28-4bc73e9a8809', 'Memory Usage', 'memory', 'LAPTOP-14678VIP', '%', 0, 100),
  ('192b7a8c-972d-4429-ac28-4bc73e9a8809', 'Disk Usage', 'pressure', 'LAPTOP-14678VIP', '%', 0, 100),
  ('192b7a8c-972d-4429-ac28-4bc73e9a8809', 'GPU Temperature', 'humidity', 'LAPTOP-14678VIP', 'C', 20, 90),
  ('192b7a8c-972d-4429-ac28-4bc73e9a8809', 'Battery Level', 'rainfall', 'LAPTOP-14678VIP', '%', 0, 100)
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. VERIFY INSTALLATION
-- ============================================
-- Current Status:
-- ✅ 1 Device: LAPTOP-14678VIP
-- ✅ 5 Sensors: CPU Temperature, Memory Usage, Disk Usage, GPU Temperature, Battery Level
-- ✅ Continuous test data generation via sensor-test-generator.js
--6. VERIFY INSTALLATION
-- ============================================
-- Current Status:
-- ✅ 1 Device: LAPTOP-14678VIP
-- ✅ 5 Sensors: CPU Temperature, Memory Usage, Disk Usage, GPU Temperature, Battery Level
-- ✅ Continuous test data generation via sensor-test-generator.js
--
-- Run these queries to verify:
SELECT COUNT(*) as total_sensors FROM sensors;
SELECT COUNT(*) as total_readings FROM sensor_readings;
SELECT COUNT(*) as total_devices FROM device_metadata;
SELECT device_id, device_name, is_online FROM device_metadata;
SELECT sensor_id, sensor_name, sensor_type FROM sensors ORDER BY sensor_id