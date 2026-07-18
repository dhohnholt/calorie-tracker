import { formatFullDate, eachDateInRange, todayISO } from "./dates";

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

const EMPTY_TOTALS = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 };

function round1(n) {
  return Math.round((n || 0) * 10) / 10;
}

function macroLine(entry) {
  const parts = [
    `${Math.round(entry.calories || 0)} kcal`,
    `${round1(entry.protein_g)}g protein`,
    `${round1(entry.carbs_g)}g carbs`,
    `${round1(entry.fat_g)}g fat`,
  ];
  if (entry.fiber_g) parts.push(`${round1(entry.fiber_g)}g fiber`);
  if (entry.sugar_g) parts.push(`${round1(entry.sugar_g)}g sugar`);
  if (entry.sodium_mg) parts.push(`${Math.round(entry.sodium_mg)}mg sodium`);
  return parts.join(", ");
}

function addTotals(a, b) {
  return {
    calories: a.calories + (b.calories || 0),
    protein_g: a.protein_g + (b.protein_g || 0),
    carbs_g: a.carbs_g + (b.carbs_g || 0),
    fat_g: a.fat_g + (b.fat_g || 0),
    fiber_g: a.fiber_g + (b.fiber_g || 0),
    sugar_g: a.sugar_g + (b.sugar_g || 0),
    sodium_mg: a.sodium_mg + (b.sodium_mg || 0),
  };
}

function totalsLine(totals) {
  return [
    `${Math.round(totals.calories)} kcal`,
    `${round1(totals.protein_g)}g protein`,
    `${round1(totals.carbs_g)}g carbs`,
    `${round1(totals.fat_g)}g fat`,
    `${round1(totals.fiber_g)}g fiber`,
    `${round1(totals.sugar_g)}g sugar`,
    `${Math.round(totals.sodium_mg)}mg sodium`,
  ].join(", ");
}

// Plain-text, LLM-friendly export — grouped by day and meal, itemized with
// full macros, plus daily and 7-day summaries so a model has both the raw
// log and enough aggregate/goal context to reason about it without needing
// a spreadsheet or PDF.
export function buildFoodLogReport({ entries, start, end, calorieGoal, proteinGoal }) {
  const dates = eachDateInRange(start, end);
  const byDate = new Map();
  for (const entry of entries) {
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(entry);
  }

  const lines = [];
  lines.push(`Food Log Export — ${formatFullDate(start)} to ${formatFullDate(end)}`);
  lines.push(`Generated ${formatFullDate(todayISO())}`);
  lines.push("");
  if (calorieGoal) lines.push(`Daily calorie goal: ${calorieGoal} kcal`);
  if (proteinGoal) lines.push(`Daily protein goal: ${proteinGoal}g`);
  if (calorieGoal || proteinGoal) lines.push("");

  const dailyTotals = [];

  for (const date of dates) {
    const dayEntries = byDate.get(date) || [];
    lines.push(`=== ${formatFullDate(date)} ===`);

    if (dayEntries.length === 0) {
      lines.push("(no food logged)");
      lines.push("");
      dailyTotals.push({ date, totals: null });
      continue;
    }

    const byMeal = new Map();
    for (const entry of dayEntries) {
      const meal = entry.meal || "snack";
      if (!byMeal.has(meal)) byMeal.set(meal, []);
      byMeal.get(meal).push(entry);
    }

    for (const meal of MEAL_ORDER) {
      const items = byMeal.get(meal);
      if (!items?.length) continue;
      lines.push(`${MEAL_LABELS[meal]}:`);
      for (const item of items) {
        const label = item.notes ? `${item.description} (${item.notes})` : item.description;
        lines.push(`  - ${label} — ${macroLine(item)}`);
      }
    }

    const totals = dayEntries.reduce(addTotals, { ...EMPTY_TOTALS });
    dailyTotals.push({ date, totals });
    lines.push(`Daily total: ${totalsLine(totals)}`);
    if (calorieGoal) {
      const diff = Math.round(totals.calories - calorieGoal);
      lines.push(`(${diff >= 0 ? "+" : ""}${diff} kcal vs. goal)`);
    }
    lines.push("");
  }

  const loggedDays = dailyTotals.filter((d) => d.totals);
  lines.push("--- 7-Day Summary ---");
  lines.push(`Days with food logged: ${loggedDays.length} of ${dates.length}`);
  if (loggedDays.length > 0) {
    const avg = (key) => loggedDays.reduce((sum, d) => sum + d.totals[key], 0) / loggedDays.length;
    lines.push(`Average daily calories: ${Math.round(avg("calories"))} kcal${calorieGoal ? ` (goal: ${calorieGoal})` : ""}`);
    lines.push(`Average daily protein: ${round1(avg("protein_g"))}g${proteinGoal ? ` (goal: ${proteinGoal}g)` : ""}`);
    lines.push(`Average daily carbs: ${round1(avg("carbs_g"))}g`);
    lines.push(`Average daily fat: ${round1(avg("fat_g"))}g`);
    lines.push(`Average daily fiber: ${round1(avg("fiber_g"))}g`);
    lines.push(`Average daily sugar: ${round1(avg("sugar_g"))}g`);
    lines.push(`Average daily sodium: ${Math.round(avg("sodium_mg"))}mg`);
  }

  return lines.join("\n");
}
