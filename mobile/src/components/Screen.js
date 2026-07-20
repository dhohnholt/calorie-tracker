import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme";

// Every screen renders its own inner ScrollView for content — this just
// makes sure that ScrollView shrinks out of the keyboard's way on iOS
// (Android already resizes the window via windowSoftInputMode) so a
// focused field near the bottom doesn't end up hidden behind the keyboard.
export default function Screen({ children, style }) {
  const theme = useTheme();
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.pagePlane }]}
      edges={["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.container, style]}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
});
