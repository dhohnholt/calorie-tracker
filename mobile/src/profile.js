// Which profile is "active" on this device, persisted so it survives an app
// restart. Not authentication — just remembering who was last using the app
// here, same idea as a family device remembering the last selected Netflix
// profile.
//
// AsyncStorage is async, but api.js needs to read the current profile id
// synchronously when building query strings. So we hydrate an in-memory
// cache once at app startup (see initProfile, called from app/_layout.js
// before any profile-scoped screen renders) and keep it in sync on switch.
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "calorie-tracker:profile-id";

let cachedProfileId = null;

export async function initProfile() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  cachedProfileId = raw ? Number(raw) : null;
  return cachedProfileId;
}

export function getCurrentProfileId() {
  return cachedProfileId;
}

export async function setCurrentProfileId(id) {
  cachedProfileId = id;
  await AsyncStorage.setItem(STORAGE_KEY, String(id));
}
