# Blocked User Sensor Control - Implementation Guide

## Overview
This document describes the implementation of blocked user sensor control functionality. When an admin blocks a user, that user loses the ability to control sensors, even if they previously had access.

## Architecture

### System Components
```
Mobile App (React Native)
    ↓ POST /api/sensors/:sensorId/control with x-user-id header
Backend API (sensor-backend-combined.js)
    ↓ Checks user_blocks and device_access_control tables
    ↓ If user is blocked, returns 403 Forbidden
    ↓ If authorized, sends command to Pi
Raspberry Pi (dhttemp.py)
    ↓ Receives authenticated control commands only
    ↓ Executes sensor on/off
```

## Implementation Details

### 1. Backend API Endpoints Modified

#### GET /api/sensors/:sensorId/control?action=on|off
**Purpose**: Control sensor on/off via GET request

**Authentication & Authorization Checks**:
```javascript
1. Extract user ID from x-user-id header
2. Check if user exists in user_blocks table with is_active = true
3. Query device_access_control for device-specific blocks
4. If either block exists, return 403 Forbidden
5. Otherwise, proceed with sensor control
```

**Request Headers Required**:
```
x-user-id: <firebase-user-id>
```

**Response Codes**:
- `200 OK`: Sensor control successful
- `401 Unauthorized`: No user ID provided
- `403 Forbidden`: User is blocked (global or device-specific)
- `404 Not Found`: Sensor not found

**Response Body (Blocked User)**:
```json
{
  "error": "Access denied",
  "reason": "User is blocked",
  "details": "Reason for blocking from admin portal"
}
```

---

#### POST /api/sensors/:sensorId/control
**Purpose**: Control sensor on/off via POST request (recommended method)

**Authentication & Authorization Checks**:
```javascript
1. Extract user ID from x-user-id header
2. Check if user exists in user_blocks table with is_active = true
3. Query sensor info to get device_id
4. Query device_access_control for device-specific blocks
5. If any block found, return 403 Forbidden
6. Otherwise, proceed with sensor control
```

**Request Body**:
```json
{
  "action": "on" | "off"
}
```

**Request Headers Required**:
```
Content-Type: application/json
x-user-id: <firebase-user-id>
```

**Response Codes**:
- `200 OK`: Sensor control successful
- `401 Unauthorized`: No user ID provided
- `403 Forbidden`: User is blocked (global or device-specific)
- `404 Not Found`: Sensor not found

---

### 2. Database Tables Involved

#### user_blocks Table
Stores global user blocks managed by admins.

| Column | Type | Purpose |
|--------|------|---------|
| `user_id` | UUID | Firebase user ID |
| `is_active` | BOOLEAN | Whether block is active |
| `reason` | TEXT | Admin-provided reason |
| `blocked_by` | UUID | Admin who created the block |
| `blocked_at` | TIMESTAMP | When block was created |

**Query Used**:
```sql
SELECT * FROM user_blocks 
WHERE user_id = $1 AND is_active = true
```

---

#### device_access_control Table
Stores device-specific access permissions and blocks.

| Column | Type | Purpose |
|--------|------|---------|
| `device_id` | UUID | Device identifier |
| `user_id` | UUID | Firebase user ID |
| `is_blocked` | BOOLEAN | Whether user is blocked for this device |
| `reason` | TEXT | Block reason (device-specific) |
| `access_level` | VARCHAR | Access level (admin/control/view) |
| `granted_by` | UUID | Who granted access |

**Query Used**:
```sql
SELECT * FROM device_access_control 
WHERE device_id = $1 AND user_id = $2
```

---

### 3. Blocking Logic Flow

```
USER ATTEMPTS SENSOR CONTROL
    ↓
BACKEND RECEIVES REQUEST
    ├─ Extract user_id from x-user-id header
    └─ Extract sensor_id from URL
    ↓
CHECK GLOBAL BLOCKS
    ├─ Query user_blocks table
    ├─ If user found with is_active = true
    │   └─ RETURN 403 "User is blocked"
    └─ Otherwise, continue
    ↓
CHECK DEVICE-SPECIFIC BLOCKS
    ├─ Get device_id from sensor
    ├─ Query device_access_control table
    ├─ If record found with is_blocked = true
    │   └─ RETURN 403 "Access blocked for this device"
    └─ Otherwise, continue
    ↓
AUTHORIZATION PASSED
    ├─ Update sensor state in database
    ├─ Get device IP from device_metadata
    ├─ Send HTTP command to Pi at /sensor/control
    └─ RETURN 200 with success response
```

---

### 4. Pi-Side Implementation (dhttemp.py)

The Raspberry Pi script **does not need to implement blocking logic** because:

1. **Authorization happens on backend**: All user authorization checks occur on the backend API before commands are sent to the Pi.
2. **Trusted network**: The Pi receives commands only from authenticated backend requests.
3. **Fail-secure design**: If a blocked user tries to control a sensor:
   - Backend rejects the request (403 Forbidden)
   - No HTTP command is ever sent to the Pi
   - Pi's `/sensor/control` endpoint never receives the request

**Pi's HTTP Endpoints** (simplified):
```
GET  http://pi-ip:5000/sensor/status          → Returns sensor state
GET  http://pi-ip:5000/sensor/control?action=on|off  → Executes control
GET  http://pi-ip:5000/health                 → Health check
```

The Pi trusts all commands it receives because the backend has already validated them.

---

## Mobile App Integration

### Example: Turn Sensor Off (React Native)

```typescript
const controllSensor = async (sensorId: string, action: 'on' | 'off') => {
  try {
    const userId = await getUserId(); // Get current user's Firebase ID
    
    const response = await fetch(`${API_BASE_URL}/api/sensors/${sensorId}/control`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId, // IMPORTANT: Pass user ID
      },
      body: JSON.stringify({ action }),
    });

    if (response.status === 403) {
      const error = await response.json();
      // Show: "Your account has been blocked: {error.details}"
      Alert.alert('Access Denied', error.details);
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to control sensor');
    }

    const data = await response.json();
    // Update UI: "Sensor turned ON/OFF"
    Alert.alert('Success', data.message);
    
  } catch (error) {
    Alert.alert('Error', error.message);
  }
};
```

---

## Admin Portal Integration

### Blocking a User

When admin blocks a user via the admin portal:

1. **Global Block**: Adds/updates entry in `user_blocks` table
   - User loses ALL sensor control capabilities
   - User cannot control any device

2. **Device-Specific Block**: Updates `device_access_control` table
   - User loses control for specific device only
   - User can still control other devices

```typescript
// Example: Block user globally
app.post('/api/admin/users/:userId/block', async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  const adminId = req.headers['x-user-id'];
  
  await pool.query(
    'INSERT INTO user_blocks (user_id, is_active, reason, blocked_by) VALUES ($1, true, $2, $3)',
    [userId, reason, adminId]
  );
  
  res.json({ message: 'User blocked' });
});
```

### Unblocking a User

```typescript
// Example: Unblock user
app.post('/api/admin/users/:userId/unblock', async (req, res) => {
  const { userId } = req.params;
  
  await pool.query(
    'UPDATE user_blocks SET is_active = false WHERE user_id = $1',
    [userId]
  );
  
  res.json({ message: 'User unblocked' });
});
```

---

## Error Handling

### HTTP 403 Responses

When a blocked user attempts sensor control:

**Response Example**:
```json
{
  "error": "Access denied",
  "reason": "User is blocked",
  "details": "Suspicious activity detected - account temporarily blocked by admin"
}
```

### Logging

Backend logs all attempts (including blocked users):

```
[Sensor Control POST] Request from user: user-123 for sensor: sensor-456
[Sensor Control POST] Checking if user user-123 is blocked...
🚫 User user-123 is BLOCKED: Suspicious activity detected
[Sensor Control POST] User user-123 blocked for device device-789
```

---

## Testing Checklist

- [ ] Unblocked user can control sensors normally
- [ ] Globally blocked user gets 403 response when attempting sensor control
- [ ] Device-specifically blocked user gets 403 response for that device only
- [ ] Device-specifically blocked user can control other devices
- [ ] Error message is user-friendly and informative
- [ ] Backend logs show all attempts properly
- [ ] Mobile app gracefully handles 403 responses
- [ ] Pi never receives commands from blocked users

---

## Security Considerations

### ✅ Strengths
1. **Server-side enforcement**: Blocking is checked before Pi communication
2. **No client-side bypass**: Mobile app cannot override blocks
3. **Audit trail**: All blocks logged with admin information
4. **Real-time**: Blocks take effect immediately

### ⚠️ Precautions
1. **Header validation**: Always validate `x-user-id` header comes from authenticated request
2. **Database indexes**: Ensure `user_blocks` and `device_access_control` queries are indexed
3. **Rate limiting**: Consider rate limiting to prevent abuse attempts
4. **Logging**: Monitor access logs for patterns of blocked user attempts

---

## Future Enhancements

- [ ] Temporary blocks with auto-expiration
- [ ] Block severity levels (warning → temporary → permanent)
- [ ] Appeal process for blocked users
- [ ] Detailed audit trail with timestamps
- [ ] Admin notifications when blocked users attempt access
- [ ] Webhook notifications to third-party systems

---

## Related Files

- [sensor-backend-combined.js](sensor-backend-combined.js) - Backend API implementation
- [dhttemp.py](dhttemp.py) - Pi sensor control script
- [admin-portal/server.js](admin-portal/server.js) - Admin portal backend
- [ADMIN_PORTAL_FIX_SUMMARY.md](ADMIN_PORTAL_FIX_SUMMARY.md) - Admin features overview

