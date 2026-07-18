// The logged-in account's session token, persisted so it survives an app
// restart. AsyncStorage is async, but api.js needs to read the token
// synchronously when building request headers, so we hydrate an in-memory
// cache once at app startup (see initAuth, called from authContext.js
// before any screen renders) and keep it in sync on login/logout.
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "calorie-tracker:auth-token";

let cachedToken = null;

export async function initAuth() {
  cachedToken = await AsyncStorage.getItem(STORAGE_KEY);
  return cachedToken;
}

export function getToken() {
  return cachedToken;
}

export async function setToken(token) {
  cachedToken = token;
  await AsyncStorage.setItem(STORAGE_KEY, token);
}

export async function clearToken() {
  cachedToken = null;
  await AsyncStorage.removeItem(STORAGE_KEY);
}
