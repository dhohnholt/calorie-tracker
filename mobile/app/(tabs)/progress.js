import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { todayISO, daysAgoISO, formatShortDate } from "calorie-tracker-shared/dates.js";
import { api } from "../../src/api";
import { useProfiles } from "../../src/profileContext";
import { useTheme, radii } from "../../src/theme";
import Screen from "../../src/components/Screen";
import { LoadingState, ErrorState, EmptyState } from "../../src/components/StateViews";

export default function ProgressScreen() {
  const theme = useTheme();
  const { activeProfileId } = useProfiles();
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [entriesRes, settingsRes] = await Promise.all([
        api.getWeightEntries({ start: daysAgoISO(89), end: todayISO() }),
        api.getSettings(),
      ]);
      setEntries(entriesRes);
      setSettings(settingsRes);
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
    }, [load, activeProfileId])
  );

  async function handleLogWeight() {
    const weight = Number(weightInput);
    if (!weight || weight <= 0) {
      setSaveError("Enter a valid weight");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await api.createWeightEntry({
        date: todayISO(),
        weight,
        unit: settings?.weight_unit || "lbs",
      });
      setWeightInput("");
      await load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Loading weight history…" />
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

  const latest = entries[entries.length - 1];
  const unit = settings?.weight_unit || "lbs";
  const goalWeight = settings?.goal_weight ? Number(settings.goal_weight) : null;
  const todaysEntry = entries.find((e) => e.date === todayISO());

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.series1} />
        }
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>Progress</Text>

        <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
          {latest ? (
            <>
              <Text style={[styles.bigNumber, { color: theme.textPrimary }]}>
                {latest.weight} {unit}
              </Text>
              <Text style={[styles.caption, { color: theme.textMuted }]}>
                as of {formatShortDate(latest.date)}
              </Text>
            </>
          ) : (
            <EmptyState title="No weight logged yet" hint="Log your weight below to start tracking" />
          )}
          {goalWeight ? (
            <Text style={[styles.caption, { color: theme.textMuted, marginTop: 4 }]}>
              Goal: {goalWeight} {unit}
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            {todaysEntry ? `Replace today's weight (currently ${todaysEntry.weight} ${unit})` : "Log today's weight"}
          </Text>
          <View style={styles.fieldRow}>
            <TextInput
              style={[
                styles.input,
                { flex: 1, backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border },
              ]}
              keyboardType="numeric"
              placeholder={`Weight in ${unit}`}
              placeholderTextColor={theme.textMuted}
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.series1 }]}
              onPress={handleLogWeight}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>
          </View>
          {saveError ? <Text style={{ color: theme.statusCritical }}>{saveError}</Text> : null}
        </View>

        {entries.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 8 }]}>
              Recent entries
            </Text>
            {entries
              .slice()
              .reverse()
              .slice(0, 10)
              .map((entry) => (
                <View key={entry.id} style={styles.historyRow}>
                  <Text style={{ color: theme.textSecondary }}>{formatShortDate(entry.date)}</Text>
                  <Text style={{ color: theme.textPrimary, fontWeight: "600" }}>
                    {entry.weight} {entry.unit}
                  </Text>
                </View>
              ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: 16, alignItems: "center", gap: 4 },
  bigNumber: { fontSize: 32, fontWeight: "800" },
  caption: { fontSize: 14 },
  label: { fontSize: 13, fontWeight: "600", alignSelf: "flex-start" },
  fieldRow: { flexDirection: "row", gap: 8, alignSelf: "stretch" },
  input: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  saveButton: { borderRadius: radii.sm, paddingHorizontal: 18, justifyContent: "center" },
  saveButtonText: { color: "#fff", fontWeight: "700" },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignSelf: "stretch",
    paddingVertical: 6,
  },
});
