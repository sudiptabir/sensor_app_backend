# 🔄 Firebase to AWS Migration Guide

## Migration Overview

This guide walks you through migrating from Firebase to AWS, including data migration, code updates, and testing procedures.

## Pre-Migration Checklist

### ✅ Environment Setup
- [ ] AWS Account created and configured
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Terraform installed (or use AWS Console)
- [ ] Node.js 18+ installed for Lambda functions
- [ ] Backup current Firebase data

### ✅ Cost Analysis
- [ ] Review [AWS_MIGRATION_PLAN.md](AWS_MIGRATION_PLAN.md) cost estimates
- [ ] Compare with current Firebase/Railway costs
- [ ] Set up AWS billing alerts

## Phase 1: Infrastructure Migration (Week 1)

### 1.1 Deploy AWS Infrastructure

```powershell
# Option A: Automated deployment (Recommended)
.\deploy-to-aws.ps1 -AWSRegion "us-east-1" -Environment "production"

# Option B: Step-by-step deployment
terraform init
terraform apply aws-infrastructure.tf
```

### 1.2 Verify Infrastructure

```bash
# Check DynamoDB tables
aws dynamodb list-tables --region us-east-1

# Check RDS instance
aws rds describe-db-instances --region us-east-1

# Check Lambda functions
aws lambda list-functions --region us-east-1
```

## Phase 2: Data Migration (Week 2)

### 2.1 Export Firebase Data

Create [firebase-data-export.js](firebase-data-export.js):

```javascript
const admin = require('firebase-admin');
const fs = require('fs').promises;

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://your-project.firebaseio.com"
});

async function exportFirebaseData() {
  const db = admin.firestore();
  const collections = ['devices', 'sensors', 'alerts', 'users'];
  const exportData = {};

  for (const collectionName of collections) {
    console.log(`📥 Exporting ${collectionName}...`);
    const snapshot = await db.collection(collectionName).get();
    exportData[collectionName] = [];
    
    snapshot.forEach(doc => {
      exportData[collectionName].push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Exported ${exportData[collectionName].length} ${collectionName} documents`);
  }

  await fs.writeFile('firebase-export.json', JSON.stringify(exportData, null, 2));
  console.log('🎉 Export complete: firebase-export.json');
}

exportFirebaseData().catch(console.error);
```

Run the export:
```bash
npm install firebase-admin
node firebase-data-export.js
```

### 2.2 Import Data to AWS

Create [aws-data-import.js](aws-data-import.js):

```javascript
const AWS = require('aws-sdk');
const fs = require('fs').promises;

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

const TABLE_MAPPING = {
  devices: 'sensor-app-devices',
  sensors: 'sensor-app-sensors', 
  alerts: 'sensor-app-alerts',
  users: 'sensor-app-users'
};

async function importToAWS() {
  const data = JSON.parse(await fs.readFile('firebase-export.json', 'utf8'));
  
  for (const [collection, tableName] of Object.entries(TABLE_MAPPING)) {
    const items = data[collection] || [];
    console.log(`📤 Importing ${items.length} items to ${tableName}...`);
    
    // Batch write in groups of 25 (DynamoDB limit)
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      
      const writeRequests = batch.map(item => ({
        PutRequest: {
          Item: transformFirebaseToAWS(item, collection)
        }
      }));
      
      await dynamodb.batchWrite({
        RequestItems: {
          [tableName]: writeRequests
        }
      }).promise();
      
      console.log(`✅ Imported batch ${Math.floor(i/25) + 1}`);
    }
  }
  
  console.log('🎉 Import complete!');
}

function transformFirebaseToAWS(item, collection) {
  // Transform Firebase document structure to match AWS DynamoDB schema
  const transformed = { ...item };
  
  switch (collection) {
    case 'devices':
      return {
        device_id: item.id,
        user_id: item.userId || item.user_id,
        device_identifier: item.deviceIdentifier || item.device_identifier,
        device_type: item.deviceType || item.device_type || 'raspberry_pi',
        location: item.location || 'Unknown',
        status: item.status || 'active',
        created_at: item.createdAt || item.created_at || Date.now(),
        updated_at: Date.now()
      };
      
    case 'sensors':
      return {
        device_id: item.deviceId || item.device_id,
        sensor_id: item.id,
        sensor_type: item.sensorType || item.sensor_type,
        value: item.value,
        unit: item.unit || '',
        timestamp: item.timestamp || Date.now(),
        created_at: Date.now()
      };
      
    case 'alerts':
      return {
        alert_id: item.id,
        device_id: item.deviceId || item.device_id,
        alert_type: item.alertType || item.alert_type || 'Alert',
        risk_label: item.riskLabel || item.risk_label || 'Medium',
        description: item.description || ['Alert'],
        timestamp: item.timestamp || Date.now(),
        created_at: Date.now(),
        status: item.status || 'active'
      };
      
    case 'users':
      return {
        user_id: item.id,
        email: item.email,
        display_name: item.displayName || item.display_name,
        blocked: item.blocked || false,
        created_at: item.createdAt || item.created_at || Date.now(),
        updated_at: Date.now()
      };
      
    default:
      return transformed;
  }
}

importToAWS().catch(console.error);
```

Run the import:
```bash
npm install aws-sdk
node aws-data-import.js
```

## Phase 3: Code Migration (Week 2-3)

### 3.1 Update API Endpoints

Replace Firebase endpoints in your applications:

```javascript
// OLD Firebase endpoints
const FIREBASE_BASE_URL = 'https://your-project.cloudfunctions.net';
const endpoints = {
  receiveMLAlert: `${FIREBASE_BASE_URL}/receiveMLAlert`,
  getDevices: `${FIREBASE_BASE_URL}/getDevices`,
  // ...
};

// NEW AWS endpoints
const AWS_BASE_URL = 'https://your-api-id.execute-api.us-east-1.amazonaws.com/prod';
const endpoints = {
  receiveMLAlert: `${AWS_BASE_URL}/api/alerts`,
  getDevices: `${AWS_BASE_URL}/api/devices`,
  sensorData: `${AWS_BASE_URL}/api/sensor-data`,
  // ...
};
```

### 3.2 Update Authentication

Replace Firebase Auth with AWS Cognito:

```javascript
// OLD Firebase Auth
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// NEW AWS Cognito
import { CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';

const cognitoConfig = {
  UserPoolId: 'us-east-1_XXXXXXXXX', // From terraform output
  ClientId: 'your-client-id'           // From terraform output
};

const userPool = new CognitoUserPool(cognitoConfig);

async function signIn(email, password) {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool
    });
    
    cognitoUser.authenticateUser(new AuthenticationDetails({
      Username: email,
      Password: password
    }), {
      onSuccess: resolve,
      onFailure: reject
    });
  });
}
```

### 3.3 Update Push Notifications

Replace Firebase Cloud Messaging with Amazon SNS:

```javascript
// Server-side: Update notification sending
const AWS = require('aws-sdk');
const sns = new AWS.SNS();

async function sendPushNotification(message, topicArn) {
  await sns.publish({
    TopicArn: topicArn,
    Message: JSON.stringify(message),
    MessageStructure: 'json'
  }).promise();
}
```

## Phase 4: Testing & Validation (Week 3-4)

### 4.1 API Testing

Create test scripts for each endpoint:

```bash
# Test device registration
curl -X POST https://your-api.amazonaws.com/api/devices/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"device_identifier": "test-device", "location": "Test Lab"}'

# Test alert submission
curl -X POST https://your-api.amazonaws.com/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "test-device", "deviceIdentifier": "test-device", "mlAlert": {"risk_label": "High"}}'

# Test sensor data
curl -X POST https://your-api.amazonaws.com/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{"device_id": "test-device", "readings": [{"sensor_type": "temperature", "value": 25.5}]}'
```

### 4.2 Load Testing

Use the existing load testing tools but point to AWS endpoints:

```bash
# Update your load testing scripts to use AWS URLs
# Example with the existing sensor test generator
node sensor-test-generator.js --aws-endpoint https://your-api.amazonaws.com/api/sensor-data
```

### 4.3 Data Validation

Verify data integrity after migration:

```sql
-- Compare record counts
SELECT 'devices' as table_name, COUNT(*) as aws_count FROM devices
UNION ALL 
SELECT 'alerts', COUNT(*) FROM alerts;
```

## Phase 5: Go-Live (Week 4)

### 5.1 Deployment Strategy

Choose your deployment approach:

**Option A: Blue-Green Deployment (Recommended)**
1. Keep Firebase system running
2. Deploy AWS system in parallel
3. Test AWS system thoroughly
4. Switch traffic gradually (10%, 50%, 100%)
5. Monitor for issues
6. Decommission Firebase after validation

**Option B: Big Bang Migration**
1. Schedule maintenance window
2. Export final Firebase data
3. Import to AWS
4. Switch all clients to AWS
5. Validate functionality
6. Decommission Firebase

### 5.2 Monitoring Setup

Set up AWS CloudWatch monitoring:

```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard --dashboard-name "Sensor-App-AWS" --dashboard-body file://cloudwatch-dashboard.json

# Set up alarms for Lambda functions
aws cloudwatch put-metric-alarm \
  --alarm-name "sensor-app-lambda-errors" \
  --alarm-description "Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold
```

## Post-Migration Cleanup

### 6.1 Firebase Cleanup (After successful migration)

```bash
# Export final backup before cleanup
firebase firestore:delete --all-collections --yes

# Cancel Firebase subscriptions
# Remove Firebase dependencies from package.json
npm uninstall firebase firebase-admin firebase-functions
```

### 6.2 Update Documentation

- [ ] Update API documentation with AWS endpoints
- [ ] Update deployment guides
- [ ] Update troubleshooting guides
- [ ] Archive Firebase-related documentation

## Rollback Plan

If issues occur, you can rollback:

1. **Immediate Rollback**: Switch DNS/load balancer back to Firebase
2. **Partial Rollback**: Route only problematic endpoints to Firebase
3. **Data Rollback**: Re-import recent data from Firebase if needed

## Cost Optimization Tips

1. **Use Reserved Instances** for RDS after testing
2. **Enable DynamoDB auto-scaling** based on usage
3. **Set up Lambda provisioned concurrency** only if needed
4. **Use S3 lifecycle policies** for old data
5. **Monitor CloudWatch costs** and adjust log retention

## Support and Troubleshooting

### Common Issues:

**Lambda Cold Start Issues**
```javascript
// Add warmup function
exports.warmup = async (event) => {
  if (event.source === 'serverless-plugin-warmup') {
    return 'Lambda is warm!';
  }
};
```

**DynamoDB Throttling**
```bash
# Increase table capacity temporarily
aws dynamodb update-table --table-name sensor-app-alerts --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10
```

**API Gateway CORS Issues**
```javascript
// Ensure all Lambda functions return proper CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
};
```

## Next Steps

1. ✅ **Complete infrastructure deployment**
2. 🔄 **Run data migration scripts**  
3. 🧪 **Execute comprehensive testing**
4. 📱 **Update mobile/web applications**
5. 🚀 **Go live with AWS infrastructure**
6. 📊 **Monitor and optimize performance**

Success metrics:
- [ ] All APIs responding correctly
- [ ] Data integrity maintained
- [ ] Performance meets requirements
- [ ] Cost within budget
- [ ] Zero data loss during migration