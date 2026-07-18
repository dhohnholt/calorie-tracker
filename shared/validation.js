export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
export const WEIGHT_UNITS = ["lbs", "kg"];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validates both the shape (YYYY-MM-DD) and that it's a real calendar date —
// the local Date constructor silently normalizes overflow (e.g. Feb 30 rolls
// to Mar 2), so we round-trip and compare components to catch that.
export function isValidISODate(value) {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function isValidMealType(value) {
  return MEAL_TYPES.includes(value);
}

export function isValidWeightUnit(value) {
  return WEIGHT_UNITS.includes(value);
}

// Settings are stored (and often submitted, via HTML number inputs) as
// strings, while food/weight entries submit real JS numbers. Accept both;
// reject everything else (booleans, arrays, objects, empty strings).
function toFiniteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function isPositiveFiniteNumber(value) {
  const n = toFiniteNumber(value);
  return n !== null && n > 0;
}

export function isNonNegativeFiniteNumber(value) {
  const n = toFiniteNumber(value);
  return n !== null && n >= 0;
}

export function isValidHeightCm(value) {
  const n = toFiniteNumber(value);
  return n !== null && n >= 50 && n <= 300;
}

// Profile ids are positive integers, but arrive over HTTP as strings (query
// params, form fields) as often as real numbers — accept both.
export function isValidProfileId(value) {
  const n = toFiniteNumber(value);
  return n !== null && Number.isInteger(n) && n > 0;
}

const MAX_PROFILE_NAME_LENGTH = 60;

export function validateProfile(body) {
  const errors = [];
  if (typeof body.name !== "string" || !body.name.trim()) {
    errors.push("name is required");
  } else if (body.name.trim().length > MAX_PROFILE_NAME_LENGTH) {
    errors.push(`name must be ${MAX_PROFILE_NAME_LENGTH} characters or fewer`);
  }
  return errors;
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;
const MIN_PASSWORD_LENGTH = 8;

export function isValidUsername(value) {
  return typeof value === "string" && USERNAME_RE.test(value);
}

// Used for account creation: needs a display name (profiles.name), a login
// handle (username), and a password. Kept separate from validateProfile
// since that's still used for the legacy-profile "name" field alone.
export function validateSignup(body) {
  const errors = [];
  if (typeof body.name !== "string" || !body.name.trim()) {
    errors.push("name is required");
  } else if (body.name.trim().length > MAX_PROFILE_NAME_LENGTH) {
    errors.push(`name must be ${MAX_PROFILE_NAME_LENGTH} characters or fewer`);
  }
  if (!isValidUsername(body.username)) {
    errors.push(
      "username must be 3-30 characters and contain only letters, numbers, underscores, periods, or hyphens"
    );
  }
  if (typeof body.password !== "string" || body.password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return errors;
}

export function validateLogin(body) {
  const errors = [];
  if (typeof body.username !== "string" || !body.username.trim()) {
    errors.push("username is required");
  }
  if (typeof body.password !== "string" || !body.password) {
    errors.push("password is required");
  }
  return errors;
}

const NUTRITION_FIELDS = ["protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg"];

// Returns an array of human-readable error strings; empty array means valid.
export function validateFoodEntry(body) {
  const errors = [];
  if (!isValidISODate(body.date)) {
    errors.push("date must be a valid ISO calendar date (YYYY-MM-DD)");
  }
  if (!isValidMealType(body.meal)) {
    errors.push(`meal must be one of ${MEAL_TYPES.join(", ")}`);
  }
  if (typeof body.description !== "string" || !body.description.trim()) {
    errors.push("description is required");
  }
  if (!isNonNegativeFiniteNumber(body.calories)) {
    errors.push("calories must be a nonnegative finite number");
  }
  for (const field of NUTRITION_FIELDS) {
    if (body[field] != null && !isNonNegativeFiniteNumber(body[field])) {
      errors.push(`${field} must be a nonnegative finite number`);
    }
  }
  return errors;
}

export function validateWeightEntry(body) {
  const errors = [];
  if (!isValidISODate(body.date)) {
    errors.push("date must be a valid ISO calendar date (YYYY-MM-DD)");
  }
  if (!isPositiveFiniteNumber(body.weight)) {
    errors.push("weight must be a positive finite number");
  }
  if (body.unit != null && !isValidWeightUnit(body.unit)) {
    errors.push(`unit must be one of ${WEIGHT_UNITS.join(", ")}`);
  }
  return errors;
}

// Settings is a generic key-value store (also used for internal counters
// like AI spend tracking), so this only validates the known user-editable
// keys when present — anything else passes through untouched.
export function validateSettingsUpdate(body) {
  const errors = [];
  if (body.calorie_goal != null && body.calorie_goal !== "" && !isPositiveFiniteNumber(body.calorie_goal)) {
    errors.push("calorie_goal must be a positive number");
  }
  if (body.goal_weight != null && body.goal_weight !== "" && !isPositiveFiniteNumber(body.goal_weight)) {
    errors.push("goal_weight must be a positive number");
  }
  if (body.weight_unit != null && body.weight_unit !== "" && !isValidWeightUnit(body.weight_unit)) {
    errors.push(`weight_unit must be one of ${WEIGHT_UNITS.join(", ")}`);
  }
  if (body.height_cm != null && body.height_cm !== "" && !isValidHeightCm(body.height_cm)) {
    errors.push("height_cm must be between 50 and 300");
  }
  return errors;
}
