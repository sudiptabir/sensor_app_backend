# 🌍 Sensor Data System - Complete Documentation Index

## 📚 Documentation Map

Start here if you're new! 👇

### 🚀 Quick Start (5 minutes)
- **[VISUAL_SETUP_GUIDE.md](VISUAL_SETUP_GUIDE.md)** ⭐ START HERE
  - Step-by-step visual guide with terminal layouts
  - Expected outputs at each step
  - Terminal window organization tips
  - Success indicators checklist

### 📖 Complete Setup Guides
- **[SENSOR_DATA_SETUP.md](SENSOR_DATA_SETUP.md)** - Main setup guide (400+ lines)
  - Architecture overview with diagrams
  - Step-by-step installation
  - Backend server deployment
  - Test data generation
  - Mobile app integration code
  - API reference
  - Troubleshooting

- **[TIMESCALEDB_SETUP.md](TIMESCALEDB_SETUP.md)** - Database setup (200+ lines)
  - Docker installation (recommended)
  - Native PostgreSQL + TimescaleDB setup
  - Database verification
  - GUI tools (pgAdmin, DBeaver)
  - Troubleshooting database issues

### 🔧 Implementation Files

#### Database
- **[schema.sql](schema.sql)** - Complete database schema
  - Sensors table (metadata)
  - sensor_readings hypertable (time-series)
  - device_metadata table
  - alert_rules configuration
  - Sample test data
  - Performance indexes
  - Data retention policies

#### Backend API Server
- **[sensor-backend.js](sensor-backend.js)** - Express.js REST API (400+ lines)
  - 10+ REST endpoints
  - WebSocket support
  - Device management
  - Sensor CRUD
  - Reading storage & retrieval
  - Statistics calculations
  - Error handling
  - Health checks

#### Test Data Generator
- **[sensor-test-generator.js](sensor-test-generator.js)** - Realistic test data (280+ lines)
  - Auto-creates test devices & sensors
  - Generates realistic sensor data
  - Continuous streaming mode
  - Configurable intervals
  - Batch operations

### 📱 Mobile App Integration

The following files contain code snippets for React Native:

1. **Hooks** (`sensor_app/hooks/useSensorData.ts`)
   - `useSensorData(sensorId)` - Fetch sensor readings
   - `useSensors(deviceId)` - Fetch sensors for device
   - Auto-refresh capability
   - Error handling

2. **Components** (`sensor_app/components/SensorCard.tsx`)
   - Display current sensor value
   - Show min/max/avg statistics
   - Real-time data updates
   - Beautiful UI

3. **Dashboard Integration** (`sensor_app/app/dashboard.tsx`)
   - Add "📊 Sensors" tab
   - List all sensors
   - Real-time display
   - Statistics view

### ⚙️ Configuration Files
- **[.env.backend](.env.backend)** - Environment variables template
  - Database settings
  - Server configuration
  - API settings

- **[BACKEND_PACKAGE_JSON.md](BACKEND_PACKAGE_JSON.md)** - npm setup guide
  - Dependencies list
  - npm scripts setup
  - Installation instructions
  - Available commands

### 📋 Quick Reference
- **[BACKEND_QUICKSTART.js](BACKEND_QUICKSTART.js)** - Command cheat sheet
  - All installation steps
  - Running commands
  - Terminal output examples
  - Production deployment tips

### 📊 System Summary
- **[SENSOR_SYSTEM_SUMMARY.md](SENSOR_SYSTEM_SUMMARY.md)** - Complete overview
  - What was created
  - New files list
  - Quick start (5 minutes)
  - API endpoint reference
  - Architecture overview
  - Database schema
  - Next steps
  - Troubleshooting guide

---

## 🎯 Getting Started Paths

### Path 1: I Just Want to Get Started Fast ⚡
1. Read: [VISUAL_SETUP_GUIDE.md](VISUAL_SETUP_GUIDE.md) (5 min)
2. Follow: Quick Start section (15 min setup)
3. Test: Use curl commands to verify
4. Done! ✅

### Path 2: I Want to Understand Everything 📚
1. Read: [SENSOR_SYSTEM_SUMMARY.md](SENSOR_SYSTEM_SUMMARY.md) - Overview
2. Read: [SENSOR_DATA_SETUP.md](SENSOR_DATA_SETUP.md) - Complete guide
3. Read: [TIMESCALEDB_SETUP.md](TIMESCALEDB_SETUP.md) - Database details
4. Study: Source code files
5. Implement: Mobile app integration

### Path 3: I Need Production Deployment 🚀
1. Read: [SENSOR_DATA_SETUP.md](SENSOR_DATA_SETUP.md) - Complete guide
2. Review: Security Considerations section
3. Configure: Production environment
4. Test: All endpoints thoroughly
5. Deploy: To production server
6. Monitor: Setup logging & alerting

### Path 4: I Just Want to Integrate with My App 📱
1. Read: [SENSOR_DATA_SETUP.md](SENSOR_DATA_SETUP.md) - Step 5
2. Copy: Hook code from guide
3. Create: `sensor_app/hooks/useSensorData.ts`
4. Create: `sensor_app/components/SensorCard.tsx`
5. Update: `sensor_app/app/dashboard.tsx`
6. Connect: Mobile app to backend
7. Test: Real-time data display

---

## 📈 Feature Overview

### Sensors Included in Test Data
- Temperature (°C)
- Humidity (%)
- Pressure (hPa)
- CPU Temperature (°C)
- Memory Usage (%)
- Wind Speed (km/h)
- Rainfall (mm)

### API Endpoints
```
GET    /api/devices              - List all devices
POST   /api/devices              - Register device
GET    /api/sensors              - List all sensors
POST   /api/sensors              - Create sensor
GET    /api/readings/:sensorId   - Get sensor readings
POST   /api/readings             - Add single reading
POST   /api/readings/batch       - Add multiple readings
GET    /api/readings/stats/:id   - Get statistics
GET    /health                   - Health check
```

### Database Tables
- `device_metadata` - Device information
- `sensors` - Sensor metadata
- `sensor_readings` - Time-series hypertable (auto-partitioned)
- `alert_rules` - Alert configuration

---

## 🐳 Docker Quick Commands

```bash
# Start TimescaleDB
docker run -d --name timescaledb \
  -e POSTGRES_PASSWORD=password123 \
  -p 5432:5432 \
  -v timescaledb_data:/var/lib/postgresql/data \
  timescale/timescaledb:latest-pg14

# View running containers
docker ps

# View logs
docker logs timescaledb

# Stop container
docker stop timescaledb

# Restart container
docker start timescaledb
```

---

## 🚀 Startup Sequence

### Terminal 1: Start Database
```bash
docker run -d --name timescaledb ...
psql -h localhost -U postgres -d sensor_db -f schema.sql
```

### Terminal 2: Start Backend
```bash
cd c:\Users\SUDIPTA\Downloads\Sensor_app
node sensor-backend.js
```

### Terminal 3: Generate Test Data
```bash
node sensor-test-generator.js --continuous --interval=5000
```

### Terminal 4: Test API
```bash
curl http://localhost:3000/api/devices
curl http://localhost:3000/api/sensors
curl "http://localhost:3000/api/readings/1?hours=24"
```

---

## ✅ Verification Checklist

- [ ] Docker installed: `docker --version`
- [ ] TimescaleDB running: `docker ps | grep timescaledb`
- [ ] Schema loaded: `psql -h localhost -U postgres -d sensor_db -c "\dt"`
- [ ] Backend started: `curl http://localhost:3000/health`
- [ ] Test data generating: Check backend logs
- [ ] API responding: `curl http://localhost:3000/api`
- [ ] Devices created: `curl http://localhost:3000/api/devices`
- [ ] Sensors created: `curl http://localhost:3000/api/sensors`
- [ ] Data stored: `curl "http://localhost:3000/api/readings/1"`
- [ ] Stats working: `curl "http://localhost:3000/api/readings/stats/1"`

---

## 🎓 Learning Path

### Beginner (1-2 hours)
- Read [VISUAL_SETUP_GUIDE.md](VISUAL_SETUP_GUIDE.md)
- Install and run system
- Understand basic API calls
- Generate test data

### Intermediate (3-5 hours)
- Read [SENSOR_DATA_SETUP.md](SENSOR_DATA_SETUP.md)
- Understand database schema
- Explore backend API code
- Add custom sensors

### Advanced (6-10 hours)
- Study [TIMESCALEDB_SETUP.md](TIMESCALEDB_SETUP.md)
- Deploy to production
- Setup security & authentication
- Integrate real devices
- Create analytics dashboards

---

## 📞 Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| Port 3000 in use | See [BACKEND_QUICKSTART.js](BACKEND_QUICKSTART.js) |
| DB connection failed | See [TIMESCALEDB_SETUP.md](TIMESCALEDB_SETUP.md) |
| No data appearing | See [SENSOR_DATA_SETUP.md](SENSOR_DATA_SETUP.md) - Troubleshooting |
| API won't start | See [BACKEND_QUICKSTART.js](BACKEND_QUICKSTART.js) |
| Mobile can't connect | See [SENSOR_DATA_SETUP.md](SENSOR_DATA_SETUP.md) - Troubleshooting |

---

## 📊 System Architecture

```
IoT Devices → Backend API → TimescaleDB
                  ↓
            Mobile App (Real-time display)
```

## 🎯 Next Steps After Setup

1. ✅ System running with test data
2. ⏭️ **Integrate Mobile App** - Use React hooks to fetch data
3. ⏭️ **Add Real Devices** - Send HTTP POST with sensor data
4. ⏭️ **Deploy Backend** - Move to production server
5. ⏭️ **Add Alerting** - Setup notification system
6. ⏭️ **Create Dashboards** - Analytics and reporting

---

## 💡 Key Files Reference

| File | Size | Purpose | Read Time |
|------|------|---------|-----------|
| VISUAL_SETUP_GUIDE.md | 400 lines | Step-by-step visual guide | 5-10 min |
| SENSOR_DATA_SETUP.md | 400 lines | Complete setup guide | 20-30 min |
| TIMESCALEDB_SETUP.md | 200 lines | Database setup | 10-15 min |
| schema.sql | 180 lines | Database schema | 5 min |
| sensor-backend.js | 400 lines | API server | 15-20 min |
| sensor-test-generator.js | 280 lines | Test data | 5-10 min |

**Total Documentation: 1700+ lines**

---

## 🎉 Ready to Start?

Pick your path above and start reading! 👇

### Quick Start (Fastest)
👉 Start with [VISUAL_SETUP_GUIDE.md](VISUAL_SETUP_GUIDE.md)

### Complete Learning
👉 Start with [SENSOR_SYSTEM_SUMMARY.md](SENSOR_SYSTEM_SUMMARY.md)

### Deep Dive
👉 Start with [SENSOR_DATA_SETUP.md](SENSOR_DATA_SETUP.md)

---

**Happy coding! 🚀**

Questions? Check the troubleshooting sections in the documentation files.
