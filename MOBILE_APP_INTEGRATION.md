# 📱 Mobile App Integration - Sensor Data Streaming

## ✅ What Was Added

Your mobile app now has **real-time sensor data streaming** from the backend!

### New Components:
1. **`useSensorData.ts`** - React hooks for fetching sensor data
2. **`SensorCard.tsx`** - Beautiful gradient cards displaying sensor values
3. **Dashboard updated** - New "📊 Sensors" tab showing live sensor readings

---

## 🚀 Next Steps

### Step 1: Update API URL
Edit `sensor_app/hooks/useSensorData.ts` and change this line to your backend IP:

```typescript
const API_URL = 'http://192.168.1.100:3000'; // Change to your backend IP
```

To find your IP:
```powershell
ipconfig
```

Look for "IPv4 Address" (usually 192.168.x.x or 10.0.x.x)

### Step 2: Rebuild Mobile App
```powershell
cd c:\Users\SUDIPTA\Downloads\Sensor_app\sensor_app
npx expo run:android
```

### Step 3: Verify Test Data is Running
In a terminal, check if data generator is running:
```powershell
curl -UseBasicParsing "http://localhost:3000/api/readings/1"
```

Should return array of sensor readings.

### Step 4: Open App and Check Sensors Tab
1. Navigate to the **"📊 Sensors"** tab (new tab at bottom)
2. You should see:
   - **7 test sensors** (Temperature, Humidity, Pressure, CPU Temp, Memory, Wind Speed, Rainfall)
   - **Live data** updating every 5 seconds
   - **Statistics** (min, max, average)
   - **Gradient colors** based on sensor type

---

## 📊 What Each Component Does

### `useSensorData.ts` Hooks

**1. `useSensorData(sensorId, hours)`**
```typescript
const { readings, stats, loading, error } = useSensorData(1, 24);
```
- Fetches sensor readings for last X hours
- Auto-refreshes every 5 seconds
- Returns: readings array, statistics, loading state

**2. `useSensors(deviceId?)`**
```typescript
const { sensors, loading, error } = useSensors('device_001');
```
- Fetches all sensors (optionally filtered by device)
- Returns: array of sensors with metadata

**3. `useDevices()`**
```typescript
const { devices, loading, error } = useDevices();
```
- Fetches all registered devices
- Returns: array of devices

### `SensorCard.tsx` Component

Displays a single sensor with:
- 🎨 **Gradient colors** by sensor type
- 📈 **Current value** large and prominent
- 📊 **Statistics**: Average, Min, Max, Reading count
- 🔄 **Auto-refresh** every 5 seconds
- ⚡ **Icons** for different sensor types

```typescript
<SensorCard
  sensorId={1}
  sensorName="Temperature"
  sensorType="temperature"
  unit="°C"
  deviceName="Warehouse Unit 1"
/>
```

---

## 🔧 Customize

### Change Refresh Interval
In `useSensorData.ts`, update these lines:
```typescript
// Change 5000 to desired milliseconds
const interval = setInterval(fetchData, 5000); // Currently 5 seconds
```

### Change Backend URL
```typescript
// Line 1 in useSensorData.ts
const API_URL = 'http://your-backend-ip:3000';
```

### Change Number of Hours to Display
```typescript
// In your component
const { readings, stats } = useSensorData(1, 48); // Show last 48 hours
```

### Add More Sensor Types
Edit `SensorCard.tsx` in the `getGradientColors()` and `getSensorIcon()` functions:
```typescript
case 'co2': // Your new type
  return ['#00FF00', '#00AA00'];
```

---

## 🎨 Sensor Type Colors

| Sensor | Colors | Icon |
|--------|--------|------|
| Temperature | Red → Orange | 🌡️ |
| Humidity | Teal → Blue | 💧 |
| Pressure | Mint → Teal | 📌 |
| Memory | Yellow → Orange | 💾 |
| Wind Speed | Green → Blue | 💨 |
| Rainfall | Light Blue → Dark Blue | 🌧️ |

---

## 🧪 Test It

### Test 1: Verify Hook is Fetching
Open app console (Expo DevTools) and check for API calls to backend.

### Test 2: Verify Data Updates
Keep Sensors tab open for 30 seconds. Values should change every 5 seconds.

### Test 3: Check Statistics
Open a sensor card. Statistics should show:
- **Min**: Lowest value in time window
- **Max**: Highest value in time window
- **Avg**: Average of all readings
- **Readings**: Total number of data points

### Test 4: Test with Multiple Sensors
Add 2-3 sensors to dashboard and verify each updates independently.

---

## 🔴 Troubleshooting

### "Connection refused" error
- Verify backend is running: `curl -UseBasicParsing http://localhost:3000/health`
- Check API_URL in hook is correct (should be your machine's IP, not localhost)
- Ensure phone/emulator can reach backend IP

### Sensors not appearing
- Check if test data generator is running
- Verify database has sensors: `curl -UseBasicParsing http://backend-ip:3000/api/sensors`
- Check Expo console for error messages

### Data not updating
- Verify interval is set correctly (default 5000ms = 5 seconds)
- Check if backend is receiving new data from generator
- Restart app by closing and reopening

### Blank statistics
- Statistics show only after 5+ readings are available
- Wait a few seconds for data to accumulate

---

## 📝 File Locations

```
sensor_app/
├── hooks/
│   └── useSensorData.ts          ← Data fetching hooks
├── components/
│   └── SensorCard.tsx             ← Sensor display component
└── app/
    └── dashboard.tsx              ← Updated with Sensors tab
```

---

## ✨ Features Summary

✅ Real-time sensor data streaming  
✅ Auto-refresh every 5 seconds  
✅ Beautiful gradient cards  
✅ Live statistics (min/max/avg)  
✅ Multiple sensor types  
✅ Device filtering  
✅ Error handling  
✅ Loading states  
✅ Type-safe TypeScript  

---

## 🎉 You're All Set!

Your app now displays **live sensor data** from your backend!

Next steps:
1. ✅ Test with mobile app
2. ⏭️ Connect real IoT devices to backend
3. ⏭️ Add more sensor types
4. ⏭️ Create analytics dashboard
5. ⏭️ Setup alerts for sensor thresholds
