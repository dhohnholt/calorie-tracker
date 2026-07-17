export const CM_PER_IN = 2.54;
export const LB_PER_KG = 2.20462262;

export function cmToIn(cm) {
  return cm / CM_PER_IN;
}

export function inToCm(inches) {
  return inches * CM_PER_IN;
}

export function lbToKg(lb) {
  return lb / LB_PER_KG;
}

export function computeBMI(weight, weightUnit, heightCm) {
  if (!weight || !heightCm) return null;
  const weightKg = weightUnit === "kg" ? weight : lbToKg(weight);
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: "Underweight", level: "warning" };
  if (bmi < 25) return { label: "Normal", level: "good" };
  if (bmi < 30) return { label: "Overweight", level: "warning" };
  return { label: "Obese", level: "critical" };
}

// 1.8g protein per kg of goal bodyweight (~0.8g/lb) — a commonly used mid-range
// target for preserving lean mass during a cut. Based on goal weight rather than
// current weight so the target reflects the body composition being worked toward.
export function proteinGoalGrams(goalWeight, weightUnit) {
  if (!goalWeight) return null;
  const goalWeightKg = weightUnit === "kg" ? goalWeight : lbToKg(goalWeight);
  return Math.round(goalWeightKg * 1.8);
}
