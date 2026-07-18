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
let defaultProfileId;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
  // A fresh DB bootstraps exactly one profile ("Me") via db.js's migration.
  const { body } = await request("/api/profiles");
  defaultProfileId = body[0].id;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(tmpDir, { recursive: true, force: true });
});

async function request(path, options) {
  const resp = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await resp.json().catch(() => null);
  return { status: resp.status, body };
}

test("POST /api/food-entries rejects an invalid meal type with 400", async () => {
  const { status, body } = await request(`/api/food-entries?profile_id=${defaultProfileId}`, {
    method: "POST",
    body: JSON.stringify({
      date: "2026-07-16",
      meal: "brunch",
      description: "Toast",
      calories: 200,
    }),
  });
  assert.equal(status, 400);
  assert.match(body.error, /meal must be one of/);
});

test("POST /api/food-entries rejects a non-calendar date with 400", async () => {
  const { status, body } = await request(`/api/food-entries?profile_id=${defaultProfileId}`, {
    method: "POST",
    body: JSON.stringify({
      date: "2026-02-30",
      meal: "lunch",
      description: "Salad",
      calories: 200,
    }),
  });
  assert.equal(status, 400);
  assert.match(body.error, /date must be a valid ISO calendar date/);
});

test("POST /api/food-entries rejects a missing profile_id with 400", async () => {
  const { status, body } = await request("/api/food-entries", {
    method: "POST",
    body: JSON.stringify({ date: "2026-07-16", meal: "lunch", description: "Toast", calories: 200 }),
  });
  assert.equal(status, 400);
  assert.match(body.error, /profile_id/);
});

test("POST /api/food-entries accepts a valid entry with 201", async () => {
  const { status, body } = await request(`/api/food-entries?profile_id=${defaultProfileId}`, {
    method: "POST",
    body: JSON.stringify({
      date: "2026-07-16",
      meal: "lunch",
      description: "Chicken salad",
      calories: 450,
      protein_g: 35,
    }),
  });
  assert.equal(status, 201);
  assert.equal(body.description, "Chicken salad");
  assert.equal(body.calories, 450);
  assert.equal(body.profile_id, defaultProfileId);
});

test("PUT /api/food-entries/:id rejects an update that would make the entry invalid", async () => {
  const created = await request(`/api/food-entries?profile_id=${defaultProfileId}`, {
    method: "POST",
    body: JSON.stringify({
      date: "2026-07-16",
      meal: "dinner",
      description: "Soup",
      calories: 300,
    }),
  });
  const { status, body } = await request(`/api/food-entries/${created.body.id}?profile_id=${defaultProfileId}`, {
    method: "PUT",
    body: JSON.stringify({ calories: -10 }),
  });
  assert.equal(status, 400);
  assert.match(body.error, /calories must be a nonnegative finite number/);
});

test("POST /api/weight-entries rejects a nonpositive weight with 400", async () => {
  const { status, body } = await request(`/api/weight-entries?profile_id=${defaultProfileId}`, {
    method: "POST",
    body: JSON.stringify({ date: "2026-07-16", weight: 0, unit: "lbs" }),
  });
  assert.equal(status, 400);
  assert.match(body.error, /weight must be a positive finite number/);
});

test("POST /api/weight-entries upserts by (profile_id, date) — log then replace today's weight", async () => {
  const first = await request(`/api/weight-entries?profile_id=${defaultProfileId}`, {
    method: "POST",
    body: JSON.stringify({ date: "2026-07-17", weight: 180, unit: "lbs" }),
  });
  assert.equal(first.status, 201);

  const second = await request(`/api/weight-entries?profile_id=${defaultProfileId}`, {
    method: "POST",
    body: JSON.stringify({ date: "2026-07-17", weight: 179.4, unit: "lbs" }),
  });
  assert.equal(second.status, 201);
  assert.equal(second.body.id, first.body.id);
  assert.equal(second.body.weight, 179.4);
});

test("PUT /api/settings rejects an invalid calorie_goal with 400", async () => {
  const { status, body } = await request(`/api/settings?profile_id=${defaultProfileId}`, {
    method: "PUT",
    body: JSON.stringify({ calorie_goal: "not-a-number" }),
  });
  assert.equal(status, 400);
  assert.match(body.error, /calorie_goal must be a positive number/);
});

test("PUT /api/settings accepts valid known keys and passes through unknown keys", async () => {
  const { status, body } = await request(`/api/settings?profile_id=${defaultProfileId}`, {
    method: "PUT",
    body: JSON.stringify({ calorie_goal: "2200", ai_estimated_spend_usd: "0.12" }),
  });
  assert.equal(status, 200);
  assert.equal(body.calorie_goal, "2200");
  assert.equal(body.ai_estimated_spend_usd, "0.12");
});

// --- Multi-profile behavior ----------------------------------------------

test("GET /api/profiles lists the bootstrapped default profile", async () => {
  const { status, body } = await request("/api/profiles");
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.ok(body.some((p) => p.id === defaultProfileId));
});

test("POST /api/profiles creates a new profile and rejects a blank name", async () => {
  const blank = await request("/api/profiles", { method: "POST", body: JSON.stringify({ name: "  " }) });
  assert.equal(blank.status, 400);

  const { status, body } = await request("/api/profiles", {
    method: "POST",
    body: JSON.stringify({ name: "Second Profile" }),
  });
  assert.equal(status, 201);
  assert.equal(body.name, "Second Profile");
});

test("a new profile is seeded with default calorie_goal/weight_unit but not goal_weight", async () => {
  const created = await request("/api/profiles", {
    method: "POST",
    body: JSON.stringify({ name: "Seed Check" }),
  });
  const { body } = await request(`/api/settings?profile_id=${created.body.id}`);
  assert.equal(body.calorie_goal, "2000");
  assert.equal(body.weight_unit, "lbs");
  assert.equal(body.goal_weight, undefined);
});

test("food entries are isolated between profiles", async () => {
  const profileA = defaultProfileId;
  const profileB = (
    await request("/api/profiles", { method: "POST", body: JSON.stringify({ name: "Isolation B" }) })
  ).body.id;

  await request(`/api/food-entries?profile_id=${profileB}`, {
    method: "POST",
    body: JSON.stringify({ date: "2026-07-18", meal: "breakfast", description: "B's breakfast", calories: 300 }),
  });

  const aEntries = await request(`/api/food-entries?profile_id=${profileA}&date=2026-07-18`);
  const bEntries = await request(`/api/food-entries?profile_id=${profileB}&date=2026-07-18`);
  assert.equal(aEntries.body.length, 0);
  assert.equal(bEntries.body.length, 1);
  assert.equal(bEntries.body[0].description, "B's breakfast");
});

test("settings are per-profile for personal keys but shared for AI spend tracking", async () => {
  const profileA = defaultProfileId;
  const profileB = (
    await request("/api/profiles", { method: "POST", body: JSON.stringify({ name: "Settings B" }) })
  ).body.id;

  await request(`/api/settings?profile_id=${profileA}`, {
    method: "PUT",
    body: JSON.stringify({ calorie_goal: "1800" }),
  });
  await request(`/api/settings?profile_id=${profileB}`, {
    method: "PUT",
    body: JSON.stringify({ calorie_goal: "2500", ai_estimated_spend_usd: "5.00" }),
  });

  const aSettings = await request(`/api/settings?profile_id=${profileA}`);
  const bSettings = await request(`/api/settings?profile_id=${profileB}`);
  assert.equal(aSettings.body.calorie_goal, "1800");
  assert.equal(bSettings.body.calorie_goal, "2500");
  // AI spend is global — writing it under profile B is visible under profile A too.
  assert.equal(aSettings.body.ai_estimated_spend_usd, "5.00");
  assert.equal(bSettings.body.ai_estimated_spend_usd, "5.00");
});

test("recipes: shared library, personal collections and ratings, non-destructive removal", async () => {
  const profileA = defaultProfileId;
  const profileB = (
    await request("/api/profiles", { method: "POST", body: JSON.stringify({ name: "Recipes B" }) })
  ).body.id;

  const created = await request(`/api/recipes?profile_id=${profileA}`, {
    method: "POST",
    body: JSON.stringify({ name: "Shared Soup", calories: 400, protein_g: 30 }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.inMyCollection, true);
  const recipeId = created.body.id;

  // Profile B can see it in the library but hasn't added it yet.
  const libraryB = await request(`/api/recipes?profile_id=${profileB}`);
  const seenByB = libraryB.body.find((r) => r.id === recipeId);
  assert.ok(seenByB, "recipe B should see the recipe in the shared library");
  assert.equal(seenByB.inMyCollection, false);

  // B adds and rates it; A's rating is unaffected.
  await request(`/api/recipes/${recipeId}/add?profile_id=${profileB}`, { method: "POST" });
  await request(`/api/recipes/${recipeId}/rating?profile_id=${profileB}`, {
    method: "PUT",
    body: JSON.stringify({ rating: 4 }),
  });

  const aView = (await request(`/api/recipes?profile_id=${profileA}`)).body.find((r) => r.id === recipeId);
  const bView = (await request(`/api/recipes?profile_id=${profileB}`)).body.find((r) => r.id === recipeId);
  assert.equal(aView.rating, 0);
  assert.equal(bView.rating, 4);

  // B removing it from their collection doesn't delete it from the library or from A's collection.
  const del = await request(`/api/recipes/${recipeId}?profile_id=${profileB}`, { method: "DELETE" });
  assert.equal(del.status, 204);

  const libraryAfter = await request(`/api/recipes?profile_id=${profileB}`);
  const stillInLibrary = libraryAfter.body.find((r) => r.id === recipeId);
  assert.ok(stillInLibrary, "recipe should still exist in the library after B removes it from their collection");
  assert.equal(stillInLibrary.inMyCollection, false);

  const aStillHasIt = (await request(`/api/recipes?profile_id=${profileA}`)).body.find((r) => r.id === recipeId);
  assert.equal(aStillHasIt.inMyCollection, true);
});
