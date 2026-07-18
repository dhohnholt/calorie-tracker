import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { todayISO, timeGreeting, parseISODate, toISODate, formatShortDate } from "calorie-tracker-shared/dates.js";
import { proteinGoalGrams } from "calorie-tracker-shared/bodyMetrics.js";
import { MEAL_TYPES } from "calorie-tracker-shared/validation.js";
import { api } from "../../src/api";
import { useProfiles } from "../../src/profileContext";
import { useTheme, radii } from "../../src/theme";
import Screen from "../../src/components/Screen";
import { LoadingState, ErrorState, EmptyState } from "../../src/components/StateViews";

const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

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

export default function TodayScreen() {
  const theme = useTheme();
  const { activeProfileId, activeProfile } = useProfiles();
  const [date, setDate] = useState(todayISO());
  const [settings, setSettings] = useState(null);
  const [totals, setTotals] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async (forDate, isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [settingsRes, summaryRes, entriesRes] = await Promise.all([
        api.getSettings(),
        api.getDailySummary(forDate, forDate),
        api.getFoodEntries({ date: forDate }),
      ]);
      setSettings(settingsRes);
      setTotals(summaryRes[0] || { calories: 0, protein_g: 0 });
      setEntries(entriesRes);
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
    }, [load, date, activeProfileId])
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
  const profileName = activeProfile?.name;
  const isToday = date === todayISO();

  const groups = MEAL_TYPES.map((meal) => ({
    meal,
    entries: entries.filter((e) => e.meal === meal),
  })).filter((g) => g.entries.length > 0);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
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
                    <View key={entry.id} style={[styles.entryRow, { borderTopColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.textPrimary }} numberOfLines={2}>
                          {entry.description}
                        </Text>
                        {entry.notes ? (
                          <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={2}>
                            {entry.notes}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={{ color: theme.textSecondary, marginLeft: 8 }}>
                        {Math.round(entry.calories)}
                      </Text>
                      <Pressable
                        onPress={() => handleDelete(entry)}
                        disabled={deletingId === entry.id}
                        hitSlop={8}
                        style={styles.deleteButton}
                      >
                        <Text style={{ color: theme.statusCritical, fontSize: 16 }}>
                          {deletingId === entry.id ? "…" : "×"}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
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
  loggedSection: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  mealCard: { borderRadius: radii.lg, borderWidth: 1, padding: 14, gap: 4 },
  mealHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  mealName: { fontSize: 15, fontWeight: "700" },
  mealTotal: { fontSize: 13 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  deleteButton: { paddingHorizontal: 8, paddingVertical: 4 },
});
