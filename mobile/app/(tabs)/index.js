import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { todayISO, timeGreeting } from "calorie-tracker-shared/dates.js";
import { proteinGoalGrams } from "calorie-tracker-shared/bodyMetrics.js";
import { api } from "../../src/api";
import { useTheme, radii } from "../../src/theme";
import Screen from "../../src/components/Screen";
import { LoadingState, ErrorState } from "../../src/components/StateViews";

export default function TodayScreen() {
  const theme = useTheme();
  const [settings, setSettings] = useState(null);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const today = todayISO();
      const [settingsRes, summaryRes] = await Promise.all([
        api.getSettings(),
        api.getDailySummary(today, today),
      ]);
      setSettings(settingsRes);
      setTotals(summaryRes[0] || { calories: 0, protein_g: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Loading today's summary…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  const calorieGoal = Number(settings.calorie_goal) || 0;
  const goalWeight = Number(settings.goal_weight) || 0;
  const proteinGoal = proteinGoalGrams(goalWeight, settings.weight_unit);
  const consumed = Math.round(totals.calories || 0);
  const remaining = calorieGoal - consumed;
  const profileName = settings.profile_name?.trim();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.series1} />
        }
      >
        <Text style={[styles.greeting, { color: theme.textPrimary }]}>
          {profileName ? `${timeGreeting()}, ${profileName}` : "Today"}
        </Text>

        <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
          <Text style={[styles.bigNumber, { color: theme.textPrimary }]}>{consumed}</Text>
          <Text style={[styles.caption, { color: theme.textMuted }]}>
            of {calorieGoal || "—"} kcal goal
          </Text>
          <Text
            style={[
              styles.remaining,
              { color: remaining < 0 ? theme.statusCritical : theme.statusGood },
            ]}
          >
            {remaining < 0 ? `${Math.abs(remaining)} over` : `${remaining} remaining`}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Protein</Text>
          <Text style={[styles.bigNumber, { color: theme.series1 }]}>
            {Math.round(totals.protein_g || 0)}g
          </Text>
          {proteinGoal ? (
            <Text style={[styles.caption, { color: theme.textMuted }]}>of {proteinGoal}g goal</Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  greeting: { fontSize: 24, fontWeight: "700" },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 4,
  },
  bigNumber: { fontSize: 40, fontWeight: "800" },
  label: { fontSize: 14, fontWeight: "600", alignSelf: "flex-start" },
  caption: { fontSize: 14 },
  remaining: { fontSize: 16, fontWeight: "700", marginTop: 4 },
});
