export function sugarStatus(sugarG, calories) {
  const pctOfCalories = calories > 0 ? ((sugarG * 4) / calories) * 100 : 0;
  let level = "good";
  if (pctOfCalories >= 20) level = "critical";
  else if (pctOfCalories >= 10) level = "warning";
  return { level, label: `${Math.round(sugarG)}g sugar (${Math.round(pctOfCalories)}% of kcal)` };
}

export function sodiumStatus(sodiumMg) {
  let level = "good";
  if (sodiumMg >= 2300) level = "critical";
  else if (sodiumMg >= 1500) level = "warning";
  return { level, label: `${Math.round(sodiumMg)}mg sodium` };
}

export function fiberStatus(fiberG) {
  let level = "good";
  if (fiberG < 15) level = "critical";
  else if (fiberG < 25) level = "warning";
  return { level, label: `${Math.round(fiberG)}g fiber` };
}

export function proteinGoalStatus(proteinG, goalG) {
  const pct = goalG > 0 ? (proteinG / goalG) * 100 : 0;
  let level = "critical";
  if (pct >= 100) level = "good";
  else if (pct >= 60) level = "warning";
  return { level, label: `${Math.round(proteinG)}g / ${goalG}g protein goal` };
}
