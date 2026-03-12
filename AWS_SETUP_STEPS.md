# 🚀 AWS Migration - Getting Started

## Current Status
✅ AWS Account: Active (Account ID: 8543-9389-2674)
✅ Region: Asia Pacific (Mumbai) - ap-south-1
⏳ Next: Configure AWS CLI

---

## Step 1: Create IAM User with Access Keys

### 1.1 Create IAM User (Via AWS Console)

1. **Open IAM Console**: Search "IAM" in the AWS search bar (top)
2. **Click "Users"** in the left sidebar
3. **Click "Create user"**
4. **User name**: `sensor-app-deployer`
5. **Click "Next"**

### 1.2 Set Permissions

6. **Select "Attach policies directly"**
7. **Add these policies** (search and check):
   - ✅ `AdministratorAccess` (for initial setup - can restrict later)
   
   **OR for production-ready (more secure):**
   - ✅ `AmazonDynamoDBFullAccess`
   - ✅ `AmazonRDSFullAccess`
   - ✅ `AWSLambda_FullAccess`
   - ✅ `IAMFullAccess`
   - ✅ `AmazonAPIGatewayAdministrator`
   - ✅ `AmazonS3FullAccess`
   - ✅ `AmazonSNSFullAccess`
   - ✅ `CloudWatchFullAccess`
   - ✅ `AWSElasticBeanstalkFullAccess`

8. **Click "Next"** → **Click "Create user"**

### 1.3 Create Access Keys

9. **Click on the user you just created** (`sensor-app-deployer`)
10. **Go to "Security credentials" tab**
11. **Scroll down to "Access keys"**
12. **Click "Create access key"**
13. **Select use case**: "Command Line Interface (CLI)"
14. **Check the confirmation checkbox**
15. **Click "Next"** → Add description: "Local development CLI"
16. **Click "Create access key"**
17. **⚠️ IMPORTANT: Copy both:**
    - Access key ID: `AKIA...`
    - Secret access key: `wJalrXUtn...` (only shown once!)

---

## Step 2: Configure AWS CLI (On Your Computer)

### 2.1 Check if AWS CLI is Installed

Open PowerShell and run:

```powershell
aws --version
```

**If not installed:**
```powershell
# Download AWS CLI installer
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi
```

### 2.2 Configure AWS CLI

```powershell
aws configure
```

**Enter these values:**
```
AWS Access Key ID [None]: AKIA... (from step 1.3)
AWS Secret Access Key [None]: wJalrXUtn... (from step 1.3)
Default region name [None]: ap-south-1
Default output format [None]: json
```

### 2.3 Verify Configuration

```powershell
# Test AWS CLI
aws sts get-caller-identity

# Should show:
# {
#   "UserId": "AIDA...",
#   "Account": "854393892674",
#   "Arn": "arn:aws:iam::854393892674:user/sensor-app-deployer"
# }
```

✅ **If you see your account info, you're ready to proceed!**

---

## Step 3: Install Terraform (Infrastructure as Code)

### 3.1 Install Terraform

**Option A: Using Chocolatey (Easiest)**
```powershell
# Install Chocolatey if you don't have it
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Terraform
choco install terraform
```

**Option B: Manual Download**
1. Go to: https://developer.hashicorp.com/terraform/downloads
2. Download Windows AMD64 version
3. Extract to `C:\terraform\`
4. Add to PATH: System Properties → Environment Variables → PATH → Add `C:\terraform`

### 3.2 Verify Terraform Installation

```powershell
terraform version

# Should show: Terraform v1.x.x
```

---

## Step 4: Install EB CLI (For Admin Portal)

```powershell
# Install Python pip if not already installed
python -m pip install --upgrade pip

# Install EB CLI
pip install awsebcli
```

### Verify EB CLI

```powershell
eb --version

# Should show: EB CLI 3.x.x
```

---

## Step 5: Deploy Infrastructure (The Actual Migration!)

### 5.1 Navigate to Your Project

```powershell
cd c:\Users\SUDIPTA\Downloads\Sensor_app
```

### 5.2 Run Terraform Deployment

```powershell
# Initialize Terraform
terraform init

# Review what will be created
terraform plan

# Deploy infrastructure (will take 5-10 minutes)
terraform apply
```

**Type `yes` when prompted**

This will create:
- ✅ DynamoDB tables (sensors, alerts, devices, users)
- ✅ RDS PostgreSQL database
- ✅ Lambda execution roles
- ✅ S3 bucket for storage
- ✅ SNS topic for notifications
- ✅ VPC and security groups

### 5.3 Save Terraform Outputs

After deployment completes, save the outputs:

```powershell
terraform output -json > aws-infrastructure-outputs.json
```

---

## Step 6: Deploy Lambda Functions

```powershell
# Run the automated deployment script
.\deploy-to-aws.ps1 -AWSRegion "ap-south-1"
```

This script will:
- Package Lambda functions
- Deploy to AWS Lambda
- Configure environment variables
- Set up API Gateway

---

## Step 7: Deploy Admin Portal

```powershell
cd admin-portal
.\deploy-to-aws-eb.ps1 -CreateNew -AWSRegion "ap-south-1"
```

---

## Step 8: Verify Everything Works

### 8.1 Check DynamoDB Tables

```powershell
aws dynamodb list-tables --region ap-south-1
```

### 8.2 Check Lambda Functions

```powershell
aws lambda list-functions --region ap-south-1
```

### 8.3 Check RDS Database

```powershell
aws rds describe-db-instances --region ap-south-1
```

### 8.4 Test API Endpoint

```powershell
# Get API Gateway URL from Terraform output
$apiUrl = (terraform output -raw api_gateway_url)

# Test endpoint
curl "${apiUrl}/api/devices"
```

---

## 🎯 Quick Start Summary (Copy-Paste)

Once you have AWS CLI and Terraform installed:

```powershell
# 1. Navigate to project
cd c:\Users\SUDIPTA\Downloads\Sensor_app

# 2. Deploy infrastructure
terraform init
terraform apply

# 3. Deploy Lambda functions
.\deploy-to-aws.ps1 -AWSRegion "ap-south-1"

# 4. Deploy admin portal
cd admin-portal
.\deploy-to-aws-eb.ps1 -CreateNew -AWSRegion "ap-south-1"
```

---

## 📊 Migration Progress Checklist

- [ ] IAM user created with access keys
- [ ] AWS CLI configured and tested
- [ ] Terraform installed
- [ ] EB CLI installed
- [ ] Terraform infrastructure deployed
- [ ] Lambda functions deployed
- [ ] Admin portal deployed
- [ ] API endpoints tested
- [ ] Database connections verified
- [ ] Frontend/mobile app updated with new URLs

---

## 🆘 Troubleshooting

### "AWS CLI not found"
```powershell
# Reinstall AWS CLI
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi
```

### "Access Denied" errors
- Check IAM user has correct permissions
- Verify `aws configure` credentials are correct
- Run: `aws sts get-caller-identity` to verify

### "Terraform not found"
```powershell
# Add Terraform to PATH manually
$env:Path += ";C:\terraform"
```

### Region Issues
- Make sure you're using `ap-south-1` consistently
- Check: `aws configure get region`

---

## 🔐 Security Best Practices

1. **Never commit access keys** to Git
2. **Use environment variables** for sensitive data
3. **Enable MFA** on your AWS root account
4. **Restrict IAM permissions** after initial setup
5. **Rotate access keys** regularly (every 90 days)

---

## 💰 Cost Monitoring

Set up a billing alarm:

```powershell
aws cloudwatch put-metric-alarm \
  --alarm-name "sensor-app-billing-alarm" \
  --alarm-description "Alert when monthly charges exceed $50" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold
```

---

## 📚 Next Steps After Migration

1. **Update mobile/web apps** with new API endpoints
2. **Test all functionality** thoroughly
3. **Set up monitoring** in CloudWatch
4. **Configure custom domains** for APIs
5. **Enable CloudFront** for better performance
6. **Decommission Firebase** after validation
7. **Document new architecture** for your team

---

## ✅ You're Ready!

Start with **Step 1** above - creating an IAM user. Once you have your access keys, everything else will flow smoothly!

Estimated total setup time: **2-3 hours** for complete migration.