import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { buildShoppingList } from "../shoppingList";

const EMPTY_RECIPE_FORM = {
  name: "",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  fiber_g: "",
  video_url: "",
  ingredients: "",
  instructions: "",
};

function extractVideoUrl(notes) {
  const match = notes?.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
}

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

const FOOD_CATEGORIES = [
  "Protein",
  "Dairy & Eggs",
  "Produce",
  "Grains & Bread",
  "Condiments & Sauces",
  "Snacks & Other",
  "Uncategorized",
];

const WEEKDAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

function normalizeMealType(slot) {
  const s = (slot || "").toLowerCase();
  if (s.includes("breakfast")) return "Breakfast";
  if (s.includes("lunch")) return "Lunch";
  if (s.includes("dinner")) return "Dinner";
  if (s.includes("snack")) return "Snack";
  return "Other";
}

function normalizeAIItems(result) {
  return (result.meals || []).flatMap((meal) =>
    (meal.items || []).map((item) => ({
      name: item.food,
      amount: item.amount,
      protein_g: item.protein_g,
      calories: item.calories,
      meal: meal.dish_name || meal.slot || meal.name,
      meal_type: normalizeMealType(meal.slot),
    }))
  );
}

export default function MealPlanPage({ proteinGoal, todayProtein }) {
  const [favoriteFoods, setFavoriteFoods] = useState([]);
  const [foodInput, setFoodInput] = useState("");
  const [foodCategory, setFoodCategory] = useState(FOOD_CATEGORIES[0]);
  const [showFavoriteChips, setShowFavoriteChips] = useState(false);
  const [scope, setScope] = useState("remaining");

  const [recipes, setRecipes] = useState([]);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState([]);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeForm, setRecipeForm] = useState(EMPTY_RECIPE_FORM);
  const [recipeError, setRecipeError] = useState(null);
  const [viewingRecipe, setViewingRecipe] = useState(null);

  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiSaveDay, setAiSaveDay] = useState("monday");
  const [aiSavedMsg, setAiSavedMsg] = useState(null);
  const [guidance, setGuidance] = useState("");

  const [weeklyPlan, setWeeklyPlan] = useState({});
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});
  const [addPlanSource, setAddPlanSource] = useState("recipe");
  const [addPlanRecipeId, setAddPlanRecipeId] = useState("");
  const [addPlanFavoriteName, setAddPlanFavoriteName] = useState("");
  const [addPlanCustomName, setAddPlanCustomName] = useState("");
  const [addPlanAmount, setAddPlanAmount] = useState("");
  const [addPlanCalories, setAddPlanCalories] = useState("");
  const [addPlanProteinG, setAddPlanProteinG] = useState("");
  const [addPlanDay, setAddPlanDay] = useState("monday");
  const [addPlanMealType, setAddPlanMealType] = useState(MEAL_TYPES[0]);
  const [addPlanError, setAddPlanError] = useState(null);

  const remaining = Math.max(Math.round(proteinGoal - todayProtein), 0);
  const target = scope === "remaining" ? remaining : proteinGoal;

  useEffect(() => {
    api.getRecipes().then(setRecipes).catch(() => {});
    api.getFavoriteFoods().then(setFavoriteFoods).catch(() => {});
    loadWeeklyPlan();
  }, []);

  async function loadWeeklyPlan() {
    const rows = await api.getWeeklyPlan().catch(() => []);
    const byDay = Object.fromEntries(rows.map((r) => [r.day_of_week, r]));
    setWeeklyPlan(byDay);
  }

  async function addFood(e) {
    e.preventDefault();
    const trimmed = foodInput.trim();
    if (!trimmed) return;
    if (favoriteFoods.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      setFoodInput("");
      return;
    }
    setFoodInput("");
    const created = await api.createFavoriteFood(trimmed, foodCategory);
    setFavoriteFoods((prev) => [...prev, created]);
    setShowFavoriteChips(true);
  }

  async function removeFood(id) {
    await api.deleteFavoriteFood(id);
    setFavoriteFoods((prev) => prev.filter((f) => f.id !== id));
  }

  function toggleRecipe(id) {
    setSelectedRecipeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleAddRecipe(e) {
    e.preventDefault();
    setRecipeError(null);
    if (!recipeForm.name.trim() || !recipeForm.calories) {
      setRecipeError("Name and calories are required");
      return;
    }
    try {
      const created = await api.createRecipe({
        name: recipeForm.name.trim(),
        calories: Number(recipeForm.calories) || 0,
        protein_g: Number(recipeForm.protein_g) || 0,
        carbs_g: Number(recipeForm.carbs_g) || 0,
        fat_g: Number(recipeForm.fat_g) || 0,
        fiber_g: Number(recipeForm.fiber_g) || 0,
        video_url: recipeForm.video_url.trim() || null,
        ingredients: recipeForm.ingredients
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        instructions: recipeForm.instructions.trim(),
      });
      setRecipes((prev) => [created, ...prev]);
      setRecipeForm(EMPTY_RECIPE_FORM);
      setShowRecipeForm(false);
    } catch (err) {
      setRecipeError(err.message);
    }
  }

  async function handleDeleteRecipe(id) {
    await api.deleteRecipe(id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setSelectedRecipeIds((prev) => prev.filter((x) => x !== id));
  }

  async function handleRateRecipe(id, rating) {
    const updated = await api.rateRecipe(id, rating);
    setRecipes((prev) =>
      [...prev.map((r) => (r.id === id ? updated : r))].sort(
        (a, b) => b.rating - a.rating || new Date(b.created_at) - new Date(a.created_at)
      )
    );
  }

  const selectedRecipes = recipes.filter((r) => selectedRecipeIds.includes(r.id));
  const favoriteFoodNames = favoriteFoods.map((f) => f.name);

  async function handleGenerateAI() {
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const result = await api.generateAIPlan(
        favoriteFoodNames,
        target,
        scope,
        selectedRecipes,
        guidance
      );
      setAiResult(result);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSaveAIToDay() {
    const items = normalizeAIItems(aiResult);
    const saved = await api.saveWeeklyPlanDay(aiSaveDay, {
      source: "ai",
      items,
      totalProteinG: aiResult.total_protein_g,
      totalCalories: aiResult.total_calories,
    });
    setWeeklyPlan((prev) => ({ ...prev, [aiSaveDay]: saved }));
    setAiSavedMsg(`Saved to ${aiSaveDay}`);
    setTimeout(() => setAiSavedMsg(null), 2500);
  }

  async function handleRemoveDay(day) {
    await api.deleteWeeklyPlanDay(day);
    setWeeklyPlan((prev) => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
  }

  async function handleAddToDay() {
    setAddPlanError(null);
    let payload;
    if (addPlanSource === "recipe") {
      if (!addPlanRecipeId) {
        setAddPlanError("Pick a recipe first");
        return;
      }
      payload = { recipeId: Number(addPlanRecipeId), mealType: addPlanMealType };
    } else if (addPlanSource === "favorite") {
      if (!addPlanFavoriteName.trim()) {
        setAddPlanError("Enter a favorite food first");
        return;
      }
      payload = {
        name: addPlanFavoriteName.trim(),
        amount: addPlanAmount,
        calories: Number(addPlanCalories) || 0,
        protein_g: Number(addPlanProteinG) || 0,
        mealType: addPlanMealType,
      };
    } else {
      if (!addPlanCustomName.trim()) {
        setAddPlanError("Enter a name first");
        return;
      }
      payload = {
        name: addPlanCustomName,
        amount: addPlanAmount,
        calories: Number(addPlanCalories) || 0,
        protein_g: Number(addPlanProteinG) || 0,
        mealType: addPlanMealType,
      };
    }

    try {
      const updated = await api.addItemToDay(addPlanDay, payload);
      setWeeklyPlan((prev) => ({ ...prev, [addPlanDay]: updated }));
      if (addPlanSource !== "recipe") {
        setAddPlanFavoriteName("");
        setAddPlanCustomName("");
        setAddPlanAmount("");
        setAddPlanCalories("");
        setAddPlanProteinG("");
      }
    } catch (err) {
      setAddPlanError(err.message);
    }
  }

  async function handleRemoveDayItem(day, index) {
    const updated = await api.removeWeeklyPlanItem(day, index);
    setWeeklyPlan((prev) => {
      const next = { ...prev };
      if (updated) {
        next[day] = updated;
      } else {
        delete next[day];
      }
      return next;
    });
  }

  const shoppingList = useMemo(
    () => buildShoppingList(Object.values(weeklyPlan), recipes),
    [weeklyPlan, recipes]
  );

  const groupedFavoriteFoods = useMemo(() => {
    return FOOD_CATEGORIES.map((cat) => ({
      category: cat,
      items: favoriteFoods.filter((f) => (f.category || "Uncategorized") === cat),
    })).filter((g) => g.items.length > 0);
  }, [favoriteFoods]);

  function toggleChecked(name) {
    setCheckedItems((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  const canGenerate = (favoriteFoods.length > 0 || selectedRecipes.length > 0) && target > 0;
  const hasWeeklyPlans = Object.keys(weeklyPlan).length > 0;

  return (
    <div className="meal-plan-page">
      <div className="card">
        <div className="card__header">
          <h2>Favorite foods</h2>
          {favoriteFoods.length > 0 && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => setShowFavoriteChips((v) => !v)}
            >
              {showFavoriteChips ? "Hide list" : `Show list (${favoriteFoods.length})`}
            </button>
          )}
        </div>

        <form className="meal-plan__food-form" onSubmit={addFood}>
          <input
            type="text"
            placeholder="e.g. chicken breast, greek yogurt, eggs…"
            value={foodInput}
            onChange={(e) => setFoodInput(e.target.value)}
          />
          <select
            className="meal-plan__category-select"
            value={foodCategory}
            onChange={(e) => setFoodCategory(e.target.value)}
          >
            {FOOD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button type="submit" className="button-primary">
            Add
          </button>
        </form>

        {showFavoriteChips && favoriteFoods.length > 0 && (
          <div className="meal-plan__favorites-groups">
            {groupedFavoriteFoods.map((group) => (
              <div className="meal-plan__category-group" key={group.category}>
                <div className="meal-plan__category-label">{group.category}</div>
                <div className="meal-plan__chips">
                  {group.items.map((food) => (
                    <span key={food.id} className="meal-plan__chip">
                      {food.name}
                      <button
                        type="button"
                        className="meal-plan__chip-remove"
                        onClick={() => removeFood(food.id)}
                        aria-label={`Remove ${food.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="meal-plan__scope">
          <span className="meal-plan__scope-label">Target:</span>
          <div className="unit-toggle">
            <button
              type="button"
              className={
                scope === "remaining"
                  ? "unit-toggle__option unit-toggle__option--active"
                  : "unit-toggle__option"
              }
              onClick={() => setScope("remaining")}
            >
              Remaining today ({remaining}g)
            </button>
            <button
              type="button"
              className={
                scope === "full"
                  ? "unit-toggle__option unit-toggle__option--active"
                  : "unit-toggle__option"
              }
              onClick={() => setScope("full")}
            >
              Full day ({proteinGoal}g)
            </button>
          </div>
        </div>

        {!canGenerate && (
          <div className="meal-plan__hint">
            {favoriteFoods.length === 0 && selectedRecipes.length === 0
              ? "Add a few favorite foods or select a saved recipe to generate suggestions."
              : "Target protein is already met — nothing left to plan for."}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__header">
          <h2>Saved recipes</h2>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setShowRecipeForm((v) => !v)}
          >
            {showRecipeForm ? "Cancel" : "+ Add recipe"}
          </button>
        </div>

        {showRecipeForm && (
          <form className="meal-plan__recipe-form" onSubmit={handleAddRecipe}>
            <input
              type="text"
              placeholder="Recipe name"
              value={recipeForm.name}
              onChange={(e) => setRecipeForm((f) => ({ ...f, name: e.target.value }))}
              className="meal-plan__recipe-name"
            />
            <div className="meal-plan__recipe-macros">
              <label>
                Calories
                <input
                  type="number"
                  value={recipeForm.calories}
                  onChange={(e) => setRecipeForm((f) => ({ ...f, calories: e.target.value }))}
                />
              </label>
              <label>
                Protein (g)
                <input
                  type="number"
                  value={recipeForm.protein_g}
                  onChange={(e) => setRecipeForm((f) => ({ ...f, protein_g: e.target.value }))}
                />
              </label>
              <label>
                Carbs (g)
                <input
                  type="number"
                  value={recipeForm.carbs_g}
                  onChange={(e) => setRecipeForm((f) => ({ ...f, carbs_g: e.target.value }))}
                />
              </label>
              <label>
                Fat (g)
                <input
                  type="number"
                  value={recipeForm.fat_g}
                  onChange={(e) => setRecipeForm((f) => ({ ...f, fat_g: e.target.value }))}
                />
              </label>
              <label>
                Fiber (g)
                <input
                  type="number"
                  value={recipeForm.fiber_g}
                  onChange={(e) => setRecipeForm((f) => ({ ...f, fiber_g: e.target.value }))}
                />
              </label>
            </div>
            <input
              type="text"
              placeholder="Video URL (optional)"
              value={recipeForm.video_url}
              onChange={(e) => setRecipeForm((f) => ({ ...f, video_url: e.target.value }))}
              className="meal-plan__recipe-name"
            />
            <textarea
              placeholder="Ingredients — one per line (optional)"
              value={recipeForm.ingredients}
              onChange={(e) => setRecipeForm((f) => ({ ...f, ingredients: e.target.value }))}
              className="meal-plan__recipe-textarea"
              rows={4}
            />
            <textarea
              placeholder="Instructions (optional)"
              value={recipeForm.instructions}
              onChange={(e) => setRecipeForm((f) => ({ ...f, instructions: e.target.value }))}
              className="meal-plan__recipe-textarea"
              rows={5}
            />
            {recipeError && <div className="quick-add__error">{recipeError}</div>}
            <div className="modal-actions">
              <button type="submit" className="button-primary">
                Save recipe
              </button>
            </div>
          </form>
        )}

        {recipes.length === 0 ? (
          <div className="meal-plan__hint">
            No saved recipes yet. Add one above (great for batch-cooked meals with known
            nutrition, like a soup you've already calculated).
          </div>
        ) : (
          <div className="meal-plan__chips">
            {recipes.map((r) => {
              const videoUrl = r.video_url || extractVideoUrl(r.notes);
              return (
                <label key={r.id} className="meal-plan__recipe-chip">
                  <input
                    type="checkbox"
                    checked={selectedRecipeIds.includes(r.id)}
                    onChange={() => toggleRecipe(r.id)}
                  />
                  <button
                    type="button"
                    className="meal-plan__recipe-chip-name meal-plan__recipe-chip-name--link"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setViewingRecipe(r);
                    }}
                  >
                    {r.name}
                  </button>
                  <span className="meal-plan__recipe-chip-macros tabular">
                    {r.protein_g}g protein · {r.calories} kcal
                  </span>
                  <span className="meal-plan__recipe-chip-stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={
                          n <= r.rating
                            ? "meal-plan__star meal-plan__star--filled"
                            : "meal-plan__star"
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRateRecipe(r.id, n === r.rating ? 0 : n);
                        }}
                        aria-label={`Rate ${r.name} ${n} star${n > 1 ? "s" : ""}`}
                        title={`Rate ${n} star${n > 1 ? "s" : ""}`}
                      >
                        ★
                      </button>
                    ))}
                  </span>
                  {videoUrl && (
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="meal-plan__recipe-chip-video"
                      title="Watch the recipe video"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ▶
                    </a>
                  )}
                  <button
                    type="button"
                    className="meal-plan__chip-remove"
                    onClick={() => handleDeleteRecipe(r.id)}
                    aria-label={`Delete ${r.name}`}
                  >
                    ×
                  </button>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="card meal-plan__result-card">
        <div className="card__header">
          <h2>Generate meal plan (Claude)</h2>
          <button
            type="button"
            className="button-primary"
            onClick={handleGenerateAI}
            disabled={!canGenerate || aiLoading}
          >
            {aiLoading ? "Generating…" : "Generate"}
          </button>
        </div>

        <input
          type="text"
          className="meal-plan__guidance"
          placeholder="Any requests? e.g. &quot;soup for dinner&quot;, &quot;a crockpot meal&quot;, &quot;no eggs&quot;…"
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
        />

        {aiError && <div className="quick-add__error">{aiError}</div>}

        {aiResult && (
          <div className="meal-plan__plan">
            {aiResult.meals?.map((meal, mi) => (
              <div key={mi} className="meal-plan__meal">
                <div className="meal-plan__meal-header">
                  <span>
                    {meal.slot ? `${meal.slot} — ` : ""}
                    {meal.dish_name || meal.name}
                  </span>
                  <span className="tabular">{meal.meal_protein_g}g protein</span>
                </div>
                <ul className="meal-plan__items">
                  {meal.items.map((item, i) => (
                    <li key={i} className="meal-plan__item">
                      <span className="meal-plan__item-desc">
                        {item.food} — {item.amount}
                        {item.from_favorites === false && (
                          <span className="meal-plan__item-new">new</span>
                        )}
                      </span>
                      <span className="meal-plan__item-macros tabular">
                        {item.protein_g}g protein · {item.calories} kcal
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="meal-plan__total">
              {aiResult.total_protein_g}g protein · {aiResult.total_calories} kcal total
            </div>
            {aiResult.notes && <div className="meal-plan__note">{aiResult.notes}</div>}

            <div className="meal-plan__save-row">
              <select value={aiSaveDay} onChange={(e) => setAiSaveDay(e.target.value)}>
                {WEEKDAYS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
              <button type="button" className="button-secondary" onClick={handleSaveAIToDay}>
                Save to day
              </button>
              {aiSavedMsg && <span className="meal-plan__saved-msg">{aiSavedMsg}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__header">
          <h2>This week's plan</h2>
          {hasWeeklyPlans && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => setShowShoppingList((v) => !v)}
            >
              {showShoppingList ? "Hide shopping list" : "Generate shopping list"}
            </button>
          )}
        </div>

        <div className="meal-plan__add-to-plan">
          <div className="unit-toggle">
            <button
              type="button"
              className={
                addPlanSource === "recipe"
                  ? "unit-toggle__option unit-toggle__option--active"
                  : "unit-toggle__option"
              }
              onClick={() => setAddPlanSource("recipe")}
            >
              Saved recipe
            </button>
            <button
              type="button"
              className={
                addPlanSource === "favorite"
                  ? "unit-toggle__option unit-toggle__option--active"
                  : "unit-toggle__option"
              }
              onClick={() => setAddPlanSource("favorite")}
            >
              Favorite food
            </button>
            <button
              type="button"
              className={
                addPlanSource === "custom"
                  ? "unit-toggle__option unit-toggle__option--active"
                  : "unit-toggle__option"
              }
              onClick={() => setAddPlanSource("custom")}
            >
              Custom meal
            </button>
          </div>

          <div className="meal-plan__add-to-plan-row">
            {addPlanSource === "recipe" && (
              <select value={addPlanRecipeId} onChange={(e) => setAddPlanRecipeId(e.target.value)}>
                <option value="">Choose a saved recipe…</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.protein_g}g protein · {r.calories} kcal)
                  </option>
                ))}
              </select>
            )}

            {addPlanSource === "favorite" && (
              <>
                <input
                  type="text"
                  list="favorite-foods-datalist"
                  placeholder="Type to search favorite foods…"
                  value={addPlanFavoriteName}
                  onChange={(e) => setAddPlanFavoriteName(e.target.value)}
                />
                <datalist id="favorite-foods-datalist">
                  {favoriteFoods.map((f) => (
                    <option key={f.id} value={f.name} />
                  ))}
                </datalist>
                <input
                  type="text"
                  placeholder="Amount (e.g. 150g)"
                  value={addPlanAmount}
                  onChange={(e) => setAddPlanAmount(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Calories"
                  value={addPlanCalories}
                  onChange={(e) => setAddPlanCalories(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Protein (g)"
                  value={addPlanProteinG}
                  onChange={(e) => setAddPlanProteinG(e.target.value)}
                />
              </>
            )}

            {addPlanSource === "custom" && (
              <>
                <input
                  type="text"
                  placeholder="Meal name"
                  value={addPlanCustomName}
                  onChange={(e) => setAddPlanCustomName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Amount (e.g. 1 bowl)"
                  value={addPlanAmount}
                  onChange={(e) => setAddPlanAmount(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Calories"
                  value={addPlanCalories}
                  onChange={(e) => setAddPlanCalories(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Protein (g)"
                  value={addPlanProteinG}
                  onChange={(e) => setAddPlanProteinG(e.target.value)}
                />
              </>
            )}

            <select value={addPlanDay} onChange={(e) => setAddPlanDay(e.target.value)}>
              {WEEKDAYS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
            <select value={addPlanMealType} onChange={(e) => setAddPlanMealType(e.target.value)}>
              {MEAL_TYPES.map((mt) => (
                <option key={mt} value={mt}>
                  {mt}
                </option>
              ))}
            </select>
            <button type="button" className="button-primary" onClick={handleAddToDay}>
              Add to plan
            </button>
          </div>
        </div>
        {addPlanError && <div className="quick-add__error">{addPlanError}</div>}

        <div className="meal-plan__week">
          {WEEKDAYS.map((d) => {
            const plan = weeklyPlan[d.key];
            const groups = plan
              ? [...MEAL_TYPES, "Other"]
                  .map((mt) => ({
                    mealType: mt,
                    items: plan.items
                      .map((item, i) => ({ item, index: i }))
                      .filter(({ item }) => (item.meal_type || "Other") === mt),
                  }))
                  .filter((g) => g.items.length > 0)
              : [];
            return (
              <div className="meal-plan__week-day" key={d.key}>
                <div className="meal-plan__week-day-header">
                  <span className="meal-plan__week-day-name">{d.label}</span>
                  {plan && (
                    <button
                      type="button"
                      className="meal-plan__chip-remove"
                      onClick={() => handleRemoveDay(d.key)}
                      aria-label={`Remove plan for ${d.label}`}
                    >
                      ×
                    </button>
                  )}
                </div>
                {plan ? (
                  <>
                    <div className="meal-plan__week-day-summary tabular">
                      {plan.total_protein_g}g protein · {plan.total_calories} kcal
                    </div>
                    {groups.map((g) => (
                      <div className="meal-plan__week-day-mealtype" key={g.mealType}>
                        <div className="meal-plan__week-day-mealtype-label">{g.mealType}</div>
                        <ul className="meal-plan__week-day-items">
                          {g.items.map(({ item, index }) => (
                            <li key={index}>
                              <span>
                                {item.name} — {item.amount}
                              </span>
                              <button
                                type="button"
                                className="meal-plan__chip-remove"
                                onClick={() => handleRemoveDayItem(d.key, index)}
                                aria-label={`Remove ${item.name} from ${d.label}`}
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="meal-plan__week-day-empty">No plan saved</div>
                )}
              </div>
            );
          })}
        </div>

        {showShoppingList && (
          <div className="meal-plan__shopping-list">
            <h3>Shopping list</h3>
            {shoppingList.ingredients.length === 0 && shoppingList.other.length === 0 ? (
              <div className="meal-plan__hint">No items to shop for yet.</div>
            ) : (
              <>
                {shoppingList.ingredients.length > 0 && (
                  <div className="meal-plan__shopping-group">
                    <ul className="meal-plan__shopping-items meal-plan__shopping-items--stacked">
                      {shoppingList.ingredients.map((group) => (
                        <li key={group.name}>
                          <label
                            className={
                              checkedItems[group.name]
                                ? "meal-plan__shopping-item meal-plan__shopping-item--checked"
                                : "meal-plan__shopping-item"
                            }
                          >
                            <input
                              type="checkbox"
                              checked={!!checkedItems[group.name]}
                              onChange={() => toggleChecked(group.name)}
                            />
                            <span className="meal-plan__shopping-item-name">{group.name}</span>
                          </label>
                          <ul className="meal-plan__shopping-sources">
                            {group.sources.map((s, i) => (
                              <li key={i}>
                                {s.display} — {s.recipeName}
                                {s.recipeCount > 1 ? ` (×${s.recipeCount})` : ""}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {shoppingList.other.length > 0 && (
                  <div className="meal-plan__shopping-group">
                    {shoppingList.ingredients.length > 0 && (
                      <div className="meal-plan__shopping-group-label">Other items</div>
                    )}
                    <ul className="meal-plan__shopping-items">
                      {shoppingList.other.map((item) => (
                        <li key={item.name}>
                          <label
                            className={
                              checkedItems[item.name]
                                ? "meal-plan__shopping-item meal-plan__shopping-item--checked"
                                : "meal-plan__shopping-item"
                            }
                          >
                            <input
                              type="checkbox"
                              checked={!!checkedItems[item.name]}
                              onChange={() => toggleChecked(item.name)}
                            />
                            <span className="meal-plan__shopping-item-name">{item.name}</span>
                            <span className="meal-plan__shopping-item-amount tabular">
                              {item.amount}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {viewingRecipe && (
        <div className="modal-backdrop" onClick={() => setViewingRecipe(null)}>
          <div
            className="modal modal--wide recipe-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="recipe-modal__header">
              <h2>{viewingRecipe.name}</h2>
              <button
                type="button"
                className="meal-plan__chip-remove"
                onClick={() => setViewingRecipe(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="recipe-modal__macros tabular">
              {viewingRecipe.protein_g}g protein · {viewingRecipe.calories} kcal
            </div>

            {(() => {
              const embedUrl = getYouTubeEmbedUrl(
                viewingRecipe.video_url || extractVideoUrl(viewingRecipe.notes)
              );
              return (
                embedUrl && (
                  <div className="recipe-modal__video">
                    <iframe
                      src={embedUrl}
                      title={`${viewingRecipe.name} video`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )
              );
            })()}

            <div className="recipe-modal__body">
              {viewingRecipe.ingredients?.length > 0 && (
                <div className="recipe-modal__section">
                  <h3>Ingredients</h3>
                  <ul>
                    {viewingRecipe.ingredients.map((ing, i) => (
                      <li key={i}>{ing}</li>
                    ))}
                  </ul>
                </div>
              )}

              {viewingRecipe.instructions && (
                <div className="recipe-modal__section">
                  <h3>Instructions</h3>
                  <ol>
                    {viewingRecipe.instructions
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((step, i) => (
                        <li key={i}>{step.replace(/^\d+[.)]\s*/, "")}</li>
                      ))}
                  </ol>
                </div>
              )}

              {!viewingRecipe.ingredients?.length && !viewingRecipe.instructions && (
                <div className="meal-plan__hint">
                  No ingredients or instructions saved for this recipe yet.
                </div>
              )}

              {viewingRecipe.notes && (
                <div className="recipe-modal__section">
                  <h3>Notes</h3>
                  <p>{viewingRecipe.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
