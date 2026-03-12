-- Cleanup script to remove dummy devices and users from PostgreSQL
-- Run this on EC2: PGPASSWORD='sensor_admin_pass123' psql -h localhost -U sensor_admin -d sensor_db -f cleanup-dummy-data.sql

-- Delete all sample/dummy devices
DELETE FROM devices WHERE device_id IN ('rpi-001', 'rpi-002', 'rpi-003', 'rpi-004');

-- Delete all sample/dummy users  
DELETE FROM app_users WHERE user_id IN ('user-001', 'user-002', 'user-003');

-- Delete any user blocks for dummy users
DELETE FROM user_blocks WHERE user_id IN ('user-001', 'user-002', 'user-003');

-- Verify cleanup
SELECT 'Remaining devices:' as info;
SELECT COUNT(*) as device_count FROM devices;

SELECT 'Remaining users:' as info;
SELECT COUNT(*) as user_count FROM app_users;

SELECT 'Remaining user blocks:' as info;
SELECT COUNT(*) as block_count FROM user_blocks;
