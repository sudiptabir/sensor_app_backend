# 🌐 Smart Network App - Video Stream URL Detection

## How Your App Determines Which URL to Fetch Video From

### **Current Flow:**

```
1. User clicks "View Camera"
   ↓
2. App retrieves device from Firebase
   {
     id: "device123",
     ipAddress: "192.168.1.100",      ← Local IP (WiFi)
     ip_address: "192.168.1.100",     ← Alternative field name
     name: "Living Room Camera"
   }
   ↓
3. App constructs MJPEG stream URL:
   `http://${device.ipAddress || device.ip_address}:8080/stream.mjpeg`
   
   Result: `http://192.168.1.100:8080/stream.mjpeg`
   ↓
4. App passes URL to MJPEGVideoPlayer component
   ↓
5. Component fetches from that URL
```

### **Current Code Location:**

**In [sensor_app/app/dashboard.tsx](sensor_app/app/dashboard.tsx#L1491):**
```typescript
streamUrl={`http://${selectedDeviceForVideo.ipAddress || selectedDeviceForVideo.ip_address}:8080/stream.mjpeg`}
```

This **always uses the `ipAddress` field** from Firebase, which currently only has the local IP.

---

## 🔴 Problem with Current Setup

- ✅ Works: **On same WiFi** (app and Pi on home WiFi)
- ❌ Fails: **On cellular/external network** (because 192.168.1.x is not accessible)

---

## ✅ Solution: Make App Smart About Network Detection

Here's the improved logic to make your app choose the correct URL based on network type.

---

## 📋 Implementation Steps

### **Step 1: Update Firebase Device Data**

The MJPEG server should store **BOTH** local and remote IP:

**File: `mjpeg-camera-server.js` (around line 290)**

```javascript
// Update both Realtime Database and Firestore
const streamingData = {
  streaming_enabled: true,
  streaming_url: `http://${LOCAL_IP}:${HTTP_PORT}/stream.mjpeg`,
  streaming_type: 'mjpeg',
  streaming_port: HTTP_PORT,
  ipAddress: LOCAL_IP,              // ← Local IP (192.168.x.x)
  ip_address: LOCAL_IP,             // ← Backup field name
  localIP: LOCAL_IP,                // ← Explicit local IP
  remoteURL: REMOTE_URL,            // ← Public IP or domain (NEW!)
  public_ip: REMOTE_URL,            // ← Backup field name
  last_updated: new Date().getTime()
};

// Update Firestore (where the app reads device info)
firestore.collection('devices').doc(DEVICE_ID).update({
  ipAddress: LOCAL_IP,
  ip_address: LOCAL_IP,
  localIP: LOCAL_IP,
  remoteURL: REMOTE_URL,            // NEW!
  public_ip: REMOTE_URL,            // NEW!
  streaming_enabled: true,
  streaming_url: `http://${LOCAL_IP}:${HTTP_PORT}/stream.mjpeg`,
  streaming_type: 'mjpeg',
  streaming_port: HTTP_PORT,
  lastSeen: admin.firestore.FieldValue.serverTimestamp()
})
  .then(() => console.log('✅ Firestore updated with streaming info'))
  .catch(err => console.error('❌ Firestore update error:', err.message));
```

**Note:** Set `REMOTE_URL` to either:
- Your public IP: `203.0.113.45`
- Your DDNS domain: `mydevice.duckdns.org`
- Your Tailscale IP: `100.x.x.x`

---

### **Step 2: Create Network Detection Helper Utility**

**Create new file: `sensor_app/utils/networkUtils.ts`**

```typescript
/**
 * 🌐 Network Utilities
 * Smart network detection for video streaming
 */

import NetInfo from '@react-native-community/netinfo';

/**
 * Device with streaming info
 */
export interface StreamingDevice {
  id: string;
  name?: string;
  ipAddress?: string;
  ip_address?: string;
  localIP?: string;
  remoteURL?: string;
  public_ip?: string;
  [key: string]: any;
}

/**
 * Network info type
 */
export interface NetworkInfo {
  type: 'wifi' | 'cellular' | 'unknown';
  isConnected: boolean;
}

/**
 * Get current network info
 */
export async function getNetworkInfo(): Promise<NetworkInfo> {
  try {
    const state = await NetInfo.fetch();
    
    return {
      type: state.type === 'wifi' ? 'wifi' : state.type === 'cellular' ? 'cellular' : 'unknown',
      isConnected: state.isConnected ?? false,
    };
  } catch (error) {
    console.warn('[NetworkUtils] Error getting network info:', error);
    return { type: 'unknown', isConnected: false };
  }
}

/**
 * Test if device is reachable (quick connectivity test)
 */
export async function isDeviceReachable(ip: string, port: number = 8080, timeout: number = 3000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`http://${ip}:${port}/health`, {
      method: 'GET',
      signal: controller.signal as any,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn(`[NetworkUtils] Device ${ip}:${port} unreachable:`, error);
    return false;
  }
}

/**
 * Get the best available stream URL for device
 * 
 * Priority:
 * 1. If on WiFi: Use local IP (faster)
 * 2. If on cellular: Use remote URL
 * 3. Fallback: Test both, use whichever is reachable
 */
export async function getStreamUrlForDevice(device: StreamingDevice): Promise<string | null> {
  const localIP = device.ipAddress || device.ip_address || device.localIP;
  const remoteURL = device.remoteURL || device.public_ip;

  console.log('[NetworkUtils] Determining stream URL for device:', device.id);
  console.log(`  Local IP: ${localIP}`);
  console.log(`  Remote URL: ${remoteURL}`);

  if (!localIP && !remoteURL) {
    console.warn('[NetworkUtils] ❌ No IP address found for device');
    return null;
  }

  try {
    const networkInfo = await getNetworkInfo();
    console.log(`[NetworkUtils] Network type: ${networkInfo.type}`);

    if (networkInfo.type === 'wifi' && localIP) {
      // On WiFi - prioritize local IP (faster, no port forwarding needed)
      console.log(`[NetworkUtils] ✅ On WiFi - using local IP: ${localIP}`);
      return `http://${localIP}:8080/stream.mjpeg`;
    } else if (networkInfo.type === 'cellular' && remoteURL) {
      // On cellular - use remote URL
      console.log(`[NetworkUtils] ✅ On cellular - using remote URL: ${remoteURL}`);
      return `http://${remoteURL}:8080/stream.mjpeg`;
    } else {
      // Unknown network - try intelligent fallback
      console.log(`[NetworkUtils] 🔄 Unknown network type - testing reachability...`);
      
      if (localIP) {
        const localReachable = await isDeviceReachable(localIP, 8080, 2000);
        if (localReachable) {
          console.log(`[NetworkUtils] ✅ Local IP reachable: ${localIP}`);
          return `http://${localIP}:8080/stream.mjpeg`;
        }
      }

      if (remoteURL) {
        const remoteReachable = await isDeviceReachable(remoteURL, 8080, 2000);
        if (remoteReachable) {
          console.log(`[NetworkUtils] ✅ Remote URL reachable: ${remoteURL}`);
          return `http://${remoteURL}:8080/stream.mjpeg`;
        }
      }

      // Neither reachable - return local as default
      if (localIP) {
        console.warn(`[NetworkUtils] ⚠️  Neither IP reachable, using local IP as fallback`);
        return `http://${localIP}:8080/stream.mjpeg`;
      }
    }

    console.error('[NetworkUtils] ❌ Could not determine stream URL');
    return null;
  } catch (error) {
    console.error('[NetworkUtils] Error in getStreamUrlForDevice:', error);
    
    // Fallback to local IP if available
    if (localIP) {
      console.warn('[NetworkUtils] ⚠️  Falling back to local IP');
      return `http://${localIP}:8080/stream.mjpeg`;
    }
    
    return null;
  }
}

/**
 * Get all streaming URLs for a device (for debugging/fallback)
 */
export function getAllStreamingUrls(device: StreamingDevice) {
  const localIP = device.ipAddress || device.ip_address || device.localIP;
  const remoteURL = device.remoteURL || device.public_ip;

  return {
    local: localIP ? `http://${localIP}:8080/stream.mjpeg` : null,
    remote: remoteURL ? `http://${remoteURL}:8080/stream.mjpeg` : null,
    frame: {
      local: localIP ? `http://${localIP}:8080/frame.jpg` : null,
      remote: remoteURL ? `http://${remoteURL}:8080/frame.jpg` : null,
    },
    health: {
      local: localIP ? `http://${localIP}:8080/health` : null,
      remote: remoteURL ? `http://${remoteURL}:8080/health` : null,
    }
  };
}
```

---

### **Step 3: Update Dashboard to Use Smart URL Selection**

**File: `sensor_app/app/dashboard.tsx` (around line 1490)**

Add import at top:
```typescript
import { getStreamUrlForDevice } from '../utils/networkUtils';
```

Update the video player section:

```typescript
// Around line 916 - When opening video player
const handleOpenCamera = async (device: any) => {
  try {
    setSelectedDeviceForVideo(device);
    
    // Get the correct stream URL based on network
    const streamUrl = await getStreamUrlForDevice(device);
    
    if (streamUrl) {
      console.log('✅ Stream URL determined:', streamUrl);
      // Store URL for rendering
      setSelectedStreamUrl(streamUrl);
      setShowVideoPlayer(true);
    } else {
      Alert.alert(
        'Camera Error',
        'Cannot determine device URL. Make sure:\n• Device has an IP address\n• Device is connected to network',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    console.error('Error opening camera:', error);
    Alert.alert('Error', 'Failed to open camera');
  }
};

// Add state for storing the selected stream URL
const [selectedStreamUrl, setSelectedStreamUrl] = useState<string | null>(null);

// Update the video player render (around line 1490):
{selectedDeviceForVideo?.ipAddress || selectedDeviceForVideo?.ip_address ? (
  <MJPEGVideoPlayer
    streamUrl={selectedStreamUrl || ''}  // ← Use smart-detected URL
    deviceLabel={selectedDeviceForVideo?.name || "Camera"}
    onClose={() => {
      setShowVideoPlayer(false);
      setSelectedDeviceForVideo(null);
      setSelectedStreamUrl(null);
    }}
  />
) : (
  <View style={styles.videoPlaceholder}>
    <Text style={styles.videoPlaceholderText}>🎥</Text>
    <Text style={styles.videoPlaceholderLabel}>No Camera Connected</Text>
    <Text style={styles.videoPlaceholderSubtext}>
      This device does not have a camera or IP address configured
    </Text>
  </View>
)}
```

---

## 📊 URL Selection Logic Flow

```
App opened on device
  ↓
User clicks camera button
  ↓
Call getStreamUrlForDevice()
  ↓
Check network type:
  ├─ WiFi + local IP available
  │  ├─ Return: http://192.168.1.100:8080/stream.mjpeg
  │  └─ Fast, no port forwarding needed
  │
  ├─ WiFi but local IP unreachable
  │  └─ Fall back to: http://203.0.113.45:8080/stream.mjpeg
  │
  ├─ Cellular + remote URL available
  │  ├─ Return: http://203.0.113.45:8080/stream.mjpeg
  │  └─ Requires port forwarding or DDNS
  │
  ├─ Cellular + no remote URL
  │  └─ Show error: "Remote access not configured"
  │
  └─ Unknown network
     ├─ Test both IPs
     └─ Use whichever is reachable
      ↓
Pass URL to MJPEGVideoPlayer component
  ↓
Component fetches video stream from URL
```

---

## 🔧 Configuration Summary

| Component | Field | Example | Purpose |
|-----------|-------|---------|---------|
| **Firebase Device** | `ipAddress` | `192.168.1.100` | Local network streaming |
| **Firebase Device** | `remoteURL` | `203.0.113.45` | External/cellular streaming |
| **App Network Utils** | WiFi detection | Auto-detected | Choose optimal URL |
| **MJPEG Server** | Port | `8080` | Fixed streaming port |
| **Stream Endpoint** | Path | `/stream.mjpeg` | MJPEG stream |
| **Health Endpoint** | Path | `/health` | Test connectivity |

---

## 🚀 Testing Checklist

- [ ] **Local WiFi Test**
  - Connect app and Pi to same WiFi
  - Open camera
  - Verify using local IP: `http://192.168.1.x:8080/stream.mjpeg`
  - Should be instant/fast

- [ ] **External WiFi Test**
  - Connect app to different WiFi network
  - Open camera
  - App should detect different network and use remote URL
  - May show fallback message if remote not configured

- [ ] **Cellular Test**
  - Disable WiFi on phone
  - Enable cellular data
  - Open camera
  - Verify using remote URL: `http://203.0.113.45:8080/stream.mjpeg`
  - Should connect if port forwarding is set up

- [ ] **Network Switch Test**
  - Start on WiFi with camera playing
  - Switch to cellular
  - App should handle gracefully
  - May need to close/reopen camera

---

## 📱 User Experience Flow

```
1️⃣  User opens app on phone
2️⃣  Navigates to Devices tab
3️⃣  Clicks camera icon on device
4️⃣  App detects network automatically
5️⃣  Stream loads from appropriate URL
6️⃣  User sees live video:
    - On WiFi: Crystal clear, instant
    - On cellular: May have slight delay due to remote routing
```

---

## 🔒 Security Considerations

- **Local Network**: No internet exposure, very secure
- **Remote Network**: 
  - Use HTTPS if possible
  - Consider VPN (Tailscale) instead of port forwarding
  - Don't expose port 8080 if you can avoid it

---

## 📞 Troubleshooting

**Stream not loading on WiFi:**
- Verify Pi and phone on same network
- Check Pi has IP address: `hostname -I`
- Verify port forwarding not conflicting

**Stream not loading on cellular:**
- Verify port forwarding configured on router
- Check if remoteURL stored in Firebase
- Test: `curl http://YOUR_PUBLIC_IP:8080/health`

**Slow video on cellular:**
- Normal due to internet routing
- Consider reducing JPEG quality
- Check if port forwarding has low bandwidth limit

---

## 📝 Summary of Changes

| Component | Before | After |
|-----------|--------|-------|
| **Firebase** | `ipAddress` only | `ipAddress` + `remoteURL` |
| **App Logic** | Hardcoded local IP | Smart network detection |
| **Network Type** | Ignored | Detected & used |
| **WiFi Support** | ✅ Works | ✅ Works (optimized) |
| **Cellular Support** | ❌ Fails | ✅ Works (if remote URL set) |
| **Fallback** | None | Intelligent URL testing |

---

## 🎯 Next Steps

1. Update MJPEG server to store `remoteURL` in Firebase
2. Create `sensor_app/utils/networkUtils.ts` with smart detection
3. Update Dashboard component to use `getStreamUrlForDevice()`
4. Test on WiFi first (should work immediately)
5. Configure port forwarding or DDNS for cellular access
6. Test on cellular network
7. Deploy to production

---

**Created:** January 31, 2026
**Purpose:** Smart network detection for MJPEG video streaming
**Status:** Implementation guide ready
