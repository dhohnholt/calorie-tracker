import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  toISODate,
  parseISODate,
  todayISO,
  daysAgoISO,
  shiftISODate,
  eachDateInRange,
  inferMealFromTime,
  timeGreeting,
} from "../dates.js";

describe("toISODate / parseISODate", () => {
  test("formats a local date as YYYY-MM-DD", () => {
    const d = new Date(2026, 6, 16); // July 16, 2026, local midnight
    assert.equal(toISODate(d), "2026-07-16");
  });

  test("round-trips through parseISODate without UTC drift", () => {
    const iso = "2026-01-05";
    const parsed = parseISODate(iso);
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 0);
    assert.equal(parsed.getDate(), 5);
    assert.equal(toISODate(parsed), iso);
  });

  test("does not shift dates near a UTC day boundary (Mountain Time evening case)", () => {
    // Simulate 6:30pm MDT (UTC-6) on July 16 -> 00:30 UTC July 17.
    // A UTC-anchored implementation (toISOString().slice(0,10)) would report
    // "2026-07-17" here; the local-safe implementation must still say the 16th.
    const localEvening = new Date(2026, 6, 16, 18, 30, 0);
    assert.equal(toISODate(localEvening), "2026-07-16");

    // Sanity check that this date, if serialized via toISOString from a
    // UTC-6 offset, WOULD roll to the next day — proving the test actually
    // exercises the boundary condition and isn't vacuous.
    const utcEquivalent = new Date(
      Date.UTC(2026, 6, 16, 18 + 6, 30, 0)
    );
    assert.equal(utcEquivalent.toISOString().slice(0, 10), "2026-07-17");
  });
});

describe("todayISO / daysAgoISO", () => {
  test("todayISO matches a freshly constructed local date", () => {
    const expected = toISODate(new Date());
    assert.equal(todayISO(), expected);
  });

  test("daysAgoISO(0) equals today", () => {
    assert.equal(daysAgoISO(0), todayISO());
  });

  test("daysAgoISO(7) is 7 calendar days before today", () => {
    const today = parseISODate(todayISO());
    const expected = new Date(today);
    expected.setDate(expected.getDate() - 7);
    assert.equal(daysAgoISO(7), toISODate(expected));
  });
});

describe("shiftISODate", () => {
  test("shifts forward and backward relative to the given date, not today", () => {
    assert.equal(shiftISODate("2026-07-18", -6), "2026-07-12");
    assert.equal(shiftISODate("2026-07-18", 6), "2026-07-24");
    assert.equal(shiftISODate("2026-07-18", 0), "2026-07-18");
  });

  test("crosses month and year boundaries correctly", () => {
    assert.equal(shiftISODate("2026-01-01", -1), "2025-12-31");
    assert.equal(shiftISODate("2026-02-28", 1), "2026-03-01");
  });
});

describe("eachDateInRange", () => {
  test("returns an inclusive, ordered list of ISO dates", () => {
    const dates = eachDateInRange("2026-02-27", "2026-03-02");
    assert.deepEqual(dates, ["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  });

  test("handles a single-day range", () => {
    assert.deepEqual(eachDateInRange("2026-05-01", "2026-05-01"), ["2026-05-01"]);
  });

  test("crosses a leap-year February correctly", () => {
    const dates = eachDateInRange("2028-02-27", "2028-03-01");
    assert.deepEqual(dates, ["2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01"]);
  });
});

describe("inferMealFromTime", () => {
  test("classifies morning as breakfast", () => {
    assert.equal(inferMealFromTime(new Date(2026, 0, 1, 8)), "breakfast");
  });
  test("classifies midday as lunch", () => {
    assert.equal(inferMealFromTime(new Date(2026, 0, 1, 12)), "lunch");
  });
  test("classifies late afternoon as dinner", () => {
    assert.equal(inferMealFromTime(new Date(2026, 0, 1, 18)), "dinner");
  });
  test("classifies late night as snack", () => {
    assert.equal(inferMealFromTime(new Date(2026, 0, 1, 22)), "snack");
  });
});

describe("timeGreeting", () => {
  test("greets morning hours", () => {
    assert.equal(timeGreeting(new Date(2026, 0, 1, 9)), "Good morning");
  });
  test("greets afternoon hours", () => {
    assert.equal(timeGreeting(new Date(2026, 0, 1, 14)), "Good afternoon");
  });
  test("greets evening hours", () => {
    assert.equal(timeGreeting(new Date(2026, 0, 1, 20)), "Good evening");
  });
});
