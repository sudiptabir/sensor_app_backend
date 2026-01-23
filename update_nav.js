const fs = require('fs');

const file = 'sensor_app/app/dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the entire nav section
const oldNav = `      {/* Tab Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === "alerts" && styles.navItemActive]}
          onPress={() => setActiveTab("alerts")}
        >
          <Text style={styles.navItemText}>🔔 Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, activeTab === "devices" && styles.navItemActive]}
          onPress={() => setActiveTab("devices")}
        >
          <Text style={styles.navItemText}>💻 Devices</Text>
        </TouchableOpacity>
      </View>`;

const newNav = `      {/* Tab Navigation */}
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
      </View>`;

content = content.replace(oldNav, newNav);
fs.writeFileSync(file, content, 'utf8');
console.log('Updated dashboard.tsx successfully');
