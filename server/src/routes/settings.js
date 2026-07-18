import { Router } from "express";
import { db, PER_PROFILE_SETTINGS_KEYS } from "../db.js";
import { validateSettingsUpdate } from "../../../shared/validation.js";

const router = Router();

function mergedSettings(profileId) {
  const rows = db
    .prepare("SELECT key, value FROM settings WHERE profile_id = ? OR profile_id = 0")
    .all(profileId);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

router.get("/", (req, res) => {
  const profileId = req.profileId;

  res.json(mergedSettings(profileId));
});

router.put("/", (req, res) => {
  const profileId = req.profileId;

  const errors = validateSettingsUpdate(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  const upsert = db.prepare(
    `INSERT INTO settings (profile_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT(profile_id, key) DO UPDATE SET value = excluded.value`
  );
  const tx = db.transaction((entries) => {
    for (const [key, value] of entries) {
      if (key === "profile_id") continue;
      const targetProfileId = PER_PROFILE_SETTINGS_KEYS.has(key) ? profileId : 0;
      upsert.run(targetProfileId, key, String(value));
    }
  });
  tx(Object.entries(req.body));

  res.json(mergedSettings(profileId));
});

export default router;
