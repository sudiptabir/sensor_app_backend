# 🔐 Admin Portal AWS Configuration Guide

## Overview

Your **Admin Portal** is currently a Node.js/Express web application deployed on Railway. In AWS, you have **multiple hosting options** depending on your needs.

## Current Admin Portal Architecture

**Technology Stack:**
- **Backend**: Node.js/Express server
- **Frontend**: Server-side rendered HTML (views/)
- **Database**: PostgreSQL (user management, access control)
- **Authentication**: Session-based with bcrypt
- **Features**:
  - User management (block/unblock users)
  - Device management
  - Access control
  - Alert monitoring
  - Admin authentication

## AWS Hosting Options for Admin Portal

### 🎯 Option 1: AWS Elastic Beanstalk (RECOMMENDED - Easiest)

**Best for**: Quick migration with minimal changes

**Architecture:**
```
User Browser → CloudFront CDN → Elastic Beanstalk → RDS PostgreSQL
                                ↓
                            DynamoDB (device data)
                            Cognito (optional)
```

**Pros:**
- ✅ Easiest migration path (similar to Railway)
- ✅ Auto-scaling and load balancing built-in
- ✅ Minimal code changes required
- ✅ Managed service (less DevOps work)
- ✅ Supports Node.js directly

**Cons:**
- ❌ More expensive than serverless (~$25-50/month)
- ❌ Not truly serverless (always running)

**Cost**: ~$30-60/month
- EC2 instance (t3.small): $15-30
- Load balancer: $15-25
- CloudFront: $5-10

**Setup:**
```bash
# Install EB CLI
pip install awsebcli

# Navigate to admin portal
cd admin-portal

# Initialize Elastic Beanstalk
eb init -p node.js-18 sensor-admin-portal --region us-east-1

# Create environment
eb create sensor-admin-prod --instance-type t3.small

# Set environment variables
eb setenv DATABASE_URL="postgresql://..." \
  ALERTS_TABLE="sensor-app-alerts" \
  DEVICES_TABLE="sensor-app-devices" \
  SESSION_SECRET="your-secret"

# Deploy
eb deploy
```

---

### ⚡ Option 2: AWS Lambda + API Gateway (Most Cost-Effective)

**Best for**: Serverless, pay-per-use model

**Architecture:**
```
User Browser → CloudFront CDN → API Gateway → Lambda Functions → RDS/DynamoDB
                                ↓
                            S3 (static assets)
                            Cognito (auth)
```

**Pros:**
- ✅ Most cost-effective ($5-20/month)
- ✅ Auto-scales to zero
- ✅ Pay only for actual usage
- ✅ No server maintenance

**Cons:**
- ❌ Requires code refactoring
- ❌ Cold starts (~200-500ms)
- ❌ Session management more complex
- ❌ More setup work required

**Cost**: ~$5-20/month
- Lambda: $2-10
- API Gateway: $3-10
- CloudFront: $0-5

**Setup:**
```bash
# Convert Express routes to Lambda functions
# See lambda-admin-portal.js (I'll create this below)

# Deploy with SAM or Serverless Framework
sam deploy --guided
```

---

### 🚀 Option 3: AWS Amplify Hosting (Modern Approach)

**Best for**: If you want to modernize to React/Next.js frontend

**Architecture:**
```
User Browser → Amplify CDN → Amplify Hosting (React app)
                              ↓
                          Lambda Functions (API)
                          Cognito (auth)
                          DynamoDB
```

**Pros:**
- ✅ Modern stack (React/Next.js)
- ✅ Built-in CI/CD
- ✅ Great developer experience
- ✅ Integrated with AWS services

**Cons:**
- ❌ Requires complete frontend rewrite
- ❌ Longer migration time
- ❌ Learning curve for new framework

**Cost**: ~$10-30/month
- Amplify hosting: $5-15
- Lambda backend: $5-15

---

### 🖥️ Option 4: ECS Fargate (Container-Based)

**Best for**: Containerized deployments, microservices

**Architecture:**
```
User Browser → ALB → ECS Fargate → RDS PostgreSQL
                     ↓
                  DynamoDB
                  ECR (Docker images)
```

**Pros:**
- ✅ Docker container support
- ✅ Good for microservices
- ✅ No server management
- ✅ Easy scaling

**Cons:**
- ❌ More complex setup
- ❌ More expensive than Lambda
- ❌ Requires Docker knowledge

**Cost**: ~$25-50/month
- Fargate tasks: $20-40
- Load balancer: $15-25
- ECR storage: $1-3

---

## 🎯 Recommended Approach: Elastic Beanstalk + CloudFront

Based on your current setup, I recommend **Elastic Beanstalk** for the fastest migration with minimal changes.

### Step-by-Step Deployment

#### 1. Prepare Your Admin Portal for AWS

Update `admin-portal/package.json` to include build scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "postinstall": "npm prune --production"
  },
  "engines": {
    "node": "18.x"
  }
}
```

#### 2. Create `.ebextensions` Configuration

Create `admin-portal/.ebextensions/nodecommand.config`:

```yaml
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
```

#### 3. Update Environment Variables

The admin portal needs these environment variables in AWS:

```bash
# Database
DATABASE_URL=postgresql://username:password@sensor-app-postgres.xyz.us-east-1.rds.amazonaws.com:5432/sensor_app

# DynamoDB Tables (from Terraform output)
ALERTS_TABLE=sensor-app-alerts
DEVICES_TABLE=sensor-app-devices
SENSORS_TABLE=sensor-app-sensors
USERS_TABLE=sensor-app-users

# AWS Region
AWS_REGION=us-east-1

# Session Secret
SESSION_SECRET=your-long-random-secret-key-here

# Port (Elastic Beanstalk uses 8080 by default)
PORT=8080

# Admin Portal URL (will be provided after deployment)
ADMIN_PORTAL_URL=http://sensor-admin-prod.us-east-1.elasticbeanstalk.com
```

#### 4. Deploy to Elastic Beanstalk

Create deployment script `admin-portal/deploy-to-aws-eb.ps1`:

```powershell
#!/usr/bin/env pwsh

Write-Host "🚀 Deploying Admin Portal to AWS Elastic Beanstalk" -ForegroundColor Green

# Check if EB CLI is installed
try {
    eb --version | Out-Null
} catch {
    Write-Host "❌ EB CLI not installed. Installing..." -ForegroundColor Red
    pip install awsebcli
}

# Initialize EB (if not already done)
if (-not (Test-Path ".elasticbeanstalk")) {
    Write-Host "🔧 Initializing Elastic Beanstalk..." -ForegroundColor Blue
    eb init -p node.js-18 sensor-admin-portal --region us-east-1
}

# Create or update environment
Write-Host "🏗️ Creating/updating environment..." -ForegroundColor Blue
eb create sensor-admin-prod --instance-type t3.small --envvars `
    DATABASE_URL="$env:DATABASE_URL",`
    AWS_REGION="us-east-1",`
    SESSION_SECRET="$(New-Guid)",`
    NODE_ENV="production"

# Deploy
Write-Host "📦 Deploying application..." -ForegroundColor Blue
eb deploy

# Get URL
Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
eb status
```

#### 5. Set Up CloudFront CDN (Optional but Recommended)

```bash
# Create CloudFront distribution pointing to your EB endpoint
aws cloudfront create-distribution \
  --origin-domain-name sensor-admin-prod.us-east-1.elasticbeanstalk.com \
  --default-root-object /login
```

---

## Alternative Quick Setup: Lambda Version

If you prefer serverless, I can create a Lambda-based version. Here's the structure:

### Admin Portal as Lambda Functions

Create `lambda-admin-portal.js`:

```javascript
const express = require('express');
const serverless = require('serverless-http');
const admin = require('./routes/admin');
const devices = require('./routes/devices');
const users = require('./routes/users');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/admin', admin);
app.use('/api/devices', devices);
app.use('/api/users', users);

// Serve static frontend from S3
app.get('*', (req, res) => {
  res.redirect(`https://admin-frontend.s3.amazonaws.com${req.path}`);
});

// Export as Lambda handler
module.exports.handler = serverless(app);
```

Deploy with SAM template `admin-portal-template.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  AdminPortalFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: sensor-app-admin-portal
      Handler: lambda-admin-portal.handler
      Runtime: nodejs18.x
      MemorySize: 512
      Timeout: 30
      Environment:
        Variables:
          DATABASE_URL: !Sub 'postgresql://...'
          ALERTS_TABLE: sensor-app-alerts
          DEVICES_TABLE: sensor-app-devices
      Events:
        Api:
          Type: HttpApi
          Properties:
            Path: /{proxy+}
            Method: ANY
```

---

## Migration Checklist for Admin Portal

### Pre-Migration
- [ ] Export PostgreSQL schema and data
- [ ] Document all environment variables
- [ ] List all admin portal endpoints
- [ ] Backup current deployment

### Migration
- [ ] Choose AWS hosting option (Elastic Beanstalk recommended)
- [ ] Set up RDS PostgreSQL connection
- [ ] Configure DynamoDB access
- [ ] Set up IAM roles and policies
- [ ] Deploy admin portal to AWS
- [ ] Configure domain/subdomain (e.g., admin.yourdomain.com)

### Post-Migration
- [ ] Test all admin functions
- [ ] Verify user authentication works
- [ ] Test device management features
- [ ] Verify access control functionality
- [ ] Update backend APIs with new admin portal URL
- [ ] Set up monitoring and alerts

---

## Accessing Your Admin Portal in AWS

After deployment, your admin portal will be accessible at:

**Elastic Beanstalk:**
```
http://sensor-admin-prod.us-east-1.elasticbeanstalk.com
```

**With Custom Domain (Recommended):**
```
https://admin.yourdomain.com
```

To set up custom domain:

```bash
# 1. Request SSL certificate in AWS Certificate Manager
aws acm request-certificate \
  --domain-name admin.yourdomain.com \
  --validation-method DNS

# 2. Add CNAME record to your EB environment
eb setenv ADMIN_DOMAIN=admin.yourdomain.com

# 3. Configure CloudFront with your custom domain
```

---

## Cost Comparison

| Hosting Option | Monthly Cost | Setup Time | Complexity |
|---------------|-------------|------------|------------|
| **Elastic Beanstalk** | $30-60 | 1-2 hours | 🟢 Easy |
| **Lambda + API Gateway** | $5-20 | 4-8 hours | 🟡 Medium |
| **ECS Fargate** | $25-50 | 3-6 hours | 🟡 Medium |
| **Amplify** | $10-30 | 2-4 days | 🔴 Hard |

---

## My Recommendation

Given your current setup and need for quick migration:

1. **Start with Elastic Beanstalk** - It's the closest to Railway, minimal code changes
2. **Add CloudFront** for better performance and SSL
3. **Later optimize to Lambda** if cost becomes a concern
4. **Use Route 53** for custom domain (admin.yourdomain.com)

This gives you:
- ✅ Quick migration (1-2 days)
- ✅ Minimal code changes
- ✅ Reliable hosting
- ✅ Easy to maintain
- ✅ Can optimize later

Would you like me to create the Elastic Beanstalk deployment script for your admin portal?