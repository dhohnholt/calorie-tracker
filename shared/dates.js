// Framework-independent date helpers. All "calendar date" functions operate
// on the local timezone of whatever runtime they execute in (Node on the
// server, the browser on web, Hermes on mobile) — never UTC. Using
// `Date.prototype.toISOString()` for a calendar date is the classic bug this
// file avoids: it converts to UTC first, so after ~6pm in any timezone west
// of UTC, "today" silently becomes "tomorrow".

export function toISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISODate(new Date());
}

export function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

// Like daysAgoISO, but relative to a given ISO date instead of "now" — used
// wherever the base date needs to be deterministic (tests, or math anchored
// to something other than today).
export function shiftISODate(iso, days) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function formatShortDate(iso) {
  if (typeof iso !== "string") return "";
  return parseISODate(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatWeekday(iso) {
  if (typeof iso !== "string") return "";
  return parseISODate(iso).toLocaleDateString(undefined, { weekday: "short" });
}

export function formatFullDate(iso) {
  if (typeof iso !== "string") return "";
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function inferMealFromTime(date = new Date()) {
  const hour = date.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

export function timeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function eachDateInRange(start, end) {
  const dates = [];
  const cur = parseISODate(start);
  const last = parseISODate(end);
  while (cur <= last) {
    dates.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
