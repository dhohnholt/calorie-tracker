import { useCallback, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { cmToIn, inToCm, proteinGoalGrams } from "calorie-tracker-shared/bodyMetrics.js";
import { api, API_BASE_URL } from "../../src/api";
import { useAuth } from "../../src/authContext";
import { useTheme, radii } from "../../src/theme";
import Screen from "../../src/components/Screen";
import { LoadingState, ErrorState } from "../../src/components/StateViews";

export default function SettingsScreen() {
  const theme = useTheme();
  const { me, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedMessage, setSavedMessage] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [calorieGoal, setCalorieGoal] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("lbs");
  const [heightInput, setHeightInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await api.getSettings();
      setCalorieGoal(settings.calorie_goal != null ? String(settings.calorie_goal) : "");
      setGoalWeight(settings.goal_weight != null ? String(settings.goal_weight) : "");
      const unit = settings.weight_unit || "lbs";
      setWeightUnit(unit);
      if (settings.height_cm) {
        const cm = Number(settings.height_cm);
        setHeightInput(unit === "kg" ? String(cm) : String(Math.round(cmToIn(cm) * 10) / 10));
      } else {
        setHeightInput("");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  function handleUnitChange(newUnit) {
    if (newUnit === weightUnit) return;
    if (heightInput !== "") {
      const num = Number(heightInput);
      if (Number.isFinite(num)) {
        const cm = weightUnit === "kg" ? num : inToCm(num);
        setHeightInput(newUnit === "kg" ? String(Math.round(cm)) : String(Math.round(cmToIn(cm) * 10) / 10));
      }
    }
    setWeightUnit(newUnit);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSavedMessage(null);
    try {
      const heightNum = heightInput === "" ? null : Number(heightInput);
      const heightCm = heightNum == null ? "" : weightUnit === "kg" ? heightNum : inToCm(heightNum);
      await api.updateSettings({
        calorie_goal: calorieGoal,
        goal_weight: goalWeight,
        weight_unit: weightUnit,
        height_cm: heightCm === "" ? "" : Math.round(heightCm * 100) / 100,
      });
      setSavedMessage("Settings saved");
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Loading settings…" />
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

  const proteinGoal = proteinGoalGrams(Number(goalWeight) || 0, weightUnit);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Settings</Text>

        <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Account</Text>
          <Text style={[styles.accountName, { color: theme.textPrimary }]}>{me?.name}</Text>
          <Text style={[styles.hint, { color: theme.textMuted }]}>@{me?.username}</Text>
          <Pressable
            style={[styles.logoutButton, { borderColor: theme.border }]}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            <Text style={{ color: theme.statusCritical, fontWeight: "700" }}>
              {loggingOut ? "Logging out…" : "Log out"}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Daily calorie goal</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border }]}
            keyboardType="numeric"
            value={calorieGoal}
            onChangeText={setCalorieGoal}
          />

          <Text style={[styles.label, { color: theme.textSecondary, marginTop: 12 }]}>Weight unit</Text>
          <View style={styles.unitToggle}>
            {["lbs", "kg"].map((u) => (
              <Pressable
                key={u}
                onPress={() => handleUnitChange(u)}
                style={[
                  styles.unitOption,
                  { backgroundColor: weightUnit === u ? theme.series1 : "transparent", borderColor: theme.border },
                ]}
              >
                <Text style={{ color: weightUnit === u ? "#fff" : theme.textSecondary, fontWeight: "600" }}>{u}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.textSecondary, marginTop: 12 }]}>
            Goal weight ({weightUnit})
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border }]}
            keyboardType="numeric"
            value={goalWeight}
            onChangeText={setGoalWeight}
          />

          <Text style={[styles.label, { color: theme.textSecondary, marginTop: 12 }]}>
            Height ({weightUnit === "kg" ? "cm" : "in"})
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border }]}
            keyboardType="numeric"
            placeholder={weightUnit === "kg" ? "e.g. 178" : "e.g. 70"}
            placeholderTextColor={theme.textMuted}
            value={heightInput}
            onChangeText={setHeightInput}
          />

          {proteinGoal ? (
            <Text style={[styles.derived, { color: theme.textMuted }]}>
              Protein goal (derived from goal weight): {proteinGoal}g/day
            </Text>
          ) : null}

          {saveError ? <Text style={{ color: theme.statusCritical, marginTop: 8 }}>{saveError}</Text> : null}
          {savedMessage ? <Text style={{ color: theme.statusGood, marginTop: 8 }}>{savedMessage}</Text> : null}

          <Pressable
            style={[styles.saveButton, { backgroundColor: theme.series1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => Linking.openURL("https://console.anthropic.com/settings/billing")}>
          <Text style={[styles.link, { color: theme.series1 }]}>
            Check AI usage & billing (Anthropic Console) ↗
          </Text>
        </Pressable>

        <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Server</Text>
          <Text style={[styles.mono, { color: theme.textPrimary }]}>{API_BASE_URL}</Text>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Set via EXPO_PUBLIC_API_URL. See mobile/.env.example.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: 20 },
  label: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 6 },
  unitToggle: { flexDirection: "row", gap: 6, marginTop: 6 },
  unitOption: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 10 },
  accountName: { fontSize: 17, fontWeight: "700", marginTop: 6 },
  logoutButton: { borderWidth: 1, borderRadius: radii.sm, paddingVertical: 10, alignItems: "center", marginTop: 14 },
  derived: { fontSize: 13, marginTop: 12 },
  saveButton: { borderRadius: radii.sm, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  saveButtonText: { color: "#fff", fontWeight: "700" },
  link: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  mono: { fontSize: 14, fontFamily: "Courier" },
  hint: { fontSize: 12, marginTop: 4 },
});
