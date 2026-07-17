export const OZ_TO_G = 28.3495;

// g/oz convert by a fixed factor; anything else (tbsp, or a food's own
// discrete count unit like "egg"/"slice") is food-specific and must be
// resolved by the caller via unitConversionFactor before calling this.
export function toGrams(amount, unit, factor) {
  if (unit === "g") return amount;
  if (unit === "oz") return amount * OZ_TO_G;
  return amount * (factor || 0);
}

const TBSP_RE = /^([\d.]+|\d+\/\d+)\s*(tbsp|tablespoons?)\b/i;
const COUNT_RE = /^([\d.]+|\d+\/\d+)\s+([a-zA-Z][a-zA-Z .]*)$/;
const MASS_SERVING_UNITS = new Set(["g", "grm", "gram", "grams"]);

// Words that describe a volume/weight measure rather than a genuinely
// discrete, countable thing — these are either handled elsewhere (tbsp) or
// not something we convert, so they're excluded from becoming a "count"
// unit (which is meant for things like "egg", "slice", "packet", "cookie").
const MEASURE_WORDS = new Set([
  "cup", "cups", "tbsp", "tbsps", "tablespoon", "tablespoons",
  "tsp", "tsps", "teaspoon", "teaspoons",
  "oz", "ozs", "onz", "ounce", "ounces",
  "ml", "milliliter", "milliliters", "l", "liter", "liters",
  "pint", "pints", "quart", "quarts", "gallon", "gallons",
  "g", "gr", "grm", "gram", "grams", "lb", "lbs", "pound", "pounds",
]);

function parseServingAmount(str) {
  if (str.includes("/")) {
    const [a, b] = str.split("/").map(Number);
    return b ? a / b : null;
  }
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

function isMassServing(food) {
  return (
    food.servingSize != null &&
    food.servingSizeUnit != null &&
    MASS_SERVING_UNITS.has(String(food.servingSizeUnit).toLowerCase())
  );
}

// Derives grams-per-tablespoon for a specific USDA food from its own
// household-serving text (e.g. "2 Tbsp") paired with its gram serving size
// (e.g. 32g) — only when that serving size is actually given in grams, not
// volume (mL), since a mL-based serving can't tell us the food's mass.
// Returns null when the food has no usable tablespoon-sized serving data.
export function gramsPerTablespoon(food) {
  const text = food.householdServingFullText;
  if (!text || !isMassServing(food)) return null;

  const match = TBSP_RE.exec(String(text).trim());
  if (!match) return null;

  const tbspCount = parseServingAmount(match[1]);
  if (!tbspCount || tbspCount <= 0) return null;

  return food.servingSize / tbspCount;
}

// Derives a food's own natural counting unit (e.g. "1 EGG" -> {label:
// "egg", gramsPerUnit: 50}) from its household-serving text, for foods
// people naturally count rather than weigh — eggs, slices, cookies,
// packets. Excludes anything that's actually a volume/weight measure word
// (already handled by tbsp, or not something we convert) and anything not
// backed by a gram-based serving size, same rules as gramsPerTablespoon.
export function parseCountUnit(food) {
  const text = food.householdServingFullText;
  if (!text || !isMassServing(food)) return null;

  const match = COUNT_RE.exec(String(text).trim());
  if (!match) return null;

  const count = parseServingAmount(match[1]);
  if (!count || count <= 0) return null;

  const label = match[2].trim().toLowerCase();
  if (!label || MEASURE_WORDS.has(label)) return null;

  return { label, gramsPerUnit: food.servingSize / count };
}

// Resolves the food-specific conversion factor for whatever unit is
// currently selected, so callers don't need to know the difference between
// "tbsp" and a food's own count unit (e.g. "egg") — both are just a label
// paired with a gramsPerUnit on the food object. Returns undefined for g/oz
// (no factor needed) or when the unit doesn't match anything on this food.
export function unitConversionFactor(unit, food) {
  if (!food || unit === "g" || unit === "oz") return undefined;
  if (unit === "tbsp") return food.gramsPerTbsp ?? undefined;
  if (food.countUnit && unit === food.countUnit.label) return food.countUnit.gramsPerUnit;
  return undefined;
}

export function defaultQuantity(food) {
  if (food.servingSize && /^g|gram/i.test(food.servingSizeUnit || "")) {
    return Math.round(food.servingSize);
  }
  return 100;
}

// Scales a USDA per-100g nutrition profile to the given gram quantity.
export function scaledMacros(food, grams) {
  const factor = grams / 100;
  const per100g = food.per100g || {};
  return {
    calories: Math.round((per100g.calories || 0) * factor),
    protein_g: Math.round((per100g.protein_g || 0) * factor * 10) / 10,
    carbs_g: Math.round((per100g.carbs_g || 0) * factor * 10) / 10,
    fat_g: Math.round((per100g.fat_g || 0) * factor * 10) / 10,
    fiber_g: Math.round((per100g.fiber_g || 0) * factor * 10) / 10,
    sugar_g: Math.round((per100g.sugar_g || 0) * factor * 10) / 10,
    sodium_mg: Math.round((per100g.sodium_mg || 0) * factor),
  };
}
