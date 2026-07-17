export const OZ_TO_G = 28.3495;

// Unlike ounces, a tablespoon is a volume — grams-per-tablespoon depends on
// the food's density (16g for peanut butter, 4g for granulated sugar, 21g
// for honey), so there's no universal conversion factor. Callers must pass
// the food-specific gramsPerTbsp (see gramsPerTablespoon below); if it's not
// available for a food, "tbsp" should not be offered as a unit at all.
export function toGrams(amount, unit, gramsPerTbsp) {
  if (unit === "oz") return amount * OZ_TO_G;
  if (unit === "tbsp") return amount * (gramsPerTbsp || 0);
  return amount;
}

const TBSP_RE = /^([\d.]+|\d+\/\d+)\s*(tbsp|tablespoons?)\b/i;
const MASS_SERVING_UNITS = new Set(["g", "grm", "gram", "grams"]);

function parseServingAmount(str) {
  if (str.includes("/")) {
    const [a, b] = str.split("/").map(Number);
    return b ? a / b : null;
  }
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

// Derives grams-per-tablespoon for a specific USDA food from its own
// household-serving text (e.g. "2 Tbsp") paired with its gram serving size
// (e.g. 32g) — only when that serving size is actually given in grams, not
// volume (mL), since a mL-based serving can't tell us the food's mass.
// Returns null when the food has no usable tablespoon-sized serving data.
export function gramsPerTablespoon(food) {
  const text = food.householdServingFullText;
  if (!text || food.servingSize == null || !food.servingSizeUnit) return null;
  if (!MASS_SERVING_UNITS.has(String(food.servingSizeUnit).toLowerCase())) return null;

  const match = TBSP_RE.exec(String(text).trim());
  if (!match) return null;

  const tbspCount = parseServingAmount(match[1]);
  if (!tbspCount || tbspCount <= 0) return null;

  return food.servingSize / tbspCount;
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
