// The logged-in account's session token, persisted so it survives a reload.
const STORAGE_KEY = "calorie-tracker:auth-token";

export function getToken() {
  return localStorage.getItem(STORAGE_KEY);
}

export function setToken(token) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
}
