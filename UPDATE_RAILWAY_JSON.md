# Update railway.json - Manual Steps

## Problem
Railway is using `railway.json` which has `"startCommand": "npm start"`, but we need it to run `node alert-api-server.js`.

## Solution: Edit railway.json File

### Step 1: Open the File
Open `railway.json` in your code editor (VS Code, Notepad++, etc.)

### Step 2: Change This Line
Find this line:
```json
"startCommand": "npm start",
```

Change it to:
```json
"startCommand": "node alert-api-server.js",
```

### Step 3: Save the File
The complete file should look like this:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node alert-api-server.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Step 4: Commit and Push
```powershell
git add railway.json
git commit -m "Update railway.json to run alert-api-server.js"
git push
```

### Step 5: Railway Will Auto-Deploy
Railway will detect the change and automatically redeploy with the new start command.

### Step 6: Verify
Wait 1-2 minutes, then check logs:
```powershell
railway service alert-api
railway logs
```

You should see:
```
🔌 PostgreSQL connection initialized for user blocking checks
✅ Firebase Admin SDK initialized
🚨 Alert API Backend Server
🚀 Server running on port 3001
```

### Step 7: Test
```powershell
curl https://alert-api-production-dc04.up.railway.app/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "firebase": true
}
```

## Quick Commands

```powershell
# Edit the file
notepad railway.json

# Or use VS Code
code railway.json

# After editing, commit and push
git add railway.json
git commit -m "Fix alert-api start command"
git push

# Check deployment
railway service alert-api
railway logs --tail 30
```

## After This Fix

Your blocking will work! When you:
1. Block a user in admin portal
2. Run `node rpi_send_alert.js`
3. Blocked user will NOT receive notification
4. Logs will show: `🚫 Skipping notification for blocked user`
