// EXPO_PUBLIC_ vars are inlined at build time by Expo. Never put USDA/Anthropic
// keys behind this prefix (or anywhere in mobile/) — they must stay server-side.
// See mobile/.env.example for how to point this at your LAN address.
import { getToken, clearToken } from "./auth";

const BASE = `${process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001/api"}`;

let onUnauthorized = null;
// authContext.js registers a callback so a 401 anywhere can drop the app
// back to the login screen without every caller special-casing it.
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(path, options) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options?.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let resp;
  try {
    resp = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error(
      `Could not reach the server at ${BASE}. Check EXPO_PUBLIC_API_URL and that the server is running.`
    );
  }

  // A 401 from /auth/login is just "wrong username or password" — let it
  // fall through to the generic error branch below so the real message
  // reaches the login form. Every other 401 means the session itself is
  // invalid/expired.
  if (resp.status === 401 && path !== "/auth/login") {
    await clearToken();
    onUnauthorized?.();
    throw new Error("Session expired, please log in again");
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${resp.status}`);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

export const api = {
  signup: (name, username, password) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify({ name, username, password }) }),
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  getMe: () => request("/auth/me"),

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

  getDailySummary: (start, end) => request(`/summary/daily?start=${start}&end=${end}`),

  searchNutrition: (q) => request(`/nutrition/search?q=${encodeURIComponent(q)}`),
};

export { BASE as API_BASE_URL };
