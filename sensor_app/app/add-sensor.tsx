import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, ScrollView, Alert } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { addSensor } from "../db/firestore";

export default function AddSensorScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("temperature");
  const [location, setLocation] = useState("");
  const [unit, setUnit] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddSensor = async () => {
    if (!name.trim() || !location.trim()) {
      Alert.alert("Error", "Please fill in Name and Location");
      return;
    }

    try {
      setLoading(true);
      console.log("[AddSensor] Creating sensor...", { name, type, location });
      
      await addSensor({
        name: name.trim(),
        type,
        location: location.trim(),
        unit: unit.trim() || "default",
        description: description.trim() || "",
      });

      console.log("[AddSensor] Sensor created successfully");
      Alert.alert("Success", "Sensor added successfully!");
      router.back();
    } catch (error: any) {
      console.error("[AddSensor] Error:", error);
      Alert.alert("Error", error.message || "Failed to create sensor");
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add New Sensor</Text>
        <Text style={styles.subtitle}>Register a new sensor device</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Sensor Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Living Room Temperature"
            value={name}
            onChangeText={setName}
            editable={!loading}
            placeholderTextColor="#aaa"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Sensor Type</Text>
          <View style={styles.typeButtons}>
            {["temperature", "humidity", "pressure", "motion"].map((t) => (
              <Button
                key={t}
                title={t}
                onPress={() => setType(t)}
                color={type === t ? "#0066cc" : "#ccc"}
              />
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Location *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Living Room, Kitchen, Bedroom"
            value={location}
            onChangeText={setLocation}
            editable={!loading}
            placeholderTextColor="#aaa"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Unit (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., °C, %, hPa"
            value={unit}
            onChangeText={setUnit}
            editable={!loading}
            placeholderTextColor="#aaa"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Add any additional notes"
            value={description}
            onChangeText={setDescription}
            editable={!loading}
            multiline
            numberOfLines={4}
            placeholderTextColor="#aaa"
          />
        </View>

        <View style={styles.buttonGroup}>
          {loading ? (
            <ActivityIndicator size="large" />
          ) : (
            <>
              <View style={styles.buttonContainer}>
                <Button
                  title="Add Sensor"
                  onPress={handleAddSensor}
                  color="#0066cc"
                />
              </View>
              <View style={styles.spacer} />
              <View style={styles.buttonContainer}>
                <Button
                  title="Cancel"
                  onPress={() => router.back()}
                  color="#999"
                />
              </View>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  header: {
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    elevation: 2,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    color: "#333",
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  typeButtons: {
    flexDirection: "row",
    gap: 5,
    justifyContent: "space-between",
  },
  buttonGroup: {
    marginTop: 20,
  },
  buttonContainer: {
    overflow: "hidden",
    borderRadius: 6,
  },
  spacer: {
    height: 10,
  },
});
