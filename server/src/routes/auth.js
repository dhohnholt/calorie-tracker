import { Router } from "express";
import { validateSignup, validateLogin } from "../../../shared/validation.js";
import { db, seedDefaultProfileSettings } from "../db.js";
import { hashPassword, verifyPassword, createSession, deleteSession, requireAuth } from "../auth.js";

const router = Router();

function publicProfile(profile) {
  return { id: profile.id, name: profile.name, username: profile.username };
}

router.post("/signup", (req, res) => {
  const errors = validateSignup(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });

  const { name, username, password } = req.body;
  const taken = db.prepare("SELECT id FROM profiles WHERE username = ?").get(username);
  if (taken) {
    return res.status(409).json({ error: "That username is already taken" });
  }

  const passwordHash = hashPassword(password);
  const nowIso = new Date().toISOString();

  const profileId = db.transaction(() => {
    // Exactly one pre-existing profile with no login yet (from before
    // accounts existed, or a fresh install's auto-seeded first profile) —
    // the first person to sign up claims it and keeps its data instead of
    // starting over empty.
    const allProfiles = db.prepare("SELECT id, username FROM profiles").all();
    if (allProfiles.length === 1 && !allProfiles[0].username) {
      const id = allProfiles[0].id;
      db.prepare("UPDATE profiles SET name = ?, username = ?, password_hash = ? WHERE id = ?").run(
        name.trim(),
        username,
        passwordHash,
        id
      );
      return id;
    }
    const id = db
      .prepare("INSERT INTO profiles (name, username, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(name.trim(), username, passwordHash, nowIso).lastInsertRowid;
    seedDefaultProfileSettings(id);
    return id;
  })();

  const token = createSession(profileId);
  const profile = db.prepare("SELECT id, name, username FROM profiles WHERE id = ?").get(profileId);
  res.status(201).json({ token, profile: publicProfile(profile) });
});

router.post("/login", (req, res) => {
  const errors = validateLogin(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });

  const { username, password } = req.body;
  const profile = db.prepare("SELECT * FROM profiles WHERE username = ?").get(username);
  // Same error for "no such user" and "wrong password" so a login attempt
  // can't be used to enumerate which usernames exist.
  if (!profile || !profile.password_hash || !verifyPassword(password, profile.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = createSession(profile.id);
  res.json({ token, profile: publicProfile(profile) });
});

router.post("/logout", requireAuth, (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) deleteSession(token);
  res.status(204).end();
});

router.get("/me", requireAuth, (req, res) => {
  const profile = db.prepare("SELECT id, name, username FROM profiles WHERE id = ?").get(req.profileId);
  res.json(publicProfile(profile));
});

export default router;
