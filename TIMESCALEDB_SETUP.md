# TimescaleDB Setup Guide for Windows

## Prerequisites
- Windows 10/11
- Administrator access
- 2GB+ RAM available
- 5GB+ disk space

## Method 1: Using Docker (Recommended - Easiest)

### Step 1: Install Docker Desktop
1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop
2. Run installer and follow setup wizard
3. Restart computer when prompted
4. Verify installation:
```bash
docker --version
docker run hello-world
```

### Step 2: Run TimescaleDB Container
```bash
# Create a volume for persistent data
docker volume create timescaledb_data

# Run TimescaleDB container
docker run -d \
  --name timescaledb \
  -e POSTGRES_PASSWORD=password123 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=sensor_db \
  -p 5432:5432 \
  -v timescaledb_data:/var/lib/postgresql/data \
  timescale/timescaledb:latest-pg14

# Verify container is running
docker ps
```

**Container Details:**
- Container Name: `timescaledb`
- Host Port: `5432`
- Database: `sensor_db`
- Username: `postgres`
- Password: `password123`

### Step 3: Connect to Database
```bash
# Using Docker exec (from command line)
docker exec -it timescaledb psql -U postgres -d sensor_db

# Or use a GUI tool like pgAdmin (see below)
```

---

## Method 2: Native Installation (Advanced)

### Step 1: Install PostgreSQL
1. Download PostgreSQL 14+ from: https://www.postgresql.org/download/windows/
2. Run installer
   - Installation directory: `C:\Program Files\PostgreSQL\14`
   - Password for postgres user: `password123`
   - Port: `5432`
   - Locale: Default
3. Complete installation

### Step 2: Install TimescaleDB Extension
```bash
# Open PostgreSQL command line (pgAdmin or psql)
# Connect as postgres user
psql -U postgres

# Create extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

# Verify installation
SELECT * FROM timescaledb_information.about();
```

---

## Database Setup (Both Methods)

### Step 1: Connect to Database
Using `psql` (command line):
```bash
psql -h localhost -U postgres -d sensor_db
# Password: password123
```

### Step 2: Create Schema
```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create sensors table
CREATE TABLE IF NOT EXISTS sensors (
  sensor_id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  sensor_name VARCHAR(255) NOT NULL,
  sensor_type VARCHAR(50) NOT NULL, -- temperature, humidity, pressure, etc.
  location VARCHAR(255),
  unit VARCHAR(50), -- Celsius, %, hPa, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, sensor_name)
);

-- Create time-series table for readings
CREATE TABLE IF NOT EXISTS sensor_readings (
  time TIMESTAMP NOT NULL,
  sensor_id INT NOT NULL REFERENCES sensors(sensor_id) ON DELETE CASCADE,
  value FLOAT NOT NULL,
  quality INT DEFAULT 100 -- 0-100% quality score
);

-- Convert to hypertable (TimescaleDB feature for efficient time-series storage)
SELECT create_hypertable('sensor_readings', 'time', if_not_exists => TRUE);

-- Create index for fast queries
CREATE INDEX IF NOT EXISTS ix_sensor_readings_sensor_id_time 
ON sensor_readings (sensor_id, time DESC);

-- Create index on device_id through sensors table
CREATE INDEX IF NOT EXISTS ix_sensors_device_id 
ON sensors (device_id);
```

---

## GUI Management Tools

### Option 1: pgAdmin (Included with PostgreSQL)
1. Open pgAdmin 4 from Windows Start menu
2. Set master password
3. Add server:
   - Name: `TimescaleDB`
   - Host: `localhost`
   - Port: `5432`
   - Username: `postgres`
   - Password: `password123`

### Option 2: DBeaver (Free Download)
1. Download from: https://dbeaver.io/download/
2. Create new database connection:
   - Type: PostgreSQL
   - Server Host: `localhost`
   - Port: `5432`
   - Database: `sensor_db`
   - Username: `postgres`
   - Password: `password123`

---

## Verify Installation

### Using psql:
```bash
psql -h localhost -U postgres -d sensor_db

# Inside psql:
\dt  -- List tables
SELECT * FROM timescaledb_information.about();  -- Check TimescaleDB version
\q   -- Exit
```

### Using SQL Query:
```sql
-- Check if extension is installed
SELECT * FROM pg_extension WHERE extname = 'timescaledb';

-- Check hypertables
SELECT * FROM timescaledb_information.hypertables;
```

---

## Docker Useful Commands

```bash
# View logs
docker logs timescaledb

# Stop container
docker stop timescaledb

# Start container
docker start timescaledb

# Remove container
docker rm timescaledb

# Connect to container
docker exec -it timescaledb bash
```

---

## Troubleshooting

**Port 5432 already in use:**
```bash
# Use different port
docker run -p 5433:5432 ...
# Then connect to localhost:5433
```

**Connection refused:**
- Ensure container/service is running: `docker ps` or Services app
- Check firewall: Allow port 5432 in Windows Firewall

**Database not created:**
```bash
# Manually create database
docker exec -it timescaledb psql -U postgres -c "CREATE DATABASE sensor_db;"
```

---

## Next Steps
1. ✅ TimescaleDB installed and running
2. ⏭️ Create test sensors and data (see: `SENSOR_DATA_SETUP.md`)
3. ⏭️ Build Node.js backend API server
4. ⏭️ Integrate with mobile app
