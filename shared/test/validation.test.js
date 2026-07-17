import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isValidISODate,
  isValidMealType,
  isValidWeightUnit,
  isPositiveFiniteNumber,
  isNonNegativeFiniteNumber,
  isValidHeightCm,
  validateFoodEntry,
  validateWeightEntry,
  validateSettingsUpdate,
} from "../validation.js";

describe("isValidISODate", () => {
  test("accepts a well-formed calendar date", () => {
    assert.equal(isValidISODate("2026-07-16"), true);
  });
  test("rejects a non-string", () => {
    assert.equal(isValidISODate(20260716), false);
  });
  test("rejects the wrong shape", () => {
    assert.equal(isValidISODate("07/16/2026"), false);
    assert.equal(isValidISODate("2026-7-16"), false);
  });
  test("rejects a date that overflows its month (Feb 30)", () => {
    assert.equal(isValidISODate("2026-02-30"), false);
  });
  test("rejects month 13", () => {
    assert.equal(isValidISODate("2026-13-01"), false);
  });
  test("accepts Feb 29 on a leap year", () => {
    assert.equal(isValidISODate("2028-02-29"), true);
  });
  test("rejects Feb 29 on a non-leap year", () => {
    assert.equal(isValidISODate("2026-02-29"), false);
  });
});

describe("isValidMealType / isValidWeightUnit", () => {
  test("accepts known meal types", () => {
    for (const m of ["breakfast", "lunch", "dinner", "snack"]) {
      assert.equal(isValidMealType(m), true);
    }
  });
  test("rejects an unknown meal type", () => {
    assert.equal(isValidMealType("brunch"), false);
  });
  test("accepts known weight units", () => {
    assert.equal(isValidWeightUnit("lbs"), true);
    assert.equal(isValidWeightUnit("kg"), true);
  });
  test("rejects an unknown weight unit", () => {
    assert.equal(isValidWeightUnit("stone"), false);
  });
});

describe("numeric predicates", () => {
  test("isPositiveFiniteNumber accepts positive numbers and numeric strings", () => {
    assert.equal(isPositiveFiniteNumber(5), true);
    assert.equal(isPositiveFiniteNumber("5.5"), true);
  });
  test("isPositiveFiniteNumber rejects zero, negatives, NaN, Infinity, garbage", () => {
    assert.equal(isPositiveFiniteNumber(0), false);
    assert.equal(isPositiveFiniteNumber(-3), false);
    assert.equal(isPositiveFiniteNumber(NaN), false);
    assert.equal(isPositiveFiniteNumber(Infinity), false);
    assert.equal(isPositiveFiniteNumber("abc"), false);
    assert.equal(isPositiveFiniteNumber(null), false);
    assert.equal(isPositiveFiniteNumber(undefined), false);
    assert.equal(isPositiveFiniteNumber([]), false);
    assert.equal(isPositiveFiniteNumber({}), false);
    assert.equal(isPositiveFiniteNumber(true), false);
  });

  test("isNonNegativeFiniteNumber accepts zero", () => {
    assert.equal(isNonNegativeFiniteNumber(0), true);
    assert.equal(isNonNegativeFiniteNumber("0"), true);
  });
  test("isNonNegativeFiniteNumber rejects negatives", () => {
    assert.equal(isNonNegativeFiniteNumber(-0.1), false);
  });

  test("isValidHeightCm accepts a realistic human height", () => {
    assert.equal(isValidHeightCm(178), true);
    assert.equal(isValidHeightCm("70"), true);
  });
  test("isValidHeightCm rejects out-of-range values", () => {
    assert.equal(isValidHeightCm(10), false);
    assert.equal(isValidHeightCm(400), false);
  });
});

describe("validateFoodEntry", () => {
  const base = { date: "2026-07-16", meal: "lunch", description: "Chicken salad", calories: 400 };

  test("passes with a valid minimal entry", () => {
    assert.deepEqual(validateFoodEntry(base), []);
  });

  test("flags an invalid date", () => {
    const errors = validateFoodEntry({ ...base, date: "not-a-date" });
    assert.ok(errors.some((e) => e.includes("date")));
  });

  test("flags an invalid meal type", () => {
    const errors = validateFoodEntry({ ...base, meal: "brunch" });
    assert.ok(errors.some((e) => e.includes("meal")));
  });

  test("flags a missing description", () => {
    const errors = validateFoodEntry({ ...base, description: "  " });
    assert.ok(errors.some((e) => e.includes("description")));
  });

  test("flags negative calories", () => {
    const errors = validateFoodEntry({ ...base, calories: -50 });
    assert.ok(errors.some((e) => e.includes("calories")));
  });

  test("flags a negative macro field when present", () => {
    const errors = validateFoodEntry({ ...base, protein_g: -1 });
    assert.ok(errors.some((e) => e.includes("protein_g")));
  });

  test("allows zero calories (e.g. black coffee)", () => {
    assert.deepEqual(validateFoodEntry({ ...base, calories: 0 }), []);
  });
});

describe("validateWeightEntry", () => {
  test("passes with a valid entry", () => {
    assert.deepEqual(validateWeightEntry({ date: "2026-07-16", weight: 190, unit: "lbs" }), []);
  });
  test("flags zero or negative weight", () => {
    assert.ok(validateWeightEntry({ date: "2026-07-16", weight: 0 }).length > 0);
    assert.ok(validateWeightEntry({ date: "2026-07-16", weight: -5 }).length > 0);
  });
  test("flags an invalid unit when provided", () => {
    const errors = validateWeightEntry({ date: "2026-07-16", weight: 190, unit: "stone" });
    assert.ok(errors.some((e) => e.includes("unit")));
  });
  test("unit is optional (defaults handled by the route)", () => {
    assert.deepEqual(validateWeightEntry({ date: "2026-07-16", weight: 190 }), []);
  });
});

describe("validateSettingsUpdate", () => {
  test("passes with no recognized keys present", () => {
    assert.deepEqual(validateSettingsUpdate({ ai_estimated_spend_usd: "0.08" }), []);
  });
  test("passes with valid string-typed settings values", () => {
    assert.deepEqual(
      validateSettingsUpdate({ calorie_goal: "2000", goal_weight: "195", weight_unit: "lbs", height_cm: "178" }),
      []
    );
  });
  test("flags a non-numeric calorie_goal", () => {
    const errors = validateSettingsUpdate({ calorie_goal: "not-a-number" });
    assert.ok(errors.some((e) => e.includes("calorie_goal")));
  });
  test("flags an out-of-range height_cm", () => {
    const errors = validateSettingsUpdate({ height_cm: "9999" });
    assert.ok(errors.some((e) => e.includes("height_cm")));
  });
  test("allows an empty height_cm string (clearing the field)", () => {
    assert.deepEqual(validateSettingsUpdate({ height_cm: "" }), []);
  });
});
