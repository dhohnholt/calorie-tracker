import { Router } from "express";
import { db } from "../db.js";
import { requireProfileId } from "../profileScope.js";

const router = Router();

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

function deserialize(row) {
  if (!row) return row;
  return { ...row, items: JSON.parse(row.items_json) };
}

function totals(items) {
  return {
    total_protein_g: items.reduce((sum, i) => sum + (Number(i.protein_g) || 0), 0),
    total_calories: items.reduce((sum, i) => sum + (Number(i.calories) || 0), 0),
  };
}

router.get("/", (req, res) => {
  const profileId = requireProfileId(req, res);
  if (profileId === null) return;

  const rows = db.prepare("SELECT * FROM weekly_meal_plans WHERE profile_id = ?").all(profileId);
  res.json(rows.map(deserialize));
});

router.put("/:day", (req, res) => {
  const profileId = requireProfileId(req, res);
  if (profileId === null) return;

  const { day } = req.params;
  if (!DAYS.includes(day)) {
    return res.status(400).json({ error: `day must be one of ${DAYS.join(", ")}` });
  }

  const { source, items, totalProteinG, totalCalories } = req.body;
  if (!source || !Array.isArray(items)) {
    return res.status(400).json({ error: "source and items (array) are required" });
  }

  const created_at = new Date().toISOString();
  db.prepare(
    `INSERT INTO weekly_meal_plans (profile_id, day_of_week, source, items_json, total_protein_g, total_calories, created_at)
     VALUES (@profile_id, @day, @source, @items_json, @total_protein_g, @total_calories, @created_at)
     ON CONFLICT(profile_id, day_of_week) DO UPDATE SET
       source = excluded.source,
       items_json = excluded.items_json,
       total_protein_g = excluded.total_protein_g,
       total_calories = excluded.total_calories,
       created_at = excluded.created_at`
  ).run({
    profile_id: profileId,
    day,
    source,
    items_json: JSON.stringify(items),
    total_protein_g: totalProteinG || 0,
    total_calories: totalCalories || 0,
    created_at,
  });

  const row = db
    .prepare("SELECT * FROM weekly_meal_plans WHERE profile_id = ? AND day_of_week = ?")
    .get(profileId, day);
  res.status(201).json(deserialize(row));
});

router.post("/:day/item", (req, res) => {
  const profileId = requireProfileId(req, res);
  if (profileId === null) return;

  const { day } = req.params;
  if (!DAYS.includes(day)) {
    return res.status(400).json({ error: `day must be one of ${DAYS.join(", ")}` });
  }

  const { recipeId, name, amount, calories, protein_g, mealType } = req.body;
  if (!MEAL_TYPES.includes(mealType)) {
    return res.status(400).json({ error: `mealType must be one of ${MEAL_TYPES.join(", ")}` });
  }

  let newItem;
  if (recipeId != null) {
    const recipe = db.prepare("SELECT * FROM recipes WHERE id = ?").get(recipeId);
    if (!recipe) {
      return res.status(404).json({ error: "recipe not found" });
    }
    newItem = {
      name: recipe.name,
      amount: "1 serving",
      protein_g: recipe.protein_g,
      calories: recipe.calories,
      meal_type: mealType,
    };
  } else {
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    newItem = {
      name: name.trim(),
      amount: (amount || "").trim() || "1 serving",
      protein_g: Number(protein_g) || 0,
      calories: Number(calories) || 0,
      meal_type: mealType,
    };
  }

  const existing = db
    .prepare("SELECT * FROM weekly_meal_plans WHERE profile_id = ? AND day_of_week = ?")
    .get(profileId, day);
  const items = existing ? JSON.parse(existing.items_json) : [];
  items.push(newItem);

  const { total_protein_g, total_calories } = totals(items);
  const created_at = existing?.created_at || new Date().toISOString();

  db.prepare(
    `INSERT INTO weekly_meal_plans (profile_id, day_of_week, source, items_json, total_protein_g, total_calories, created_at)
     VALUES (@profile_id, @day, @source, @items_json, @total_protein_g, @total_calories, @created_at)
     ON CONFLICT(profile_id, day_of_week) DO UPDATE SET
       items_json = excluded.items_json,
       total_protein_g = excluded.total_protein_g,
       total_calories = excluded.total_calories`
  ).run({
    profile_id: profileId,
    day,
    source: existing?.source || "manual",
    items_json: JSON.stringify(items),
    total_protein_g,
    total_calories,
    created_at,
  });

  const row = db
    .prepare("SELECT * FROM weekly_meal_plans WHERE profile_id = ? AND day_of_week = ?")
    .get(profileId, day);
  res.status(201).json(deserialize(row));
});

router.delete("/:day/items/:index", (req, res) => {
  const profileId = requireProfileId(req, res);
  if (profileId === null) return;

  const { day, index } = req.params;
  if (!DAYS.includes(day)) {
    return res.status(400).json({ error: `day must be one of ${DAYS.join(", ")}` });
  }

  const existing = db
    .prepare("SELECT * FROM weekly_meal_plans WHERE profile_id = ? AND day_of_week = ?")
    .get(profileId, day);
  if (!existing) {
    return res.status(404).json({ error: "no plan for this day" });
  }

  const items = JSON.parse(existing.items_json);
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) {
    return res.status(400).json({ error: "invalid item index" });
  }
  items.splice(idx, 1);

  if (items.length === 0) {
    db.prepare("DELETE FROM weekly_meal_plans WHERE profile_id = ? AND day_of_week = ?").run(profileId, day);
    return res.status(204).end();
  }

  const { total_protein_g, total_calories } = totals(items);
  db.prepare(
    "UPDATE weekly_meal_plans SET items_json = ?, total_protein_g = ?, total_calories = ? WHERE profile_id = ? AND day_of_week = ?"
  ).run(JSON.stringify(items), total_protein_g, total_calories, profileId, day);

  const row = db
    .prepare("SELECT * FROM weekly_meal_plans WHERE profile_id = ? AND day_of_week = ?")
    .get(profileId, day);
  res.json(deserialize(row));
});

router.delete("/:day", (req, res) => {
  const profileId = requireProfileId(req, res);
  if (profileId === null) return;

  db.prepare("DELETE FROM weekly_meal_plans WHERE profile_id = ? AND day_of_week = ?").run(
    profileId,
    req.params.day
  );
  res.status(204).end();
});

export default router;
