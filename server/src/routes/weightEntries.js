import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const { start, end } = req.query;
  let rows;
  if (start && end) {
    rows = db
      .prepare("SELECT * FROM weight_entries WHERE date BETWEEN ? AND ? ORDER BY date ASC")
      .all(start, end);
  } else {
    rows = db.prepare("SELECT * FROM weight_entries ORDER BY date ASC").all();
  }
  res.json(rows);
});

router.post("/", (req, res) => {
  const { date, weight, unit = "lbs" } = req.body;
  if (!date || weight == null) {
    return res.status(400).json({ error: "date and weight are required" });
  }

  const logged_at = new Date().toISOString();
  db.prepare(
    `INSERT INTO weight_entries (date, weight, unit, logged_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET weight = excluded.weight, unit = excluded.unit, logged_at = excluded.logged_at`
  ).run(date, weight, unit, logged_at);

  const row = db.prepare("SELECT * FROM weight_entries WHERE date = ?").get(date);
  res.status(201).json(row);
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM weight_entries WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

export default router;
