import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MEAL_TYPES } from "calorie-tracker-shared/validation.js";
import { useTheme, radii } from "../theme";
import { NUMERIC_KEYBOARD_ACCESSORY_ID } from "./KeyboardDoneAccessory";

const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

export default function FoodItemRow({ entry, onUpdate, onDelete, deleting }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  function startEdit() {
    setForm({
      description: entry.description,
      notes: entry.notes || "",
      calories: String(entry.calories),
      protein_g: String(entry.protein_g),
      carbs_g: String(entry.carbs_g),
      fat_g: String(entry.fat_g),
      meal: entry.meal,
      date: entry.date,
    });
    setEditing(true);
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onUpdate(entry.id, {
        ...form,
        notes: form.notes.trim() || null,
        calories: Number(form.calories) || 0,
        protein_g: Number(form.protein_g) || 0,
        carbs_g: Number(form.carbs_g) || 0,
        fat_g: Number(form.fat_g) || 0,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    const inputStyle = [
      styles.input,
      { backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border },
    ];
    return (
      <View style={[styles.editBox, { borderTopColor: theme.border }]}>
        <TextInput
          style={inputStyle}
          value={form.description}
          onChangeText={(t) => updateField("description", t)}
        />
        <TextInput
          style={[inputStyle, styles.notesInput]}
          placeholder="Description (optional)"
          placeholderTextColor={theme.textMuted}
          value={form.notes}
          onChangeText={(t) => updateField("notes", t)}
          multiline
        />
        <View style={styles.fieldRow}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Calories</Text>
            <TextInput
              style={inputStyle}
              keyboardType="numeric"
              inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
              value={form.calories}
              onChangeText={(t) => updateField("calories", t)}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Protein (g)</Text>
            <TextInput
              style={inputStyle}
              keyboardType="numeric"
              inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
              value={form.protein_g}
              onChangeText={(t) => updateField("protein_g", t)}
            />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Carbs (g)</Text>
            <TextInput
              style={inputStyle}
              keyboardType="numeric"
              inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
              value={form.carbs_g}
              onChangeText={(t) => updateField("carbs_g", t)}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Fat (g)</Text>
            <TextInput
              style={inputStyle}
              keyboardType="numeric"
              inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
              value={form.fat_g}
              onChangeText={(t) => updateField("fat_g", t)}
            />
          </View>
        </View>

        <Text style={[styles.label, { color: theme.textSecondary }]}>Meal</Text>
        <View style={styles.mealRow}>
          {MEAL_TYPES.map((m) => (
            <Pressable
              key={m}
              onPress={() => updateField("meal", m)}
              style={[
                styles.mealOption,
                { backgroundColor: form.meal === m ? theme.series1 : "transparent", borderColor: theme.border },
              ]}
            >
              <Text style={{ color: form.meal === m ? "#fff" : theme.textSecondary, fontWeight: "600" }}>
                {MEAL_LABELS[m]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textSecondary }]}>Date (YYYY-MM-DD)</Text>
        <TextInput style={inputStyle} value={form.date} onChangeText={(t) => updateField("date", t)} />

        <View style={styles.actionsRow}>
          <Pressable onPress={() => setEditing(false)} hitSlop={8}>
            <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, { backgroundColor: theme.series1 }]}
          >
            <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.entryRow, { borderTopColor: theme.border }]}>
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
      <Text style={{ color: theme.textSecondary, marginLeft: 8 }}>{Math.round(entry.calories)}</Text>
      <Pressable onPress={startEdit} hitSlop={8} style={styles.iconButton}>
        <Text style={{ color: theme.series1, fontSize: 16 }}>✎</Text>
      </Pressable>
      <Pressable onPress={() => onDelete(entry)} disabled={deleting} hitSlop={8} style={styles.iconButton}>
        <Text style={{ color: theme.statusCritical, fontSize: 16 }}>{deleting ? "…" : "×"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  entryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1 },
  iconButton: { paddingHorizontal: 8, paddingVertical: 4 },
  editBox: { borderTopWidth: 1, paddingTop: 10, marginTop: 2, gap: 8 },
  input: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  notesInput: { minHeight: 44, textAlignVertical: "top" },
  fieldRow: { flexDirection: "row", gap: 8 },
  field: { flex: 1, gap: 4 },
  label: { fontSize: 12, fontWeight: "600" },
  mealRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mealOption: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 16, marginTop: 4 },
  saveButton: { borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 8 },
  saveButtonText: { color: "#fff", fontWeight: "700" },
});
