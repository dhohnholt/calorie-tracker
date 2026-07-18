import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Point at a throwaway database before importing anything that touches db.js,
// so these tests never read or write the real calorie-tracker.db.
const tmpDir = mkdtempSync(path.join(tmpdir(), "calorie-tracker-test-"));
process.env.DB_PATH = path.join(tmpDir, "test.db");

const { default: app } = await import("../src/index.js");

let server;
let baseUrl;
let defaultToken;
let defaultProfileId;

async function request(path, options = {}, token) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const body = await resp.json().catch(() => null);
  return { status: resp.status, body };
}

async function signup(username, password, name = username) {
  const { status, body } = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, username, password }),
  });
  return { status, token: body?.token, profile: body?.profile };
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
  // First signup on a fresh DB claims the auto-seeded "Me" profile from
  // db.js's bootstrap rather than starting a second, empty one.
  const { token, profile } = await signup("testuser", "password123", "Test User");
  defaultToken = token;
  defaultProfileId = profile.id;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(tmpDir, { recursive: true, force: true });
});

// --- Auth ------------------------------------------------------------------

test("POST /api/auth/signup claimed the pre-seeded legacy profile as id 1", () => {
  assert.equal(defaultProfileId, 1);
});

test("POST /api/auth/signup rejects a duplicate username with 409", async () => {
  const { status } = await signup("testuser", "anotherpassword");
  assert.equal(status, 409);
});

test("POST /api/auth/signup rejects invalid username/password with 400", async () => {
  const badUsername = await signup("x", "password123");
  assert.equal(badUsername.status, 400);
  const shortPassword = await signup("newuser1", "short");
  assert.equal(shortPassword.status, 400);
});

test("POST /api/auth/login accepts correct credentials and returns a usable token", async () => {
  const { status, body } = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "testuser", password: "password123" }),
  });
  assert.equal(status, 200);
  assert.ok(body.token);
  const me = await request("/api/auth/me", {}, body.token);
  assert.equal(me.status, 200);
  assert.equal(me.body.username, "testuser");
});

test("POST /api/auth/login rejects a wrong password or unknown username with the same 401 message", async () => {
  const wrongPassword = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "testuser", password: "wrongpassword" }),
  });
  const unknownUser = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "nosuchuser", password: "whatever1" }),
  });
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownUser.status, 401);
  assert.equal(wrongPassword.body.error, unknownUser.body.error);
});

test("protected routes reject requests with no token or a garbage token", async () => {
  const noToken = await request("/api/food-entries");
  assert.equal(noToken.status, 401);
  const garbageToken = await request("/api/food-entries", {}, "not-a-real-token");
  assert.equal(garbageToken.status, 401);
});

test("POST /api/auth/logout invalidates the token", async () => {
  const { token } = await signup("logouttest", "password123");
  const before = await request("/api/food-entries", {}, token);
  assert.equal(before.status, 200);

  const logout = await request("/api/auth/logout", { method: "POST" }, token);
  assert.equal(logout.status, 204);

  const after = await request("/api/food-entries", {}, token);
  assert.equal(after.status, 401);
});

// --- Food entries ------------------------------------------------------------

test("POST /api/food-entries rejects an invalid meal type with 400", async () => {
  const { status, body } = await request(
    "/api/food-entries",
    {
      method: "POST",
      body: JSON.stringify({ date: "2026-07-16", meal: "brunch", description: "Toast", calories: 200 }),
    },
    defaultToken
  );
  assert.equal(status, 400);
  assert.match(body.error, /meal must be one of/);
});

test("POST /api/food-entries rejects a non-calendar date with 400", async () => {
  const { status, body } = await request(
    "/api/food-entries",
    {
      method: "POST",
      body: JSON.stringify({ date: "2026-02-30", meal: "lunch", description: "Salad", calories: 200 }),
    },
    defaultToken
  );
  assert.equal(status, 400);
  assert.match(body.error, /date must be a valid ISO calendar date/);
});

test("POST /api/food-entries accepts a valid entry with 201", async () => {
  const { status, body } = await request(
    "/api/food-entries",
    {
      method: "POST",
      body: JSON.stringify({
        date: "2026-07-16",
        meal: "lunch",
        description: "Chicken salad",
        calories: 450,
        protein_g: 35,
      }),
    },
    defaultToken
  );
  assert.equal(status, 201);
  assert.equal(body.description, "Chicken salad");
  assert.equal(body.calories, 450);
  assert.equal(body.profile_id, defaultProfileId);
});

test("PUT /api/food-entries/:id rejects an update that would make the entry invalid", async () => {
  const created = await request(
    "/api/food-entries",
    {
      method: "POST",
      body: JSON.stringify({ date: "2026-07-16", meal: "dinner", description: "Soup", calories: 300 }),
    },
    defaultToken
  );
  const { status, body } = await request(
    `/api/food-entries/${created.body.id}`,
    { method: "PUT", body: JSON.stringify({ calories: -10 }) },
    defaultToken
  );
  assert.equal(status, 400);
  assert.match(body.error, /calories must be a nonnegative finite number/);
});

// --- Weight entries ----------------------------------------------------------

test("POST /api/weight-entries rejects a nonpositive weight with 400", async () => {
  const { status, body } = await request(
    "/api/weight-entries",
    { method: "POST", body: JSON.stringify({ date: "2026-07-16", weight: 0, unit: "lbs" }) },
    defaultToken
  );
  assert.equal(status, 400);
  assert.match(body.error, /weight must be a positive finite number/);
});

test("POST /api/weight-entries upserts by (profile_id, date) — log then replace today's weight", async () => {
  const first = await request(
    "/api/weight-entries",
    { method: "POST", body: JSON.stringify({ date: "2026-07-17", weight: 180, unit: "lbs" }) },
    defaultToken
  );
  assert.equal(first.status, 201);

  const second = await request(
    "/api/weight-entries",
    { method: "POST", body: JSON.stringify({ date: "2026-07-17", weight: 179.4, unit: "lbs" }) },
    defaultToken
  );
  assert.equal(second.status, 201);
  assert.equal(second.body.id, first.body.id);
  assert.equal(second.body.weight, 179.4);
});

// --- Settings ------------------------------------------------------------

test("PUT /api/settings rejects an invalid calorie_goal with 400", async () => {
  const { status, body } = await request(
    "/api/settings",
    { method: "PUT", body: JSON.stringify({ calorie_goal: "not-a-number" }) },
    defaultToken
  );
  assert.equal(status, 400);
  assert.match(body.error, /calorie_goal must be a positive number/);
});

test("PUT /api/settings accepts valid known keys and passes through unknown keys", async () => {
  const { status, body } = await request(
    "/api/settings",
    { method: "PUT", body: JSON.stringify({ calorie_goal: "2200", ai_estimated_spend_usd: "0.12" }) },
    defaultToken
  );
  assert.equal(status, 200);
  assert.equal(body.calorie_goal, "2200");
  assert.equal(body.ai_estimated_spend_usd, "0.12");
});

test("a newly signed-up account is seeded with default calorie_goal/weight_unit but not goal_weight", async () => {
  const { token } = await signup("seedcheck", "password123");
  const { body } = await request("/api/settings", {}, token);
  assert.equal(body.calorie_goal, "2000");
  assert.equal(body.weight_unit, "lbs");
  assert.equal(body.goal_weight, undefined);
});

// --- Cross-account isolation -----------------------------------------------

test("food entries are isolated between accounts", async () => {
  const { token: tokenB } = await signup("isolationb", "password123", "Isolation B");

  await request(
    "/api/food-entries",
    {
      method: "POST",
      body: JSON.stringify({ date: "2026-07-18", meal: "breakfast", description: "B's breakfast", calories: 300 }),
    },
    tokenB
  );

  const aEntries = await request("/api/food-entries?date=2026-07-18", {}, defaultToken);
  const bEntries = await request("/api/food-entries?date=2026-07-18", {}, tokenB);
  assert.equal(aEntries.body.length, 0);
  assert.equal(bEntries.body.length, 1);
  assert.equal(bEntries.body[0].description, "B's breakfast");
});

test("settings are per-account for personal keys but shared for AI spend tracking", async () => {
  const { token: tokenB } = await signup("settingsb", "password123", "Settings B");

  await request("/api/settings", { method: "PUT", body: JSON.stringify({ calorie_goal: "1800" }) }, defaultToken);
  await request(
    "/api/settings",
    { method: "PUT", body: JSON.stringify({ calorie_goal: "2500", ai_estimated_spend_usd: "5.00" }) },
    tokenB
  );

  const aSettings = await request("/api/settings", {}, defaultToken);
  const bSettings = await request("/api/settings", {}, tokenB);
  assert.equal(aSettings.body.calorie_goal, "1800");
  assert.equal(bSettings.body.calorie_goal, "2500");
  // AI spend is global — writing it under account B is visible under account A too.
  assert.equal(aSettings.body.ai_estimated_spend_usd, "5.00");
  assert.equal(bSettings.body.ai_estimated_spend_usd, "5.00");
});

test("recipes: shared library, personal collections and ratings, non-destructive removal", async () => {
  const { token: tokenB } = await signup("recipesb", "password123", "Recipes B");

  const created = await request(
    "/api/recipes",
    { method: "POST", body: JSON.stringify({ name: "Shared Soup", calories: 400, protein_g: 30 }) },
    defaultToken
  );
  assert.equal(created.status, 201);
  assert.equal(created.body.inMyCollection, true);
  const recipeId = created.body.id;

  // Account B can see it in the library but hasn't added it yet.
  const libraryB = await request("/api/recipes", {}, tokenB);
  const seenByB = libraryB.body.find((r) => r.id === recipeId);
  assert.ok(seenByB, "recipe B should see the recipe in the shared library");
  assert.equal(seenByB.inMyCollection, false);

  // B adds and rates it; A's rating is unaffected.
  await request(`/api/recipes/${recipeId}/add`, { method: "POST" }, tokenB);
  await request(`/api/recipes/${recipeId}/rating`, { method: "PUT", body: JSON.stringify({ rating: 4 }) }, tokenB);

  const aView = (await request("/api/recipes", {}, defaultToken)).body.find((r) => r.id === recipeId);
  const bView = (await request("/api/recipes", {}, tokenB)).body.find((r) => r.id === recipeId);
  assert.equal(aView.rating, 0);
  assert.equal(bView.rating, 4);

  // B removing it from their collection doesn't delete it from the library or from A's collection.
  const del = await request(`/api/recipes/${recipeId}`, { method: "DELETE" }, tokenB);
  assert.equal(del.status, 204);

  const libraryAfter = await request("/api/recipes", {}, tokenB);
  const stillInLibrary = libraryAfter.body.find((r) => r.id === recipeId);
  assert.ok(stillInLibrary, "recipe should still exist in the library after B removes it from their collection");
  assert.equal(stillInLibrary.inMyCollection, false);

  const aStillHasIt = (await request("/api/recipes", {}, defaultToken)).body.find((r) => r.id === recipeId);
  assert.equal(aStillHasIt.inMyCollection, true);
});
