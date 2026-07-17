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

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
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
  const { status, body } = await request("/api/food-entries", {
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
  const { status, body } = await request("/api/food-entries", {
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

test("POST /api/food-entries accepts a valid entry with 201", async () => {
  const { status, body } = await request("/api/food-entries", {
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
});

test("PUT /api/food-entries/:id rejects an update that would make the entry invalid", async () => {
  const created = await request("/api/food-entries", {
    method: "POST",
    body: JSON.stringify({
      date: "2026-07-16",
      meal: "dinner",
      description: "Soup",
      calories: 300,
    }),
  });
  const { status, body } = await request(`/api/food-entries/${created.body.id}`, {
    method: "PUT",
    body: JSON.stringify({ calories: -10 }),
  });
  assert.equal(status, 400);
  assert.match(body.error, /calories must be a nonnegative finite number/);
});

test("POST /api/weight-entries rejects a nonpositive weight with 400", async () => {
  const { status, body } = await request("/api/weight-entries", {
    method: "POST",
    body: JSON.stringify({ date: "2026-07-16", weight: 0, unit: "lbs" }),
  });
  assert.equal(status, 400);
  assert.match(body.error, /weight must be a positive finite number/);
});

test("POST /api/weight-entries upserts by date (log then replace today's weight)", async () => {
  const first = await request("/api/weight-entries", {
    method: "POST",
    body: JSON.stringify({ date: "2026-07-16", weight: 180, unit: "lbs" }),
  });
  assert.equal(first.status, 201);

  const second = await request("/api/weight-entries", {
    method: "POST",
    body: JSON.stringify({ date: "2026-07-16", weight: 179.4, unit: "lbs" }),
  });
  assert.equal(second.status, 201);
  assert.equal(second.body.id, first.body.id);
  assert.equal(second.body.weight, 179.4);
});

test("PUT /api/settings rejects an invalid calorie_goal with 400", async () => {
  const { status, body } = await request("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ calorie_goal: "not-a-number" }),
  });
  assert.equal(status, 400);
  assert.match(body.error, /calorie_goal must be a positive number/);
});

test("PUT /api/settings accepts valid known keys and passes through unknown keys", async () => {
  const { status, body } = await request("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ calorie_goal: "2200", ai_estimated_spend_usd: "0.12" }),
  });
  assert.equal(status, 200);
  assert.equal(body.calorie_goal, "2200");
  assert.equal(body.ai_estimated_spend_usd, "0.12");
});
