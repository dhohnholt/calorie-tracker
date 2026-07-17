import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM favorite_foods ORDER BY created_at ASC").all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const { name, category } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }

  const trimmed = name.trim();
  const finalCategory = category?.trim() || "Uncategorized";
  const created_at = new Date().toISOString();
  db.prepare(
    `INSERT INTO favorite_foods (name, category, created_at) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET category = excluded.category`
  ).run(trimmed, finalCategory, created_at);

  const row = db.prepare("SELECT * FROM favorite_foods WHERE name = ? COLLATE NOCASE").get(trimmed);
  res.status(201).json(row);
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM favorite_foods WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

export default router;
