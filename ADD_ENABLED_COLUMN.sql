-- Add 'enabled' column to sensors table for on/off control
-- This is separate from 'is_active' which indicates if sensor exists/deleted

ALTER TABLE sensors 
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS ix_sensors_enabled ON sensors(enabled);

-- Update existing sensors to be enabled by default
UPDATE sensors SET enabled = true WHERE enabled IS NULL;

-- Verify
SELECT sensor_id, sensor_name, is_active, enabled FROM sensors;
