/**
 * Admin Portal - User Sync Endpoint Update
 * Add this to admin-portal-v2/server.js
 * 
 * Allows the mobile app to sync user details to PostgreSQL when they sign in
 */

// Add this endpoint to amdin-portal-v2/server.js (after line 47, before requireAuth endpoints)

/**
 * User Registration/Sync Endpoint (Called by mobile app after sign-in)
 * POST /api/users/sync
 * Body: { userId, email, displayName }
 */
app.post('/api/users/sync', async (req, res) => {
  try {
    const { userId, email, displayName } = req.body;

    // Validate required fields
    if (!userId || !email) {
      return res.status(400).json({
        error: 'Missing required fields: userId, email'
      });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM app_users WHERE user_id = $1',
      [userId]
    );

    if (existingUser.rows.length > 0) {
      // Update last_login timestamp
      const updateQuery = `
        UPDATE app_users 
        SET last_login = NOW(),
            display_name = COALESCE($1, display_name)
        WHERE user_id = $2
        RETURNING *
      `;

      const result = await pool.query(updateQuery, [displayName || null, userId]);
      
      console.log(`✅ User updated: ${userId} (${email})`);
      return res.json({
        success: true,
        message: 'User updated successfully',
        user: result.rows[0]
      });
    } else {
      // Create new user
      const insertQuery = `
        INSERT INTO app_users (user_id, email, display_name, is_blocked, last_login, created_at, updated_at)
        VALUES ($1, $2, $3, false, NOW(), NOW(), NOW())
        RETURNING *
      `;

      const result = await pool.query(insertQuery, [userId, email, displayName || email]);
      
      console.log(`✅ User created: ${userId} (${email})`);
      return res.json({
        success: true,
        message: 'User created successfully',
        user: result.rows[0]
      });
    }
  } catch (error) {
    console.error('User sync error:', error);
    
    // Check if it's a duplicate email error
    if (error.code === '23505' && error.constraint === 'app_users_email_key') {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    res.status(500).json({
      error: 'Failed to sync user',
      message: error.message
    });
  }
});

/**
 * Sync existing Firestore users to PostgreSQL
 * POST /api/users/sync-all (authenticated endpoint)
 * Useful for initial migration
 */
app.post('/api/users/sync-all', requireAuth, async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const db = admin.firestore();

    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();

    let synced = 0;
    let errors = 0;

    for (const doc of usersSnapshot.docs) {
      try {
        const userId = doc.id;
        const userData = doc.data();
        
        const email = userData.email || `user-${userId}@example.com`;
        const displayName = userData.displayName || userData.email || userId;

        // Upsert to PostgreSQL
        await pool.query(`
          INSERT INTO app_users (user_id, email, display_name, is_blocked, last_login, created_at, updated_at)
          VALUES ($1, $2, $3, false, NOW(), NOW(), NOW())
          ON CONFLICT (user_id) DO UPDATE
          SET email = EXCLUDED.email,
              display_name = EXCLUDED.display_name,
              updated_at = NOW()
        `, [userId, email, displayName]);

        synced++;
      } catch (error) {
        console.error(`Error syncing user ${doc.id}:`, error.message);
        errors++;
      }
    }

    res.json({
      success: true,
      message: `Synced ${synced} users with ${errors} errors`,
      synced,
      errors,
      total: usersSnapshot.size
    });
  } catch (error) {
    console.error('Sync all users error:', error);
    res.status(500).json({
      error: 'Failed to sync users',
      message: error.message
    });
  }
});
