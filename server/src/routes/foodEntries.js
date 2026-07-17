import { Router } from "express";
import { db } from "../db.js";

const router = Router();

const MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);

router.get("/", (req, res) => {
  const { date, start, end } = req.query;

  let rows;
  if (date) {
    rows = db
      .prepare("SELECT * FROM food_entries WHERE date = ? ORDER BY logged_at ASC")
      .all(date);
  } else if (start && end) {
    rows = db
      .prepare(
        "SELECT * FROM food_entries WHERE date BETWEEN ? AND ? ORDER BY date ASC, logged_at ASC"
      )
      .all(start, end);
  } else {
    rows = db
      .prepare("SELECT * FROM food_entries ORDER BY date DESC, logged_at DESC LIMIT 200")
      .all();
  }

  res.json(rows.map(deserialize));
});

router.post("/", (req, res) => {
  const {
    date,
    meal,
    description,
    calories,
    protein_g = 0,
    carbs_g = 0,
    fat_g = 0,
    fiber_g = 0,
    sugar_g = 0,
    sodium_mg = 0,
    items = [],
  } = req.body;

  if (!date || !meal || !description || calories == null) {
    return res
      .status(400)
      .json({ error: "date, meal, description, and calories are required" });
  }
  if (!MEALS.has(meal)) {
    return res.status(400).json({ error: `meal must be one of ${[...MEALS].join(", ")}` });
  }

  const logged_at = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO food_entries
        (date, meal, description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, items_json, logged_at)
       VALUES (@date, @meal, @description, @calories, @protein_g, @carbs_g, @fat_g, @fiber_g, @sugar_g, @sodium_mg, @items_json, @logged_at)`
    )
    .run({
      date,
      meal,
      description,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
      sugar_g,
      sodium_mg,
      items_json: JSON.stringify(items),
      logged_at,
    });

  const row = db.prepare("SELECT * FROM food_entries WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(deserialize(row));
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM food_entries WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });

  const merged = { ...existing, ...req.body };
  if (req.body.items) merged.items_json = JSON.stringify(req.body.items);

  db.prepare(
    `UPDATE food_entries SET
      date = @date, meal = @meal, description = @description, calories = @calories,
      protein_g = @protein_g, carbs_g = @carbs_g, fat_g = @fat_g,
      fiber_g = @fiber_g, sugar_g = @sugar_g, sodium_mg = @sodium_mg,
      items_json = @items_json
     WHERE id = @id`
  ).run(merged);

  const row = db.prepare("SELECT * FROM food_entries WHERE id = ?").get(req.params.id);
  res.json(deserialize(row));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM food_entries WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

function deserialize(row) {
  if (!row) return row;
  return { ...row, items: row.items_json ? JSON.parse(row.items_json) : [] };
}

export default router;
