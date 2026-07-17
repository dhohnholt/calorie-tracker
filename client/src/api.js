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

export const api = {
  getSettings: () => request("/settings"),
  updateSettings: (settings) =>
    request("/settings", { method: "PUT", body: JSON.stringify(settings) }),

  getFoodEntries: (params) => request(`/food-entries?${new URLSearchParams(params)}`),
  createFoodEntry: (entry) =>
    request("/food-entries", { method: "POST", body: JSON.stringify(entry) }),
  updateFoodEntry: (id, entry) =>
    request(`/food-entries/${id}`, { method: "PUT", body: JSON.stringify(entry) }),
  deleteFoodEntry: (id) => request(`/food-entries/${id}`, { method: "DELETE" }),

  getWeightEntries: (params) => request(`/weight-entries?${new URLSearchParams(params)}`),
  createWeightEntry: (entry) =>
    request("/weight-entries", { method: "POST", body: JSON.stringify(entry) }),
  deleteWeightEntry: (id) => request(`/weight-entries/${id}`, { method: "DELETE" }),

  getDailySummary: (start, end) => request(`/summary/daily?start=${start}&end=${end}`),

  searchNutrition: (q) => request(`/nutrition/search?q=${encodeURIComponent(q)}`),

  generateAIPlan: (favoriteFoods, targetProteinG, planScope, recipes, guidance) =>
    request("/meal-plan/ai", {
      method: "POST",
      body: JSON.stringify({ favoriteFoods, targetProteinG, planScope, recipes, guidance }),
    }),

  getRecipes: () => request("/recipes"),
  createRecipe: (recipe) =>
    request("/recipes", { method: "POST", body: JSON.stringify(recipe) }),
  deleteRecipe: (id) => request(`/recipes/${id}`, { method: "DELETE" }),
  rateRecipe: (id, rating) =>
    request(`/recipes/${id}/rating`, { method: "PUT", body: JSON.stringify({ rating }) }),

  getFavoriteFoods: () => request("/favorite-foods"),
  createFavoriteFood: (name, category) =>
    request("/favorite-foods", { method: "POST", body: JSON.stringify({ name, category }) }),
  deleteFavoriteFood: (id) => request(`/favorite-foods/${id}`, { method: "DELETE" }),

  getWeeklyPlan: () => request("/weekly-plan"),
  saveWeeklyPlanDay: (day, plan) =>
    request(`/weekly-plan/${day}`, { method: "PUT", body: JSON.stringify(plan) }),
  deleteWeeklyPlanDay: (day) => request(`/weekly-plan/${day}`, { method: "DELETE" }),
  addItemToDay: (day, payload) =>
    request(`/weekly-plan/${day}/item`, { method: "POST", body: JSON.stringify(payload) }),
  removeWeeklyPlanItem: (day, index) =>
    request(`/weekly-plan/${day}/items/${index}`, { method: "DELETE" }),
};
