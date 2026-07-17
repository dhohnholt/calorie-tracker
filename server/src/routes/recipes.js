import { Router } from "express";
import { db } from "../db.js";

const router = Router();

function deserialize(row) {
  return { ...row, ingredients: JSON.parse(row.ingredients_json || "[]") };
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM recipes ORDER BY rating DESC, created_at DESC").all();
  res.json(rows.map(deserialize));
});

router.post("/", (req, res) => {
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
  const result = db
    .prepare(
      `INSERT INTO recipes
        (name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, notes, video_url, ingredients_json, instructions, created_at)
       VALUES (@name, @calories, @protein_g, @carbs_g, @fat_g, @fiber_g, @sugar_g, @sodium_mg, @notes, @video_url, @ingredients_json, @instructions, @created_at)`
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
    });

  const row = db.prepare("SELECT * FROM recipes WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(deserialize(row));
});

router.put("/:id/rating", (req, res) => {
  const { rating } = req.body;
  if (rating == null || rating < 0 || rating > 5) {
    return res.status(400).json({ error: "rating must be between 0 and 5" });
  }
  db.prepare("UPDATE recipes SET rating = ? WHERE id = ?").run(rating, req.params.id);
  const row = db.prepare("SELECT * FROM recipes WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "recipe not found" });
  res.json(deserialize(row));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM recipes WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

export default router;
