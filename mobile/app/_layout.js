import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/authContext";
import AuthScreen from "../src/components/AuthScreen";
import Screen from "../src/components/Screen";
import { LoadingState } from "../src/components/StateViews";

function Gate({ children }) {
  const { ready, authenticated } = useAuth();
  if (!ready) {
    return (
      <Screen>
        <LoadingState label="Loading…" />
      </Screen>
    );
  }
  if (!authenticated) {
    return <AuthScreen />;
  }
  return children;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <AuthProvider>
        <Gate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </Gate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
