# Python Virtual Environment Setup (rtc-test)

## ✅ Virtual Environment Created

Your Python virtual environment `rtc-test` has been created and configured.

---

## How to Activate

### Option 1: Command Prompt (CMD)
```bash
rtc-test\Scripts\activate.bat
```

### Option 2: PowerShell
```powershell
.\rtc-test\Scripts\Activate.ps1
```

If you get an execution policy error in PowerShell, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then try again:
```powershell
.\rtc-test\Scripts\Activate.ps1
```

---

## After Activation

Once activated, your prompt will show:
```
(rtc-test) C:\Users\SUDIPTA\Downloads\Sensor_app>
```

---

## Installed Packages

Currently installed:
- ✅ `opencv-python` - For webcam capture
- ✅ `numpy` - Required by OpenCV

---

## Install Additional Packages

To install more packages while in the virtual environment:

```bash
pip install package-name
```

For example:
```bash
pip install aiohttp
pip install aiortc
```

---

## Deactivate Virtual Environment

When done, deactivate with:
```bash
deactivate
```

---

## Run WebRTC Server

Once activated, run the server:

```bash
python webrtc_server.py
```

---

## Troubleshooting

### "Python is not recognized"
- Make sure you're in the correct directory
- Or use the full path: `C:\Users\SUDIPTA\Downloads\Sensor_app\rtc-test\Scripts\python.exe`

### "Permission denied" in PowerShell
- Run PowerShell as Administrator
- Or change execution policy (see above)

### "Module not found"
- Make sure virtual environment is activated
- Check with: `pip list`

---

## Quick Start Script

Create a file `activate_venv.bat`:

```batch
@echo off
echo Activating rtc-test virtual environment...
call rtc-test\Scripts\activate.bat
cmd /k
```

Then double-click it to activate the venv in a new terminal.

---

## Next Steps

1. Activate the virtual environment
2. Install additional packages as needed
3. Run the WebRTC server
4. Test from mobile app
