const fs = require('fs');

const file = 'sensor_app/app/dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find and replace the entire Tab Navigation section
// Looking for the section that contains both buttons
const navStart = content.indexOf('{/* Tab Navigation */}');
const navEnd = content.indexOf('{/* Alerts Tab */}');

if (navStart !== -1 && navEnd !== -1) {
  const oldSection = content.substring(navStart, navEnd);
  
  const newSection = `{/* Tab Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === "alerts" && styles.navItemActive]}
          onPress={() => setActiveTab("alerts")}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <MaterialIcons name="notifications" size={20} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.navItemText}>Alerts</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, activeTab === "devices" && styles.navItemActive]}
          onPress={() => setActiveTab("devices")}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <MaterialIcons name="computer" size={20} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.navItemText}>Devices</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Alerts Tab */}`;

  content = content.substring(0, navStart) + newSection + content.substring(navEnd);
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully updated dashboard.tsx');
  console.log('Replaced Tab Navigation section with MaterialIcons buttons');
} else {
  console.log('Could not find Tab Navigation section');
  console.log('navStart:', navStart);
  console.log('navEnd:', navEnd);
}
