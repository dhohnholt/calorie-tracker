import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

export function LoadingState({ label = "Loading…" }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.series1} />
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, hint, actionLabel, onAction }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: theme.textSecondary }]}>{title}</Text>
      {hint ? <Text style={[styles.label, { color: theme.textMuted }]}>{hint}</Text> : null}
      {actionLabel && onAction ? (
        <Text style={[styles.retry, { color: theme.series1 }]} onPress={onAction}>
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: theme.statusCritical }]}>Something went wrong</Text>
      <Text style={[styles.label, { color: theme.textMuted }]}>{message}</Text>
      {onRetry ? (
        <Text style={[styles.retry, { color: theme.series1 }]} onPress={onRetry}>
          Tap to retry
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 6,
  },
  title: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  label: { fontSize: 14, textAlign: "center" },
  retry: { fontSize: 14, fontWeight: "600", marginTop: 8 },
});
