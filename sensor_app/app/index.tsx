import { View, Text, ActivityIndicator, Platform, TouchableOpacity } from "react-native";
import { useEffect, useState } from "react";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential, signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";

const webClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

GoogleSignin.configure({
  webClientId: webClientId,
  offlineAccess: true,
  forceCodeForRefreshToken: true,
  accountName: "",
});

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  console.log("[Login] Web Client ID:", webClientId);

  const handleLogin = async () => {
    try {
      setLoading(true);
      console.log("[Login] Starting Google Sign-In");

      // Sign out first to clear cached account
      try {
        await GoogleSignin.signOut();
        console.log("[Login] Signed out previous session");
      } catch (e) {
        console.log("[Login] No previous session");
      }

      await GoogleSignin.hasPlayServices();
      console.log("[Login] Play Services available");

      // This should show account picker
      const userInfo = await GoogleSignin.signIn();
      console.log("[Login] userInfo:", JSON.stringify(userInfo, null, 2));
      
      // Extract from correct structure
      const user = userInfo?.data?.user;
      const idToken = userInfo?.data?.idToken;

      if (!user || !user.email) {
        console.error("[Login] ❌ No user info returned");
        setLoading(false);
        return;
      }

      console.log("[Login] Selected account:", user.email);

      if (!idToken) {
        console.error("[Login] ❌ No ID token");
        setLoading(false);
        return;
      }

      console.log("[Login] ID Token received");

      const credential = GoogleAuthProvider.credential(idToken);
      console.log("[Login] Credential created");

      const firebaseUser = await signInWithCredential(auth, credential);

      console.log("[Login] ✅ Firebase sign-in success:", firebaseUser.user.email);
      setSignedInEmail(firebaseUser.user.email);
      setLoading(false);
    } catch (error: any) {
      console.error("[Login] ❌ Error:", error.code, error.message);
      console.error("[Login] Full error:", JSON.stringify(error, null, 2));
      setLoading(false);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log("[Login] User cancelled");
      }
    }
  };

  const handleLogout = async () => {
    try {
      console.log("[Login] Logging out...");
      await GoogleSignin.signOut();
      await signOut(auth);
      setSignedInEmail(null);
      console.log("[Login] ✅ Logged out");
    } catch (error) {
      console.error("[Login] ❌ Logout error:", error);
    }
  };

  return (
    <LinearGradient
      colors={["#7C3AED", "#6D28D9"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 20,
        }}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#ffffff" />
        ) : (
          <>
            {/* Logo Container */}
            <View
              style={{
                marginBottom: 60,
                alignItems: "center",
              }}
            >
              {/* Outer Circle Background */}
              <View
                style={{
                  width: 180,
                  height: 180,
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  borderRadius: 90,
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 30,
                }}
              >
                {/* Inner Circle */}
                <View
                  style={{
                    width: 140,
                    height: 140,
                    backgroundColor: "#ffffff",
                    borderRadius: 70,
                    justifyContent: "center",
                    alignItems: "center",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 12,
                    elevation: 12,
                  }}
                >
                  <MaterialIcons name="sensors" size={80} color="#7C3AED" />
                </View>
              </View>
            </View>

            {/* Title */}
            <Text
              style={{
                fontSize: 32,
                fontWeight: "700",
                color: "#ffffff",
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              Sensor App
            </Text>

            {/* Subtitle */}
            <Text
              style={{
                fontSize: 16,
                color: "#ffffff",
                marginBottom: 50,
                textAlign: "center",
                lineHeight: 24,
              }}
            >
              Monitor your systems{"\n"}from anywhere
            </Text>

            {/* Sign in with Google Button */}
            <TouchableOpacity
              onPress={handleLogin}
              style={{
                width: "100%",
                backgroundColor: "#ffffff",
                borderRadius: 28,
                paddingVertical: 14,
                paddingHorizontal: 24,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 5,
              }}
            >
              <MaterialIcons name="language" size={20} color="#4285F4" style={{ marginRight: 12 }} />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#1F2937",
                }}
              >
                Sign in with Google
              </Text>
            </TouchableOpacity>

            {/* Signed In Status */}
            {signedInEmail && (
              <>
                <Text
                  style={{
                    marginTop: 30,
                    color: "#ffffff",
                    fontSize: 14,
                  }}
                >
                  Signed in as: {signedInEmail}
                </Text>
                <TouchableOpacity
                  onPress={handleLogout}
                  style={{
                    marginTop: 20,
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    borderRadius: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 24,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.3)",
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                  >
                    Logout
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>
    </LinearGradient>
  );
}
