import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, LinearGradient } from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = "968944435256-74nt68dipdouo64p0kejipf1vin3h5oh.apps.googleusercontent.com";

export default function LoginScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_WEB_CLIENT_ID,
  });

  React.useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      handleGoogleSignIn(id_token);
    }
  }, [response]);

  const handleGoogleSignIn = async (idToken) => {
    try {
      setLoading(true);
      // The Google sign-in will be handled by the auth context in the app
      // For now, this will trigger the Google auth flow
      console.log("[LoginScreen] Google sign-in successful");
    } catch (error) {
      alert("Sign in failed: " + error.message);
      setLoading(false);
    }
  };

  const handleGooglePress = async () => {
    try {
      const result = await promptAsync();
      if (result?.type !== "success") {
        console.log("[LoginScreen] Google sign-in cancelled or failed");
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  return (
    <LinearGradient
      colors={["#6B46C1", "#8B5CF6"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Icon and Text Section */}
      <View style={styles.contentSection}>
        {/* Icon Circle */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📡</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Remote Monitor</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>Monitor your systems{"\n"}from anywhere</Text>
      </View>

      {/* Google Sign-in Button */}
      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGooglePress}
          disabled={loading || !request}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#1F2937" />
          ) : (
            <>
              <Text style={styles.googleIcon}>🔵</Text>
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  contentSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 100,
  },
  iconContainer: {
    width: 100,
    height: 100,
    backgroundColor: "#fff",
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  icon: {
    fontSize: 50,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    lineHeight: 24,
  },
  buttonSection: {
    width: "100%",
    alignItems: "center",
  },
  googleButton: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  googleIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
});
