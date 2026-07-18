import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const profileId = req.profileId;

  const rows = db
    .prepare("SELECT * FROM favorite_foods WHERE profile_id = ? ORDER BY created_at ASC")
    .all(profileId);
  res.json(rows);
});

router.post("/", (req, res) => {
  const profileId = req.profileId;

  const { name, category } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }

  const trimmed = name.trim();
  const finalCategory = category?.trim() || "Uncategorized";
  const created_at = new Date().toISOString();
  db.prepare(
    `INSERT INTO favorite_foods (profile_id, name, category, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(profile_id, name) DO UPDATE SET category = excluded.category`
  ).run(profileId, trimmed, finalCategory, created_at);

  const row = db
    .prepare("SELECT * FROM favorite_foods WHERE profile_id = ? AND name = ? COLLATE NOCASE")
    .get(profileId, trimmed);
  res.status(201).json(row);
});

router.delete("/:id", (req, res) => {
  const profileId = req.profileId;

  db.prepare("DELETE FROM favorite_foods WHERE id = ? AND profile_id = ?").run(req.params.id, profileId);
  res.status(204).end();
});

export default router;
