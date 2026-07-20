import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  todayISO,
  daysAgoISO,
  timeGreeting,
  parseISODate,
  toISODate,
  formatShortDate,
} from "calorie-tracker-shared/dates.js";
import { proteinGoalGrams } from "calorie-tracker-shared/bodyMetrics.js";
import { MEAL_TYPES } from "calorie-tracker-shared/validation.js";
import { computeStreak, computeWeeklyComparison } from "calorie-tracker-shared/dailyStats.js";
import { api } from "../../src/api";
import { useAuth } from "../../src/authContext";
import { useTheme, radii } from "../../src/theme";
import Screen from "../../src/components/Screen";
import { LoadingState, ErrorState, EmptyState } from "../../src/components/StateViews";
import FoodItemRow from "../../src/components/FoodItemRow";
import KeyboardDoneAccessory from "../../src/components/KeyboardDoneAccessory";

const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
// Wide enough for a meaningful streak without needing its own screen/fetch.
const STATS_WINDOW_DAYS = 90;

function shiftDate(iso, days) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function dateLabel(iso) {
  if (iso === todayISO()) return "Today";
  if (iso === shiftDate(todayISO(), -1)) return "Yesterday";
  return formatShortDate(iso);
}

function formatComparison({ avgCaloriesThisWeek, avgCaloriesLastWeek }) {
  if (avgCaloriesThisWeek == null || avgCaloriesLastWeek == null) return null;
  const diff = avgCaloriesThisWeek - avgCaloriesLastWeek;
  const pct = Math.round((Math.abs(diff) / avgCaloriesLastWeek) * 100);
  if (pct < 3) return "About the same as last week";
  return `${pct}% ${diff > 0 ? "above" : "below"} last week's average`;
}

export default function TodayScreen() {
  const theme = useTheme();
  const { me } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [settings, setSettings] = useState(null);
  const [totals, setTotals] = useState(null);
  const [entries, setEntries] = useState([]);
  const [statsSummary, setStatsSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async (forDate, isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [settingsRes, summaryRes, entriesRes, statsRes] = await Promise.all([
        api.getSettings(),
        api.getDailySummary(forDate, forDate),
        api.getFoodEntries({ date: forDate }),
        api.getDailySummary(daysAgoISO(STATS_WINDOW_DAYS - 1), todayISO()),
      ]);
      setSettings(settingsRes);
      setTotals(summaryRes[0] || { calories: 0, protein_g: 0 });
      setEntries(entriesRes);
      setStatsSummary(statsRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(date);
    }, [load, date])
  );

  function handleDelete(entry) {
    Alert.alert("Delete entry?", entry.description, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletingId(entry.id);
          try {
            await api.deleteFoodEntry(entry.id);
            await load(date);
          } catch (err) {
            setError(err.message);
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  async function handleUpdate(id, fields) {
    await api.updateFoodEntry(id, fields);
    if (fields.date && fields.date !== date) {
      setDate(fields.date);
    } else {
      await load(date);
    }
  }

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
        <ErrorState message={error} onRetry={() => load(date)} />
      </Screen>
    );
  }

  const calorieGoal = Number(settings.calorie_goal) || 0;
  const goalWeight = Number(settings.goal_weight) || 0;
  const proteinGoal = proteinGoalGrams(goalWeight, settings.weight_unit);
  const consumed = Math.round(totals.calories || 0);
  const remaining = calorieGoal - consumed;
  const profileName = me?.name;
  const isToday = date === todayISO();

  const streak = computeStreak(statsSummary);
  const comparison = computeWeeklyComparison(statsSummary);
  const comparisonText = formatComparison(comparison);

  const groups = MEAL_TYPES.map((meal) => ({
    meal,
    entries: entries.filter((e) => e.meal === meal),
  })).filter((g) => g.entries.length > 0);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(date, true)} tintColor={theme.series1} />
        }
      >
        <Text style={[styles.greeting, { color: theme.textPrimary }]}>
          {isToday && profileName ? `${timeGreeting()}, ${profileName}` : "Today"}
        </Text>

        <View style={styles.dateNav}>
          <Pressable
            style={[styles.dateNavButton, { borderColor: theme.border }]}
            onPress={() => setDate((d) => shiftDate(d, -1))}
          >
            <Text style={{ color: theme.textSecondary, fontSize: 18 }}>‹</Text>
          </Pressable>
          <Text style={[styles.dateNavLabel, { color: theme.textPrimary }]}>{dateLabel(date)}</Text>
          <Pressable
            style={[styles.dateNavButton, { borderColor: theme.border, opacity: isToday ? 0.3 : 1 }]}
            onPress={() => !isToday && setDate((d) => shiftDate(d, 1))}
            disabled={isToday}
          >
            <Text style={{ color: theme.textSecondary, fontSize: 18 }}>›</Text>
          </Pressable>
        </View>

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

        {(streak > 0 || comparisonText) && (
          <View style={[styles.card, styles.trendCard, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
            {streak > 0 && (
              <Text style={[styles.streakText, { color: theme.series1 }]}>{streak}-day streak</Text>
            )}
            {comparisonText && (
              <Text style={[styles.caption, { color: theme.textMuted }]}>{comparisonText}</Text>
            )}
          </View>
        )}

        <View style={styles.loggedSection}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Food logged</Text>
          {groups.length === 0 ? (
            <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
              <EmptyState title="No food logged" hint={isToday ? "Log something from the Log tab" : undefined} />
            </View>
          ) : (
            groups.map(({ meal, entries: mealEntries }) => {
              const mealTotal = mealEntries.reduce((sum, e) => sum + e.calories, 0);
              return (
                <View
                  key={meal}
                  style={[styles.mealCard, { backgroundColor: theme.surface1, borderColor: theme.border }]}
                >
                  <View style={styles.mealHeader}>
                    <Text style={[styles.mealName, { color: theme.textPrimary }]}>{MEAL_LABELS[meal]}</Text>
                    <Text style={[styles.mealTotal, { color: theme.textMuted }]}>
                      {Math.round(mealTotal)} kcal
                    </Text>
                  </View>
                  {mealEntries.map((entry) => (
                    <FoodItemRow
                      key={entry.id}
                      entry={entry}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      deleting={deletingId === entry.id}
                    />
                  ))}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
      <KeyboardDoneAccessory />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  greeting: { fontSize: 24, fontWeight: "700" },
  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  dateNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dateNavLabel: { fontSize: 16, fontWeight: "600", minWidth: 90, textAlign: "center" },
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
  trendCard: { paddingVertical: 14, gap: 2 },
  streakText: { fontSize: 16, fontWeight: "700" },
  loggedSection: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  mealCard: { borderRadius: radii.lg, borderWidth: 1, padding: 14, gap: 4 },
  mealHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  mealName: { fontSize: 15, fontWeight: "700" },
  mealTotal: { fontSize: 13 },
});
