import { Router } from "express";
import { db, seedDefaultProfileSettings } from "../db.js";
import { validateProfile } from "../../../shared/validation.js";

const router = Router();

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM profiles ORDER BY id ASC").all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const errors = validateProfile(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  const name = req.body.name.trim();
  const created_at = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO profiles (name, created_at) VALUES (?, ?)")
    .run(name, created_at);

  seedDefaultProfileSettings(result.lastInsertRowid);

  const row = db.prepare("SELECT * FROM profiles WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(row);
});

export default router;
