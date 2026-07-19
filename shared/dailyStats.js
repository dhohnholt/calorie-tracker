import { todayISO, shiftISODate } from "./dates.js";

// dailySummary rows only exist for dates with at least one logged entry
// (the server groups by date), so a date's presence in the set is enough
// to know that day was logged — no need to check calories > 0.
export function computeStreak(dailySummary, today = todayISO()) {
  const loggedDates = new Set(dailySummary.map((d) => d.date));
  // Today not being logged yet doesn't break an existing streak — the day
  // just isn't counted until something is logged.
  let cursor = loggedDates.has(today) ? today : shiftISODate(today, -1);

  let streak = 0;
  while (loggedDates.has(cursor)) {
    streak++;
    cursor = shiftISODate(cursor, -1);
  }
  return streak;
}

// Compares the trailing 7-day window (today back 6 days) against the 7
// days before that, for both calories and protein. Averages are null when
// there's no data in that window, so callers can show "not enough data"
// instead of a misleading 0.
export function computeWeeklyComparison(dailySummary, today = todayISO()) {
  const thisWeekStart = shiftISODate(today, -6);
  const lastWeekStart = shiftISODate(today, -13);
  const lastWeekEnd = shiftISODate(today, -7);

  const thisWeek = dailySummary.filter((d) => d.date >= thisWeekStart && d.date <= today);
  const lastWeek = dailySummary.filter((d) => d.date >= lastWeekStart && d.date <= lastWeekEnd);

  const avg = (rows, key) =>
    rows.length ? rows.reduce((sum, r) => sum + (r[key] || 0), 0) / rows.length : null;

  return {
    thisWeekDays: thisWeek.length,
    lastWeekDays: lastWeek.length,
    avgCaloriesThisWeek: avg(thisWeek, "calories"),
    avgCaloriesLastWeek: avg(lastWeek, "calories"),
    avgProteinThisWeek: avg(thisWeek, "protein_g"),
    avgProteinLastWeek: avg(lastWeek, "protein_g"),
  };
}
