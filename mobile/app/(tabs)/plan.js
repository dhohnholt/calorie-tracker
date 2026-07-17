import { StyleSheet, Text, View } from "react-native";
import { useTheme, radii } from "../../src/theme";
import Screen from "../../src/components/Screen";

export default function PlanScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Plan</Text>
        <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
          <Text style={[styles.heading, { color: theme.textPrimary }]}>Coming soon</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Weekly meal planning, saved recipes, and shopping lists will be available here in a
            future update — matching what's already on the web app.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: 20, gap: 8 },
  heading: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20 },
});
