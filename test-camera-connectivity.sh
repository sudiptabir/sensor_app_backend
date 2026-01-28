#!/bin/bash

##############################################################################
# MJPEG Camera Server - Connectivity Test Script
# Run this on your Raspberry Pi to diagnose streaming issues
##############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 MJPEG Camera Server - Connectivity Diagnostics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

##############################################################################
# Test 1: Check if camera server is running
##############################################################################
echo "━━━ Test 1: Server Process ━━━"
if pgrep -f "mjpeg-camera-server" > /dev/null; then
    echo -e "${GREEN}✅ PASS${NC} - Camera server is running"
    PASSED=$((PASSED+1))
    
    # Show process details
    echo "   Process info:"
    ps aux | grep mjpeg-camera-server | grep -v grep | sed 's/^/   /'
else
    echo -e "${RED}❌ FAIL${NC} - Camera server is NOT running"
    echo "   Start it with: node mjpeg-camera-server.js"
    FAILED=$((FAILED+1))
fi
echo ""

##############################################################################
# Test 2: Check if port 8080 is listening
##############################################################################
echo "━━━ Test 2: Port Listening ━━━"
PORT=8080
if netstat -tln 2>/dev/null | grep -q ":$PORT "; then
    echo -e "${GREEN}✅ PASS${NC} - Port $PORT is open and listening"
    PASSED=$((PASSED+1))
    
    # Show listening details
    echo "   Listening on:"
    netstat -tln 2>/dev/null | grep ":$PORT " | sed 's/^/   /'
else
    echo -e "${RED}❌ FAIL${NC} - Port $PORT is not listening"
    echo "   Check if server started correctly"
    FAILED=$((FAILED+1))
fi
echo ""

##############################################################################
# Test 3: Get local IP address
##############################################################################
echo "━━━ Test 3: Network Configuration ━━━"
LOCAL_IP=$(hostname -I | awk '{print $1}')
PUBLIC_IP=$(curl -s ifconfig.me || echo "Unable to detect")

if [ -n "$LOCAL_IP" ] && [ "$LOCAL_IP" != "127.0.0.1" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Local IP detected: $LOCAL_IP"
    PASSED=$((PASSED+1))
else
    echo -e "${RED}❌ FAIL${NC} - Unable to detect valid local IP"
    FAILED=$((FAILED+1))
fi

echo "   Local IP:  $LOCAL_IP"
echo "   Public IP: $PUBLIC_IP"
echo ""

##############################################################################
# Test 4: Health endpoint
##############################################################################
echo "━━━ Test 4: Health Endpoint (Local) ━━━"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:$PORT/health 2>/dev/null)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Health endpoint responding"
    PASSED=$((PASSED+1))
    echo "   Response:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null | sed 's/^/   /' || echo "$BODY" | sed 's/^/   /'
else
    echo -e "${RED}❌ FAIL${NC} - Health endpoint not responding"
    echo "   HTTP Code: $HTTP_CODE"
    FAILED=$((FAILED+1))
fi
echo ""

##############################################################################
# Test 5: Single frame endpoint
##############################################################################
echo "━━━ Test 5: Frame Endpoint ━━━"
FRAME_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:$PORT/frame.jpg --output /tmp/test_frame.jpg 2>/dev/null)
HTTP_CODE=$(echo "$FRAME_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ] && [ -f /tmp/test_frame.jpg ]; then
    FILE_SIZE=$(stat -f%z /tmp/test_frame.jpg 2>/dev/null || stat -c%s /tmp/test_frame.jpg 2>/dev/null)
    if [ "$FILE_SIZE" -gt 1000 ]; then
        echo -e "${GREEN}✅ PASS${NC} - Frame endpoint working"
        echo "   Frame size: $FILE_SIZE bytes"
        PASSED=$((PASSED+1))
    else
        echo -e "${YELLOW}⚠️  WARN${NC} - Frame too small ($FILE_SIZE bytes)"
        echo "   Camera may not be capturing"
        FAILED=$((FAILED+1))
    fi
    rm -f /tmp/test_frame.jpg
else
    echo -e "${RED}❌ FAIL${NC} - Frame endpoint not working"
    echo "   HTTP Code: $HTTP_CODE"
    FAILED=$((FAILED+1))
fi
echo ""

##############################################################################
# Test 6: MJPEG stream endpoint
##############################################################################
echo "━━━ Test 6: MJPEG Stream Endpoint ━━━"
# Request stream for 2 seconds
timeout 2 curl -s http://localhost:$PORT/stream.mjpeg > /tmp/test_stream.mjpeg 2>/dev/null

if [ -f /tmp/test_stream.mjpeg ]; then
    STREAM_SIZE=$(stat -f%z /tmp/test_stream.mjpeg 2>/dev/null || stat -c%s /tmp/test_stream.mjpeg 2>/dev/null)
    if [ "$STREAM_SIZE" -gt 5000 ]; then
        echo -e "${GREEN}✅ PASS${NC} - MJPEG stream working"
        echo "   Streamed data: $STREAM_SIZE bytes in 2 seconds"
        PASSED=$((PASSED+1))
    else
        echo -e "${YELLOW}⚠️  WARN${NC} - Stream data too small ($STREAM_SIZE bytes)"
        echo "   Camera may not be streaming properly"
        FAILED=$((FAILED+1))
    fi
    rm -f /tmp/test_stream.mjpeg
else
    echo -e "${RED}❌ FAIL${NC} - Stream endpoint not responding"
    FAILED=$((FAILED+1))
fi
echo ""

##############################################################################
# Test 7: Camera hardware
##############################################################################
echo "━━━ Test 7: Camera Hardware ━━━"
if rpicam-hello --version > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC} - rpicam tools installed"
    PASSED=$((PASSED+1))
    
    # Try to detect camera
    if rpicam-hello --list-cameras 2>&1 | grep -q "Available cameras"; then
        echo -e "${GREEN}✅ PASS${NC} - Camera detected"
        PASSED=$((PASSED+1))
        echo "   Camera info:"
        rpicam-hello --list-cameras 2>&1 | sed 's/^/   /'
    else
        echo -e "${RED}❌ FAIL${NC} - No camera detected"
        echo "   Check camera cable and enable camera in raspi-config"
        FAILED=$((FAILED+1))
    fi
else
    echo -e "${YELLOW}⚠️  WARN${NC} - rpicam tools not found"
    echo "   Install with: sudo apt install rpicam-apps"
    FAILED=$((FAILED+1))
fi
echo ""

##############################################################################
# Test 8: Firebase connectivity
##############################################################################
echo "━━━ Test 8: Firebase Connection ━━━"
if [ -f "./serviceAccountKey.json" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Firebase credentials file exists"
    PASSED=$((PASSED+1))
    
    # Check if it's valid JSON
    if python3 -m json.tool ./serviceAccountKey.json > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC} - Firebase credentials file is valid JSON"
        PASSED=$((PASSED+1))
    else
        echo -e "${RED}❌ FAIL${NC} - Firebase credentials file is corrupted"
        FAILED=$((FAILED+1))
    fi
else
    echo -e "${RED}❌ FAIL${NC} - Firebase credentials file not found"
    echo "   Expected: ./serviceAccountKey.json"
    FAILED=$((FAILED+1))
fi
echo ""

##############################################################################
# Test 9: Firewall check
##############################################################################
echo "━━━ Test 9: Firewall Rules ━━━"
if command -v ufw > /dev/null 2>&1; then
    if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
        if sudo ufw status 2>/dev/null | grep -q "$PORT"; then
            echo -e "${GREEN}✅ PASS${NC} - Port $PORT allowed in firewall"
            PASSED=$((PASSED+1))
        else
            echo -e "${YELLOW}⚠️  WARN${NC} - Port $PORT not explicitly allowed in firewall"
            echo "   Run: sudo ufw allow $PORT/tcp"
        fi
    else
        echo -e "${GREEN}✅ INFO${NC} - Firewall (ufw) is inactive"
    fi
else
    echo -e "${GREEN}✅ INFO${NC} - No firewall detected (ufw not installed)"
fi
echo ""

##############################################################################
# Test 10: Network accessibility (from same network)
##############################################################################
echo "━━━ Test 10: Network Accessibility ━━━"
if [ -n "$LOCAL_IP" ]; then
    # Try to connect via local IP
    REMOTE_HEALTH=$(curl -s -w "\n%{http_code}" http://$LOCAL_IP:$PORT/health 2>/dev/null)
    REMOTE_CODE=$(echo "$REMOTE_HEALTH" | tail -n1)
    
    if [ "$REMOTE_CODE" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} - Server accessible via local IP"
        echo "   URL: http://$LOCAL_IP:$PORT/stream.mjpeg"
        PASSED=$((PASSED+1))
    else
        echo -e "${RED}❌ FAIL${NC} - Server not accessible via local IP"
        echo "   Check firewall or network configuration"
        FAILED=$((FAILED+1))
    fi
else
    echo -e "${YELLOW}⚠️  SKIP${NC} - Cannot test (no local IP)"
fi
echo ""

##############################################################################
# Summary
##############################################################################
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}🎉 All critical tests passed!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Your camera server should be working correctly."
    echo ""
    echo "📱 Mobile App Connection URLs:"
    echo "   Local:  http://$LOCAL_IP:$PORT/stream.mjpeg"
    echo "   Remote: http://$PUBLIC_IP:$PORT/stream.mjpeg (if port forwarding enabled)"
    echo ""
    echo "🧪 Test in browser:"
    echo "   Health: http://$LOCAL_IP:$PORT/health"
    echo "   Frame:  http://$LOCAL_IP:$PORT/frame.jpg"
    echo "   Stream: http://$LOCAL_IP:$PORT/stream.mjpeg"
    echo ""
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}⚠️  Some tests failed - please review above${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "💡 Quick fixes:"
    echo ""
    
    if ! pgrep -f "mjpeg-camera-server" > /dev/null; then
        echo "   1. Start camera server:"
        echo "      cd /path/to/Sensor_app"
        echo "      node mjpeg-camera-server.js"
        echo ""
    fi
    
    if [ "$FAILED" -gt 0 ]; then
        echo "   2. Check camera connection:"
        echo "      rpicam-hello --list-cameras"
        echo ""
        echo "   3. Enable camera if needed:"
        echo "      sudo raspi-config"
        echo "      → Interface Options → Camera → Enable"
        echo ""
        echo "   4. Allow port through firewall:"
        echo "      sudo ufw allow $PORT/tcp"
        echo ""
    fi
    
    echo "📚 Full troubleshooting guide:"
    echo "   See: MJPEG_REMOTE_ACCESS_FIX.md"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
