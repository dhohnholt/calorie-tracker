import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeStreak, computeWeeklyComparison } from "../dailyStats.js";

describe("computeStreak", () => {
  test("is 0 with no logged days", () => {
    assert.equal(computeStreak([], "2026-07-18"), 0);
  });

  test("counts consecutive days ending today when today is logged", () => {
    const summary = [
      { date: "2026-07-16", calories: 1800 },
      { date: "2026-07-17", calories: 1900 },
      { date: "2026-07-18", calories: 2000 },
    ];
    assert.equal(computeStreak(summary, "2026-07-18"), 3);
  });

  test("doesn't break the streak just because today isn't logged yet", () => {
    const summary = [
      { date: "2026-07-16", calories: 1800 },
      { date: "2026-07-17", calories: 1900 },
    ];
    assert.equal(computeStreak(summary, "2026-07-18"), 2);
  });

  test("stops at the first gap", () => {
    const summary = [
      { date: "2026-07-14", calories: 1800 },
      // gap on 07-15
      { date: "2026-07-16", calories: 1900 },
      { date: "2026-07-17", calories: 2000 },
      { date: "2026-07-18", calories: 2100 },
    ];
    assert.equal(computeStreak(summary, "2026-07-18"), 3);
  });

  test("is 0 when neither today nor yesterday was logged", () => {
    const summary = [{ date: "2026-07-10", calories: 1800 }];
    assert.equal(computeStreak(summary, "2026-07-18"), 0);
  });
});

describe("computeWeeklyComparison", () => {
  test("returns null averages when there's no data in a window", () => {
    const result = computeWeeklyComparison([], "2026-07-18");
    assert.equal(result.avgCaloriesThisWeek, null);
    assert.equal(result.avgCaloriesLastWeek, null);
    assert.equal(result.thisWeekDays, 0);
    assert.equal(result.lastWeekDays, 0);
  });

  test("splits into this-week (last 7 days) and last-week (7 days before that)", () => {
    const summary = [
      // last week: 07-05 .. 07-11
      { date: "2026-07-05", calories: 2000, protein_g: 100 },
      { date: "2026-07-11", calories: 2200, protein_g: 120 },
      // this week: 07-12 .. 07-18
      { date: "2026-07-12", calories: 1800, protein_g: 140 },
      { date: "2026-07-18", calories: 1600, protein_g: 160 },
    ];
    const result = computeWeeklyComparison(summary, "2026-07-18");
    assert.equal(result.thisWeekDays, 2);
    assert.equal(result.lastWeekDays, 2);
    assert.equal(result.avgCaloriesThisWeek, 1700);
    assert.equal(result.avgCaloriesLastWeek, 2100);
    assert.equal(result.avgProteinThisWeek, 150);
    assert.equal(result.avgProteinLastWeek, 110);
  });

  test("excludes days outside either window", () => {
    const summary = [
      { date: "2026-06-01", calories: 9999, protein_g: 999 }, // way before last week
      { date: "2026-07-18", calories: 1600, protein_g: 160 },
    ];
    const result = computeWeeklyComparison(summary, "2026-07-18");
    assert.equal(result.lastWeekDays, 0);
    assert.equal(result.thisWeekDays, 1);
    assert.equal(result.avgCaloriesThisWeek, 1600);
  });
});
