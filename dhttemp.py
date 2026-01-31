#!/usr/bin/env python3
"""
DHT11 Temperature & Humidity Sensor Control Script
Runs on Raspberry Pi and communicates with backend server
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
UPDATE_INTERVAL = 2  # seconds

def get_local_ip():
    """Get the local IP address of this Raspberry Pi"""
    import socket
    try:
        # Create a socket to determine local IP
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
        
        # Update device metadata with IP address
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
current_temperature = None
current_humidity = None
dht = None

# ============================================
# HTTP Request Handler
# ============================================
class SensorHandler(BaseHTTPRequestHandler):
    """HTTP handler to receive commands from backend"""
    
    def do_GET(self):
        """Handle GET requests"""
        global sensor_enabled, current_temperature, current_humidity
        
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query = parse_qs(parsed_url.query)
        
        if path == '/sensor/status':
            # Return current sensor status
            response = {
                'status': 'ok',
                'enabled': sensor_enabled,
                'temperature': current_temperature,
                'humidity': current_humidity,
                'device_id': DEVICE_ID,
                'sensor_id': SENSOR_ID,
                'timestamp': time.time()
            }
            self._send_response(200, response)
        
        elif path == '/sensor/control':
            # Handle sensor control commands
            action = query.get('action', [''])[0]
            
            if action == 'on':
                sensor_enabled = True
                response = {'status': 'Sensor turned ON'}
                self._send_response(200, response)
            
            elif action == 'off':
                sensor_enabled = False
                response = {'status': 'Sensor turned OFF'}
                self._send_response(200, response)
            
            else:
                self._send_response(400, {'error': 'Invalid action. Use ?action=on or ?action=off'})
        
        elif path == '/health':
            self._send_response(200, {'status': 'ok'})
        
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
# Sensor Reading Function
# ============================================
def read_sensor():
    """Read temperature and humidity from DHT11"""
    global current_temperature, current_humidity, dht, sensor_enabled
    
    if dht is None:
        try:
            dht = adafruit_dht.DHT11(DHT_PIN)
        except Exception as e:
            print(f"❌ Failed to initialize DHT11: {e}")
            return None, None
    
    if not sensor_enabled:
        print("⏸️  Sensor is disabled")
        return None, None
    
    try:
        temperature = dht.temperature
        humidity = dht.humidity
        
        if temperature is not None and humidity is not None:
            current_temperature = temperature
            current_humidity = humidity
            return temperature, humidity
        else:
            print("❌ Failed to read sensor - values are None")
            return None, None
    
    except RuntimeError as e:
        print(f"❌ Reading error: {e}")
        return None, None
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return None, None

# ============================================
# Send Data to Backend
# ============================================
def send_to_backend(temperature, humidity):
    """Send sensor readings to backend"""
    try:
        payload = {
            'device_id': DEVICE_ID,
            'sensor_id': SENSOR_ID,
            'temperature': temperature,
            'humidity': humidity,
            'timestamp': time.time()
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/readings",
            json=payload,
            timeout=5
        )
        
        if response.status_code == 201:
            print(f"✅ Data sent to backend: {temperature}°C, {humidity}%")
        else:
            print(f"⚠️  Backend returned {response.status_code}")
    
    except requests.exceptions.ConnectionError:
        print(f"⚠️  Cannot connect to backend at {BACKEND_URL}")
    except Exception as e:
        print(f"⚠️  Error sending to backend: {e}")

# ============================================
# Main Sensor Loop
# ============================================
def sensor_loop():
    """Main loop to read sensor and send data"""
    print(f"🚀 Starting sensor loop (Device: {DEVICE_ID}, Sensor: {SENSOR_ID})")
    
    while True:
        try:
            temperature, humidity = read_sensor()
            
            if temperature is not None and humidity is not None:
                print(f"📊 Temperature: {temperature}°C | Humidity: {humidity}%")
                send_to_backend(temperature, humidity)
            
            time.sleep(UPDATE_INTERVAL)
        
        except KeyboardInterrupt:
            print("🛑 Sensor loop interrupted")
            break
        except Exception as e:
            print(f"❌ Error in sensor loop: {e}")
            time.sleep(UPDATE_INTERVAL)

# ============================================
# Start HTTP Server
# ============================================
def start_http_server(port=5000):
    """Start HTTP server to handle commands"""
    server = HTTPServer(('0.0.0.0', port), SensorHandler)
    print(f"🌐 HTTP Server started on port {port}")
    print(f"📍 Endpoints:")
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
        print("🚀 Initializing DHT11 Sensor...")
        
        # Register device IP with backend
        register_device_ip()
        
        # Start HTTP server in background thread
        server_thread = threading.Thread(target=start_http_server, args=(5000,), daemon=True)
        server_thread.start()
        
        # Run sensor loop in main thread
        sensor_loop()
    
    except Exception as e:
        print(f"❌ Fatal error: {e}")
    
    finally:
        print("🔌 Cleaning up...")
        if dht:
            dht.exit()
        print("✅ Goodbye!")
