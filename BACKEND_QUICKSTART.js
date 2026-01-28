/**
 * 🚀 Quick Start Guide - Backend Setup
 * 
 * This file shows the commands and steps to get the sensor data system running
 */

// ============================================
// 1. INSTALL BACKEND DEPENDENCIES
// ============================================

// Run this command:
// npm install express pg cors dotenv socket.io

// If you need to install specific versions:
// npm install express@4.18.0 pg@8.10.0 cors@2.8.5 dotenv@16.0.0 socket.io@4.5.0

// ============================================
// 2. SETUP TIMESCALEDB
// ============================================

// Using Docker (Recommended):
// docker run -d --name timescaledb -e POSTGRES_PASSWORD=password123 -e POSTGRES_USER=postgres -e POSTGRES_DB=sensor_db -p 5432:5432 -v timescaledb_data:/var/lib/postgresql/data timescale/timescaledb:latest-pg14

// Then load the schema:
// psql -h localhost -U postgres -d sensor_db -f schema.sql

// ============================================
// 3. START BACKEND SERVER
// ============================================

// In PowerShell:
// cd c:\Users\SUDIPTA\Downloads\Sensor_app
// node sensor-backend.js

// Or in separate PowerShell window with npm script (if added):
// npm run backend-server

// ============================================
// 4. GENERATE TEST DATA (in another terminal)
// ============================================

// One-time test data:
// node sensor-test-generator.js

// Continuous streaming (recommended for testing):
// node sensor-test-generator.js --continuous --interval=5000

// ============================================
// 5. TEST THE SYSTEM
// ============================================

// Open browser or use curl:
// curl http://localhost:3000/api

// Get devices:
// curl http://localhost:3000/api/devices

// Get sensors:
// curl http://localhost:3000/api/sensors

// Get readings:
// curl "http://localhost:3000/api/readings/1?hours=24"

// ============================================
// 6. OPTIONAL: Add npm Scripts to package.json
// ============================================

// Add these to your package.json "scripts" section:

{
  "scripts": {
    "backend-server": "node sensor-backend.js",
    "test-data": "node sensor-test-generator.js",
    "test-data-continuous": "node sensor-test-generator.js --continuous --interval=5000",
    "db-console": "psql -h localhost -U postgres -d sensor_db",
    "schema:load": "psql -h localhost -U postgres -d sensor_db -f schema.sql"
  }
}

// Then you can run:
// npm run backend-server
// npm run test-data
// npm run test-data-continuous

// ============================================
// 7. COMPLETE STARTUP SEQUENCE
// ============================================

/*
Terminal 1 (TimescaleDB):
  docker run -d --name timescaledb \
    -e POSTGRES_PASSWORD=password123 \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_DB=sensor_db \
    -p 5432:5432 \
    -v timescaledb_data:/var/lib/postgresql/data \
    timescale/timescaledb:latest-pg14

  psql -h localhost -U postgres -d sensor_db -f schema.sql

Terminal 2 (Backend Server):
  cd c:\Users\SUDIPTA\Downloads\Sensor_app
  node sensor-backend.js

Terminal 3 (Test Data Generator):
  cd c:\Users\SUDIPTA\Downloads\Sensor_app
  node sensor-test-generator.js --continuous --interval=5000

Now open:
  - Browser: http://localhost:3000/api
  - Mobile app connected to: http://192.168.x.x:3000
*/

// ============================================
// 8. PRODUCTION DEPLOYMENT
// ============================================

/*
For production, consider:

1. Use PM2 for process management:
   npm install -g pm2
   pm2 start sensor-backend.js --name "sensor-api"
   pm2 save

2. Use environment variables:
   - Create .env file with production settings
   - Use DATABASE_URL for connection string

3. Setup NGINX reverse proxy:
   - Listen on port 80/443
   - Forward to backend on 3000

4. Enable HTTPS:
   - Get SSL certificate (Let's Encrypt)
   - Configure HTTPS in Express

5. Monitor and logs:
   - Setup logging with Winston or Bunyan
   - Monitor with PM2 Plus or New Relic

6. Database backups:
   - Schedule regular backups
   - Test restore procedures

7. Rate limiting:
   - npm install express-rate-limit
   - Limit requests per IP

8. Authentication:
   - Implement JWT tokens
   - Validate all requests
*/

// ============================================
// 9. MONITORING & DEBUGGING
// ============================================

// Check if services are running:
// docker ps                            -- Check TimescaleDB
// netstat -ano | findstr :3000        -- Check port 3000
// curl http://localhost:3000/health   -- Check API health

// View backend logs:
// cat sensor-backend.js               -- Add console.log statements

// View database logs:
// docker logs timescaledb

// Connect to database directly:
// psql -h localhost -U postgres -d sensor_db
// SELECT COUNT(*) FROM sensor_readings;
// SELECT * FROM sensors;

module.exports = {
  docs: "See SENSOR_DATA_SETUP.md for complete documentation",
  setup: "Complete steps above in order",
  tests: "Use sensor-test-generator.js to generate test data",
};
