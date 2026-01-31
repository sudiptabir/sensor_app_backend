-- Fix sensor 9001 to have correct device_id
-- Run this in Railway PostgreSQL console

-- Update sensor 9001 to use correct device_id
UPDATE sensors 
SET device_id = '3d49c55d-bbfd-4bd0-9663-8728d64743ac'
WHERE sensor_id = 9001;

-- Verify the update
SELECT sensor_id, sensor_name, sensor_type, device_id, is_active 
FROM sensors 
WHERE sensor_id = 9001;
