import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProfileProvider, useProfiles } from "../src/profileContext";
import Screen from "../src/components/Screen";
import { LoadingState, ErrorState } from "../src/components/StateViews";

function Gate({ children }) {
  const { ready, error } = useProfiles();
  if (error) {
    return (
      <Screen>
        <ErrorState message={error} />
      </Screen>
    );
  }
  if (!ready) {
    return (
      <Screen>
        <LoadingState label="Loading…" />
      </Screen>
    );
  }
  return children;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <ProfileProvider>
        <Gate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </Gate>
      </ProfileProvider>
    </SafeAreaProvider>
  );
}
