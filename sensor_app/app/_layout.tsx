import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { View, ActivityIndicator } from "react-native";
import "../global.css";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * 🔔 Listen to Firebase auth state
   */
  useEffect(() => {
    console.log("[RootLayout] Initializing auth listener");

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log(
        "[RootLayout] Auth state changed:",
        firebaseUser?.email ?? "null"
      );
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * 🔀 Route protection & redirects
   */
  useEffect(() => {
    if (loading) return;

    const currentRoot = segments[0]; // first route segment
    const isOnLogin = segments.length === 0; // "/"
    const isOnDashboard = currentRoot === "dashboard";

    if (!user && !isOnLogin) {
      console.log("[RootLayout] 🔐 No user → redirect to login");
      router.replace("/");
      return;
    }

    if (user && !isOnDashboard) {
      console.log("[RootLayout] ✅ User logged in → redirect to dashboard");
      router.replace("/dashboard");
    }
  }, [user, loading, segments]);

  /**
   * ⏳ Splash/loading state
   */
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  /**
   * 🧭 App navigation stack
   */
  return <Stack screenOptions={{ headerShown: false }} />;
}
