import { getCurrentProfileId } from "./profile.js";

const BASE = "/api";

async function request(path, options) {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${resp.status}`);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

// Merges the active profile into a params object for building a query
// string. Every profile-scoped endpoint (all of them except /profiles
// itself and stateless ones like nutrition search) needs this — the server
// checks both query params and the request body, so appending it here works
// for GET/DELETE and POST/PUT alike.
function withProfile(params = {}) {
  return { ...params, profile_id: getCurrentProfileId() };
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
  updateFoodEntry: (id, entry) =>
    request(`/food-entries/${id}?${new URLSearchParams(withProfile())}`, {
      method: "PUT",
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
  deleteWeightEntry: (id) =>
    request(`/weight-entries/${id}?${new URLSearchParams(withProfile())}`, { method: "DELETE" }),

  getDailySummary: (start, end) =>
    request(`/summary/daily?${new URLSearchParams(withProfile({ start, end }))}`),

  searchNutrition: (q) => request(`/nutrition/search?q=${encodeURIComponent(q)}`),

  generateAIPlan: (favoriteFoods, targetProteinG, planScope, recipes, guidance) =>
    request("/meal-plan/ai", {
      method: "POST",
      body: JSON.stringify({ favoriteFoods, targetProteinG, planScope, recipes, guidance }),
    }),

  getRecipes: () => request(`/recipes?${new URLSearchParams(withProfile())}`),
  createRecipe: (recipe) =>
    request(`/recipes?${new URLSearchParams(withProfile())}`, {
      method: "POST",
      body: JSON.stringify(recipe),
    }),
  addRecipeToCollection: (id) =>
    request(`/recipes/${id}/add?${new URLSearchParams(withProfile())}`, { method: "POST" }),
  removeRecipeFromCollection: (id) =>
    request(`/recipes/${id}?${new URLSearchParams(withProfile())}`, { method: "DELETE" }),
  rateRecipe: (id, rating) =>
    request(`/recipes/${id}/rating?${new URLSearchParams(withProfile())}`, {
      method: "PUT",
      body: JSON.stringify({ rating }),
    }),

  getFavoriteFoods: () => request(`/favorite-foods?${new URLSearchParams(withProfile())}`),
  createFavoriteFood: (name, category) =>
    request(`/favorite-foods?${new URLSearchParams(withProfile())}`, {
      method: "POST",
      body: JSON.stringify({ name, category }),
    }),
  deleteFavoriteFood: (id) =>
    request(`/favorite-foods/${id}?${new URLSearchParams(withProfile())}`, { method: "DELETE" }),

  getWeeklyPlan: () => request(`/weekly-plan?${new URLSearchParams(withProfile())}`),
  saveWeeklyPlanDay: (day, plan) =>
    request(`/weekly-plan/${day}?${new URLSearchParams(withProfile())}`, {
      method: "PUT",
      body: JSON.stringify(plan),
    }),
  deleteWeeklyPlanDay: (day) =>
    request(`/weekly-plan/${day}?${new URLSearchParams(withProfile())}`, { method: "DELETE" }),
  addItemToDay: (day, payload) =>
    request(`/weekly-plan/${day}/item?${new URLSearchParams(withProfile())}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  removeWeeklyPlanItem: (day, index) =>
    request(`/weekly-plan/${day}/items/${index}?${new URLSearchParams(withProfile())}`, {
      method: "DELETE",
    }),
};
