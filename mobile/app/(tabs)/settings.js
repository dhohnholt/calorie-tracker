import { StyleSheet, Text, View } from "react-native";
import { useTheme, radii } from "../../src/theme";
import Screen from "../../src/components/Screen";
import { API_BASE_URL } from "../../src/api";

export default function SettingsScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Settings</Text>

        <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Server</Text>
          <Text style={[styles.mono, { color: theme.textPrimary }]}>{API_BASE_URL}</Text>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Set via EXPO_PUBLIC_API_URL. See mobile/.env.example.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
          <Text style={[styles.heading, { color: theme.textPrimary }]}>Coming soon</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Calorie goal, protein goal, weight unit, and profile settings will be editable here in
            a future update — matching what's already on the web app.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: 20, gap: 6 },
  label: { fontSize: 13, fontWeight: "600" },
  mono: { fontSize: 14, fontFamily: "Courier" },
  hint: { fontSize: 12 },
  heading: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20 },
});
