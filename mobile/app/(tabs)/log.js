import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { todayISO, daysAgoISO, inferMealFromTime } from "calorie-tracker-shared/dates.js";
import {
  MEAL_TYPES,
  isValidISODate,
} from "calorie-tracker-shared/validation.js";
import {
  OZ_TO_G,
  defaultQuantity,
  toGrams,
  scaledMacros,
  unitConversionFactor,
} from "calorie-tracker-shared/nutritionScaling.js";
import { api } from "../../src/api";
import { useTheme, radii } from "../../src/theme";
import Screen from "../../src/components/Screen";
import { LoadingState, EmptyState, ErrorState } from "../../src/components/StateViews";
import BarcodeScanner from "../../src/components/BarcodeScanner";
import KeyboardDoneAccessory, { NUMERIC_KEYBOARD_ACCESSORY_ID } from "../../src/components/KeyboardDoneAccessory";

const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

function dedupeByDescription(entries, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const key = e.description.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

export default function LogScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(100);
  const [unit, setUnit] = useState("g");
  const [meal, setMeal] = useState(inferMealFromTime());
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(null);
  const [scanning, setScanning] = useState(false);

  const [adjusting, setAdjusting] = useState(false);
  const [caloriesOverride, setCaloriesOverride] = useState("");
  const [proteinOverride, setProteinOverride] = useState("");
  const [carbsOverride, setCarbsOverride] = useState("");
  const [fatOverride, setFatOverride] = useState("");
  const [fiberOverride, setFiberOverride] = useState("");

  const loadRecent = useCallback(async () => {
    try {
      const entries = await api.getFoodEntries({});
      setRecent(dedupeByDescription(entries));
    } catch {
      // recent foods are a nice-to-have; ignore failures
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecent();
    }, [loadRecent])
  );

  async function handleSearch(queryOverride) {
    const q = (typeof queryOverride === "string" ? queryOverride : query).trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setSelected(null);
    try {
      const { foods } = await api.searchNutrition(q);
      setResults(foods);
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  // Auto-search once there's enough text to be a meaningful query, so
  // results start appearing without waiting for an explicit submit.
  useEffect(() => {
    if (query.trim().length < 3) return;
    const timer = setTimeout(() => handleSearch(), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function handleBarcodeScanned(barcode) {
    setScanning(false);
    setQuery(barcode);
    handleSearch(barcode);
  }

  function handleSelect(food) {
    setSelected(food);
    setUnit("g");
    setAmount(defaultQuantity(food));
    setSavedMessage(null);
    setAdjusting(false);
  }

  function handleStartAdjusting() {
    setCaloriesOverride(String(preview.calories));
    setProteinOverride(String(preview.protein_g));
    setCarbsOverride(String(preview.carbs_g));
    setFatOverride(String(preview.fat_g));
    setFiberOverride(String(preview.fiber_g));
    setAdjusting(true);
  }

  function handleUnitChange(newUnit) {
    if (newUnit === unit) return;
    const grams = toGrams(Number(amount) || 0, unit, unitConversionFactor(unit, selected));
    let converted;
    if (newUnit === "oz") converted = grams / OZ_TO_G;
    else if (newUnit === "g") converted = grams;
    else converted = grams / (unitConversionFactor(newUnit, selected) || 1);
    setAmount(String(Math.round(converted * 10) / 10));
    setUnit(newUnit);
  }

  async function handleSave() {
    if (!selected) return;
    if (!isValidISODate(date)) {
      setError("Enter a valid date (YYYY-MM-DD)");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const grams = toGrams(Number(amount) || 0, unit, unitConversionFactor(unit, selected));
      const computed = scaledMacros(selected, grams);
      const macros = adjusting
        ? {
            ...computed,
            calories: Number(caloriesOverride) || 0,
            protein_g: Number(proteinOverride) || 0,
            carbs_g: Number(carbsOverride) || 0,
            fat_g: Number(fatOverride) || 0,
            fiber_g: Number(fiberOverride) || 0,
          }
        : computed;
      const qtyLabel = `${amount}${unit}`;
      await api.createFoodEntry({
        date,
        meal,
        description: `${selected.description} (${qtyLabel})`,
        ...macros,
        items: [{ name: selected.description, qty: qtyLabel, fdcId: selected.fdcId, calories: macros.calories }],
      });
      setSavedMessage(`Added ${macros.calories} kcal to ${MEAL_LABELS[meal]}`);
      setQuery("");
      setResults(null);
      setSelected(null);
      setAdjusting(false);
      loadRecent();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReLog(entry) {
    setError(null);
    try {
      const today = todayISO();
      await api.createFoodEntry({
        date: today,
        meal: inferMealFromTime(),
        description: entry.description,
        calories: entry.calories,
        protein_g: entry.protein_g,
        carbs_g: entry.carbs_g,
        fat_g: entry.fat_g,
        fiber_g: entry.fiber_g,
        sugar_g: entry.sugar_g,
        sodium_mg: entry.sodium_mg,
        items: entry.items || [],
      });
      setSavedMessage(`Re-logged ${entry.description}`);
      loadRecent();
    } catch (err) {
      setError(err.message);
    }
  }

  const preview = selected
    ? scaledMacros(selected, toGrams(Number(amount) || 0, unit, unitConversionFactor(unit, selected)))
    : null;

  if (scanning) {
    return <BarcodeScanner onScanned={handleBarcodeScanned} onClose={() => setScanning(false)} />;
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Log food</Text>

        <View style={styles.searchRow}>
          <TextInput
            style={[
              styles.input,
              { flex: 1, backgroundColor: theme.surface1, color: theme.textPrimary, borderColor: theme.border },
            ]}
            placeholder="Search foods…"
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
          />
          <Pressable
            style={[styles.searchButton, { backgroundColor: theme.surface1, borderColor: theme.border, borderWidth: 1 }]}
            onPress={() => setScanning(true)}
          >
            <Text style={[styles.searchButtonText, { color: theme.textPrimary }]}>📷</Text>
          </Pressable>
          <Pressable
            style={[styles.searchButton, { backgroundColor: theme.series1 }]}
            onPress={() => handleSearch()}
            disabled={searching}
          >
            <Text style={styles.searchButtonText}>{searching ? "…" : "Search"}</Text>
          </Pressable>
        </View>

        {savedMessage ? (
          <Text style={[styles.savedBanner, { color: theme.statusGood }]}>{savedMessage}</Text>
        ) : null}
        {error ? <Text style={{ color: theme.statusCritical }}>{error}</Text> : null}

        {selected ? (
          <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{selected.description}</Text>

            <View style={styles.fieldRow}>
              <TextInput
                style={[
                  styles.input,
                  { width: 90, backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border },
                ]}
                keyboardType="numeric"
                inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
                value={String(amount)}
                onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
              />
              <View style={styles.unitToggle}>
                {[
                  "g",
                  "oz",
                  ...(selected.gramsPerTbsp ? ["tbsp"] : []),
                  ...(selected.countUnit ? [selected.countUnit.label] : []),
                ].map((u) => (
                  <Pressable
                    key={u}
                    onPress={() => handleUnitChange(u)}
                    style={[
                      styles.unitOption,
                      {
                        backgroundColor: unit === u ? theme.series1 : "transparent",
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: unit === u ? "#fff" : theme.textSecondary, fontWeight: "600" }}>
                      {u}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={[styles.label, { color: theme.textSecondary }]}>Meal</Text>
            <View style={styles.mealRow}>
              {MEAL_TYPES.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMeal(m)}
                  style={[
                    styles.mealOption,
                    {
                      backgroundColor: meal === m ? theme.series1 : "transparent",
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: meal === m ? "#fff" : theme.textSecondary, fontWeight: "600" }}>
                    {MEAL_LABELS[m]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: theme.textSecondary }]}>Date</Text>
            <View style={styles.mealRow}>
              <TextInput
                style={[
                  styles.input,
                  { flex: 1, backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border },
                ]}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textMuted}
              />
              <Pressable
                style={[styles.quickDateButton, { borderColor: theme.border }]}
                onPress={() => setDate(todayISO())}
              >
                <Text style={{ color: theme.textSecondary }}>Today</Text>
              </Pressable>
              <Pressable
                style={[styles.quickDateButton, { borderColor: theme.border }]}
                onPress={() => setDate(daysAgoISO(1))}
              >
                <Text style={{ color: theme.textSecondary }}>Yesterday</Text>
              </Pressable>
            </View>

            {preview && !adjusting ? (
              <View style={styles.previewRow}>
                <Text style={[styles.preview, { color: theme.textPrimary }]}>
                  {preview.calories} kcal · {preview.protein_g}g protein · {preview.carbs_g}g carbs ·{" "}
                  {preview.fat_g}g fat
                </Text>
                <Pressable onPress={handleStartAdjusting}>
                  <Text style={[styles.adjustLink, { color: theme.series1 }]}>Adjust</Text>
                </Pressable>
              </View>
            ) : null}

            {preview && adjusting ? (
              <View style={[styles.adjustBox, { borderColor: theme.border }]}>
                <Text style={[styles.adjustHint, { color: theme.textMuted }]}>
                  Not matching the package? Fix the numbers here.
                </Text>
                <View style={styles.adjustFieldRow}>
                  <View style={styles.adjustField}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Calories</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border },
                      ]}
                      keyboardType="numeric"
                      inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
                      value={caloriesOverride}
                      onChangeText={setCaloriesOverride}
                    />
                  </View>
                  <View style={styles.adjustField}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Protein (g)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border },
                      ]}
                      keyboardType="numeric"
                      inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
                      value={proteinOverride}
                      onChangeText={setProteinOverride}
                    />
                  </View>
                </View>
                <View style={styles.adjustFieldRow}>
                  <View style={styles.adjustField}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Carbs (g)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border },
                      ]}
                      keyboardType="numeric"
                      inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
                      value={carbsOverride}
                      onChangeText={setCarbsOverride}
                    />
                  </View>
                  <View style={styles.adjustField}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Fat (g)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border },
                      ]}
                      keyboardType="numeric"
                      inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
                      value={fatOverride}
                      onChangeText={setFatOverride}
                    />
                  </View>
                </View>
                <View style={styles.adjustFieldRow}>
                  <View style={styles.adjustField}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Fiber (g)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border },
                      ]}
                      keyboardType="numeric"
                      inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
                      value={fiberOverride}
                      onChangeText={setFiberOverride}
                    />
                  </View>
                </View>
                <Pressable onPress={() => setAdjusting(false)}>
                  <Text style={[styles.adjustLink, { color: theme.series1 }]}>Reset to calculated</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.actionsRow}>
              <Pressable style={styles.secondaryButton} onPress={() => setSelected(null)}>
                <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.searchButton, { backgroundColor: theme.series1 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.searchButtonText}>{saving ? "Adding…" : "Add to log"}</Text>
              </Pressable>
            </View>
          </View>
        ) : results ? (
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.fdcId)}
            contentContainerStyle={{ gap: 8 }}
            ListEmptyComponent={<EmptyState title="No matches found" />}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.resultRow, { backgroundColor: theme.surface1, borderColor: theme.border }]}
                onPress={() => handleSelect(item)}
              >
                <Text style={[styles.resultDesc, { color: theme.textPrimary }]} numberOfLines={2}>
                  {item.description}
                </Text>
                <Text style={[styles.resultCals, { color: theme.textMuted }]}>
                  {Math.round(item.per100g?.calories || 0)} kcal/100g
                </Text>
              </Pressable>
            )}
          />
        ) : (
          <FlatList
            data={recent}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ gap: 8 }}
            ListHeaderComponent={
              recent.length > 0 ? (
                <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 4 }]}>Recent</Text>
              ) : null
            }
            ListEmptyComponent={<EmptyState title="No foods logged yet" hint="Search above to get started" />}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.resultRow, { backgroundColor: theme.surface1, borderColor: theme.border }]}
                onPress={() => handleReLog(item)}
              >
                <Text style={[styles.resultDesc, { color: theme.textPrimary }]} numberOfLines={2}>
                  {item.description}
                </Text>
                <Text style={[styles.resultCals, { color: theme.textMuted }]}>
                  {Math.round(item.calories)} kcal
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
      <KeyboardDoneAccessory />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  searchRow: { flexDirection: "row", gap: 8 },
  input: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  searchButton: { borderRadius: radii.sm, paddingHorizontal: 16, justifyContent: "center" },
  searchButtonText: { color: "#fff", fontWeight: "700" },
  savedBanner: { fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  fieldRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  unitToggle: { flexDirection: "row", gap: 6 },
  unitOption: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 14, paddingVertical: 10 },
  label: { fontSize: 13, fontWeight: "600" },
  mealRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  mealOption: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 8 },
  quickDateButton: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 10, justifyContent: "center" },
  preview: { fontSize: 14, fontWeight: "600", flex: 1 },
  previewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  adjustLink: { fontSize: 13, fontWeight: "700" },
  adjustBox: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  adjustHint: { fontSize: 12 },
  adjustFieldRow: { flexDirection: "row", gap: 10 },
  adjustField: { flex: 1, gap: 4 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  secondaryButton: { paddingHorizontal: 12, justifyContent: "center" },
  resultRow: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  resultDesc: { flex: 1, fontSize: 14 },
  resultCals: { fontSize: 13 },
});
