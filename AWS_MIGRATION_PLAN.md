# 🚀 Complete AWS Migration Plan

## Service Migration Mapping

| Current Service | AWS Equivalent | Migration Priority |
|----------------|---------------|------------------|
| **Firestore** | **DynamoDB** | 🔴 High |
| **Firebase Cloud Functions** | **AWS Lambda** | 🔴 High |
| **Firebase Authentication** | **AWS Cognito** | 🟡 Medium |
| **Firebase Cloud Messaging** | **Amazon SNS** | 🟡 Medium |
| **Firebase Realtime Database** | **API Gateway + WebSocket** | 🟢 Low |
| **PostgreSQL (Railway)** | **RDS PostgreSQL** | 🔴 High |
| **Express API (Railway)** | **Lambda + API Gateway** | 🔴 High |
| **Admin Portal (Railway)** | **Elastic Beanstalk** | 🟡 Medium |

## Migration Steps Overview

### Phase 1: Infrastructure Setup (Week 1)
1. **RDS PostgreSQL Database**
2. **DynamoDB Tables** 
3. **Lambda Functions**
4. **API Gateway**
5. **S3 Buckets** (for file storage)
6. **Elastic Beanstalk** (for Admin Portal)

### Phase 2: Core Services Migration (Week 2)
1. **Database Schema Migration**
2. **API Endpoints Migration**
3. **Authentication System**
4. **Alert System**

### Phase 3: Real-time Features (Week 3)
1. **WebSocket API**
2. **Push Notifications**
3. **Real-time Data Sync**

### Phase 4: Testing & Deployment (Week 4)
1. **Load Testing**
2. **Security Audit**
3. **Go-Live**

## Detailed Migration Guide

### 1. DynamoDB Setup

**Tables Needed:**
- `sensors` - Device sensor data
- `alerts` - ML alerts and notifications  
- `users` - User profiles and preferences
- `devices` - Device registration and metadata
- `sensor_readings` - Time-series sensor data

### 2. Lambda Functions Migration

**Functions to Create:**
- `receive-ml-alert` (replaces receiveMLAlert Cloud Function)
- `check-sensor-threshold` 
- `send-push-notification`
- `device-registration`
- `sensor-data-processor`

### 3. API Gateway Setup

**Endpoints:**
- `POST /api/alerts` - Receive alerts
- `GET /api/devices` - List devices
- `POST /api/devices/register` - Register device
- `GET /api/sensors/{deviceId}` - Get sensor data
- `POST /api/notifications/send` - Send notifications

### 4. AWS Cognito Authentication

**Features:**
- User registration/login
- JWT token management
- Password reset
- Email verification

### 5. Amazon SNS Push Notifications

**Topics:**
- High priority alerts
- Device status updates
- System notifications

## Cost Estimation (Monthly)

| Service | Estimated Cost |
|---------|---------------|
| **DynamoDB** | $25-50 |
| **Lambda** | $10-30 |
| **RDS PostgreSQL (t3.micro)** | $15-25 |
| **API Gateway** | $5-15 |
| **SNS** | $2-10 |
| **S3** | $5-15 |
| **Elastic Beanstalk (Admin Portal)** | $20-40 |
| **Total** | **$87-1910 |
| **Total** | **$67-155** |

## Next Steps

1. ✅ **Review this plan**
2. 📋 **Choose migration approach**: Big Bang vs Gradual
3. 🛠️ **Set up AWS account and basic infrastructure**
4. 🔄 **Start with Phase 1 - Infrastructure**

Choose your preferred approach:
- **Option A**: Gradual migration (safer, parallel systems)

## Admin Portal Configuration

Your Admin Portal will be hosted on **AWS Elastic Beanstalk** for easy migration from Railway.

**Quick Deploy:**
```powershell
cd admin-portal
.\deploy-to-aws-eb.ps1 -CreateNew
```

**Admin Portal Details:**
- **Hosting**: AWS Elastic Beanstalk (Node.js 18)
- **URL**: `http://sensor-admin-prod.us-east-1.elasticbeanstalk.com`
- **Custom Domain**: Configure via Route 53 + CloudFront
- **See**: [AWS_ADMIN_PORTAL_CONFIG.md](AWS_ADMIN_PORTAL_CONFIG.md) for complete guide
- **Option B**: Complete rewrite (faster, cleaner architecture)