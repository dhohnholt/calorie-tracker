import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// recipes is a single shared library; profile_recipes tracks which profile
// has added which recipe to their personal collection, plus that profile's
// own rating (two profiles can reasonably disagree about a shared recipe).
function deserialize(row) {
  const { my_rating, my_added_at, ...rest } = row;
  return {
    ...rest,
    ingredients: JSON.parse(row.ingredients_json || "[]"),
    inMyCollection: my_added_at != null,
    rating: my_rating || 0,
  };
}

router.get("/", (req, res) => {
  const profileId = req.profileId;

  const rows = db
    .prepare(
      `SELECT r.*, pr.rating AS my_rating, pr.added_at AS my_added_at
       FROM recipes r
       LEFT JOIN profile_recipes pr ON pr.recipe_id = r.id AND pr.profile_id = ?
       ORDER BY (pr.recipe_id IS NOT NULL) DESC, COALESCE(pr.rating, 0) DESC, r.created_at DESC`
    )
    .all(profileId);
  res.json(rows.map(deserialize));
});

router.post("/", (req, res) => {
  const profileId = req.profileId;

  const {
    name,
    calories,
    protein_g = 0,
    carbs_g = 0,
    fat_g = 0,
    fiber_g = 0,
    sugar_g = 0,
    sodium_mg = 0,
    notes = "",
    video_url = null,
    ingredients = [],
    instructions = "",
  } = req.body;

  if (!name || calories == null) {
    return res.status(400).json({ error: "name and calories are required" });
  }

  const created_at = new Date().toISOString();
  const ingredients_json = JSON.stringify(ingredients);

  const addToCollection = db.prepare(
    "INSERT INTO profile_recipes (profile_id, recipe_id, rating, added_at) VALUES (?, ?, 0, ?)"
  );
  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO recipes
          (name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, notes, video_url, ingredients_json, instructions, created_at, created_by_profile_id)
         VALUES (@name, @calories, @protein_g, @carbs_g, @fat_g, @fiber_g, @sugar_g, @sodium_mg, @notes, @video_url, @ingredients_json, @instructions, @created_at, @profile_id)`
      )
      .run({
        name,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        fiber_g,
        sugar_g,
        sodium_mg,
        notes,
        video_url,
        ingredients_json,
        instructions,
        created_at,
        profile_id: profileId,
      });
    // Whoever writes out a whole recipe obviously wants it in their own
    // list too, not just contributed to the library for others to find.
    addToCollection.run(profileId, result.lastInsertRowid, created_at);
    return result.lastInsertRowid;
  });

  const newId = tx();
  const row = db
    .prepare(
      `SELECT r.*, pr.rating AS my_rating, pr.added_at AS my_added_at
       FROM recipes r
       LEFT JOIN profile_recipes pr ON pr.recipe_id = r.id AND pr.profile_id = ?
       WHERE r.id = ?`
    )
    .get(profileId, newId);
  res.status(201).json(deserialize(row));
});

// Adds an existing library recipe to this profile's personal collection
// without changing the shared recipe itself.
router.post("/:id/add", (req, res) => {
  const profileId = req.profileId;

  const recipe = db.prepare("SELECT id FROM recipes WHERE id = ?").get(req.params.id);
  if (!recipe) return res.status(404).json({ error: "recipe not found" });

  db.prepare(
    `INSERT INTO profile_recipes (profile_id, recipe_id, rating, added_at) VALUES (?, ?, 0, ?)
     ON CONFLICT(profile_id, recipe_id) DO NOTHING`
  ).run(profileId, req.params.id, new Date().toISOString());

  const row = db
    .prepare(
      `SELECT r.*, pr.rating AS my_rating, pr.added_at AS my_added_at
       FROM recipes r
       LEFT JOIN profile_recipes pr ON pr.recipe_id = r.id AND pr.profile_id = ?
       WHERE r.id = ?`
    )
    .get(profileId, req.params.id);
  res.status(201).json(deserialize(row));
});

router.put("/:id/rating", (req, res) => {
  const profileId = req.profileId;

  const { rating } = req.body;
  if (rating == null || rating < 0 || rating > 5) {
    return res.status(400).json({ error: "rating must be between 0 and 5" });
  }

  const recipe = db.prepare("SELECT id FROM recipes WHERE id = ?").get(req.params.id);
  if (!recipe) return res.status(404).json({ error: "recipe not found" });

  // Rating something implies you have an opinion on it — add it to the
  // profile's collection first if it isn't there yet, rather than requiring
  // a separate "add" step before rating works.
  db.prepare(
    `INSERT INTO profile_recipes (profile_id, recipe_id, rating, added_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(profile_id, recipe_id) DO UPDATE SET rating = excluded.rating`
  ).run(profileId, req.params.id, rating, new Date().toISOString());

  const row = db
    .prepare(
      `SELECT r.*, pr.rating AS my_rating, pr.added_at AS my_added_at
       FROM recipes r
       LEFT JOIN profile_recipes pr ON pr.recipe_id = r.id AND pr.profile_id = ?
       WHERE r.id = ?`
    )
    .get(profileId, req.params.id);
  res.json(deserialize(row));
});

// Removes the recipe from this profile's personal collection only — the
// shared library entry (and any other profile's collection) is untouched.
router.delete("/:id", (req, res) => {
  const profileId = req.profileId;

  db.prepare("DELETE FROM profile_recipes WHERE profile_id = ? AND recipe_id = ?").run(
    profileId,
    req.params.id
  );
  res.status(204).end();
});

export default router;
