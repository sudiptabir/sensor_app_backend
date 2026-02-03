@echo off
REM 🎥 WebRTC Server Starter for Windows 11

echo.
echo ============================================================
echo 🎥 WebRTC Video Server Launcher
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)

echo ✅ Python found
echo.

REM Check if dependencies are installed
echo 📦 Checking dependencies...
python -c "import aiortc" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Installing required packages...
    pip install -r webrtc_requirements.txt
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

echo ✅ All dependencies installed
echo.

REM Get local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4 Address"') do (
    set "ip=%%a"
    set "ip=!ip: =!"
)

echo 📡 Your laptop IP: %ip%
echo.
echo 🚀 Starting WebRTC Server...
echo.

REM Run the server
python webrtc_server.py

pause
