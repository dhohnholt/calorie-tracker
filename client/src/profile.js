// Which profile is "active" on this browser/device, persisted so it
// survives a reload. Not authentication — just remembering who was last
// using the app here, same idea as a family device remembering the last
// selected Netflix profile.
const STORAGE_KEY = "calorie-tracker:profile-id";

export function getCurrentProfileId() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? Number(raw) : null;
}

export function setCurrentProfileId(id) {
  localStorage.setItem(STORAGE_KEY, String(id));
}
