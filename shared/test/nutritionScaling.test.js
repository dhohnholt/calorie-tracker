import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  toGrams,
  defaultQuantity,
  scaledMacros,
  gramsPerTablespoon,
  parseCountUnit,
  unitConversionFactor,
  OZ_TO_G,
} from "../nutritionScaling.js";

describe("toGrams", () => {
  test("passes grams through unchanged", () => {
    assert.equal(toGrams(150, "g"), 150);
  });
  test("converts ounces to grams", () => {
    assert.ok(Math.abs(toGrams(1, "oz") - OZ_TO_G) < 1e-9);
  });
  test("converts tablespoons to grams using the food-specific factor", () => {
    assert.equal(toGrams(2, "tbsp", 16), 32);
  });
  test("treats a missing tablespoon factor as 0g rather than throwing", () => {
    assert.equal(toGrams(2, "tbsp", undefined), 0);
  });
  test("converts a food's own count unit (e.g. eggs) using its factor", () => {
    assert.equal(toGrams(3, "egg", 50), 150);
  });
});

describe("gramsPerTablespoon", () => {
  test("derives grams/tbsp from a gram-based household serving (peanut butter)", () => {
    const grams = gramsPerTablespoon({
      householdServingFullText: "2 Tbsp",
      servingSize: 32,
      servingSizeUnit: "g",
    });
    assert.equal(grams, 16);
  });

  test("is case-insensitive and accepts the full word 'tablespoon'", () => {
    const grams = gramsPerTablespoon({
      householdServingFullText: "1 TABLESPOON",
      servingSize: 15,
      servingSizeUnit: "g",
    });
    assert.equal(grams, 15);
  });

  test("handles fractional tablespoon counts", () => {
    const grams = gramsPerTablespoon({
      householdServingFullText: "1/2 tbsp",
      servingSize: 7,
      servingSizeUnit: "g",
    });
    assert.equal(grams, 14);
  });

  test("returns null when the household serving isn't in tablespoons (e.g. cups)", () => {
    const grams = gramsPerTablespoon({
      householdServingFullText: "1/2 cup",
      servingSize: 60,
      servingSizeUnit: "g",
    });
    assert.equal(grams, null);
  });

  test("returns null when the serving size is a volume unit, not mass (would give mL, not grams)", () => {
    const grams = gramsPerTablespoon({
      householdServingFullText: "1 Tbsp",
      servingSize: 15,
      servingSizeUnit: "ml",
    });
    assert.equal(grams, null);
  });

  test("returns null when there is no household serving text at all", () => {
    assert.equal(gramsPerTablespoon({ servingSize: 100, servingSizeUnit: "g" }), null);
  });

  test("returns null for a food with no serving size data", () => {
    assert.equal(gramsPerTablespoon({}), null);
  });

  test("different foods give different, correctly distinct densities", () => {
    const honey = gramsPerTablespoon({
      householdServingFullText: "1 Tbsp",
      servingSize: 21,
      servingSizeUnit: "g",
    });
    const sugar = gramsPerTablespoon({
      householdServingFullText: "1 Tbsp",
      servingSize: 4,
      servingSizeUnit: "g",
    });
    assert.equal(honey, 21);
    assert.equal(sugar, 4);
    assert.notEqual(honey, sugar);
  });
});

describe("parseCountUnit", () => {
  test("derives a food's natural count unit (eggs)", () => {
    const unit = parseCountUnit({
      householdServingFullText: "1 EGG",
      servingSize: 50,
      servingSizeUnit: "g",
    });
    assert.deepEqual(unit, { label: "egg", gramsPerUnit: 50 });
  });

  test("lowercases the label", () => {
    const unit = parseCountUnit({
      householdServingFullText: "1 SLICE",
      servingSize: 28,
      servingSizeUnit: "g",
    });
    assert.equal(unit.label, "slice");
  });

  test("handles a count greater than 1", () => {
    const unit = parseCountUnit({
      householdServingFullText: "2 cookies",
      servingSize: 46,
      servingSizeUnit: "g",
    });
    assert.equal(unit.label, "cookies");
    assert.equal(unit.gramsPerUnit, 23);
  });

  test("returns null for a recognized measure word (tbsp) rather than double-counting it as a count unit", () => {
    assert.equal(
      parseCountUnit({ householdServingFullText: "2 Tbsp", servingSize: 32, servingSizeUnit: "g" }),
      null
    );
  });

  test("returns null for a recognized measure word (cup)", () => {
    assert.equal(
      parseCountUnit({ householdServingFullText: "1/2 cup", servingSize: 60, servingSizeUnit: "g" }),
      null
    );
  });

  test("returns null when the serving size is a volume unit, not mass", () => {
    assert.equal(
      parseCountUnit({ householdServingFullText: "1 packet", servingSize: 15, servingSizeUnit: "ml" }),
      null
    );
  });

  test("returns null when there is no household serving text", () => {
    assert.equal(parseCountUnit({ servingSize: 100, servingSizeUnit: "g" }), null);
  });

  test("different foods give different, correctly distinct per-unit weights", () => {
    const smallEgg = parseCountUnit({ householdServingFullText: "1 EGG", servingSize: 44, servingSizeUnit: "g" });
    const largeEgg = parseCountUnit({ householdServingFullText: "1 EGG", servingSize: 63, servingSizeUnit: "g" });
    assert.equal(smallEgg.gramsPerUnit, 44);
    assert.equal(largeEgg.gramsPerUnit, 63);
    assert.notEqual(smallEgg.gramsPerUnit, largeEgg.gramsPerUnit);
  });
});

describe("unitConversionFactor", () => {
  const food = {
    gramsPerTbsp: 16,
    countUnit: { label: "egg", gramsPerUnit: 50 },
  };

  test("returns undefined for g and oz (no factor needed)", () => {
    assert.equal(unitConversionFactor("g", food), undefined);
    assert.equal(unitConversionFactor("oz", food), undefined);
  });

  test("resolves the tbsp factor", () => {
    assert.equal(unitConversionFactor("tbsp", food), 16);
  });

  test("resolves a food's own count-unit factor by matching its label", () => {
    assert.equal(unitConversionFactor("egg", food), 50);
  });

  test("returns undefined for a unit that doesn't match this food's count unit", () => {
    assert.equal(unitConversionFactor("slice", food), undefined);
  });

  test("returns undefined when the food has no data at all", () => {
    assert.equal(unitConversionFactor("tbsp", {}), undefined);
    assert.equal(unitConversionFactor("egg", {}), undefined);
  });
});

describe("defaultQuantity", () => {
  test("uses the food's serving size when given in grams", () => {
    assert.equal(defaultQuantity({ servingSize: 85, servingSizeUnit: "g" }), 85);
  });
  test("falls back to 100g when serving size is a non-gram unit", () => {
    assert.equal(defaultQuantity({ servingSize: 1, servingSizeUnit: "cup" }), 100);
  });
  test("falls back to 100g when no serving size is present", () => {
    assert.equal(defaultQuantity({}), 100);
  });
});

describe("scaledMacros", () => {
  const food = {
    per100g: {
      calories: 200,
      protein_g: 20,
      carbs_g: 10,
      fat_g: 5,
      fiber_g: 2,
      sugar_g: 1,
      sodium_mg: 300,
    },
  };

  test("scales per-100g values to the requested grams", () => {
    const macros = scaledMacros(food, 150);
    assert.equal(macros.calories, 300);
    assert.equal(macros.protein_g, 30);
    assert.equal(macros.carbs_g, 15);
    assert.equal(macros.fat_g, 7.5);
    assert.equal(macros.fiber_g, 3);
    assert.equal(macros.sugar_g, 1.5);
    assert.equal(macros.sodium_mg, 450);
  });

  test("returns all zeros for 0 grams", () => {
    const macros = scaledMacros(food, 0);
    assert.equal(macros.calories, 0);
    assert.equal(macros.protein_g, 0);
  });

  test("handles a food with no per100g data", () => {
    const macros = scaledMacros({}, 100);
    assert.equal(macros.calories, 0);
    assert.equal(macros.sodium_mg, 0);
  });
});
