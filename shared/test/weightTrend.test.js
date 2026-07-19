import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeWeightTrend, computeWeightLossStreak } from "../weightTrend.js";

describe("computeWeightTrend", () => {
  test("reports insufficient data with fewer than 2 entries", () => {
    assert.equal(computeWeightTrend([], 195).status, "insufficient");
    assert.equal(computeWeightTrend([{ date: "2026-07-01", weight: 200 }], 195).status, "insufficient");
  });

  test("reports insufficient data when the span is under 3 days", () => {
    const entries = [
      { date: "2026-07-01", weight: 201 },
      { date: "2026-07-02", weight: 200.5 },
    ];
    assert.equal(computeWeightTrend(entries, 195).status, "insufficient");
  });

  test("reports flat when the weekly rate is near zero", () => {
    // (200.05 - 200) / 9 days * 7 = 0.039 kg/week, under the 0.05 flat threshold.
    const entries = [
      { date: "2026-07-01", weight: 200 },
      { date: "2026-07-10", weight: 200.05 },
    ];
    assert.equal(computeWeightTrend(entries, 195).status, "flat");
  });

  test("reports away when trending in the wrong direction", () => {
    // Gaining weight (190 -> 194) while the goal (185) requires losing.
    const entries = [
      { date: "2026-07-01", weight: 190 },
      { date: "2026-07-11", weight: 194 },
    ];
    const trend = computeWeightTrend(entries, 185);
    assert.equal(trend.status, "away");
  });

  test("reports projecting with a future date when trending toward the goal", () => {
    const entries = [
      { date: "2026-07-01", weight: 210 },
      { date: "2026-07-11", weight: 208 },
    ];
    const trend = computeWeightTrend(entries, 195);
    assert.equal(trend.status, "projecting");
    assert.ok(trend.projectedDate > "2026-07-11");
    assert.ok(trend.weeklyRate < 0);
  });
});

describe("computeWeightLossStreak", () => {
  test("is 0 with no entries or a single entry", () => {
    assert.equal(computeWeightLossStreak([]), 0);
    assert.equal(computeWeightLossStreak([{ date: "2026-07-10", weight: 200 }]), 0);
  });

  test("counts consecutive decreasing weigh-ins, needing one extra baseline entry", () => {
    // 237 (baseline), 235 (<237, entry 1), 233 (<235, entry 2), 231 (<233, entry 3)
    // -> a 3-entry streak.
    const entries = [
      { date: "2026-07-15", weight: 237 },
      { date: "2026-07-16", weight: 235 },
      { date: "2026-07-17", weight: 233 },
      { date: "2026-07-18", weight: 231 },
    ];
    assert.equal(computeWeightLossStreak(entries), 3);
  });

  test("ignores gaps between weigh-in dates — only the logged sequence matters", () => {
    const entries = [
      { date: "2026-07-14", weight: 240 },
      // gap on 07-15, 07-18 (not logged) — doesn't break anything
      { date: "2026-07-16", weight: 235 },
      { date: "2026-07-17", weight: 233 },
      { date: "2026-07-19", weight: 231 },
    ];
    assert.equal(computeWeightLossStreak(entries), 3);
  });

  test("stops at a tie or increase", () => {
    const entries = [
      { date: "2026-07-16", weight: 233 },
      { date: "2026-07-17", weight: 233 }, // tie, not a decrease
      { date: "2026-07-18", weight: 231 },
    ];
    assert.equal(computeWeightLossStreak(entries), 1);
  });
});
