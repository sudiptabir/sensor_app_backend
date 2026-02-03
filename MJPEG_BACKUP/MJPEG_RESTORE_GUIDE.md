# ⚠️ CRITICAL MJPEG CONFIGURATION BACKUP
# Date: February 1, 2026
# Purpose: WebRTC Compatibility Testing - Backup for Safe Rollback

## 🎯 BACKUP STATUS: COMPLETE

This is your complete MJPEG configuration backup. If WebRTC testing fails, you can restore this exact setup.

---

## 📂 BACKED UP FILES

### 1. Video Player Components
- ✅ **MJPEGVideoPlayer.tsx.backup** - Native Image-based MJPEG player
- ✅ **MJPEGVideoPlayerWebView.tsx.backup** - WebView-based MJPEG player

### 2. Current Dashboard Configuration
- Location: `sensor_app/app/dashboard.tsx`
- Lines: 1520-1540 (Video Player Modal)

---

## 🔧 CURRENT MJPEG CONFIGURATION

### Active Video Player
**Component:** `MJPEGVideoPlayer`  
**Import:** `import MJPEGVideoPlayer from "../utils/MJPEGVideoPlayer"`  
**Location:** Line 11 in dashboard.tsx

### Stream URL Configuration
```typescript
streamUrl={`http://${selectedDeviceForVideo.ipAddress || selectedDeviceForVideo.ip_address}:8080/stream.mjpeg`}
```

**Key Settings:**
- Protocol: HTTP
- Port: 8080
- Endpoint: /stream.mjpeg
- Frame Update: 1.5 seconds interval
- Fallback Frame URL: /frame.jpg

### Video Player Modal Implementation
```typescript
<Modal
  visible={showVideoPlayer}
  transparent
  animationType="fade"
  onRequestClose={() => {
    setShowVideoPlayer(false);
    setSelectedDeviceForVideo(null);
  }}
>
  <View style={styles.videoPlayerOverlay}>
    <View style={styles.videoPlayerContainer}>
      <View style={styles.videoPlayerHeader}>
        <Text style={styles.videoPlayerTitle}>
          📹 {selectedDeviceForVideo?.label || "Device"} - Live Feed
        </Text>
        <TouchableOpacity
          onPress={() => {
            setShowVideoPlayer(false);
            setSelectedDeviceForVideo(null);
          }}
        >
          <Text style={styles.videoPlayerCloseBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.videoPlayerContent}>
        {selectedDeviceForVideo?.ipAddress || selectedDeviceForVideo?.ip_address ? (
          <MJPEGVideoPlayer
            streamUrl={`http://${selectedDeviceForVideo.ipAddress || selectedDeviceForVideo.ip_address}:8080/stream.mjpeg`}
            deviceLabel={selectedDeviceForVideo?.name || "Camera"}
            onClose={() => {
              setShowVideoPlayer(false);
              setSelectedDeviceForVideo(null);
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
      </View>

      <View style={styles.videoPlayerFooter}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            setShowVideoPlayer(false);
            setSelectedDeviceForVideo(null);
          }}
        >
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
```

---

## 🔄 HOW TO REVERT FROM WEBRTC BACK TO MJPEG

### Step 1: Restore Video Player Files

```powershell
# Navigate to backup directory
cd C:\Users\SUDIPTA\Downloads\Sensor_app\MJPEG_BACKUP

# Copy backup files back to original location
Copy-Item MJPEGVideoPlayer.tsx.backup C:\Users\SUDIPTA\Downloads\Sensor_app\sensor_app\utils\MJPEGVideoPlayer.tsx -Force
Copy-Item MJPEGVideoPlayerWebView.tsx.backup C:\Users\SUDIPTA\Downloads\Sensor_app\sensor_app\utils\MJPEGVideoPlayerWebView.tsx -Force
```

### Step 2: Update dashboard.tsx Import

In `sensor_app/app/dashboard.tsx`, line 11:

**Change FROM:**
```typescript
import WebRTCVideoPlayer from "../utils/WebRTCVideoPlayer";
```

**Change TO:**
```typescript
import MJPEGVideoPlayer from "../utils/MJPEGVideoPlayer";
```

### Step 3: Update Video Player Component (Lines 1520-1540)

**Change FROM:**
```typescript
<WebRTCVideoPlayer
  deviceId={selectedDeviceForVideo?.id}
  deviceLabel={selectedDeviceForVideo?.name || "Camera"}
  onClose={() => {
    setShowVideoPlayer(false);
    setSelectedDeviceForVideo(null);
  }}
/>
```

**Change TO:**
```typescript
<MJPEGVideoPlayer
  streamUrl={`http://${selectedDeviceForVideo.ipAddress || selectedDeviceForVideo.ip_address}:8080/stream.mjpeg`}
  deviceLabel={selectedDeviceForVideo?.name || "Camera"}
  onClose={() => {
    setShowVideoPlayer(false);
    setSelectedDeviceForVideo(null);
  }}
/>
```

### Step 4: Rebuild App

```powershell
cd C:\Users\SUDIPTA\Downloads\Sensor_app\sensor_app
npx expo start --clear
```

---

## 📋 MJPEG COMPONENT FEATURES

### MJPEGVideoPlayer.tsx (Native Image)
✅ Uses React Native Image component  
✅ Frame-by-frame loading (1.5s interval)  
✅ Fade animation between frames  
✅ Automatic cache busting  
✅ Error handling with retry  
✅ Loading indicators  
✅ Works on iOS and Android  

### MJPEGVideoPlayerWebView.tsx (WebView)
✅ Uses React Native WebView  
✅ HTML/JavaScript based streaming  
✅ 1 second frame updates  
✅ Better for continuous streaming  
✅ Lower battery usage  
✅ Cross-platform compatible  

---

## 🔍 VERIFICATION CHECKLIST

After reverting, verify these work:

- [ ] Camera icon appears on devices with IP addresses
- [ ] Tapping camera icon opens video modal
- [ ] Video stream loads and displays frames
- [ ] Frames update every 1-2 seconds
- [ ] Close button works properly
- [ ] No console errors
- [ ] Works on both iOS and Android (if testing both)
- [ ] Stream URL shows in footer: `http://IP:8080/stream.mjpeg`

---

## 📊 MJPEG vs WebRTC COMPARISON

| Feature | MJPEG (Current) | WebRTC (Testing) |
|---------|-----------------|------------------|
| **Latency** | 1-2 seconds | 100-300ms |
| **Quality** | Good | Excellent |
| **Setup Complexity** | Simple ✅ | Complex |
| **Bandwidth** | Medium | Adaptive |
| **Battery Usage** | Low ✅ | Medium |
| **Firewall Issues** | Rare ✅ | Common |
| **In-App Playback** | Yes ✅ | Yes ✅ |
| **Works Offline** | No | No |
| **Requires STUN/TURN** | No ✅ | Yes |
| **Mobile Data Friendly** | Yes ✅ | Yes |

---

## 🚨 WHEN TO REVERT TO MJPEG

Revert if you experience:

❌ WebRTC connection fails consistently  
❌ Video stream doesn't start  
❌ High battery drain  
❌ Frequent disconnections  
❌ Firewall/NAT traversal issues  
❌ STUN/TURN server problems  
❌ Complex setup not worth the latency improvement  
❌ App crashes or freezes  
❌ Performance issues on older devices  

---

## ✅ WHEN TO KEEP WEBRTC

Keep WebRTC if:

✅ Connection establishes successfully  
✅ Latency is noticeably better (< 500ms)  
✅ Video quality is improved  
✅ No stability issues  
✅ Battery usage is acceptable  
✅ NAT traversal works reliably  
✅ STUN/TURN infrastructure is stable  

---

## 📁 FILE LOCATIONS

```
Sensor_app/
├── MJPEG_BACKUP/                           # THIS BACKUP DIRECTORY
│   ├── MJPEG_RESTORE_GUIDE.md             # This file
│   ├── MJPEGVideoPlayer.tsx.backup        # Native Image player
│   └── MJPEGVideoPlayerWebView.tsx.backup # WebView player
│
├── sensor_app/
│   ├── app/
│   │   └── dashboard.tsx                   # Main dashboard (line 11, 1520-1540)
│   │
│   └── utils/
│       ├── MJPEGVideoPlayer.tsx           # Active MJPEG player (will be modified)
│       ├── MJPEGVideoPlayerWebView.tsx    # Alternative MJPEG player
│       ├── WebRTCVideoPlayer.tsx          # WebRTC player (for testing)
│       └── cameraStreaming.ts             # Camera URL utilities
│
└── MJPEG_RESTORE_GUIDE.md                  # Copy of this guide (root level)
```

---

## 🛠️ QUICK RESTORE SCRIPT

Save this as `restore-mjpeg.ps1` in the Sensor_app directory:

```powershell
# Restore MJPEG Configuration
Write-Host "🔄 Restoring MJPEG Configuration..." -ForegroundColor Cyan

# Copy backup files
Copy-Item MJPEG_BACKUP\MJPEGVideoPlayer.tsx.backup sensor_app\utils\MJPEGVideoPlayer.tsx -Force
Copy-Item MJPEG_BACKUP\MJPEGVideoPlayerWebView.tsx.backup sensor_app\utils\MJPEGVideoPlayerWebView.tsx -Force

Write-Host "✅ Files restored" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Manual steps required:" -ForegroundColor Yellow
Write-Host "1. Update import in dashboard.tsx (line 11)" -ForegroundColor Yellow
Write-Host "   FROM: import WebRTCVideoPlayer from '../utils/WebRTCVideoPlayer'" -ForegroundColor Red
Write-Host "   TO:   import MJPEGVideoPlayer from '../utils/MJPEGVideoPlayer'" -ForegroundColor Green
Write-Host ""
Write-Host "2. Update component usage (lines 1520-1540)" -ForegroundColor Yellow
Write-Host "   FROM: <WebRTCVideoPlayer deviceId={...} />" -ForegroundColor Red
Write-Host "   TO:   <MJPEGVideoPlayer streamUrl={...} />" -ForegroundColor Green
Write-Host ""
Write-Host "3. Rebuild app: npx expo start --clear" -ForegroundColor Yellow
```

To use:
```powershell
cd C:\Users\SUDIPTA\Downloads\Sensor_app
.\restore-mjpeg.ps1
```

---

## 💾 BACKUP VERIFICATION

**Backup Date:** February 1, 2026  
**Backup Size:** 2 files  
**Dashboard State:** Using MJPEGVideoPlayer  
**Stream URL:** http://IP:8080/stream.mjpeg  
**Port:** 8080  
**Update Interval:** 1.5 seconds  
**Component Type:** Native Image  

**Files Protected:**
1. ✅ MJPEGVideoPlayer.tsx (273 lines)
2. ✅ MJPEGVideoPlayerWebView.tsx (242 lines)

---

## 🔐 SAFETY NOTES

- ✅ Original files are backed up with `.backup` extension
- ✅ Backups are stored in separate `MJPEG_BACKUP` directory
- ✅ No files will be overwritten without explicit action
- ✅ This guide provides exact line numbers and code snippets
- ✅ Restore process is fully reversible
- ✅ You can test WebRTC risk-free

---

## 📞 SUPPORT

If you need help reverting:

1. Check this guide's Step-by-Step instructions
2. Verify file locations match your setup
3. Ensure backup files exist in MJPEG_BACKUP/
4. Run the quick restore script
5. Manually update dashboard.tsx as specified

---

## ✨ TESTING RECOMMENDATIONS

**Before WebRTC Test:**
1. ✅ Backup created (this file proves it)
2. ✅ Current MJPEG setup works
3. ✅ Device has IP address configured
4. ✅ Camera server is running

**During WebRTC Test:**
1. Test connection establishment
2. Monitor latency and quality
3. Check battery usage
4. Test on multiple networks
5. Verify stability over time

**After WebRTC Test:**
1. If successful → Keep WebRTC
2. If issues → Restore MJPEG using this guide
3. Document your findings
4. Update configuration preferences

---

**🎉 Your MJPEG configuration is safely backed up!**

You can now proceed with WebRTC testing with confidence.
If anything goes wrong, this guide will restore your working MJPEG setup in minutes.
