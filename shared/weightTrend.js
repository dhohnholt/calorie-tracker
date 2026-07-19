import { toISODate, parseISODate } from "./dates.js";

function daysBetween(a, b) {
  return (new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24);
}

// Counts consecutive logged weigh-ins (most recent backward, in the order
// they were logged — not calendar days) where each is strictly lower than
// the one before it. A gap between weigh-in dates doesn't matter, only
// whether the sequence of entries you actually logged keeps decreasing; a
// tie or increase breaks the streak. Expects entries sorted ascending by
// date (what the API already returns).
export function computeWeightLossStreak(entries) {
  let streak = 0;
  for (let i = entries.length - 1; i > 0; i--) {
    if (entries[i].weight < entries[i - 1].weight) {
      streak++;
    } else {
      break;
    }
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
