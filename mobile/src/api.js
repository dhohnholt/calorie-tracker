// EXPO_PUBLIC_ vars are inlined at build time by Expo. Never put USDA/Anthropic
// keys behind this prefix (or anywhere in mobile/) — they must stay server-side.
// See mobile/.env.example for how to point this at your LAN address.
import { getCurrentProfileId } from "./profile";

const BASE = `${process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001/api"}`;

// Merges the active profile into a params object for building a query
// string. Every profile-scoped endpoint needs this — the server checks both
// query params and the request body, so appending it here works for
// GET/DELETE and POST/PUT alike.
function withProfile(params = {}) {
  return { ...params, profile_id: getCurrentProfileId() };
}

async function request(path, options) {
  let resp;
  try {
    resp = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error(
      `Could not reach the server at ${BASE}. Check EXPO_PUBLIC_API_URL and that the server is running.`
    );
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${resp.status}`);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

export const api = {
  getProfiles: () => request("/profiles"),
  createProfile: (name) => request("/profiles", { method: "POST", body: JSON.stringify({ name }) }),

  getSettings: () => request(`/settings?${new URLSearchParams(withProfile())}`),
  updateSettings: (settings) =>
    request(`/settings?${new URLSearchParams(withProfile())}`, {
      method: "PUT",
      body: JSON.stringify(settings),
    }),

  getFoodEntries: (params) => request(`/food-entries?${new URLSearchParams(withProfile(params))}`),
  createFoodEntry: (entry) =>
    request(`/food-entries?${new URLSearchParams(withProfile())}`, {
      method: "POST",
      body: JSON.stringify(entry),
    }),
  deleteFoodEntry: (id) =>
    request(`/food-entries/${id}?${new URLSearchParams(withProfile())}`, { method: "DELETE" }),

  getWeightEntries: (params) => request(`/weight-entries?${new URLSearchParams(withProfile(params))}`),
  createWeightEntry: (entry) =>
    request(`/weight-entries?${new URLSearchParams(withProfile())}`, {
      method: "POST",
      body: JSON.stringify(entry),
    }),

  getDailySummary: (start, end) =>
    request(`/summary/daily?${new URLSearchParams(withProfile({ start, end }))}`),

  searchNutrition: (q) => request(`/nutrition/search?q=${encodeURIComponent(q)}`),
};

export { BASE as API_BASE_URL };
