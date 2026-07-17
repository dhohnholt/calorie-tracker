import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_PATH lets tests point at a throwaway database instead of the real one.
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "data", "calorie-tracker.db");

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

function seedSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO NOTHING`
  ).run(key, value);
}

seedSetting("calorie_goal", "2000");
seedSetting("goal_weight", "195");
seedSetting("weight_unit", "lbs");
