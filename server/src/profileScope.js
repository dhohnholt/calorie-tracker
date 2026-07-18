import { isValidProfileId } from "../../shared/validation.js";

// profile_id can arrive as a query param (GET/DELETE) or a body field
// (POST/PUT) depending on the route — check both rather than making every
// route caller pick the right spot. Writes a 400 and returns null when
// missing/invalid; callers should return immediately when they get null.
export function requireProfileId(req, res) {
  const raw = req.query.profile_id ?? req.body?.profile_id;
  if (!isValidProfileId(raw)) {
    res.status(400).json({ error: "profile_id is required and must be a positive integer" });
    return null;
  }
  return Number(raw);
}
