export const OZ_TO_G = 28.3495;

export function toGrams(amount, unit) {
  return unit === "oz" ? amount * OZ_TO_G : amount;
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
