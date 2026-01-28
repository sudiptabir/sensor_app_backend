# 📋 Sensor Data System - Step-by-Step Visual Guide

## Phase 1: Setup & Installation (15 minutes)

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Install Docker (if not already installed)           │
│ Download: https://www.docker.com/products/docker-desktop   │
│ Verify: docker --version                                    │
└─────────────────────────────────────────────────────────────┘
                           ⬇️
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Start TimescaleDB in Docker                         │
│                                                             │
│ Command:                                                   │
│ docker run -d --name timescaledb \                         │
│   -e POSTGRES_PASSWORD=password123 \                       │
│   -e POSTGRES_USER=postgres \                              │
│   -e POSTGRES_DB=sensor_db \                               │
│   -p 5432:5432 \                                           │
│   -v timescaledb_data:/var/lib/postgresql/data \          │
│   timescale/timescaledb:latest-pg14                       │
│                                                             │
│ Wait ~30 seconds for container to be ready                 │
└─────────────────────────────────────────────────────────────┘
                           ⬇️
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Load Database Schema                               │
│                                                             │
│ Command:                                                   │
│ psql -h localhost -U postgres -d sensor_db -f schema.sql   │
│                                                             │
│ Output should show: CREATE TABLE, CREATE INDEX, etc.       │
└─────────────────────────────────────────────────────────────┘
                           ⬇️
┌─────────────────────────────────────────────────────────────┐
│ ✅ Phase 1 Complete: TimescaleDB is ready!                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 2: Backend Setup (10 minutes)

```
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Install Node Dependencies                          │
│                                                             │
│ Command:                                                   │
│ cd c:\Users\SUDIPTA\Downloads\Sensor_app                   │
│ npm install express pg cors dotenv socket.io              │
│                                                             │
│ Wait for ~1-2 minutes while npm downloads packages         │
└─────────────────────────────────────────────────────────────┘
                           ⬇️
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Start Backend Server (NEW TERMINAL)                │
│                                                             │
│ Command:                                                   │
│ node sensor-backend.js                                    │
│                                                             │
│ Expected Output:                                           │
│ ╔═══════════════════════════════════════════════╗          │
│ ║  🚀 Sensor Backend Server Started            ║          │
│ ║  📡 Server: http://localhost:3000            ║          │
│ ║  🗄️  Database: localhost:5432                ║          │
│ ╚═══════════════════════════════════════════════╝          │
│                                                             │
│ ⚠️  Keep this terminal open and running!                   │
└─────────────────────────────────────────────────────────────┘
                           ⬇️
┌─────────────────────────────────────────────────────────────┐
│ ✅ Phase 2 Complete: Backend API is ready!                  │
│                                                             │
│ Verify by opening browser: http://localhost:3000/api      │
│ Should show: { "name": "Sensor Data Backend", ... }       │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 3: Test Data Generation (5 minutes)

```
┌─────────────────────────────────────────────────────────────┐
│ Step 6: Generate Initial Test Data (NEW TERMINAL)          │
│                                                             │
│ Command:                                                   │
│ cd c:\Users\SUDIPTA\Downloads\Sensor_app                   │
│ node sensor-test-generator.js                             │
│                                                             │
│ Expected Output:                                           │
│ 📱 Creating test devices...                               │
│ ✅ Created 3 test devices                                │
│ 📊 Creating sensors...                                   │
│ ✅ Created 7 sensors                                     │
│ 📈 Generating test readings...                           │
│ ⏱️  14:30:45                                              │
│   📊 Sensor 1: 22.5                                       │
│   📊 Sensor 2: 65.3                                       │
│   📊 Sensor 3: 1012.8                                     │
│   ...                                                      │
│                                                             │
│ ✅ Test complete!                                          │
└─────────────────────────────────────────────────────────────┘
                           ⬇️
┌─────────────────────────────────────────────────────────────┐
│ Step 7: Start Continuous Data Stream (SAME TERMINAL)       │
│                                                             │
│ Command:                                                   │
│ node sensor-test-generator.js --continuous --interval=5000 │
│                                                             │
│ This will keep sending data every 5 seconds               │
│ ⚠️  Keep this terminal open!                              │
│                                                             │
│ To stop: Press Ctrl+C                                      │
└─────────────────────────────────────────────────────────────┘
                           ⬇️
┌─────────────────────────────────────────────────────────────┐
│ ✅ Phase 3 Complete: Test data is flowing!                  │
│                                                             │
│ Now you have:                                              │
│ • 3 test devices                                           │
│ • 7 sensors (temperature, humidity, pressure, etc.)        │
│ • Continuous data stream                                   │
│ • Data stored in TimescaleDB                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 4: Test & Verify (5 minutes)

```
┌─────────────────────────────────────────────────────────────┐
│ Step 8: Test API Endpoints (NEW TERMINAL or Browser)       │
│                                                             │
│ Test 1 - Get API Info:                                     │
│ curl http://localhost:3000/api                            │
│ Expected: API documentation JSON                           │
│                                                             │
│ Test 2 - Get All Devices:                                 │
│ curl http://localhost:3000/api/devices                    │
│ Expected: Array of 3 devices                              │
│                                                             │
│ Test 3 - Get All Sensors:                                 │
│ curl http://localhost:3000/api/sensors                    │
│ Expected: Array of 7 sensors                              │
│                                                             │
│ Test 4 - Get Sensor Data:                                 │
│ curl "http://localhost:3000/api/readings/1?hours=1"       │
│ Expected: Array of recent readings from sensor 1          │
│                                                             │
│ Test 5 - Get Statistics:                                  │
│ curl "http://localhost:3000/api/readings/stats/1"         │
│ Expected: { min_value: X, max_value: Y, avg_value: Z ... } │
│                                                             │
│ ✅ If all tests pass, system is working!                   │
└─────────────────────────────────────────────────────────────┘
                           ⬇️
┌─────────────────────────────────────────────────────────────┐
│ ✅ Phase 4 Complete: System Verified!                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Final Architecture

```
Your Windows Machine
├── Terminal 1: TimescaleDB (Docker)
│   Port: 5432
│   Database: sensor_db
│   User: postgres / Password: password123
│
├── Terminal 2: Node.js Backend Server
│   Port: 3000
│   URL: http://localhost:3000
│   Status: Running ✅
│
├── Terminal 3: Test Data Generator
│   Streaming: 7 sensors
│   Interval: Every 5 seconds
│   Status: Running ✅
│
└── Terminal 4: API Testing
    Curl commands or Browser
    Verifying data flow
```

---

## Terminal Window Layout (Recommended)

```
┌──────────────────────────────────────────────────────────────┐
│ Power Shell / Terminal 1 (TimescaleDB - Minimized)          │
│ $ docker run -d --name timescaledb ...                      │
│ $ psql -h localhost -U postgres -d sensor_db -f schema.sql  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Power Shell / Terminal 2 (Backend Server - KEEP VISIBLE)    │
│ $ node sensor-backend.js                                    │
│                                                              │
│ 🚀 Sensor Backend Server Started                           │
│ 📡 Server: http://localhost:3000                           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Power Shell / Terminal 3 (Test Data - KEEP VISIBLE)         │
│ $ node sensor-test-generator.js --continuous               │
│                                                              │
│ ⏱️  14:35:30                                                │
│   📊 Sensor 1: 23.4 (Temperature)                          │
│   📊 Sensor 2: 62.1 (Humidity)                             │
│   📊 Sensor 3: 1013.2 (Pressure)                           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Web Browser (Testing)                                        │
│ http://localhost:3000/api                                   │
│ http://localhost:3000/api/devices                          │
│ http://localhost:3000/api/sensors                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
Step 1: Initial Setup
┌─────────────────────┐
│ Docker Image:       │
│ timescale:latest    │
└──────────┬──────────┘
           │ docker run
           ▼
┌──────────────────────────┐
│ TimescaleDB Container    │
│ Port: 5432              │
│ Database: sensor_db     │
└──────────┬───────────────┘
           │ psql -f schema.sql
           ▼
      ✅ Database Ready

Step 2: Backend Started
┌──────────────────────────┐
│ Node.js Process          │
│ Port: 3000              │
│ Status: Listening       │
└──────────┬───────────────┘
           │ connects to DB
           ▼
      ✅ Backend Ready

Step 3: Data Generator
┌──────────────────────────┐
│ Test Generator Process   │
│ Interval: 5000ms        │
│ Status: Streaming       │
└──────────┬───────────────┘
           │ POST /api/readings/batch
           ▼
┌──────────────────────────┐
│ Backend API (Express)    │
│ Validates data          │
│ Inserts into DB         │
└──────────┬───────────────┘
           │ INSERT INTO sensor_readings
           ▼
┌──────────────────────────┐
│ TimescaleDB Hypertable   │
│ Stores time-series data │
│ Status: ✅ Data flowing │
└──────────────────────────┘

Step 4: Data Retrieval
┌──────────────────────────┐
│ Mobile App / Client      │
│ Calls API endpoints      │
└──────────┬───────────────┘
           │ GET /api/readings/1
           ▼
┌──────────────────────────┐
│ Backend API              │
│ Queries database         │
│ Returns JSON             │
└──────────┬───────────────┘
           │ SELECT * FROM sensor_readings
           ▼
┌──────────────────────────┐
│ TimescaleDB              │
│ Returns data to backend  │
└──────────┬───────────────┘
           │ JSON response
           ▼
      ✅ Display on Mobile App
```

---

## Troubleshooting Flowchart

```
System Not Working?
        │
        ├─ API won't start?
        │  └─ Port 3000 in use?
        │     └─ netstat -ano | findstr :3000
        │     └─ Kill process or use PORT=3001
        │
        ├─ No data in database?
        │  └─ Test generator running?
        │  │  └─ Yes: Check backend logs
        │  │  └─ No: Start test generator
        │  └─ Backend connected to DB?
        │     └─ Check DB_HOST in .env
        │
        ├─ Can't connect to database?
        │  └─ TimescaleDB container running?
        │  │  └─ docker ps | grep timescaledb
        │  └─ Schema loaded?
        │     └─ docker exec -it timescaledb psql -U postgres -d sensor_db -c "\dt"
        │
        └─ API returns error?
           └─ Check backend console logs
           └─ Verify JSON payload format
           └─ Check query parameters
```

---

## Success Indicators ✅

When everything is working, you should see:

```
✅ Docker Container Running
   docker ps shows: timescaledb (Up)

✅ Backend Server Started
   Terminal shows: "🚀 Sensor Backend Server Started"

✅ Test Data Streaming
   Terminal shows: "📊 Sensor X: Y.Z" every 5 seconds

✅ API Responding
   curl http://localhost:3000/api returns JSON

✅ Database Populated
   psql query returns sensor data

✅ Data Flowing End-to-End
   • Sensors generate data
   • Backend receives it
   • Database stores it
   • API returns it
   • Mobile app displays it
```

---

## Quick Reference

| Component | Status | Terminal | Command |
|-----------|--------|----------|---------|
| TimescaleDB | ✅ Running | 1 (Optional) | `docker ps` |
| Backend Server | ✅ Running | 2 (Keep open) | `node sensor-backend.js` |
| Test Generator | ✅ Running | 3 (Keep open) | `node sensor-test-generator.js --continuous` |
| API Testing | ✅ Ready | 4 (Browser/Curl) | `curl http://localhost:3000/api` |
| Database | ✅ Ready | - | Connected automatically |

---

🎉 **Your sensor data system is now running in real-time!**

Next steps:
1. ⏭️ Integrate with mobile app (see SENSOR_DATA_SETUP.md)
2. ⏭️ Connect real IoT devices (send HTTP POST to backend)
3. ⏭️ Deploy to production server
4. ⏭️ Add more sensors and devices
5. ⏭️ Setup alerting and notifications
