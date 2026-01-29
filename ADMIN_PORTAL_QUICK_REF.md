# ADMIN PORTAL - QUICK REFERENCE CARD

## 🎯 The Problem
You're trying to access admin portal at the backend URL. They are **2 separate services**.

---

## ⚡ 3-Step Quick Fix

### Step 1: Deploy (1 min)
```bash
cd admin-portal
railway up
```

### Step 2: Get URL (30 seconds)
```bash
railway domain
# Copy the URL provided
```

### Step 3: Create Admin (30 seconds)
```bash
# Replace https://YOUR_URL with URL from Step 2
curl -X POST https://YOUR_URL/api/setup/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Test123!",
    "fullName": "Admin User",
    "setupKey": "setup123"
  }'
```

Then open in browser: `https://YOUR_URL/login`

---

## 📍 URLs After Fix

| Service | URL | Purpose |
|---------|-----|---------|
| Backend | `https://sensorappbackend-production.up.railway.app/` | API |
| Admin | `https://your-admin-portal.railway.app/` | Login & Manage |
| Database | Internal Railway only | Data |

---

## 🔑 Environment Variables (Set in Railway Dashboard)

```
NODE_ENV=production
PORT=4000
DATABASE_URL=(from backend service)
ADMIN_PORTAL_URL=https://your-url.railway.app
FIREBASE_DATABASE_URL=https://sensor-app-2a69b.firebaseio.com
FIREBASE_SERVICE_ACCOUNT=(from serviceAccountKey.json)
SESSION_SECRET=your-long-random-secret
API_KEY=test-api-key-123
SETUP_KEY=setup123
```

---

## ✅ Verification Checklist

- [ ] Deployed with `railway up`
- [ ] Got URL with `railway domain`
- [ ] Variables set in Railway Dashboard
- [ ] Admin user created via curl
- [ ] Can access `/login` page
- [ ] Can login with credentials
- [ ] Dashboard loads

---

## 🚨 Common Issues

| Error | Fix |
|-------|-----|
| Cannot GET / | Go to `/login` |
| 404 Not Found | Deploy incomplete - check logs |
| Database error | Set DATABASE_URL variable |
| Invalid credentials | Run admin setup curl command |
| Firebase error | Verify FIREBASE_SERVICE_ACCOUNT |

---

## 📞 Need Help?

1. **Visual guide:** [ADMIN_PORTAL_VISUAL_GUIDE.md](ADMIN_PORTAL_VISUAL_GUIDE.md)
2. **Troubleshooting:** [ADMIN_PORTAL_TROUBLESHOOTING.md](ADMIN_PORTAL_TROUBLESHOOTING.md)
3. **Full details:** [ADMIN_PORTAL_DEPLOYMENT_FIX.md](ADMIN_PORTAL_DEPLOYMENT_FIX.md)
4. **Check logs:** `railway logs --follow -o admin-portal`

---

## 🚀 TL;DR

```
cd admin-portal && railway up && railway domain
# Opens browser to login page
# Email: admin@example.com
# Password: Test123!
```

That's it! You now have an admin portal deployed.

