import crypto from "node:crypto";
import { db } from "./db.js";

const SCRYPT_KEYLEN = 64;
const SESSION_BYTES = 32;
const SESSION_TTL_DAYS = 90;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidateBuffer = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  if (hashBuffer.length !== candidateBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, candidateBuffer);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createSession(profileId) {
  const token = crypto.randomBytes(SESSION_BYTES).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  db.prepare(
    "INSERT INTO sessions (token_hash, profile_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(hashToken(token), profileId, now.toISOString(), expiresAt.toISOString());
  return token;
}

export function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const session = db
    .prepare("SELECT profile_id, expires_at FROM sessions WHERE token_hash = ?")
    .get(hashToken(token));
  if (!session || new Date(session.expires_at) < new Date()) {
    return res.status(401).json({ error: "Session expired or invalid, please log in again" });
  }
  req.profileId = session.profile_id;
  next();
}
