# 🔐 Admin Portal AWS - Quick Reference

## TL;DR - Where is My Admin Portal in AWS?

Your Admin Portal will be hosted on **AWS Elastic Beanstalk** at:

```
http://sensor-admin-prod.us-east-1.elasticbeanstalk.com
```

Or with custom domain:
```
https://admin.yourdomain.com
```

---

## 🚀 Quick Deploy (3 Commands)

```powershell
# 1. Navigate to admin portal
cd c:\Users\SUDIPTA\Downloads\Sensor_app\admin-portal

# 2. Deploy to AWS
.\deploy-to-aws-eb.ps1 -CreateNew

# 3. Open in browser
# URL will be displayed after deployment
```

---

## 📊 Admin Portal Architecture in AWS

```
┌─────────────────────────────────────────────────────┐
│                    User Browser                      │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│            CloudFront CDN (Optional)                 │
│              - SSL/HTTPS                             │
│              - Custom Domain                         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│         AWS Elastic Beanstalk                        │
│    ┌──────────────────────────────────┐             │
│    │   EC2 Instance (t3.small)        │             │
│    │   - Node.js 18                   │             │
│    │   - Express Server                │             │
│    │   - Port 8080                    │             │
│    └──────────┬───────────────────────┘             │
│               │                                      │
│    ┌──────────▼───────────────────────┐             │
│    │   Nginx Reverse Proxy             │             │
│    └──────────────────────────────────┘             │
└───────────────┬──────────────────┬───────────────────┘
                │                  │
       ┌────────▼────────┐    ┌───▼────────────┐
       │  RDS PostgreSQL │    │   DynamoDB     │
       │                 │    │                │
       │  - Admin users  │    │  - Devices     │
       │  - Access ctrl  │    │  - Sensors     │
       │  - User blocks  │    │  - Alerts      │
       └─────────────────┘    └────────────────┘
```

---

## 🎯 Why Elastic Beanstalk for Admin Portal?

| Feature | Benefit |
|---------|---------|
| **Easy Migration** | Similar to Railway - minimal code changes |
| **Managed Service** | AWS handles infrastructure, scaling, updates |
| **Auto-Scaling** | Automatically scales based on traffic |
| **Load Balancing** | Built-in load balancer for high availability |
| **Monitoring** | CloudWatch integration for logs and metrics |
| **Zero Downtime** | Rolling deployments with health checks |

---

## 💰 Cost Breakdown

| Component | Monthly Cost |
|-----------|-------------|
| EC2 Instance (t3.small) | $15-30 |
| Load Balancer | $15-20 |
| CloudWatch Logs | $2-5 |
| Data Transfer | $2-5 |
| **Total** | **$34-60/month** |

**Current Railway Cost**: ~$20-40/month
**Difference**: +$14-20/month (but more reliable and scalable)

---

## 🔑 Key Environment Variables

Your admin portal needs these in AWS:

```bash
# Database
DATABASE_URL=postgresql://user:pass@sensor-app-postgres.xyz.rds.amazonaws.com:5432/sensor_app

# DynamoDB Tables
ALERTS_TABLE=sensor-app-alerts
DEVICES_TABLE=sensor-app-devices
SENSORS_TABLE=sensor-app-sensors
USERS_TABLE=sensor-app-users

# AWS Config
AWS_REGION=us-east-1

# Security
SESSION_SECRET=your-random-32-char-secret
NODE_ENV=production

# Server
PORT=8080
```

---

## 📁 Admin Portal Features

### What the Admin Portal Does:

✅ **User Management**
- Block/unblock users from receiving alerts
- View user activity
- Manage user permissions

✅ **Device Management**  
- Register new devices
- View all devices
- Update device information
- Delete devices

✅ **Access Control**
- Grant/revoke device access
- Set permission levels
- View access logs

✅ **Alert Monitoring**
- View all alerts
- Filter by device/risk level
- Acknowledge alerts
- Delete old alerts

✅ **Admin Authentication**
- Secure login system
- Session management
- Password hashing (bcrypt)

---

## 🚀 Deployment Commands

### First Time Deployment

```powershell
cd admin-portal

# Install EB CLI (if not installed)
pip install awsebcli

# Deploy
.\deploy-to-aws-eb.ps1 -CreateNew -AWSRegion "us-east-1"
```

### Update Existing Deployment

```powershell
cd admin-portal
eb deploy
```

### View Logs

```powershell
eb logs
```

### Check Health

```powershell
eb health
```

### Open AWS Console

```powershell
eb console
```

---

## 🔗 Connecting Backend to Admin Portal

Update your sensor backend (currently on Railway) to point to AWS admin portal:

```javascript
// sensor-backend.js or similar
const ADMIN_PORTAL_URL = process.env.ADMIN_PORTAL_URL || 
  'http://sensor-admin-prod.us-east-1.elasticbeanstalk.com';

// Use this URL to check user permissions
async function checkUserAccess(userId, deviceId) {
  const response = await fetch(`${ADMIN_PORTAL_URL}/api/access/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, deviceId })
  });
  return response.json();
}
```

Set environment variable in your backend service:
```bash
ADMIN_PORTAL_URL=http://sensor-admin-prod.us-east-1.elasticbeanstalk.com
```

---

## 🌐 Setting Up Custom Domain

### Step 1: Request SSL Certificate
```bash
aws acm request-certificate \
  --domain-name admin.yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

### Step 2: Configure Route 53
```bash
# Add A record pointing to your Elastic Beanstalk endpoint
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch file://dns-record.json
```

### Step 3: Update EB Environment
```bash
eb config
# Add under aws:elasticbeanstalk:environment:
#   LoadBalancerType: application
```

---

## 🔒 Security Checklist

- [ ] SSL certificate configured (HTTPS only)
- [ ] Strong SESSION_SECRET set
- [ ] Database credentials secured
- [ ] IAM roles with minimal permissions
- [ ] Security groups configured (only allow necessary ports)
- [ ] CloudWatch logs enabled
- [ ] Regular security updates scheduled

---

## 📊 Monitoring & Metrics

### CloudWatch Metrics Tracked:
- Request count
- Error rate
- Response time
- CPU utilization
- Memory usage
- Network traffic

### View Metrics:
```bash
# Via CLI
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElasticBeanstalk \
  --metric-name RequestCount \
  --start-time 2026-03-09T00:00:00Z \
  --end-time 2026-03-10T00:00:00Z \
  --period 3600 \
  --statistics Sum

# Via Console
eb health --view-dashboard
```

---

## 🆘 Troubleshooting

### Admin Portal Not Loading
```powershell
# Check environment status
eb status

# View recent logs
eb logs --all

# Check health
eb health

# SSH into instance (if needed)
eb ssh
```

### Database Connection Issues
```powershell
# Test database connection
psql $env:DATABASE_URL -c "SELECT 1"

# Check security group rules
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

### High Response Times
```powershell
# Check instance metrics
eb health --view-dashboard

# Scale up instance size
eb scale 2  # Increase to 2 instances
```

---

## 📚 Related Documentation

- **[AWS_ADMIN_PORTAL_CONFIG.md](AWS_ADMIN_PORTAL_CONFIG.md)** - Complete configuration guide
- **[AWS_MIGRATION_PLAN.md](AWS_MIGRATION_PLAN.md)** - Overall migration strategy
- **[FIREBASE_TO_AWS_MIGRATION_GUIDE.md](FIREBASE_TO_AWS_MIGRATION_GUIDE.md)** - Step-by-step migration

---

## ✅ Post-Deployment Checklist

- [ ] Admin portal accessible at EB URL
- [ ] Database connection working
- [ ] Can create admin account
- [ ] Can login to admin portal
- [ ] Device management functions work
- [ ] User blocking works
- [ ] Backend connected to admin portal
- [ ] CloudWatch monitoring enabled
- [ ] SSL certificate configured (production)
- [ ] Custom domain configured (optional)

---

## 🎯 Summary

**Current**: Admin Portal on Railway  
**AWS**: Admin Portal on Elastic Beanstalk  
**URL**: `http://sensor-admin-prod.us-east-1.elasticbeanstalk.com`  
**Deploy**: `cd admin-portal && .\deploy-to-aws-eb.ps1 -CreateNew`  
**Cost**: ~$34-60/month  
**Migration Time**: 1-2 hours  

---

Need help? See full guide: [AWS_ADMIN_PORTAL_CONFIG.md](AWS_ADMIN_PORTAL_CONFIG.md)