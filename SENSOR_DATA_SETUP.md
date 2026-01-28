# 🌍 Complete Sensor Data System Setup Guide

## Overview

This guide walks you through setting up a complete sensor data system with:
- **TimescaleDB** for time-series data storage
- **Node.js Backend API** for sensor management and streaming
- **Mobile App Integration** for real-time sensor visualization

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Remote IoT Devices                         │
│    (Arduino, Raspberry Pi, ESP32, Custom Sensors)              │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP POST (Sensor Data)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              Node.js Backend API Server                         │
│  • REST API endpoints                                           │
│  • WebSocket real-time streaming                              │
│  • Data validation & batch processing                          │
└────────────────────┬────────────────────────────────────────────┘
                     │ SQL Queries
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TimescaleDB (PostgreSQL)                      │
│  • Hypertables for efficient time-series storage               │
│  • Automatic data compression                                  │
│  • Built-in retention policies                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  ┌──────────────┐         ┌──────────────┐
  │ Mobile App   │         │ Dashboard    │
  │ (Real-time   │         │ (Analytics)  │
  │  Display)    │         │              │
  └──────────────┘         └──────────────┘
```

---

## Step 1: Install and Setup TimescaleDB

### Option A: Docker (Recommended)

```bash
# Create persistent volume
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

# Verify it's running
docker ps | grep timescaledb
```

### Option B: Native PostgreSQL + TimescaleDB

See [TIMESCALEDB_SETUP.md](TIMESCALEDB_SETUP.md) for detailed native installation steps.

### Step 1.2: Load Database Schema

```bash
# Connect to database and load schema
psql -h localhost -U postgres -d sensor_db -f schema.sql
```

**Verify schema was created:**
```bash
psql -h localhost -U postgres -d sensor_db -c "
  SELECT * FROM pg_tables WHERE schemaname = 'public';
"
```

Expected tables:
- `device_metadata` - Device information
- `sensors` - Sensor metadata
- `sensor_readings` - Time-series hypertable for readings
- `alert_rules` - Alert configuration

---

## Step 2: Setup Node.js Backend Server

### Step 2.1: Install Dependencies

```bash
# Navigate to project directory
cd c:\Users\SUDIPTA\Downloads\Sensor_app

# Install backend dependencies
npm install express pg cors dotenv socket.io
```

Or install from package.json:
```bash
npm install
```

**Required packages:**
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.10.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "socket.io": "^4.5.0"
  }
}
```

### Step 2.2: Configure Environment

Copy `.env.backend` template:
```bash
cp .env.backend .env.backend.local
```

Edit `.env.backend.local` with your settings:
```env
DB_USER=postgres
DB_PASSWORD=password123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sensor_db
PORT=3000
```

### Step 2.3: Start Backend Server

```bash
# Start with Node
node sensor-backend.js

# Or with npm (if added to package.json scripts)
npm run backend-server
```

Expected output:
```
╔═══════════════════════════════════════════════════════╗
║         🚀 Sensor Backend Server Started             ║
║                                                       ║
║  📡 Server: http://localhost:3000                    ║
║  🗄️  Database: localhost:5432                        ║
║  📊 WebSocket: ws://localhost:3000                   ║
║                                                       ║
║  API Docs: http://localhost:3000/api               ║
║  Health: http://localhost:3000/health              ║
╚═══════════════════════════════════════════════════════╝
```

---

## Step 3: Generate Test Data

### Step 3.1: One-Time Test Data Generation

```bash
# Run test data generator (one time)
node sensor-test-generator.js
```

Expected output:
```
📱 Creating test devices...
✅ Created 3 test devices

📊 Creating sensors...
✅ Created 7 sensors

📈 Generating test readings...
⏱️  14:30:45
  📊 Sensor 1: 22.5
  📊 Sensor 2: 65.3
  📊 Sensor 3: 1012.8
  ...
```

### Step 3.2: Continuous Test Data Streaming

```bash
# Stream test data every 5 seconds (continuous)
node sensor-test-generator.js --continuous --interval=5000

# Stream test data every 1 second (high frequency)
node sensor-test-generator.js --continuous --interval=1000
```

Keep this running to simulate real sensor data flowing in.

---

## Step 4: Test Backend API

### Using curl or Postman

**Get all devices:**
```bash
curl http://localhost:3000/api/devices
```

**Get all sensors:**
```bash
curl http://localhost:3000/api/sensors
```

**Get sensor readings (last 24 hours):**
```bash
curl "http://localhost:3000/api/readings/1?hours=24&limit=100"
```

**Get sensor statistics:**
```bash
curl "http://localhost:3000/api/readings/stats/1?hours=24"
```

**Add single sensor reading:**
```bash
curl -X POST http://localhost:3000/api/readings \
  -H "Content-Type: application/json" \
  -d '{"sensor_id": 1, "value": 23.5, "quality": 95}'
```

**Batch add multiple readings:**
```bash
curl -X POST http://localhost:3000/api/readings/batch \
  -H "Content-Type: application/json" \
  -d '{
    "readings": [
      {"sensor_id": 1, "value": 22.5, "quality": 100},
      {"sensor_id": 2, "value": 65.3, "quality": 98},
      {"sensor_id": 3, "value": 1012.8, "quality": 100}
    ]
  }'
```

---

## Step 5: Integrate with Mobile App

### Step 5.1: Add Sensor Hooks

Create `sensor_app/hooks/useSensorData.ts`:

```typescript
import { useEffect, useState } from 'react';

interface SensorReading {
  sensor_id: number;
  value: number;
  quality: number;
  timestamp: string;
}

interface Sensor {
  sensor_id: number;
  sensor_name: string;
  sensor_type: string;
  unit: string;
  device_id: string;
}

export function useSensorData(sensorId: number) {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReadings = async () => {
      try {
        const response = await fetch(
          `http://localhost:3000/api/readings/${sensorId}?hours=24`
        );
        const data = await response.json();
        setReadings(data);

        // Fetch stats
        const statsResponse = await fetch(
          `http://localhost:3000/api/readings/stats/${sensorId}?hours=24`
        );
        const statsData = await statsResponse.json();
        setStats(statsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchReadings();
    const interval = setInterval(fetchReadings, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [sensorId]);

  return { readings, stats, loading, error };
}

export function useSensors(deviceId?: string) {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const url = deviceId
          ? `http://localhost:3000/api/sensors?deviceId=${deviceId}`
          : 'http://localhost:3000/api/sensors';
        
        const response = await fetch(url);
        const data = await response.json();
        setSensors(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSensors();
  }, [deviceId]);

  return { sensors, loading, error };
}
```

### Step 5.2: Create Sensor Display Component

Create `sensor_app/components/SensorCard.tsx`:

```typescript
import { View, Text, StyleSheet } from 'react-native';
import { useSensorData } from '../hooks/useSensorData';

interface Props {
  sensorId: number;
  sensorName: string;
  sensorType: string;
  unit: string;
}

export default function SensorCard({
  sensorId,
  sensorName,
  sensorType,
  unit,
}: Props) {
  const { readings, stats, loading } = useSensorData(sensorId);

  const currentValue = readings?.[0]?.value?.toFixed(2);
  const avgValue = stats?.avg_value?.toFixed(2);
  const minValue = stats?.min_value?.toFixed(2);
  const maxValue = stats?.max_value?.toFixed(2);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{sensorName}</Text>
      <Text style={styles.type}>{sensorType}</Text>
      
      {loading ? (
        <Text>Loading...</Text>
      ) : (
        <>
          <View style={styles.valueContainer}>
            <Text style={styles.currentValue}>{currentValue}</Text>
            <Text style={styles.unit}>{unit}</Text>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.label}>Avg</Text>
              <Text style={styles.value}>{avgValue}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.label}>Min</Text>
              <Text style={styles.value}>{minValue}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.label}>Max</Text>
              <Text style={styles.value}>{maxValue}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  type: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  currentValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  unit: {
    fontSize: 16,
    color: '#666',
    marginLeft: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  stat: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    color: '#999',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 3,
  },
});
```

### Step 5.3: Add Sensor Dashboard Tab

Add to `sensor_app/app/dashboard.tsx`:

```typescript
import SensorCard from '../components/SensorCard';
import { useSensors } from '../hooks/useSensorData';

// Inside Dashboard component:
const [sensorTab, setSensorTab] = useState<"alerts" | "devices" | "sensors">("sensors");
const { sensors, loading: sensorsLoading } = useSensors();

// Add tab button in UI:
<TouchableOpacity
  onPress={() => setSensorTab("sensors")}
  style={[styles.tabButton, sensorTab === "sensors" && styles.activeTab]}
>
  <Text>📊 Sensors</Text>
</TouchableOpacity>

// Add sensor list:
{sensorTab === "sensors" && (
  <FlatList
    data={sensors}
    keyExtractor={(item) => item.sensor_id.toString()}
    renderItem={({ item }) => (
      <SensorCard
        sensorId={item.sensor_id}
        sensorName={item.sensor_name}
        sensorType={item.sensor_type}
        unit={item.unit}
      />
    )}
    ListEmptyComponent={
      sensorsLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <Text>No sensors available</Text>
      )
    }
  />
)}
```

---

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/devices` | Get all registered devices |
| POST | `/api/devices` | Register new device |
| GET | `/api/sensors` | Get all sensors |
| POST | `/api/sensors` | Create new sensor |
| GET | `/api/readings/:sensorId` | Get sensor readings |
| POST | `/api/readings` | Add single reading |
| POST | `/api/readings/batch` | Add multiple readings |
| GET | `/api/readings/stats/:sensorId` | Get sensor statistics |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hours` | int | 24 | Hours of historical data |
| `limit` | int | 1000 | Max readings to return |
| `deviceId` | string | - | Filter sensors by device |

---

## Troubleshooting

### Database Connection Failed
```bash
# Check TimescaleDB is running
docker ps | grep timescaledb

# If not running, start it:
docker start timescaledb

# Check logs:
docker logs timescaledb
```

### Backend Server Won't Start
```bash
# Port 3000 already in use?
netstat -ano | findstr :3000
# Kill the process or use different port:
PORT=3001 node sensor-backend.js
```

### No Test Data Appearing
1. Verify backend is running: `curl http://localhost:3000/health`
2. Check database connection: Connect via pgAdmin or psql
3. Verify schema exists: `psql -h localhost -U postgres -d sensor_db -c "\dt"`

### Mobile App Can't Connect to Backend
- Use device IP instead of `localhost`: `http://192.168.x.x:3000`
- Ensure firewall allows port 3000
- Check backend is accessible: `curl http://backend-ip:3000/api`

---

## Next Steps

1. ✅ TimescaleDB installed
2. ✅ Backend server running
3. ✅ Test data generated
4. ⏭️ Connect remote devices to backend (HTTP POST to `/api/readings`)
5. ⏭️ Monitor real-time data in mobile app
6. ⏭️ Setup alerting rules
7. ⏭️ Create dashboards for analytics

---

## File Structure

```
Sensor_app/
├── TIMESCALEDB_SETUP.md          # TimescaleDB installation
├── schema.sql                     # Database schema
├── sensor-backend.js              # Backend API server
├── sensor-test-generator.js       # Test data generator
├── .env.backend                   # Environment config
│
└── sensor_app/
    ├── hooks/
    │   └── useSensorData.ts       # Data fetching hooks
    ├── components/
    │   └── SensorCard.tsx          # Sensor display component
    └── app/
        └── dashboard.tsx           # Main app screen
```

---

## Performance Tips

- **Batch readings**: Send multiple readings at once with `/api/readings/batch`
- **Compression**: TimescaleDB automatically compresses old data
- **Indexing**: Create indexes on frequently queried columns
- **Retention**: Old data is automatically deleted based on policies

---

## Security Considerations

- 🔒 Add authentication to API (JWT tokens)
- 🔒 Use HTTPS in production
- 🔒 Validate all incoming data
- 🔒 Use environment variables for secrets
- 🔒 Implement rate limiting
- 🔒 Add request logging and monitoring

---

For more help: See individual setup files or contact support.
