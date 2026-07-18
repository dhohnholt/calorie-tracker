import { Router } from "express";
import { db } from "../db.js";
import { validateWeightEntry } from "../../../shared/validation.js";
import { requireProfileId } from "../profileScope.js";

const router = Router();

router.get("/", (req, res) => {
  const profileId = requireProfileId(req, res);
  if (profileId === null) return;

  const { start, end } = req.query;
  let rows;
  if (start && end) {
    rows = db
      .prepare("SELECT * FROM weight_entries WHERE profile_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC")
      .all(profileId, start, end);
  } else {
    rows = db.prepare("SELECT * FROM weight_entries WHERE profile_id = ? ORDER BY date ASC").all(profileId);
  }
  res.json(rows);
});

router.post("/", (req, res) => {
  const profileId = requireProfileId(req, res);
  if (profileId === null) return;

  const errors = validateWeightEntry(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  const { date, weight, unit = "lbs" } = req.body;
  const logged_at = new Date().toISOString();
  db.prepare(
    `INSERT INTO weight_entries (profile_id, date, weight, unit, logged_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(profile_id, date) DO UPDATE SET weight = excluded.weight, unit = excluded.unit, logged_at = excluded.logged_at`
  ).run(profileId, date, weight, unit, logged_at);

  const row = db
    .prepare("SELECT * FROM weight_entries WHERE profile_id = ? AND date = ?")
    .get(profileId, date);
  res.status(201).json(row);
});

router.delete("/:id", (req, res) => {
  const profileId = requireProfileId(req, res);
  if (profileId === null) return;

  db.prepare("DELETE FROM weight_entries WHERE id = ? AND profile_id = ?").run(req.params.id, profileId);
  res.status(204).end();
});

export default router;
