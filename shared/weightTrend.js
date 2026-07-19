import { toISODate, parseISODate, todayISO, shiftISODate } from "./dates.js";

function daysBetween(a, b) {
  return (new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24);
}

// Counts consecutive calendar days (most recent backward) where each day's
// logged weight was strictly lower than the day before it. A gap in
// weigh-ins or a non-decrease breaks the streak. Not weighing in yet today
// doesn't reset an existing streak — it just means today isn't counted
// until something is logged (same rule as the food-logging streak).
export function computeWeightLossStreak(entries, today = todayISO()) {
  if (entries.length === 0) return 0;
  const byDate = new Map(entries.map((e) => [e.date, e.weight]));

  let laterDate = byDate.has(today) ? today : shiftISODate(today, -1);
  if (!byDate.has(laterDate)) return 0;

  let streak = 0;
  let laterWeight = byDate.get(laterDate);

  while (true) {
    const earlierDate = shiftISODate(laterDate, -1);
    if (!byDate.has(earlierDate)) break;
    const earlierWeight = byDate.get(earlierDate);
    if (!(laterWeight < earlierWeight)) break;
    streak++;
    laterDate = earlierDate;
    laterWeight = earlierWeight;
  }

  return streak;
}

export function computeWeightTrend(entries, goalWeight) {
  if (entries.length < 2) {
    return { status: "insufficient" };
  }

  const first = entries[0];
  const last = entries[entries.length - 1];
  const spanDays = daysBetween(first.date, last.date);

  if (spanDays < 3) {
    return { status: "insufficient" };
  }

  const weeklyRate = ((last.weight - first.weight) / spanDays) * 7;

  if (Math.abs(weeklyRate) < 0.05) {
    return { status: "flat", currentWeight: last.weight, weeklyRate };
  }

  const neededChange = goalWeight - last.weight;
  const weeksRemaining = neededChange / weeklyRate;

  if (weeksRemaining <= 0) {
    return { status: "away", currentWeight: last.weight, weeklyRate };
  }

  const projectedDate = parseISODate(last.date);
  projectedDate.setDate(projectedDate.getDate() + Math.round(weeksRemaining * 7));

  return {
    status: "projecting",
    currentWeight: last.weight,
    weeklyRate,
    weeksRemaining,
    projectedDate: toISODate(projectedDate),
  };
}
