import { useEffect, useState } from "react";
import { api } from "../api";
import { todayISO, inferMealFromTime } from "../dates";
import { OZ_TO_G, defaultQuantity, toGrams, scaledMacros } from "../../../shared/nutritionScaling.js";

const RECENT_LIMIT = 8;

function dedupeByDescription(entries) {
  const seen = new Set();
  const deduped = [];
  for (const e of entries) {
    const key = e.description.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
    if (deduped.length >= RECENT_LIMIT) break;
  }
  return deduped;
}

const MEALS = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

export default function QuickAddFood({ onAdded }) {
  const [mode, setMode] = useState("search");

  const [manualTitle, setManualTitle] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(100);
  const [unit, setUnit] = useState("g");
  const [meal, setMeal] = useState(inferMealFromTime());
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const [recentFoods, setRecentFoods] = useState([]);
  const [reAddingId, setReAddingId] = useState(null);

  async function loadRecent() {
    try {
      const entries = await api.getFoodEntries({});
      setRecentFoods(dedupeByDescription(entries));
    } catch {
      // recent foods are a nice-to-have; ignore failures
    }
  }

  useEffect(() => {
    loadRecent();
  }, []);

  async function handleQuickReLog(entry) {
    setReAddingId(entry.id);
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
      onAdded(today);
      loadRecent();
    } catch (err) {
      setError(err.message);
    } finally {
      setReAddingId(null);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setSelected(null);
    try {
      const { foods } = await api.searchNutrition(query.trim());
      setResults(foods);
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  function handleSelect(food) {
    setSelected(food);
    setUnit("g");
    setAmount(defaultQuantity(food));
  }

  function handleUnitChange(newUnit) {
    if (newUnit === unit) return;
    const grams = toGrams(amount, unit);
    const converted = newUnit === "oz" ? grams / OZ_TO_G : grams;
    setAmount(Math.round(converted * 10) / 10);
    setUnit(newUnit);
  }

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      const grams = toGrams(amount, unit);
      const macros = scaledMacros(selected, grams);
      const qtyLabel = `${amount}${unit}`;
      await api.createFoodEntry({
        date,
        meal,
        description: `${selected.description} (${qtyLabel})`,
        ...macros,
        items: [{ name: selected.description, qty: qtyLabel, fdcId: selected.fdcId, calories: macros.calories }],
      });
      setQuery("");
      setResults(null);
      setSelected(null);
      onAdded(date);
      loadRecent();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleManualAdd() {
    setManualError(null);
    if (!manualTitle.trim()) {
      setManualError("Enter a title first");
      return;
    }
    if (!manualCalories || Number(manualCalories) <= 0) {
      setManualError("Enter a calorie count first");
      return;
    }
    setManualSaving(true);
    try {
      await api.createFoodEntry({
        date,
        meal,
        description: manualTitle.trim(),
        notes: manualNotes.trim() || null,
        calories: Number(manualCalories) || 0,
        protein_g: Number(manualProtein) || 0,
      });
      setManualTitle("");
      setManualNotes("");
      setManualCalories("");
      setManualProtein("");
      onAdded(date);
      loadRecent();
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualSaving(false);
    }
  }

  const preview = selected ? scaledMacros(selected, toGrams(amount, unit)) : null;

  return (
    <div className="card quick-add">
      <div className="card__header">
        <h2>Log food</h2>
      </div>

      <div className="unit-toggle quick-add__mode-toggle">
        <button
          type="button"
          className={mode === "search" ? "unit-toggle__option unit-toggle__option--active" : "unit-toggle__option"}
          onClick={() => setMode("search")}
        >
          Search
        </button>
        <button
          type="button"
          className={mode === "manual" ? "unit-toggle__option unit-toggle__option--active" : "unit-toggle__option"}
          onClick={() => setMode("manual")}
        >
          Manual entry
        </button>
      </div>

      {mode === "manual" && (
        <div className="quick-add__manual">
          <input
            type="text"
            placeholder="Title (e.g. Leftover pasta)"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            className="quick-add__manual-title"
          />
          <textarea
            placeholder="Description (optional)"
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            className="quick-add__manual-notes"
            rows={2}
          />
          <div className="quick-add__fields">
            <label>
              Calories
              <input
                type="number"
                min="0"
                value={manualCalories}
                onChange={(e) => setManualCalories(e.target.value)}
              />
            </label>
            <label>
              Protein (g, optional)
              <input
                type="number"
                min="0"
                value={manualProtein}
                onChange={(e) => setManualProtein(e.target.value)}
              />
            </label>
            <label>
              Meal
              <select value={meal} onChange={(e) => setMeal(e.target.value)}>
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
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>

          {manualError && <div className="quick-add__error">{manualError}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="button-primary"
              onClick={handleManualAdd}
              disabled={manualSaving}
            >
              {manualSaving ? "Adding…" : "Add to log"}
            </button>
          </div>
        </div>
      )}

      {mode === "search" && (
      <>
      <form className="quick-add__search" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="What did you eat? e.g. banana, grilled chicken breast…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="button-primary" disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <div className="quick-add__error">{error}</div>}

      {!results && !selected && recentFoods.length > 0 && (
        <div className="quick-add__recent">
          <div className="quick-add__recent-label">Recent</div>
          <div className="quick-add__recent-chips">
            {recentFoods.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="quick-add__recent-chip"
                disabled={reAddingId !== null}
                onClick={() => handleQuickReLog(entry)}
                title={`Re-log ${entry.description}`}
              >
                <span className="quick-add__recent-chip-desc">
                  {reAddingId === entry.id ? "Adding…" : entry.description}
                </span>
                <span className="quick-add__recent-chip-cals tabular">
                  {Math.round(entry.calories)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {results && !selected && (
        <ul className="quick-add__results">
          {results.length === 0 && <li className="quick-add__empty">No matches found</li>}
          {results.map((food) => (
            <li key={food.fdcId}>
              <button className="quick-add__result" onClick={() => handleSelect(food)}>
                <span className="quick-add__result-desc">{food.description}</span>
                <span className="quick-add__result-cals tabular">
                  {Math.round(food.per100g?.calories || 0)} kcal/100g
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="quick-add__detail">
          <div className="quick-add__detail-desc">{selected.description}</div>

          <div className="quick-add__fields">
            <label>
              Amount
              <div className="quick-add__amount">
                <input
                  type="number"
                  min="0"
                  step={unit === "oz" ? "0.1" : "1"}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                />
                <div className="unit-toggle">
                  <button
                    type="button"
                    className={unit === "g" ? "unit-toggle__option unit-toggle__option--active" : "unit-toggle__option"}
                    onClick={() => handleUnitChange("g")}
                  >
                    g
                  </button>
                  <button
                    type="button"
                    className={unit === "oz" ? "unit-toggle__option unit-toggle__option--active" : "unit-toggle__option"}
                    onClick={() => handleUnitChange("oz")}
                  >
                    oz
                  </button>
                </div>
              </div>
            </label>
            <label>
              Meal
              <select value={meal} onChange={(e) => setMeal(e.target.value)}>
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
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>

          {preview && (
            <div className="quick-add__preview tabular">
              {preview.calories} kcal · {preview.protein_g}g protein · {preview.carbs_g}g carbs ·{" "}
              {preview.fat_g}g fat
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setSelected(null);
              }}
            >
              Back
            </button>
            <button type="button" className="button-primary" onClick={handleAdd} disabled={saving}>
              {saving ? "Adding…" : "Add to log"}
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
