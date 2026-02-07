# User Journey Documentation

## Overview

This document outlines the complete user journeys for all user types in the IoT Sensor Monitoring System. Each journey includes step-by-step flows, decision points, and expected outcomes.

---

## User Types

1. **End User (Mobile App)** - Device owner who monitors sensors and receives alerts
2. **System Administrator** - Manages users, devices, and access control via admin portal
3. **Device Owner** - Person who sets up Raspberry Pi devices

---

# End User Journeys (Mobile App)

## Journey 1: First-Time User Onboarding

### Goal
New user downloads app, signs in, and claims their first device.

### Steps

1. **App Launch**
   - User opens the mobile app for the first time
   - App displays branded splash screen with logo
   - App checks for existing authentication

2. **Login Screen**
   - User sees "Sensor App" title with icon
   - User sees "Sign in with Google" button
   - User taps the button

3. **Google Sign-In**
   - Google account picker appears
   - User selects their Google account
   - User grants permissions (if first time)
   - Authentication completes

4. **First Dashboard View**
   - User lands on "Alerts" tab (default)
   - Empty state message: "No alerts yet"
   - User sees "Devices" tab in navigation
   - User taps "Devices" tab

5. **Empty Devices State**
   - Message: "No devices yet"
   - "Add Device" button visible
   - User taps "Add Device"

6. **Device Selection Modal**
   - List of available (unclaimed) devices appears
   - Each device shows:
     - Device ID
     - Device label
     - Device type
     - "Claim" button
   - User taps "Claim" on desired device

7. **Device Claimed**
   - Success message: "Device [name] added to your account!"
   - Modal closes
   - Device appears in user's device list
   - Device card shows:
     - Device label
     - Status (online/offline)
     - Latest sensor reading
     - Action buttons

8. **Onboarding Complete**
   - User can now monitor sensors
   - User can receive alerts
   - User can control sensors

### Success Criteria
- User successfully authenticated
- User claimed at least one device
- User can see device in their list

### Possible Issues
- No available devices to claim → User must wait for device registration
- Google Sign-In fails → User sees error message with retry option
- Network error → User sees error with retry option

---

## Journey 2: Daily Monitoring Routine

### Goal
User checks their devices and sensor readings during normal operation.

### Steps

1. **App Launch**
   - User opens app
   - Auto-login if session valid
   - Dashboard loads with latest data

2. **View Alerts Tab**
   - User sees list of recent ML alerts (if any)
   - Each alert shows:
     - Risk level indicator (🔴🟠🟡🟢)
     - Device name
     - Detected objects
     - Timestamp
   - User can tap alert for details

3. **Switch to Devices Tab**
   - User taps "Devices" tab
   - List of claimed devices appears
   - Each device card shows:
     - Device label
     - Online/offline status
     - Latest temperature reading
     - Latest humidity reading
     - Last update time

4. **View Device Details**
   - User taps on a device card
   - Device detail view expands showing:
     - All sensors for that device
     - Current readings
     - Sensor status (on/off)
     - Control buttons

5. **Check Sensor Readings**
   - User sees real-time temperature: "25.5°C"
   - User sees real-time humidity: "60%"
   - Readings auto-update every 15 seconds
   - User observes changes over time

6. **View Video Stream (Optional)**
   - User taps "View Camera" button
   - Video player opens in full screen
   - MJPEG stream loads
   - User sees live video feed
   - User taps close button to exit

7. **Return to Dashboard**
   - User navigates back
   - Dashboard refreshes with latest data
   - User exits app or continues monitoring

### Success Criteria
- User can view all devices
- User can see real-time sensor data
- User can view video streams
- Data updates automatically

### Possible Issues
- Device offline → Shows "Offline" status, no recent readings
- Video stream fails → Error message with retry option
- Network slow → Loading indicators shown

---

## Journey 3: Responding to Critical Alert

### Goal
User receives critical alert notification and takes action.

### Steps

1. **Alert Generation**
   - ML model on remote system detects threat
   - Alert sent to backend
   - Backend stores alert in user's collection

2. **Push Notification**
   - User's phone receives notification
   - Notification shows:
     - Title: "🔴 CRITICAL - [Device Name]"
     - Body: "Person, Weapon detected"
     - Sound and vibration
   - Notification appears on lock screen

3. **User Taps Notification**
   - App opens (or comes to foreground)
   - App navigates to Alerts tab
   - Alert detail modal opens automatically
   - User sees full alert information:
     - Risk level: CRITICAL
     - Device: "Front Door Camera"
     - Detected objects: Person, Weapon
     - Timestamp: "2:34 PM"
     - Confidence scores
     - Image/video frame (if available)

4. **User Reviews Alert**
   - User examines the alert details
   - User decides if it's accurate or false positive

5. **User Provides Feedback**
   - User taps "Rate Alert" button
   - Rating modal appears
   - User selects accuracy: "Accurate" or "Inaccurate"
   - User rates severity: 1-10 scale
   - User taps "Submit"
   - Success message: "Feedback saved"
   - Alert card background turns green (accurate) or red (inaccurate)

6. **User Takes Action (Outside App)**
   - User may call authorities
   - User may check physical location
   - User may review video footage

7. **User Returns to App**
   - Alert remains in list for reference
   - User can view alert history
   - User continues monitoring

### Success Criteria
- User receives notification within 5 seconds
- User can view full alert details
- User can provide feedback
- Feedback is saved successfully

### Possible Issues
- Notification permission denied → User doesn't receive push notification (but alert still appears in app)
- False positive alert → User marks as inaccurate to improve ML model
- Network delay → Alert appears later than expected

---

## Journey 4: Remote Sensor Control

### Goal
User remotely turns sensor on or off from mobile app.

### Steps

1. **Navigate to Device**
   - User opens app
   - User taps "Devices" tab
   - User sees list of devices

2. **Select Device**
   - User taps on device card
   - Device details expand
   - User sees list of sensors

3. **View Sensor Status**
   - User sees sensor card:
     - Sensor name: "DHT11 Temperature Sensor"
     - Current status: "ON" (green) or "OFF" (gray)
     - Toggle switch visible

4. **Control Sensor**
   - User taps toggle switch to turn OFF
   - Loading indicator appears briefly
   - Backend validates user has permission
   - Backend sends command to Raspberry Pi
   - Pi receives command and updates sensor state

5. **Confirmation**
   - Success message: "DHT11 Temperature Sensor disabled"
   - Toggle switch updates to OFF position
   - Sensor card turns gray
   - Sensor stops sending readings

6. **Turn Sensor Back On**
   - User taps toggle switch again
   - Loading indicator appears
   - Backend processes command
   - Pi turns sensor back on
   - Success message: "DHT11 Temperature Sensor enabled"
   - Sensor resumes sending readings

7. **Verify Operation**
   - User waits a few seconds
   - New readings appear (if turned on)
   - No new readings appear (if turned off)
   - User confirms sensor control works

### Success Criteria
- User can toggle sensor on/off
- Changes reflect immediately in UI
- Raspberry Pi receives and executes command
- Sensor readings start/stop accordingly

### Possible Issues
- User blocked by admin → Error: "Access Denied - You do not have permission"
- Device offline → Error: "Device is offline"
- Network error → Error with retry option
- Pi not responding → Timeout error

---

## Journey 5: Managing Alert Retention Settings

### Goal
User configures how long alerts are kept before auto-deletion.

### Steps

1. **Open Profile Menu**
   - User taps profile icon (top-left)
   - Profile modal opens showing:
     - User email
     - User name
     - "Settings" button
     - "Logout" button

2. **Open Settings**
   - User taps "Settings" button
   - Settings modal opens

3. **View Current Setting**
   - User sees "Alert Retention" section
   - Current setting displayed: "30 days" (default)
   - Options available:
     - 7 days
     - 15 days
     - 30 days
     - Never

4. **Change Setting**
   - User taps "15 days" option
   - Confirmation dialog appears
   - User confirms change

5. **Setting Saved**
   - Success message: "Alerts older than 15 days will be auto-deleted"
   - Setting persists across app restarts
   - Auto-delete runs hourly in background

6. **Close Settings**
   - User taps close button
   - Returns to dashboard
   - Setting is active

### Success Criteria
- User can change retention period
- Setting is saved persistently
- Old alerts are deleted automatically
- User receives confirmation

### Possible Issues
- None expected (local setting only)

---

## Journey 6: Adding Additional Devices

### Goal
User claims a second (or more) device to their account.

### Steps

1. **Navigate to Devices**
   - User opens app
   - User taps "Devices" tab
   - User sees existing devices

2. **Add New Device**
   - User taps "Add Device" button (+ icon)
   - Available devices modal opens
   - List shows unclaimed devices

3. **Select Device**
   - User browses available devices
   - User finds desired device by ID or label
   - User taps "Claim" button

4. **Device Added**
   - Success message appears
   - Modal closes
   - New device appears in device list
   - User can now monitor this device

5. **Configure Device (Optional)**
   - User taps device card
   - User taps "Edit Label" button
   - User enters custom name: "Garage Sensor"
   - User saves
   - Device label updates

### Success Criteria
- User can claim multiple devices
- Each device appears in user's list
- User can customize device labels

### Possible Issues
- No available devices → Message: "All devices have been claimed"
- Device already claimed by another user → Not shown in available list

---

## Journey 7: Removing a Device

### Goal
User removes a device from their account (unclaims it).

### Steps

1. **Navigate to Device**
   - User opens app
   - User taps "Devices" tab
   - User sees device list

2. **Select Device to Remove**
   - User long-presses on device card (or taps menu icon)
   - Context menu appears with options:
     - Edit Label
     - Remove Device
     - View Details

3. **Initiate Removal**
   - User taps "Remove Device"
   - Confirmation dialog appears:
     - Title: "Remove Device"
     - Message: "Are you sure you want to remove '[Device Name]'? The device will not be deleted, just removed from your account."
     - Buttons: "Cancel" | "Remove"

4. **Confirm Removal**
   - User taps "Remove" button
   - Loading indicator appears
   - Backend removes user association
   - Device becomes available for claiming again

5. **Device Removed**
   - Success message: "Device removed from your account"
   - Device disappears from user's list
   - User no longer receives alerts from this device
   - User can no longer control this device

### Success Criteria
- Device is unclaimed successfully
- Device no longer appears in user's list
- Device becomes available for other users
- User data for this device is preserved

### Possible Issues
- Network error → Retry option provided
- Backend error → Error message displayed

---

## Journey 8: Viewing Alert History

### Goal
User reviews past alerts to identify patterns or verify events.

### Steps

1. **Open Alerts Tab**
   - User opens app
   - User taps "Alerts" tab (default view)
   - List of alerts appears, sorted by newest first

2. **Browse Alert List**
   - User scrolls through alerts
   - Each alert shows:
     - Risk level indicator
     - Device name
     - Detected objects
     - Timestamp
     - Background color (green if rated accurate, red if inaccurate)

3. **Filter by Risk Level (Future)**
   - User taps filter icon
   - User selects "Critical only"
   - List updates to show only critical alerts

4. **View Alert Details**
   - User taps on an alert
   - Detail modal opens showing:
     - Full alert information
     - Image/video frame (if available)
     - User's previous rating (if any)
     - Timestamp
     - Device details

5. **Review Multiple Alerts**
   - User closes modal
   - User taps another alert
   - User compares alerts over time
   - User identifies patterns (e.g., false positives at certain times)

6. **Delete Old Alert (Optional)**
   - User long-presses alert
   - Delete option appears
   - User confirms deletion
   - Alert removed from list

### Success Criteria
- User can view all historical alerts
- Alerts are sorted chronologically
- User can view full details of each alert
- User can identify patterns

### Possible Issues
- Too many alerts → Pagination needed (future enhancement)
- Old alerts auto-deleted → User informed via settings

---

## Journey 9: Troubleshooting Offline Device

### Goal
User notices device is offline and investigates the issue.

### Steps

1. **Notice Offline Status**
   - User opens app
   - User sees device card with "Offline" badge
   - No recent readings displayed
   - Last seen: "2 hours ago"

2. **Check Device Details**
   - User taps on offline device
   - Device details show:
     - Status: Offline
     - Last reading: 2 hours ago
     - No current data available

3. **Attempt to View Video**
   - User taps "View Camera" button
   - Error message: "Device is offline - cannot connect to camera"
   - Retry option provided

4. **Check Physical Device**
   - User goes to physical location of Raspberry Pi
   - User checks:
     - Power connection
     - Network connection (WiFi/Ethernet)
     - LED indicators

5. **Device Comes Back Online**
   - User fixes connection issue
   - Raspberry Pi reconnects to network
   - Pi registers with backend
   - Backend updates device status

6. **Verify in App**
   - User returns to app
   - User pulls to refresh
   - Device status updates to "Online"
   - New readings appear
   - User confirms device is working

### Success Criteria
- User can identify offline devices
- User can see last known status
- User can troubleshoot and resolve issue
- Device reconnects automatically

### Possible Issues
- Network issue at user's location → Device remains offline until fixed
- Power outage → Device offline until power restored
- Pi hardware failure → Device needs replacement

---

## Journey 10: Logging Out

### Goal
User signs out of the app.

### Steps

1. **Open Profile Menu**
   - User taps profile icon
   - Profile modal opens

2. **Initiate Logout**
   - User taps "Logout" button
   - Confirmation dialog appears (optional)

3. **Logout Process**
   - App clears authentication tokens
   - App clears cached data
   - App stops all real-time listeners
   - App stops polling for updates

4. **Return to Login Screen**
   - User sees login screen
   - "Sign in with Google" button visible
   - User is logged out

5. **Re-login (Optional)**
   - User can sign in again
   - User can sign in with different account
   - Previous data loads for that account

### Success Criteria
- User is logged out successfully
- All listeners stopped
- No data leakage between accounts
- User can log back in

### Possible Issues
- None expected (local operation)

---

# Administrator Journeys (Admin Portal)

## Journey 11: Admin First-Time Setup

### Goal
System administrator creates their admin account and accesses the portal.

### Steps

1. **Initial Setup**
   - Developer runs setup script or API call
   - Admin account created with:
     - Email
     - Password (hashed)
     - Full name
     - Role: super_admin

2. **Access Admin Portal**
   - Admin opens browser
   - Admin navigates to admin portal URL
   - Login page appears

3. **Admin Login**
   - Admin enters email
   - Admin enters password
   - Admin clicks "Login"
   - Session created
   - Redirect to dashboard

4. **View Dashboard**
   - Admin sees overview:
     - Total devices count
     - Total users count
     - Active alerts count
     - Recent activity log
   - Navigation menu visible:
     - Dashboard
     - Devices
     - Users
     - Access Control
     - Logs

5. **Explore Portal**
   - Admin clicks through sections
   - Admin familiarizes with interface
   - Admin is ready to manage system

### Success Criteria
- Admin account created successfully
- Admin can log in
- Admin can access all sections
- Dashboard displays correct data

### Possible Issues
- Setup key incorrect → Account creation fails
- Password too weak → Validation error
- Database connection issue → Login fails

---

## Journey 12: Blocking a User

### Goal
Admin blocks a user from accessing all devices due to policy violation.

### Steps

1. **Navigate to Users**
   - Admin logs into portal
   - Admin clicks "Users" in navigation
   - User list appears

2. **Find User**
   - Admin sees list of all users
   - Each user shows:
     - Email
     - Name
     - Sign-up date
     - Number of devices
     - Status (active/blocked)
   - Admin searches for user by email
   - Admin finds target user

3. **View User Details**
   - Admin clicks on user row
   - User detail page opens showing:
     - User information
     - Claimed devices list
     - Activity history
     - Current access status

4. **Block User**
   - Admin clicks "Block User" button
   - Modal appears asking for reason
   - Admin enters: "Policy violation - unauthorized access attempt"
   - Admin clicks "Confirm"

5. **User Blocked**
   - Backend creates user block record
   - User status updates to "Blocked"
   - Success message: "User blocked successfully"
   - Action logged in audit trail

6. **User Attempts Access**
   - Blocked user opens mobile app
   - User tries to control sensor
   - Backend checks user_blocks table
   - Backend returns 403 Forbidden
   - User sees: "Access Denied - Policy violation - unauthorized access attempt"
   - User cannot control any devices

7. **Verify Block**
   - Admin refreshes user page
   - User shows as "Blocked"
   - Admin can see block reason
   - Admin can unblock if needed

### Success Criteria
- User is blocked successfully
- User cannot access any devices
- Block reason is displayed to user
- Action is logged

### Possible Issues
- Database error → Block fails, error message shown
- User already blocked → Warning message shown

---

## Journey 13: Managing Device Access

### Goal
Admin grants specific user access to specific device with expiration.

### Steps

1. **Navigate to Access Control**
   - Admin logs in
   - Admin clicks "Access Control" in menu
   - Access control page appears

2. **View Current Access Rules**
   - Admin sees table of all access rules:
     - Device ID
     - User email
     - Access level
     - Granted by
     - Granted date
     - Expiration date
     - Status (active/expired/blocked)

3. **Grant New Access**
   - Admin clicks "Grant Access" button
   - Modal appears with form:
     - Select Device (dropdown)
     - Select User (dropdown)
     - Access Level (viewer/controller/admin)
     - Expiration Date (optional)
     - Reason (optional)

4. **Fill Form**
   - Admin selects Device: "Front Door Camera"
   - Admin selects User: "john@example.com"
   - Admin selects Access Level: "Controller"
   - Admin sets Expiration: "30 days from now"
   - Admin enters Reason: "Temporary access for maintenance"

5. **Submit**
   - Admin clicks "Grant Access"
   - Backend creates access control record
   - Success message appears
   - New rule appears in table

6. **User Receives Access**
   - User opens mobile app
   - User can now see "Front Door Camera" device
   - User can control sensors on this device
   - User can view video stream

7. **Access Expires**
   - 30 days pass
   - Backend checks expiration dates
   - Access automatically revoked
   - User can no longer see device
   - Admin can see expired status in table

### Success Criteria
- Access granted successfully
- User can access device
- Access expires automatically
- All actions logged

### Possible Issues
- User already has access → Warning shown
- Device doesn't exist → Validation error
- Expiration date in past → Validation error

---

## Journey 14: Investigating User Activity

### Goal
Admin reviews audit logs to investigate suspicious activity.

### Steps

1. **Navigate to Logs**
   - Admin logs in
   - Admin clicks "Logs" in navigation
   - Audit log page appears

2. **View Recent Activity**
   - Admin sees table of all actions:
     - Timestamp
     - Admin email (who performed action)
     - Action type
     - Target type (user/device/access)
     - Target ID
     - Details
     - IP address

3. **Filter Logs**
   - Admin enters date range: "Last 7 days"
   - Admin filters by action type: "User Block"
   - Admin filters by admin: "admin@example.com"
   - Table updates with filtered results

4. **Review Specific Action**
   - Admin clicks on log entry
   - Detail modal opens showing:
     - Full action details (JSON)
     - Timestamp
     - Admin who performed action
     - IP address
     - Before/after state (if applicable)

5. **Export Logs (Future)**
   - Admin clicks "Export" button
   - CSV file downloads
   - Admin can analyze in spreadsheet

6. **Identify Pattern**
   - Admin notices multiple failed login attempts
   - Admin identifies suspicious IP address
   - Admin takes appropriate action

### Success Criteria
- Admin can view all logs
- Admin can filter and search logs
- Admin can view detailed information
- Logs are complete and accurate

### Possible Issues
- Too many logs → Pagination needed
- Slow query → Loading indicator shown

---

## Journey 15: Monitoring System Health

### Goal
Admin checks system health and device status.

### Steps

1. **View Dashboard**
   - Admin logs in
   - Dashboard loads automatically
   - Admin sees key metrics:
     - Total devices: 47
     - Online devices: 43
     - Offline devices: 4
     - Total users: 156
     - Active alerts: 12
     - Critical alerts: 2

2. **Check Offline Devices**
   - Admin clicks "4 Offline Devices"
   - List of offline devices appears
   - Each shows:
     - Device ID
     - Device label
     - Owner email
     - Last seen timestamp
     - Duration offline

3. **Investigate Offline Device**
   - Admin clicks on device
   - Device details show:
     - Last known status
     - Last readings
     - Owner contact info
   - Admin may contact owner

4. **Check Critical Alerts**
   - Admin clicks "2 Critical Alerts"
   - Alert list appears
   - Admin reviews each alert
   - Admin verifies appropriate action taken

5. **Review System Performance**
   - Admin checks API health endpoint
   - Admin verifies database connection
   - Admin checks alert delivery rate
   - All systems operational

### Success Criteria
- Admin can monitor system health
- Admin can identify issues quickly
- Admin can take corrective action
- Dashboard updates in real-time

### Possible Issues
- Multiple devices offline → May indicate network issue
- High alert volume → May indicate false positives

---

# Device Owner Journeys (Raspberry Pi Setup)

## Journey 16: Setting Up New Raspberry Pi Device

### Goal
Device owner sets up a new Raspberry Pi with sensors and camera.

### Steps

1. **Hardware Setup**
   - Owner connects DHT11 sensor to GPIO pins
   - Owner connects camera module
   - Owner connects power supply
   - Owner connects to network (WiFi or Ethernet)

2. **Software Installation**
   - Owner installs Raspberry Pi OS
   - Owner installs Python dependencies
   - Owner installs camera software
   - Owner downloads sensor control script
   - Owner downloads camera server script

3. **Configuration**
   - Owner edits configuration file
   - Owner sets backend URL
   - Owner sets device ID (or generates new one)
   - Owner sets sensor ID
   - Owner saves configuration

4. **Start Services**
   - Owner runs sensor control script
   - Script starts HTTP server on port 5000
   - Script registers device IP with backend
   - Script begins polling backend for status

5. **Start Camera Server**
   - Owner runs camera server script
   - Camera initializes
   - MJPEG server starts on port 8080
   - Server registers streaming URL with backend

6. **Device Registration**
   - Scripts send device metadata to backend
   - Backend creates device record
   - Device appears in admin portal
   - Device is available for claiming

7. **Verify Operation**
   - Owner checks device status in admin portal
   - Owner sees device online
   - Owner sees sensor readings
   - Owner can view camera stream

8. **Claim Device (or Assign to User)**
   - Owner claims device in mobile app
   - OR admin assigns device to specific user
   - Device is now operational

### Success Criteria
- Device is online and registered
- Sensors are sending data
- Camera is streaming
- Device can be claimed by user

### Possible Issues
- Network connectivity issues → Device offline
- Sensor not detected → Check wiring
- Camera not working → Check camera enable in config
- Backend unreachable → Check URL and firewall

---

## Journey 17: Troubleshooting Device Issues

### Goal
Device owner diagnoses and fixes issues with Raspberry Pi.

### Steps

1. **Identify Problem**
   - Owner notices device offline in app
   - OR owner notices no sensor readings
   - OR owner notices camera not streaming

2. **Check Physical Connections**
   - Owner checks power supply
   - Owner checks network cable/WiFi
   - Owner checks sensor wiring
   - Owner checks camera connection

3. **Check Logs**
   - Owner SSH into Raspberry Pi
   - Owner views sensor script logs
   - Owner views camera server logs
   - Owner identifies error messages

4. **Common Issues**
   - **Network Issue**: Owner restarts router, checks WiFi password
   - **Sensor Issue**: Owner checks GPIO pin configuration, reinstalls sensor library
   - **Camera Issue**: Owner enables camera in raspi-config, checks camera module
   - **Script Crash**: Owner restarts scripts, checks for Python errors

5. **Restart Services**
   - Owner stops running scripts
   - Owner starts scripts again
   - Scripts reconnect to backend
   - Device comes back online

6. **Verify Fix**
   - Owner checks device status in app
   - Owner sees device online
   - Owner sees new sensor readings
   - Owner can view camera stream
   - Issue resolved

### Success Criteria
- Issue identified and resolved
- Device back online
- All functions working
- User can access device

### Possible Issues
- Hardware failure → Requires replacement
- SD card corruption → Requires re-imaging
- Network firewall → Requires port forwarding

---

## Journey 18: Updating Device Software

### Goal
Device owner updates sensor control script or camera server to latest version.

### Steps

1. **Check for Updates**
   - Owner checks project repository
   - Owner sees new version available
   - Owner reviews changelog

2. **Backup Current Setup**
   - Owner backs up current scripts
   - Owner backs up configuration files
   - Owner notes current settings

3. **Download Updates**
   - Owner downloads new scripts
   - Owner downloads new dependencies (if any)

4. **Stop Services**
   - Owner stops sensor control script
   - Owner stops camera server
   - Device goes offline temporarily

5. **Install Updates**
   - Owner replaces old scripts with new ones
   - Owner updates configuration if needed
   - Owner installs new dependencies

6. **Test Updates**
   - Owner starts sensor script
   - Owner verifies sensor readings
   - Owner starts camera server
   - Owner verifies video stream

7. **Verify in App**
   - Owner opens mobile app
   - Owner checks device status
   - Owner verifies all functions work
   - Update complete

### Success Criteria
- Scripts updated successfully
- All functions still working
- No data loss
- Device back online

### Possible Issues
- Breaking changes → Requires configuration updates
- Dependency conflicts → Requires troubleshooting
- Script errors → Requires rollback to backup

---

## Summary of Key User Journeys

### End User (Mobile App)
1. ✅ First-time onboarding and device claiming
2. ✅ Daily monitoring routine
3. ✅ Responding to critical alerts
4. ✅ Remote sensor control
5. ✅ Managing alert retention settings
6. ✅ Adding additional devices
7. ✅ Removing devices
8. ✅ Viewing alert history
9. ✅ Troubleshooting offline devices
10. ✅ Logging out

### Administrator (Admin Portal)
11. ✅ Admin first-time setup
12. ✅ Blocking a user
13. ✅ Managing device access
14. ✅ Investigating user activity
15. ✅ Monitoring system health

### Device Owner (Raspberry Pi)
16. ✅ Setting up new device
17. ✅ Troubleshooting device issues
18. ✅ Updating device software

---

## Journey Metrics

### Success Metrics
- **Onboarding completion rate**: % of users who claim first device
- **Daily active users**: % of users who open app daily
- **Alert response time**: Time from alert generation to user viewing
- **Device uptime**: % of time devices are online
- **User satisfaction**: Based on alert feedback ratings

### Pain Points to Address
- Device claiming process could be simplified with QR codes
- Video streaming only works on local network (needs remote access solution)
- No offline mode for viewing cached data
- Alert images not stored (only metadata)
- No bulk device management for admins

---

## Future Journey Enhancements

### Planned Improvements
1. **QR Code Device Claiming**: Scan QR code on device to claim instantly
2. **Remote Video Access**: View camera streams from anywhere via secure tunnel
3. **Offline Mode**: View cached sensor data when offline
4. **Alert Video Clips**: Store 10-second video clips with each alert
5. **Custom Alert Rules**: User-defined thresholds and conditions
6. **Multi-Device Dashboard**: View all devices on single screen
7. **Scheduled Sensor Control**: Turn sensors on/off on schedule
8. **Geofencing**: Auto-enable/disable based on user location
9. **Family Sharing**: Multiple users can access same devices
10. **Voice Control**: Integration with voice assistants

---

## Conclusion

These user journeys represent the complete experience for all user types in the IoT Sensor Monitoring System. Each journey is designed to be intuitive, efficient, and reliable, with clear success criteria and error handling for common issues.
