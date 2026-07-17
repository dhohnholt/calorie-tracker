// EXPO_PUBLIC_ vars are inlined at build time by Expo. Never put USDA/Anthropic
// keys behind this prefix (or anywhere in mobile/) — they must stay server-side.
// See mobile/.env.example for how to point this at your LAN address.
const BASE = `${process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001/api"}`;

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
  getSettings: () => request("/settings"),
  updateSettings: (settings) =>
    request("/settings", { method: "PUT", body: JSON.stringify(settings) }),

  getFoodEntries: (params) => request(`/food-entries?${new URLSearchParams(params)}`),
  createFoodEntry: (entry) =>
    request("/food-entries", { method: "POST", body: JSON.stringify(entry) }),
  deleteFoodEntry: (id) => request(`/food-entries/${id}`, { method: "DELETE" }),

  getWeightEntries: (params) => request(`/weight-entries?${new URLSearchParams(params)}`),
  createWeightEntry: (entry) =>
    request("/weight-entries", { method: "POST", body: JSON.stringify(entry) }),

  getDailySummary: (start, end) => request(`/summary/daily?start=${start}&end=${end}`),

  searchNutrition: (q) => request(`/nutrition/search?q=${encodeURIComponent(q)}`),
};

export { BASE as API_BASE_URL };
