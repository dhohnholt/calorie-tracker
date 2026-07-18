import { Router } from "express";
import { db } from "../db.js";
import { validateFoodEntry } from "../../../shared/validation.js";

const router = Router();

router.get("/", (req, res) => {
  const profileId = req.profileId;

  const { date, start, end } = req.query;

  let rows;
  if (date) {
    rows = db
      .prepare("SELECT * FROM food_entries WHERE profile_id = ? AND date = ? ORDER BY logged_at ASC")
      .all(profileId, date);
  } else if (start && end) {
    rows = db
      .prepare(
        "SELECT * FROM food_entries WHERE profile_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC, logged_at ASC"
      )
      .all(profileId, start, end);
  } else {
    rows = db
      .prepare("SELECT * FROM food_entries WHERE profile_id = ? ORDER BY date DESC, logged_at DESC LIMIT 200")
      .all(profileId);
  }

  res.json(rows.map(deserialize));
});

router.post("/", (req, res) => {
  const profileId = req.profileId;

  const errors = validateFoodEntry(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  const {
    date,
    meal,
    description,
    notes = null,
    calories,
    protein_g = 0,
    carbs_g = 0,
    fat_g = 0,
    fiber_g = 0,
    sugar_g = 0,
    sodium_mg = 0,
    items = [],
  } = req.body;

  const logged_at = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO food_entries
        (profile_id, date, meal, description, notes, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, items_json, logged_at)
       VALUES (@profile_id, @date, @meal, @description, @notes, @calories, @protein_g, @carbs_g, @fat_g, @fiber_g, @sugar_g, @sodium_mg, @items_json, @logged_at)`
    )
    .run({
      profile_id: profileId,
      date,
      meal,
      description,
      notes,
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
  const profileId = req.profileId;

  const existing = db
    .prepare("SELECT * FROM food_entries WHERE id = ? AND profile_id = ?")
    .get(req.params.id, profileId);
  if (!existing) return res.status(404).json({ error: "not found" });

  const merged = { ...existing, ...req.body };
  if (req.body.items) merged.items_json = JSON.stringify(req.body.items);

  const errors = validateFoodEntry(merged);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  db.prepare(
    `UPDATE food_entries SET
      date = @date, meal = @meal, description = @description, notes = @notes, calories = @calories,
      protein_g = @protein_g, carbs_g = @carbs_g, fat_g = @fat_g,
      fiber_g = @fiber_g, sugar_g = @sugar_g, sodium_mg = @sodium_mg,
      items_json = @items_json
     WHERE id = @id AND profile_id = @profile_id`
  ).run({ ...merged, profile_id: profileId });

  const row = db.prepare("SELECT * FROM food_entries WHERE id = ?").get(req.params.id);
  res.json(deserialize(row));
});

router.delete("/:id", (req, res) => {
  const profileId = req.profileId;

  db.prepare("DELETE FROM food_entries WHERE id = ? AND profile_id = ?").run(req.params.id, profileId);
  res.status(204).end();
});

function deserialize(row) {
  if (!row) return row;
  return { ...row, items: row.items_json ? JSON.parse(row.items_json) : [] };
}

export default router;
