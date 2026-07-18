import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_PATH lets tests point at a throwaway database instead of the real one.
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "data", "calorie-tracker.db");

// server/data/ is gitignored (it holds the real user data file), so it
// doesn't exist on a fresh deploy — better-sqlite3 doesn't create missing
// parent directories itself and throws, crashing the process before it can
// bind to a port at all.
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS food_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
    description TEXT NOT NULL,
    calories REAL NOT NULL,
    protein_g REAL DEFAULT 0,
    carbs_g REAL DEFAULT 0,
    fat_g REAL DEFAULT 0,
    fiber_g REAL DEFAULT 0,
    sugar_g REAL DEFAULT 0,
    sodium_mg REAL DEFAULT 0,
    items_json TEXT,
    logged_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_food_entries_date ON food_entries(date);

  CREATE TABLE IF NOT EXISTS weight_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    weight REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'lbs',
    logged_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON weight_entries(date);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS favorite_foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    category TEXT NOT NULL DEFAULT 'Uncategorized',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weekly_meal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week TEXT NOT NULL UNIQUE CHECK (day_of_week IN
      ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
    source TEXT NOT NULL,
    items_json TEXT NOT NULL,
    total_protein_g REAL DEFAULT 0,
    total_calories REAL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    calories REAL NOT NULL,
    protein_g REAL DEFAULT 0,
    carbs_g REAL DEFAULT 0,
    fat_g REAL DEFAULT 0,
    fiber_g REAL DEFAULT 0,
    sugar_g REAL DEFAULT 0,
    sodium_mg REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL
  );
`);

const favoriteFoodsColumns = db.prepare("PRAGMA table_info(favorite_foods)").all();
if (!favoriteFoodsColumns.some((c) => c.name === "category")) {
  db.exec("ALTER TABLE favorite_foods ADD COLUMN category TEXT NOT NULL DEFAULT 'Uncategorized'");
}

const recipesColumns = db.prepare("PRAGMA table_info(recipes)").all();
if (!recipesColumns.some((c) => c.name === "video_url")) {
  db.exec("ALTER TABLE recipes ADD COLUMN video_url TEXT");
}
if (!recipesColumns.some((c) => c.name === "ingredients_json")) {
  db.exec("ALTER TABLE recipes ADD COLUMN ingredients_json TEXT NOT NULL DEFAULT '[]'");
}
if (!recipesColumns.some((c) => c.name === "instructions")) {
  db.exec("ALTER TABLE recipes ADD COLUMN instructions TEXT");
}
if (!recipesColumns.some((c) => c.name === "rating")) {
  db.exec("ALTER TABLE recipes ADD COLUMN rating INTEGER NOT NULL DEFAULT 0");
}

const foodEntriesColumns = db.prepare("PRAGMA table_info(food_entries)").all();
if (!foodEntriesColumns.some((c) => c.name === "notes")) {
  db.exec("ALTER TABLE food_entries ADD COLUMN notes TEXT");
}

// --- Multi-profile migration -------------------------------------------
//
// Everything above this point is the pre-profiles schema, kept as-is so a
// database created before profiles existed evolves through the same steps
// a fresh one would. From here, food_entries/weight_entries/favorite_foods/
// weekly_meal_plans/settings gain a profile_id and, where the old schema
// enforced global uniqueness (favorite name, weekly-plan day, weight-entry
// date), that constraint becomes per-profile instead — which SQLite can
// only do by recreating the table, since ALTER TABLE can't change a UNIQUE
// constraint in place. Runs once (guarded by the profiles table being
// empty) inside a single transaction, so a failure partway rolls back
// entirely rather than leaving the database half-migrated.
//
// settings.profile_id uses 0 as a reserved "global" sentinel (for the AI
// spend-tracking counters, which aren't per-person data) rather than NULL,
// since SQLite treats every NULL as distinct in a composite key and that
// would break the ON CONFLICT upsert those counters rely on. 0 is safe
// because real profiles.id values start at 1 (AUTOINCREMENT) and 0 is
// deliberately never created as a real profile.
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Explicit allowlist of per-profile settings keys (the ones editable via the
// Settings UI) — everything else defaults to global (profile_id 0). This is
// the safer direction to default: a new global counter accidentally routed
// per-profile is just a minor accounting split, but a new personal setting
// accidentally routed global would leak one profile's data into another's
// view. Must match the identical allowlist in routes/settings.js.
export const PER_PROFILE_SETTINGS_KEYS = new Set([
  "calorie_goal",
  "goal_weight",
  "weight_unit",
  "height_cm",
]);

function migrateToProfiles() {
  const profileCount = db.prepare("SELECT COUNT(*) AS c FROM profiles").get().c;
  if (profileCount > 0) return;

  const migrate = db.transaction(() => {
    const existingName = db.prepare("SELECT value FROM settings WHERE key = 'profile_name'").get();
    const name = existingName?.value?.trim() || "Me";
    const nowIso = new Date().toISOString();
    const defaultProfileId = db
      .prepare("INSERT INTO profiles (name, created_at) VALUES (?, ?)")
      .run(name, nowIso).lastInsertRowid;

    db.exec(`
      CREATE TABLE food_entries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
        description TEXT NOT NULL,
        notes TEXT,
        calories REAL NOT NULL,
        protein_g REAL DEFAULT 0,
        carbs_g REAL DEFAULT 0,
        fat_g REAL DEFAULT 0,
        fiber_g REAL DEFAULT 0,
        sugar_g REAL DEFAULT 0,
        sodium_mg REAL DEFAULT 0,
        items_json TEXT,
        logged_at TEXT NOT NULL
      );
    `);
    db.prepare(
      `INSERT INTO food_entries_new
        (id, profile_id, date, meal, description, notes, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, items_json, logged_at)
       SELECT id, ?, date, meal, description, notes, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, items_json, logged_at
       FROM food_entries`
    ).run(defaultProfileId);
    db.exec("DROP TABLE food_entries");
    db.exec("ALTER TABLE food_entries_new RENAME TO food_entries");
    db.exec("CREATE INDEX idx_food_entries_date ON food_entries(date)");
    db.exec("CREATE INDEX idx_food_entries_profile ON food_entries(profile_id)");

    db.exec(`
      CREATE TABLE weight_entries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        weight REAL NOT NULL,
        unit TEXT NOT NULL DEFAULT 'lbs',
        logged_at TEXT NOT NULL,
        UNIQUE(profile_id, date)
      );
    `);
    db.prepare(
      `INSERT INTO weight_entries_new (id, profile_id, date, weight, unit, logged_at)
       SELECT id, ?, date, weight, unit, logged_at FROM weight_entries`
    ).run(defaultProfileId);
    db.exec("DROP TABLE weight_entries");
    db.exec("ALTER TABLE weight_entries_new RENAME TO weight_entries");
    db.exec("CREATE INDEX idx_weight_entries_date ON weight_entries(date)");

    db.exec(`
      CREATE TABLE favorite_foods_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL,
        name TEXT NOT NULL COLLATE NOCASE,
        category TEXT NOT NULL DEFAULT 'Uncategorized',
        created_at TEXT NOT NULL,
        UNIQUE(profile_id, name)
      );
    `);
    db.prepare(
      `INSERT INTO favorite_foods_new (id, profile_id, name, category, created_at)
       SELECT id, ?, name, category, created_at FROM favorite_foods`
    ).run(defaultProfileId);
    db.exec("DROP TABLE favorite_foods");
    db.exec("ALTER TABLE favorite_foods_new RENAME TO favorite_foods");

    db.exec(`
      CREATE TABLE weekly_meal_plans_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL,
        day_of_week TEXT NOT NULL CHECK (day_of_week IN
          ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
        source TEXT NOT NULL,
        items_json TEXT NOT NULL,
        total_protein_g REAL DEFAULT 0,
        total_calories REAL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE(profile_id, day_of_week)
      );
    `);
    db.prepare(
      `INSERT INTO weekly_meal_plans_new
        (id, profile_id, day_of_week, source, items_json, total_protein_g, total_calories, created_at)
       SELECT id, ?, day_of_week, source, items_json, total_protein_g, total_calories, created_at
       FROM weekly_meal_plans`
    ).run(defaultProfileId);
    db.exec("DROP TABLE weekly_meal_plans");
    db.exec("ALTER TABLE weekly_meal_plans_new RENAME TO weekly_meal_plans");

    // profile_id 0 = global (see comment above); real per-profile settings
    // (calorie_goal, goal_weight, weight_unit, height_cm) move to the
    // default profile, profile_name is dropped (superseded by profiles.name).
    db.exec(`
      CREATE TABLE settings_new (
        profile_id INTEGER NOT NULL DEFAULT 0,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (profile_id, key)
      );
    `);
    const insertSetting = db.prepare(
      "INSERT INTO settings_new (profile_id, key, value) VALUES (?, ?, ?)"
    );
    for (const row of db.prepare("SELECT key, value FROM settings").all()) {
      if (row.key === "profile_name") continue;
      const profileIdForKey = PER_PROFILE_SETTINGS_KEYS.has(row.key) ? defaultProfileId : 0;
      insertSetting.run(profileIdForKey, row.key, row.value);
    }
    db.exec("DROP TABLE settings");
    db.exec("ALTER TABLE settings_new RENAME TO settings");

    // Recipes stay a single shared table (the "library"); profile_recipes
    // tracks which profile has added which recipe to their personal
    // collection, and carries the per-profile rating (rating used to be
    // global on recipes itself, but two profiles can reasonably disagree
    // about a shared recipe). Every existing recipe predates profiles, so
    // it was implicitly "personal" to the one user who created it — add it
    // to the default profile's collection, carrying its existing rating.
    db.exec(`
      CREATE TABLE IF NOT EXISTS profile_recipes (
        profile_id INTEGER NOT NULL REFERENCES profiles(id),
        recipe_id INTEGER NOT NULL REFERENCES recipes(id),
        rating INTEGER NOT NULL DEFAULT 0,
        added_at TEXT NOT NULL,
        PRIMARY KEY (profile_id, recipe_id)
      );
    `);
    const insertProfileRecipe = db.prepare(
      "INSERT INTO profile_recipes (profile_id, recipe_id, rating, added_at) VALUES (?, ?, ?, ?)"
    );
    for (const recipe of db.prepare("SELECT id, rating FROM recipes").all()) {
      insertProfileRecipe.run(defaultProfileId, recipe.id, recipe.rating || 0, nowIso);
    }
  });

  migrate();
}

migrateToProfiles();

const recipesColumnsPostMigration = db.prepare("PRAGMA table_info(recipes)").all();
if (!recipesColumnsPostMigration.some((c) => c.name === "created_by_profile_id")) {
  db.exec("ALTER TABLE recipes ADD COLUMN created_by_profile_id INTEGER");
  // Existing recipes predate profiles; attribute them to whichever profile
  // the migration above just created (there's only ever one at this point).
  const firstProfile = db.prepare("SELECT id FROM profiles ORDER BY id ASC LIMIT 1").get();
  if (firstProfile) {
    db.prepare(
      "UPDATE recipes SET created_by_profile_id = ? WHERE created_by_profile_id IS NULL"
    ).run(firstProfile.id);
  }
}

// --- Accounts (username/password login) --------------------------------
//
// Additive on top of the profiles table above — a profile with no username
// is a "legacy" profile from the old no-password switcher (or a fresh
// install's auto-seeded first profile) waiting to be claimed by the first
// signup. See routes/auth.js for the claim logic. The unique index is
// partial (WHERE username IS NOT NULL) so multiple unclaimed legacy
// profiles could in principle coexist without violating uniqueness, even
// though in practice at most one is ever unclaimed at a time.
const profilesColumns = db.prepare("PRAGMA table_info(profiles)").all();
if (!profilesColumns.some((c) => c.name === "username")) {
  db.exec("ALTER TABLE profiles ADD COLUMN username TEXT COLLATE NOCASE");
}
if (!profilesColumns.some((c) => c.name === "password_hash")) {
  db.exec("ALTER TABLE profiles ADD COLUMN password_hash TEXT");
}
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL"
);

// Opaque bearer session tokens. Only a sha256 hash of the token is stored —
// the raw token is a bearer credential (like an API key), so it's never
// persisted anywhere, only returned once at login/signup time.
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES profiles(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_profile ON sessions(profile_id);
`);

export function seedDefaultProfileSettings(profileId) {
  const insert = db.prepare(
    `INSERT INTO settings (profile_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT(profile_id, key) DO NOTHING`
  );
  insert.run(profileId, "calorie_goal", "2000");
  insert.run(profileId, "weight_unit", "lbs");
}

// Only seed the very first profile here (fresh-install bootstrap, or the
// profile the migration above just created if it had no settings to carry
// forward). Every profile created afterward is seeded in the profiles route
// at creation time instead.
const firstProfile = db.prepare("SELECT id FROM profiles ORDER BY id ASC LIMIT 1").get();
if (firstProfile) {
  seedDefaultProfileSettings(firstProfile.id);
}
