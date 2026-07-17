import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toGrams, defaultQuantity, scaledMacros, OZ_TO_G } from "../nutritionScaling.js";

describe("toGrams", () => {
  test("passes grams through unchanged", () => {
    assert.equal(toGrams(150, "g"), 150);
  });
  test("converts ounces to grams", () => {
    assert.ok(Math.abs(toGrams(1, "oz") - OZ_TO_G) < 1e-9);
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
