import { useState } from "react";
import { todayISO } from "../dates";

const MEALS = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

export default function FoodItemRow({ entry, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  function startEdit() {
    setForm({
      description: entry.description,
      calories: entry.calories,
      protein_g: entry.protein_g,
      carbs_g: entry.carbs_g,
      fat_g: entry.fat_g,
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
    return (
      <li className="food-item food-item--editing">
        <input
          className="food-item__edit-desc"
          type="text"
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
        />
        <div className="food-item__edit-row">
          <label>
            Calories
            <input
              type="number"
              value={form.calories}
              onChange={(e) => updateField("calories", e.target.value)}
            />
          </label>
          <label>
            Protein (g)
            <input
              type="number"
              value={form.protein_g}
              onChange={(e) => updateField("protein_g", e.target.value)}
            />
          </label>
          <label>
            Carbs (g)
            <input
              type="number"
              value={form.carbs_g}
              onChange={(e) => updateField("carbs_g", e.target.value)}
            />
          </label>
          <label>
            Fat (g)
            <input
              type="number"
              value={form.fat_g}
              onChange={(e) => updateField("fat_g", e.target.value)}
            />
          </label>
          <label>
            Meal
            <select value={form.meal} onChange={(e) => updateField("meal", e.target.value)}>
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              value={form.date}
              max={todayISO()}
              onChange={(e) => updateField("date", e.target.value)}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button type="button" className="button-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="food-item">
      <div className="food-item__main">
        <div className="food-item__desc">{entry.description}</div>
        <div className="food-item__macros">
          {Math.round(entry.protein_g)}g protein · {Math.round(entry.carbs_g)}g carbs ·{" "}
          {Math.round(entry.fat_g)}g fat
        </div>
      </div>
      <div className="food-item__cals tabular">{Math.round(entry.calories)}</div>
      <button
        className="icon-button icon-button--edit"
        onClick={startEdit}
        aria-label={`Edit ${entry.description}`}
        title="Edit entry"
      >
        ✎
      </button>
      <button
        className="icon-button"
        onClick={() => onDelete(entry.id)}
        aria-label={`Delete ${entry.description}`}
        title="Delete entry"
      >
        ×
      </button>
    </li>
  );
}
