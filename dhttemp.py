#!/usr/bin/env python3
"""
DHT11 Temperature & Humidity Sensor Control Script
Runs on Raspberry Pi - Only handles sensor on/off control
"""

import time
import json
import requests
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import board
import adafruit_dht

# ============================================
# Configuration
# ============================================
BACKEND_URL = "https://web-production-3d9a.up.railway.app"  # Your Railway backend
DEVICE_ID = "3d49c55d-bbfd-4bd0-9663-8728d64743ac"  # Raspberry Pi device ID from admin portal
SENSOR_ID = 6  # DHT11 Sensor ID (integer)
DHT_PIN = board.D4  # GPIO4
STATUS_CHECK_INTERVAL = 5  # Check backend status every 5 seconds

def get_local_ip():
    """Get the local IP address of this Raspberry Pi"""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None

def register_device_ip():
    """Register this device's IP address with the backend"""
    try:
        ip_address = get_local_ip()
        if not ip_address:
            print("⚠️  Could not determine local IP address")
            return
        
        print(f"📍 Local IP: {ip_address}")
        
        url = f"{BACKEND_URL}/api/devices/{DEVICE_ID}/metadata"
        response = requests.put(
            url,
            json={"ip_address": ip_address},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code in [200, 201]:
            print(f"✅ Device IP registered: {ip_address}")
        else:
            print(f"⚠️  Failed to register IP: {response.status_code}")
    except Exception as e:
        print(f"⚠️  Error registering IP: {e}")

# ============================================
# Global State
# ============================================
sensor_enabled = True
dht = None

# ============================================
# HTTP Request Handler
# ============================================
class SensorHandler(BaseHTTPRequestHandler):
    """HTTP handler to receive commands from backend"""
    
    def do_GET(self):
        """Handle GET requests"""
        global sensor_enabled
        
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query = parse_qs(parsed_url.query)
        
        if path == '/sensor/status':
            response = {
                'status': 'ok',
                'enabled': sensor_enabled,
                'device_id': DEVICE_ID,
                'sensor_id': SENSOR_ID,
                'timestamp': time.time()
            }
            self._send_response(200, response)
        
        elif path == '/sensor/control':
            action = query.get('action', [''])[0]
            
            if action == 'on':
                sensor_enabled = True
                print("✅ Sensor turned ON")
                response = {'status': 'Sensor turned ON', 'enabled': True}
                self._send_response(200, response)
            
            elif action == 'off':
                sensor_enabled = False
                print("⏸️  Sensor turned OFF")
                response = {'status': 'Sensor turned OFF', 'enabled': False}
                self._send_response(200, response)
            
            else:
                self._send_response(400, {'error': 'Invalid action. Use ?action=on or ?action=off'})
        
        elif path == '/health':
            self._send_response(200, {'status': 'ok', 'sensor_enabled': sensor_enabled})
        
        else:
            self._send_response(404, {'error': 'Not found'})
    
    def _send_response(self, status_code, data):
        """Send JSON response"""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def log_message(self, format, *args):
        """Suppress default logging"""
        pass

# ============================================
# Check Sensor Status from Backend
# ============================================
def check_sensor_status():
    """Check if sensor is enabled in backend database"""
    global sensor_enabled
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/sensors?deviceId={DEVICE_ID}",
            timeout=5
        )
        
        if response.status_code == 200:
            sensors = response.json()
            for sensor in sensors:
                if sensor.get('sensor_id') == SENSOR_ID:
                    backend_enabled = sensor.get('enabled', True)
                    
                    # Update local state if changed
                    if backend_enabled != sensor_enabled:
                        sensor_enabled = backend_enabled
                        status = "ON" if sensor_enabled else "OFF"
                        print(f"🔄 Sensor state updated from backend: {status}")
                    
                    return backend_enabled
        
        return sensor_enabled
    except Exception as e:
        print(f"⚠️  Error checking backend status: {e}")
        return sensor_enabled

# ============================================
# Status Monitoring Loop
# ============================================
def status_monitor_loop():
    """Monitor sensor status from backend"""
    print(f"🔍 Starting status monitor (Device: {DEVICE_ID}, Sensor: {SENSOR_ID})")
    
    while True:
        try:
            check_sensor_status()
            time.sleep(STATUS_CHECK_INTERVAL)
        
        except KeyboardInterrupt:
            print("🛑 Status monitor interrupted")
            break
        except Exception as e:
            print(f"❌ Error in status monitor: {e}")
            time.sleep(STATUS_CHECK_INTERVAL)

# ============================================
# Start HTTP Server
# ============================================
def start_http_server(port=5000):
    """Start HTTP server to handle commands"""
    server = HTTPServer(('0.0.0.0', port), SensorHandler)
    print(f"🌐 HTTP Server started on port {port}")
    print(f"📍 Control Endpoints:")
    print(f"   - GET http://localhost:{port}/sensor/status")
    print(f"   - GET http://localhost:{port}/sensor/control?action=on")
    print(f"   - GET http://localhost:{port}/sensor/control?action=off")
    print(f"   - GET http://localhost:{port}/health")
    
    server.serve_forever()

# ============================================
# Main Entry Point
# ============================================
if __name__ == "__main__":
    try:
        print("🚀 Initializing DHT11 Sensor Control...")
        print("ℹ️  This script only handles sensor on/off control")
        print("ℹ️  No sensor data will be sent to backend")
        
        # Register device IP with backend
        register_device_ip()
        
        # Start HTTP server in background thread
        server_thread = threading.Thread(target=start_http_server, args=(5000,), daemon=True)
        server_thread.start()
        
        # Run status monitor in main thread
        status_monitor_loop()
    
    except Exception as e:
        print(f"❌ Fatal error: {e}")
    
    finally:
        print("🔌 Cleaning up...")
        if dht:
            dht.exit()
        print("✅ Goodbye!")
