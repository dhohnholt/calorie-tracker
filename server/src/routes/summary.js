import { Router } from "express";
import { db } from "../db.js";
import { requireProfileId } from "../profileScope.js";

const router = Router();

router.get("/daily", (req, res) => {
  const profileId = requireProfileId(req, res);
  if (profileId === null) return;

  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: "start and end query params are required" });
  }

  const rows = db
    .prepare(
      `SELECT
        date,
        SUM(calories) AS calories,
        SUM(protein_g) AS protein_g,
        SUM(carbs_g) AS carbs_g,
        SUM(fat_g) AS fat_g,
        SUM(fiber_g) AS fiber_g,
        SUM(sugar_g) AS sugar_g,
        SUM(sodium_mg) AS sodium_mg,
        COUNT(*) AS entry_count
       FROM food_entries
       WHERE profile_id = ? AND date BETWEEN ? AND ?
       GROUP BY date
       ORDER BY date ASC`
    )
    .all(profileId, start, end);

  res.json(rows);
});

export default router;
