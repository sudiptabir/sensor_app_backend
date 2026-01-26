# Railway Admin Portal Deployment

## 🚀 Quick Deploy to Railway

### 1. Prerequisites
- Railway account (signup at railway.app)
- Firebase service account JSON
- Git repository

### 2. Deploy Steps

**A. Create Railway Project:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize project in admin-portal directory
cd admin-portal
railway init
```

**B. Add PostgreSQL Database:**
- Go to Railway dashboard
- Click "New" → "Database" → "PostgreSQL"
- Database will auto-provision

**C. Set Environment Variables:**
In Railway dashboard, add these variables:
```
NODE_ENV=production
SESSION_SECRET=<generate-random-32-char-string>
API_KEY=<same-as-your-mobile-backend>
SETUP_KEY=<one-time-key-for-first-admin>
FIREBASE_SERVICE_ACCOUNT=<paste-your-firebase-json>
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
ADMIN_PORTAL_URL=https://your-domain.railway.app
```

**D. Deploy:**
```bash
railway up
```

### 3. Create First Admin User

After deployment, create your first admin account:

```bash
curl -X POST https://your-admin-portal.railway.app/api/setup/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourdomain.com",
    "password": "SecurePassword123!",
    "fullName": "Admin Name",
    "setupKey": "your-setup-key-from-env"
  }'
```

### 4. Access Your Portal
Visit: `https://your-admin-portal.railway.app/login`

## 🔐 Security Notes

1. **Change SESSION_SECRET** - Use a strong random string
2. **Use HTTPS** - Railway provides this automatically
3. **Restrict API_KEY** - Share only with your backend
4. **Delete SETUP_KEY** - After creating first admin, remove from env vars
5. **Strong Passwords** - Enforce password policies

## 📊 Features

### User Management
- View all mobile app users
- Block/unblock users globally
- See user registration dates
- Track user activity

### Device Management
- List all registered devices
- View device online/offline status
- Manage device access control
- Grant/revoke per-device permissions

### Access Control
- Grant time-limited access
- Set access levels (viewer/controller)
- Block specific user-device combinations
- Track who granted permissions

### Activity Logging
- All admin actions logged
- IP address tracking
- Audit trail for compliance

## 🔌 Integration with Mobile Backend

Add this middleware to your mobile backend to check access:

```javascript
async function checkUserAccess(req, res, next) {
  const userId = req.user.id; // from JWT
  const deviceId = req.params.deviceId;
  
  const response = await fetch(
    `${process.env.ADMIN_PORTAL_URL}/api/check-access/${userId}/${deviceId}`,
    {
      headers: { 'X-API-Key': process.env.API_KEY }
    }
  );
  
  const { hasAccess, reason } = await response.json();
  
  if (!hasAccess) {
    return res.status(403).json({ error: reason });
  }
  
  next();
}

// Use in your routes
app.get('/devices/:deviceId/stream', checkUserAccess, (req, res) => {
  // Device streaming logic
});
```

## 🎨 Customization

- Edit views in `/views` for UI changes
- Modify `/public` for custom CSS/JS
- Extend API routes in `server.js`
- Add new features as needed

## 📈 Monitoring

Railway provides:
- Automatic metrics
- Log streaming
- Health checks
- Auto-scaling
