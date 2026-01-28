# Backend Package.json Setup

Add these dependencies to your root `package.json` (not sensor_app/package.json):

```json
{
  "name": "sensor-app-backend",
  "version": "1.0.0",
  "description": "Sensor Data Backend with TimescaleDB",
  "main": "sensor-backend.js",
  "scripts": {
    "backend-server": "node sensor-backend.js",
    "test-data": "node sensor-test-generator.js",
    "test-data:continuous": "node sensor-test-generator.js --continuous --interval=5000",
    "test-data:fast": "node sensor-test-generator.js --continuous --interval=1000",
    "schema:load": "psql -h localhost -U postgres -d sensor_db -f schema.sql",
    "db:console": "psql -h localhost -U postgres -d sensor_db",
    "db:reset": "psql -h localhost -U postgres -d sensor_db -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' && npm run schema:load"
  },
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.10.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "socket.io": "^4.5.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  },
  "engines": {
    "node": ">=14.0.0",
    "npm": ">=6.0.0"
  }
}
```

## Installation Steps

```bash
# 1. Navigate to project root
cd c:\Users\SUDIPTA\Downloads\Sensor_app

# 2. Install dependencies
npm install

# 3. Verify installation
npm list

# 4. Load database schema
npm run schema:load

# 5. Start backend server
npm run backend-server

# 6. In another terminal, start test data generator
npm run test-data:continuous
```

## Available npm Commands

```bash
# Start backend server
npm run backend-server

# Generate test data once
npm run test-data

# Stream test data continuously (every 5 seconds)
npm run test-data:continuous

# Stream test data fast (every 1 second)
npm run test-data:fast

# Access database console
npm run db:console

# Load/reload database schema
npm run schema:load

# Reset database (WARNING: deletes all data)
npm run db:reset
```

## Optional: Setup Nodemon for Auto-Reload

Install nodemon for development:

```bash
npm install --save-dev nodemon
```

Update package.json scripts:

```json
{
  "scripts": {
    "backend-server": "nodemon sensor-backend.js",
    "backend-server:prod": "node sensor-backend.js"
  }
}
```

Now the server will automatically restart when you modify files!

## Troubleshooting

### "Port 3000 already in use"
```bash
# Kill the process using port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use different port:
PORT=3001 npm run backend-server
```

### "Cannot find module 'pg'"
```bash
# Reinstall all dependencies
rm package-lock.json
npm install
```

### "psql: command not found"
```bash
# You need PostgreSQL installed locally, or use Docker Compose instead
# For now, use docker exec instead:
docker exec -it timescaledb psql -U postgres -d sensor_db -f schema.sql
```
