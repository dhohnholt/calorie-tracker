import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cmToIn,
  inToCm,
  lbToKg,
  computeBMI,
  bmiCategory,
  proteinGoalGrams,
} from "../bodyMetrics.js";

describe("unit conversions", () => {
  test("cmToIn / inToCm round-trip", () => {
    assert.ok(Math.abs(cmToIn(inToCm(70)) - 70) < 1e-9);
  });
  test("lbToKg", () => {
    assert.ok(Math.abs(lbToKg(220.462262) - 100) < 1e-6);
  });
});

describe("computeBMI", () => {
  test("computes BMI for lbs input", () => {
    // 195 lbs, 70 in (177.8cm) -> ~27.97
    const bmi = computeBMI(195, "lbs", inToCm(70));
    assert.ok(Math.abs(bmi - 27.97) < 0.05);
  });

  test("computes BMI for kg input", () => {
    const bmi = computeBMI(88.5, "kg", 178);
    assert.ok(Math.abs(bmi - 27.94) < 0.05);
  });

  test("returns null when weight or height is missing", () => {
    assert.equal(computeBMI(0, "lbs", 178), null);
    assert.equal(computeBMI(195, "lbs", 0), null);
  });
});

describe("bmiCategory", () => {
  test("categorizes underweight", () => {
    assert.equal(bmiCategory(17).label, "Underweight");
  });
  test("categorizes normal", () => {
    assert.equal(bmiCategory(22).label, "Normal");
  });
  test("categorizes overweight", () => {
    assert.equal(bmiCategory(27).label, "Overweight");
  });
  test("categorizes obese", () => {
    assert.equal(bmiCategory(32).label, "Obese");
  });
});

describe("proteinGoalGrams", () => {
  test("computes ~1.8g/kg for a lbs goal weight", () => {
    // 195 lbs -> 88.45kg -> ~159g
    assert.equal(proteinGoalGrams(195, "lbs"), 159);
  });
  test("computes 1.8g/kg directly for a kg goal weight", () => {
    assert.equal(proteinGoalGrams(90, "kg"), 162);
  });
  test("returns null with no goal weight", () => {
    assert.equal(proteinGoalGrams(0, "lbs"), null);
  });
});
