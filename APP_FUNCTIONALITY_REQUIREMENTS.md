# Application Functionality & Requirements Documentation

## Overview

This is an IoT sensor monitoring and management system consisting of a mobile application, backend services, admin portal, and edge devices (Raspberry Pi). The system enables real-time monitoring, remote control, ML-based alerting, and multi-user device management.

---

## Core Functionalities

### 1. User Authentication & Authorization

#### User Authentication
- Google Sign-In integration for mobile app users
- Email/password authentication for admin portal users
- Session management with secure cookies
- Automatic session expiry (24 hours)
- Multi-account support (account picker on login)

#### Authorization Levels
- **End Users**: Can view and control their claimed devices
- **Admins**: Full access to all devices, users, and system settings
- **Blocked Users**: Access denied with reason displayed

#### Access Control
- Device-specific access control (per user, per device)
- Global user blocking capability
- Temporary access grants with expiration dates
- Access level management (viewer, controller, admin)
- Audit logging of all access control changes

---

### 2. Device Management

#### Device Registration
- Automatic device registration from edge devices
- Unique device ID generation
- Device metadata storage (name, type, location, IP address)
- Device status tracking (online/offline)
- Last seen timestamp

#### Device Claiming
- Users can claim unclaimed devices
- Browse available devices for claiming
- One device can belong to one user at a time
- Device unclaiming (removes user association without deletion)
- Device label customization

#### Device Information
- Device identifier and label
- Device type (Raspberry Pi, sensor hub, etc.)
- Location information
- IP address (for local network access)
- Connection status
- Associated sensors list
- Streaming capabilities

---

### 3. Sensor Monitoring

#### Real-Time Sensor Data
- Temperature readings (DHT11 sensor)
- Humidity readings (DHT11 sensor)
- Real-time data streaming via polling (15-second intervals)
- Historical data visualization
- Data quality indicators
- Timestamp for each reading

#### Sensor Management
- List all sensors for a device
- Sensor identification (ID, name, type)
- Sensor location within device
- Measurement units
- Sensor status (enabled/disabled)

#### Sensor Control
- Remote on/off control
- State synchronization between app and device
- Control via mobile app
- Control via admin portal
- Backend validation of control commands
- Access control enforcement for sensor operations

---

### 4. ML Alert System

#### Alert Generation
- Remote ML model integration
- Object detection alerts
- Risk level classification (critical, high, medium, low)
- Detected objects list
- Alert timestamp
- Device identifier association
- Image/video frame capture (optional)

#### Alert Delivery
- Push notifications to mobile devices
- In-app alert display
- Real-time alert polling (5-second intervals)
- Alert badge counters
- Sound and vibration on new alerts
- Notification tap to view details

#### Alert Management
- Alert list view with filtering
- Alert detail modal with full information
- Risk level color coding (red, orange, yellow, green)
- Alert acknowledgment
- Alert deletion
- Auto-delete based on retention policy

#### Alert Feedback
- User rating system (1-10 scale)
- Accuracy feedback (accurate/inaccurate)
- Visual indication of rated alerts (green/red background)
- Feedback stored for ML model improvement

#### Alert Retention
- Configurable auto-delete periods:
  - 7 days
  - 15 days
  - 30 days (default)
  - Never
- Automatic cleanup runs hourly
- User-configurable via settings

---

### 5. Video Streaming

#### Streaming Capabilities
- MJPEG video streaming from Raspberry Pi cameras
- HTTP-based streaming (local network)
- Frame-by-frame image loading
- Automatic frame refresh (1.5-second intervals)
- Fade animation for smooth transitions

#### Video Player Features
- Full-screen video view
- Device label display
- Stream URL display
- Connection status indicator
- Retry mechanism on errors
- Close button to exit stream

#### Camera Server
- Persistent camera process on Raspberry Pi
- MJPEG encoding
- Configurable framerate (default: 15 fps)
- Configurable JPEG quality (default: 80%)
- Health check endpoint
- Single frame snapshot endpoint
- Auto-restart on camera failure

---

### 6. Admin Portal

#### Dashboard
- System overview
- Total devices count
- Total users count
- Active alerts count
- Recent activity log

#### Device Management
- View all registered devices
- Device details and metadata
- Device status monitoring
- Force device offline/online
- Delete devices
- View device sensors
- View device users

#### User Management
- View all users
- User details (email, name, sign-up date)
- User's claimed devices list
- Block/unblock users globally
- Set block reason
- View user activity logs

#### Access Control
- Grant device access to specific users
- Revoke device access
- Set access levels (viewer, controller, admin)
- Set access expiration dates
- Block users from specific devices
- View access control history

#### Audit Logging
- All admin actions logged
- Timestamp and admin identifier
- Action type and target
- IP address tracking
- Detailed action parameters
- Searchable log history

---

### 7. Push Notifications

#### Notification Types
- New ML alert notifications
- Critical alert notifications
- Device offline notifications (optional)
- System announcements (optional)

#### Notification Features
- Rich notifications with title and body
- Custom notification data payload
- Badge count management
- Sound and vibration
- Notification tap handling
- Deep linking to alert details

#### Notification Permissions
- Permission request on app launch
- Graceful handling of denied permissions
- Re-request capability
- Platform-specific handling (iOS/Android)

---

### 8. Settings & Preferences

#### User Settings
- Alert retention period configuration
- Notification preferences
- Display preferences
- Account information view

#### Profile Management
- View user email
- View user name
- Sign out functionality
- Account deletion (future)

---

### 9. Backend API

#### Device APIs
- `GET /api/devices` - List all devices
- `POST /api/devices` - Register new device
- `PUT /api/devices/:deviceId/metadata` - Update device metadata
- `GET /api/devices/:deviceId` - Get device details

#### Sensor APIs
- `GET /api/sensors` - List sensors (optionally filtered by device)
- `POST /api/sensors` - Register new sensor
- `PUT /api/sensors/:sensorId/state` - Update sensor state (on/off)
- `GET /api/sensors/:sensorId/latest` - Get latest sensor reading

#### Readings APIs
- `GET /api/readings/:sensorId` - Get sensor readings history
- `GET /api/readings/stats/:sensorId` - Get sensor statistics
- `POST /api/readings` - Submit new sensor reading

#### Sensor Control APIs
- `GET /api/sensors/:sensorId/control?action=on|off` - Control sensor
- `POST /api/sensors/:sensorId/control` - Control sensor via POST

#### Health Check
- `GET /health` - Backend health status
- `GET /api` - API information and endpoints list

---

### 10. Edge Device Functionality (Raspberry Pi)

#### Sensor Control Script
- DHT11 sensor initialization
- Sensor state management (on/off)
- Backend status polling (5-second intervals)
- Local HTTP server for control commands
- IP address registration with backend
- Graceful error handling

#### Control Endpoints (on Pi)
- `GET /sensor/status` - Get sensor status
- `GET /sensor/control?action=on|off` - Control sensor
- `GET /health` - Health check

#### Camera Server
- MJPEG stream generation
- Frame buffering
- HTTP streaming server
- Health check endpoint
- Frame snapshot endpoint
- Auto-restart on failure

---

## Data Models

### User
- User ID (Firebase UID)
- Email
- Display name
- Photo URL
- Sign-up date
- Last login date

### Device
- Device ID (UUID)
- User ID (owner)
- Device label
- Device type
- Location
- IP address
- Streaming URL
- Streaming type (MJPEG, WebRTC)
- Streaming port
- Online status
- Last seen timestamp
- Created date
- Updated date

### Sensor
- Sensor ID
- Device ID
- Sensor name
- Sensor type (temperature, humidity, etc.)
- Location
- Unit of measurement
- Enabled status
- Created date
- Updated date

### Sensor Reading
- Reading ID
- Sensor ID
- Timestamp
- Value
- Data type (temperature, humidity)
- Quality indicator
- Created date

### ML Alert
- Alert ID
- Device ID
- Device identifier
- User ID
- Risk label (critical, high, medium, low)
- Detected objects array
- Confidence scores
- Timestamp
- Image URL (optional)
- Acknowledged status
- Rating (1-10)
- Accuracy feedback (true/false)
- Created date

### Admin User
- Admin ID
- Email
- Password hash
- Full name
- Role (admin, super_admin)
- Created date
- Last login date

### Device Access Control
- Access ID
- Device ID
- User ID
- Access level (viewer, controller, admin)
- Granted by (admin email)
- Granted date
- Expiration date
- Blocked status
- Block reason

### User Block
- Block ID
- User ID
- Blocked by (admin email)
- Blocked date
- Reason
- Active status

### Admin Log
- Log ID
- Admin email
- Action type
- Target type (device, user, access)
- Target ID
- Details (JSON)
- IP address
- Timestamp

---

## Security Requirements

### Authentication Security
- Secure token storage
- Token refresh mechanism
- Session timeout enforcement
- Multi-factor authentication support (future)

### API Security
- API key validation
- User ID verification in headers
- Rate limiting (100 requests per 15 minutes)
- CORS configuration
- Helmet security headers
- SQL injection prevention (parameterized queries)
- XSS protection

### Access Control Security
- User blocking enforcement at API level
- Device-specific access validation
- Admin action authorization
- Audit logging for security events

### Data Security
- HTTPS for all API communications
- Secure cookie configuration
- Password hashing (bcrypt)
- Environment variable protection
- Database connection encryption (SSL)

---

## Performance Requirements

### Response Times
- API response: < 500ms for 95% of requests
- Real-time data updates: 5-15 second intervals
- Video streaming: 10-15 fps minimum
- Alert delivery: < 5 seconds from generation

### Scalability
- Support 10-100 devices initially
- Support 100-1000 users
- Handle 1000+ alerts per day
- Database query optimization for time-series data

### Reliability
- 99% uptime target
- Automatic reconnection on network failures
- Graceful degradation when services unavailable
- Error logging and monitoring

---

## Integration Requirements

### External Services
- Firebase Authentication
- Firebase Cloud Messaging
- Firestore database
- PostgreSQL database (Railway)
- Google Sign-In API

### Device Integration
- Raspberry Pi support
- DHT11 sensor support
- Camera module support (Pi Camera, USB webcams)
- GPIO control
- Network connectivity

---

## User Experience Requirements

### Mobile App UX
- Intuitive navigation (tab-based)
- Visual feedback for all actions
- Loading indicators
- Error messages with retry options
- Offline capability (view cached data)
- Pull-to-refresh
- Smooth animations

### Admin Portal UX
- Responsive design
- Clear action buttons
- Confirmation dialogs for destructive actions
- Search and filter capabilities
- Pagination for large datasets
- Export functionality (future)

---

## Monitoring & Logging

### Application Logging
- Console logging for debugging
- Error tracking
- Performance metrics
- User action tracking

### System Monitoring
- Device online/offline status
- API health checks
- Database connection monitoring
- Alert delivery success rate

### Admin Audit Trail
- All admin actions logged
- User access changes logged
- Device modifications logged
- Searchable audit history

---

## Future Enhancements (Not Currently Implemented)

### Planned Features
- Cloud video recording
- Video playback from alerts
- Multi-camera support per device
- Custom alert rules and thresholds
- Email notifications
- SMS notifications
- Data export (CSV, JSON)
- Advanced analytics dashboard
- Mobile app for admins
- Two-factor authentication
- API rate limiting per user
- Webhook integrations
- Third-party ML model integration
- Geofencing alerts
- Scheduled sensor control
- Energy usage monitoring
- Battery status monitoring
- Firmware update management

---

## Technical Constraints

### Current Limitations
- MJPEG streaming only works on local network (no remote access without VPN/tunnel)
- No HTTPS for video streaming (requires reverse proxy)
- No authentication on video streams
- No cloud video storage
- Limited to single sensor per device (DHT11)
- No offline mode for sensor control
- Alert images not stored (only metadata)
- No video analytics in cloud

### Platform Constraints
- Mobile app requires Android 5.0+ or iOS 12+
- Raspberry Pi requires Python 3.7+
- Backend requires Node.js 14+
- PostgreSQL 12+ required
- Firebase Blaze plan required for production

---

## Deployment Requirements

### Mobile App
- Expo build service or EAS Build
- Google Play Store deployment
- Apple App Store deployment
- Code signing certificates
- App store assets (icons, screenshots)

### Backend Services
- Railway deployment (current)
- Environment variables configuration
- Database migrations
- SSL certificates
- Domain configuration

### Edge Devices
- Raspberry Pi OS installation
- Python dependencies installation
- Service configuration (systemd)
- Network configuration
- Camera module setup

---

## Testing Requirements

### Unit Testing
- API endpoint testing
- Database query testing
- Authentication flow testing
- Access control logic testing

### Integration Testing
- End-to-end user flows
- Device registration flow
- Alert delivery flow
- Video streaming flow

### Manual Testing
- Mobile app on real devices
- Admin portal on multiple browsers
- Raspberry Pi sensor control
- Network failure scenarios

---

## Documentation Requirements

### User Documentation
- Mobile app user guide
- Device setup guide
- Troubleshooting guide
- FAQ

### Admin Documentation
- Admin portal guide
- Access control guide
- System monitoring guide

### Developer Documentation
- API documentation
- Database schema
- Architecture diagrams
- Deployment guide
- Contributing guide

---

## Compliance & Legal

### Data Privacy
- User data collection disclosure
- Data retention policies
- Data deletion on request
- GDPR compliance (if applicable)

### Terms of Service
- User agreement
- Acceptable use policy
- Liability limitations

### Security Policies
- Incident response plan
- Data breach notification
- Password policies
- Access control policies

---

## Success Metrics

### Key Performance Indicators
- Daily active users
- Device registration rate
- Alert response time
- User retention rate
- System uptime percentage
- API error rate
- User satisfaction score

### Business Metrics
- Cost per device
- Cost per user
- Revenue per user (if applicable)
- Customer acquisition cost
- Churn rate

---

## Conclusion

This system provides a comprehensive IoT monitoring solution with real-time sensor data, ML-based alerting, video streaming, and robust admin controls. The architecture is designed for scalability, security, and ease of use, with clear separation between user-facing features and administrative functions.
