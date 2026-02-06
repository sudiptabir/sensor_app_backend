# Quick Testing Guide - Blocked User Sensor Control

## Test Endpoints

### Test 1: Unblocked User Can Control Sensor ✅
```bash
curl -X POST http://localhost:3000/api/sensors/dht11-sensor-01/control \
  -H "Content-Type: application/json" \
  -H "x-user-id: normal-user-123" \
  -d '{"action": "on"}'
```

**Expected Response**:
```json
{
  "message": "Sensor turned ON",
  "sensor_id": "dht11-sensor-01",
  "is_active": true,
  "device_control": "success",
  "device_error": null
}
```

---

### Test 2: Blocked User Gets 403 Error ❌
```bash
curl -X POST http://localhost:3000/api/sensors/dht11-sensor-01/control \
  -H "Content-Type: application/json" \
  -H "x-user-id: blocked-user-456" \
  -d '{"action": "on"}'
```

**Expected Response** (403 Forbidden):
```json
{
  "error": "Access denied",
  "reason": "User is blocked",
  "details": "Suspicious activity detected"
}
```

---

### Test 3: Missing User ID Header ❌
```bash
curl -X POST http://localhost:3000/api/sensors/dht11-sensor-01/control \
  -H "Content-Type: application/json" \
  -d '{"action": "on"}'
```

**Expected Response** (401 Unauthorized):
```json
{
  "error": "User ID required"
}
```

---

### Test 4: Device-Specific Block
```bash
curl -X POST http://localhost:3000/api/sensors/dht11-sensor-01/control \
  -H "Content-Type: application/json" \
  -H "x-user-id: device-blocked-user-789" \
  -d '{"action": "off"}'
```

**Expected Response** (403 Forbidden):
```json
{
  "error": "Access denied",
  "reason": "Access blocked for this device",
  "details": "Device-specific access revoked"
}
```

---

## Database Setup - Blocking a User

### Block a User Globally
```sql
-- Add user to blocked list
INSERT INTO user_blocks (user_id, is_active, reason, blocked_by, blocked_at)
VALUES (
  'blocked-user-456',
  true,
  'Suspicious activity detected',
  'admin-user-id',
  NOW()
);

-- Verify the block
SELECT * FROM user_blocks WHERE user_id = 'blocked-user-456';
```

---

### Block a User for Specific Device
```sql
-- Update device access to block user
UPDATE device_access_control 
SET is_blocked = true, reason = 'Device-specific access revoked'
WHERE device_id = 'device-123' AND user_id = 'device-blocked-user-789';

-- Verify the block
SELECT * FROM device_access_control 
WHERE device_id = 'device-123' AND user_id = 'device-blocked-user-789';
```

---

### Unblock a User
```sql
-- Remove global block
UPDATE user_blocks 
SET is_active = false 
WHERE user_id = 'blocked-user-456';

-- Remove device-specific block
UPDATE device_access_control 
SET is_blocked = false 
WHERE device_id = 'device-123' AND user_id = 'device-blocked-user-789';
```

---

## Server Console Logs

### When Blocked User Attempts Control:
```
[Sensor Control POST] Request from user: blocked-user-456 for sensor: dht11-sensor-01
[Sensor Control POST] Checking if user blocked-user-456 is blocked...
🚫 User blocked-user-456 is BLOCKED: Suspicious activity detected
[Sensor Control POST] User blocked-user-456 blocked for device device-123
```

### When Authorized User Controls Sensor:
```
[Sensor Control POST] Request from user: normal-user-123 for sensor: dht11-sensor-01
[Sensor Control POST] Checking if user normal-user-123 is blocked...
📡 Sensor dht11-sensor-01 turned ON
🔌 Sending control to Pi at http://192.168.1.100:5000/sensor/control?action=on
✅ Pi responded: {"status":"Sensor turned ON","enabled":true}
```

---

## Mobile App Testing

### Block a User via Admin Portal
1. Open Admin Portal
2. Go to User Management
3. Find user "test-blocked-user"
4. Click "Block User"
5. Enter reason: "Suspicious activity detected"
6. Click Confirm

### Try to Control Sensor from Mobile App
1. Log in as the blocked user (from Step 3)
2. Go to Sensors tab
3. Try to turn sensor ON/OFF
4. **Expected**: See error message "Your account has been blocked: Suspicious activity detected"

### Unblock User via Admin Portal
1. Go to User Management
2. Find user "test-blocked-user"
3. Click "Unblock User"
4. Confirm

### Try to Control Sensor Again
1. Try to turn sensor ON/OFF
2. **Expected**: Sensor control works normally

---

## Verification Checklist

```
BEFORE IMPLEMENTATION:
☐ Sensor control works for normal users
☐ Admin can block/unblock users in admin portal
☐ Database tables exist: user_blocks, device_access_control

AFTER IMPLEMENTATION:
☐ Unblocked user CAN control sensors (200 OK)
☐ Globally blocked user CANNOT control sensors (403 Forbidden)
☐ Device-blocked user CANNOT control specific device (403 Forbidden)
☐ Device-blocked user CAN control other devices (200 OK)
☐ Missing x-user-id header returns 401
☐ Error messages are clear and informative
☐ Backend logs show all attempts correctly
☐ Pi never receives commands from blocked users
☐ Mobile app handles 403 gracefully
☐ Admin portal can see blocks in user management
```

---

## Troubleshooting

### Problem: "User ID required" error
**Cause**: `x-user-id` header not being sent
**Fix**: Ensure mobile app includes the header in requests:
```typescript
headers: {
  'x-user-id': userId,
  'Content-Type': 'application/json'
}
```

### Problem: Block doesn't take effect immediately
**Cause**: Old token or cached permissions
**Fix**: 
1. Have user log out and log back in
2. Clear app cache
3. Restart mobile app

### Problem: Sometimes block works, sometimes doesn't
**Cause**: Possible database consistency issue
**Fix**:
1. Check database connection
2. Verify `is_active = true` in user_blocks table
3. Check PostgreSQL logs for errors

### Problem: Device-specific block not working
**Cause**: `is_blocked` column might have wrong value
**Fix**:
```sql
-- Verify the column has correct value
SELECT * FROM device_access_control 
WHERE device_id = 'device-id' AND user_id = 'user-id';

-- Make sure is_blocked is true
UPDATE device_access_control 
SET is_blocked = true 
WHERE device_id = 'device-id' AND user_id = 'user-id';
```

---

## Performance Considerations

### Query Performance
- These queries should be fast (< 10ms):
  - `user_blocks` lookup: Single row by user_id
  - `device_access_control` lookup: Single row by (device_id, user_id)

- Ensure indexes exist:
```sql
CREATE INDEX IF NOT EXISTS idx_user_blocks_user_id 
  ON user_blocks(user_id);

CREATE INDEX IF NOT EXISTS idx_device_access 
  ON device_access_control(device_id, user_id);
```

### Recommended Limits
- Rate limit sensor control to 10 requests per minute per user
- Log all control attempts for audit trail
- Clear old blocks older than 90 days

