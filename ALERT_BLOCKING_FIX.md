# Alert Notification Blocking Fix

## Problem

Blocked users were still receiving push notifications and alerts in their mobile app, even after being blocked by an administrator in the admin portal.

## Root Cause

The alert API servers (`alert-api-server.js` and `alert-api-v2/server.js`) were not checking the PostgreSQL `user_blocks` table before:
1. Sending push notifications to users
2. Storing alerts in users' Firestore collections

**Previous Flow:**
```
ML Alert Received
    ↓
Get Device Owner from Firestore
    ↓
Store Alert in User's mlAlerts Collection ❌ (No blocking check)
    ↓
Send Push Notification ❌ (No blocking check)
```

## Solution

Added user blocking checks to both alert API servers before sending notifications and storing alerts.

**New Flow:**
```
ML Alert Received
    ↓
Get Device Owner from Firestore
    ↓
Check if User is Blocked in PostgreSQL ✅
    ↓
If Blocked → Skip notification & alert storage
If Not Blocked → Continue
    ↓
Store Alert in User's mlAlerts Collection
    ↓
Send Push Notification
```

## Changes Made

### 1. Added PostgreSQL Connection

Both `alert-api-server.js` and `alert-api-v2/server.js` now connect to PostgreSQL to check user blocking status:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

### 2. Added `isUserBlocked()` Function

New function checks the `user_blocks` table:

```javascript
async function isUserBlocked(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM user_blocks WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    
    if (result.rows.length > 0) {
      console.log(`🚫 User ${userId} is BLOCKED: ${result.rows[0].reason}`);
      return {
        blocked: true,
        reason: result.rows[0].reason,
        blockedBy: result.rows[0].blocked_by,
        blockedAt: result.rows[0].blocked_at
      };
    }
    
    return { blocked: false };
  } catch (error) {
    console.error('❌ Error checking user block status:', error);
    // On error, allow notification (fail open for availability)
    return { blocked: false };
  }
}
```

### 3. Updated `sendPushNotifications()` Function

Added blocking check before sending each notification:

```javascript
for (const userId of userIds) {
  // Check if user is blocked
  const blockStatus = await isUserBlocked(userId);
  if (blockStatus.blocked) {
    console.log(`🚫 Skipping notification for blocked user ${userId}: ${blockStatus.reason}`);
    results.push({ 
      userId, 
      success: false, 
      blocked: true,
      reason: blockStatus.reason 
    });
    continue;
  }
  
  // Send notification...
}
```

### 4. Updated `storeAlertInFirestore()` Function

Added blocking check before storing alerts:

```javascript
// Check if user is blocked
const blockStatus = await isUserBlocked(userId);
if (blockStatus.blocked) {
  console.log(`🚫 Skipping alert storage for blocked user ${userId}: ${blockStatus.reason}`);
  return { blocked: true, reason: blockStatus.reason };
}

// Store alert...
```

## Files Modified

1. `alert-api-v2/server.js` - Railway deployment version
2. `alert-api-server.js` - Local/alternative version

## Testing

### Test Scenario 1: Block User and Send Alert

1. Admin blocks user via admin portal
2. ML alert is generated for user's device
3. Alert API receives alert
4. **Expected Result:** 
   - User does NOT receive push notification
   - Alert is NOT stored in user's Firestore collection
   - Logs show: `🚫 Skipping notification for blocked user [userId]: [reason]`

### Test Scenario 2: Unblock User and Send Alert

1. Admin unblocks user via admin portal
2. ML alert is generated for user's device
3. Alert API receives alert
4. **Expected Result:**
   - User DOES receive push notification
   - Alert IS stored in user's Firestore collection
   - Normal alert flow continues

### Test Scenario 3: Database Error Handling

1. PostgreSQL connection fails
2. ML alert is generated
3. **Expected Result:**
   - System fails open (allows notification)
   - Error logged but alert still delivered
   - Ensures availability over strict blocking

## Deployment

### Prerequisites

Both alert API servers need:
- `DATABASE_URL` environment variable set
- PostgreSQL connection with `user_blocks` table
- `pg` npm package installed

### Deployment Steps

1. **Install Dependencies** (if not already installed):
   ```bash
   npm install pg
   ```

2. **Set Environment Variable**:
   ```bash
   DATABASE_URL=postgresql://postgres:password@host:port/database
   ```

3. **Deploy to Railway**:
   ```bash
   git add alert-api-server.js alert-api-v2/server.js
   git commit -m "Add user blocking check to alert notifications"
   git push
   ```

4. **Verify Deployment**:
   - Check Railway logs for: `🔌 PostgreSQL connection initialized for user blocking checks`
   - Test blocking a user and sending an alert
   - Verify logs show: `🚫 Skipping notification for blocked user`

## Monitoring

### Log Messages to Watch

**Successful Blocking:**
```
🚫 User [userId] is BLOCKED: [reason]
🚫 Skipping notification for blocked user [userId]: [reason]
🚫 Skipping alert storage for blocked user [userId]: [reason]
```

**Normal Operation:**
```
📱 Push notification sent to user [userId]
💾 Alert stored for user [userId]
```

**Errors:**
```
❌ Error checking user block status: [error]
❌ PostgreSQL pool error: [error]
```

## Database Schema

The fix relies on the `user_blocks` table:

```sql
CREATE TABLE user_blocks (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  blocked_by VARCHAR(255) NOT NULL,
  blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_user_blocks ON user_blocks(user_id, is_active);
```

## Fail-Safe Behavior

The system is designed to **fail open** (allow notifications) rather than **fail closed** (block notifications) when errors occur:

- If PostgreSQL connection fails → Notifications still sent
- If query times out → Notifications still sent
- If table doesn't exist → Notifications still sent

This ensures system availability is prioritized over strict blocking enforcement.

## Future Enhancements

### 1. Device-Specific Blocking

Currently blocks ALL alerts for a user. Could add device-specific blocking:

```javascript
async function isUserBlockedForDevice(userId, deviceId) {
  // Check both global blocks and device-specific blocks
  const globalBlock = await pool.query(
    'SELECT * FROM user_blocks WHERE user_id = $1 AND is_active = true',
    [userId]
  );
  
  const deviceBlock = await pool.query(
    'SELECT * FROM device_access_control WHERE user_id = $1 AND device_id = $2 AND is_blocked = true',
    [userId, deviceId]
  );
  
  return globalBlock.rows.length > 0 || deviceBlock.rows.length > 0;
}
```

### 2. Temporary Blocks with Expiration

Add expiration dates to blocks:

```sql
ALTER TABLE user_blocks ADD COLUMN expires_at TIMESTAMP;
```

```javascript
async function isUserBlocked(userId) {
  const result = await pool.query(
    `SELECT * FROM user_blocks 
     WHERE user_id = $1 
     AND is_active = true 
     AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId]
  );
  // ...
}
```

### 3. Block Reason Categories

Add structured block reasons:

```sql
ALTER TABLE user_blocks ADD COLUMN block_category VARCHAR(50);
-- Categories: 'policy_violation', 'security_threat', 'spam', 'maintenance', etc.
```

### 4. Notification Suppression Log

Track blocked notifications for audit:

```sql
CREATE TABLE blocked_notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  device_id VARCHAR(255),
  alert_type VARCHAR(50),
  blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  block_reason TEXT
);
```

## Troubleshooting

### Issue: Blocked users still receiving notifications

**Check:**
1. Verify `DATABASE_URL` is set correctly
2. Check Railway logs for PostgreSQL connection message
3. Verify `user_blocks` table exists and has data
4. Check `is_active` column is `true` for the block
5. Verify user ID matches exactly (case-sensitive)

**Debug:**
```bash
# Check if user is blocked in database
railway run psql $DATABASE_URL -c "SELECT * FROM user_blocks WHERE user_id = 'USER_ID_HERE';"
```

### Issue: No users receiving notifications

**Check:**
1. Check for PostgreSQL connection errors in logs
2. Verify `user_blocks` table query is working
3. Check if all users are accidentally blocked

**Debug:**
```bash
# Check all active blocks
railway run psql $DATABASE_URL -c "SELECT * FROM user_blocks WHERE is_active = true;"
```

### Issue: Database connection errors

**Check:**
1. Verify `DATABASE_URL` format is correct
2. Check PostgreSQL service is running
3. Verify SSL settings match environment
4. Check firewall/network connectivity

## Rollback Plan

If issues occur, rollback by reverting the changes:

```bash
git revert HEAD
git push
```

The system will continue to work without blocking checks (all users will receive notifications).

## Conclusion

This fix ensures that when an administrator blocks a user in the admin portal, that user will no longer receive push notifications or see new alerts in their mobile app. The blocking is enforced at the alert API level before notifications are sent and alerts are stored.

The implementation includes proper error handling and fail-safe behavior to ensure system availability is maintained even if the blocking check fails.
