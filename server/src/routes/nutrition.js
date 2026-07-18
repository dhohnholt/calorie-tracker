import { Router } from "express";
import { gramsPerTablespoon, parseCountUnit } from "../../../shared/nutritionScaling.js";

const router = Router();

const NUTRIENT_MAP = {
  "Energy": "calories",
  "Protein": "protein_g",
  "Total lipid (fat)": "fat_g",
  "Carbohydrate, by difference": "carbs_g",
  "Fiber, total dietary": "fiber_g",
  "Sugars, total including NLEA": "sugar_g",
  "Sugars, total": "sugar_g",
  "Total Sugars": "sugar_g",
  "Sodium, Na": "sodium_mg",
};

function simplifyFood(food) {
  const per100g = {};
  for (const n of food.foodNutrients || []) {
    if (n.nutrientName === "Energy" && n.unitName?.toLowerCase() !== "kcal") continue;
    const key = NUTRIENT_MAP[n.nutrientName];
    if (key && per100g[key] === undefined) per100g[key] = n.value;
  }
  return {
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType,
    brandOwner: food.brandOwner,
    servingSize: food.servingSize,
    servingSizeUnit: food.servingSizeUnit,
    per100g,
    // Only present when USDA's own household-serving data lets us derive an
    // accurate, food-specific grams-per-tablespoon (not a generic guess) —
    // null means "tbsp" shouldn't be offered as a unit for this food.
    gramsPerTbsp: gramsPerTablespoon(food),
    // The food's own natural counting unit (e.g. "1 EGG" -> {label: "egg",
    // gramsPerUnit: 50}), for foods people count rather than weigh. null
    // means this food has no reliable discrete-unit serving data.
    countUnit: parseCountUnit(food),
  };
}

function sanitizeQuery(query) {
  // USDA's API gateway 400s on parentheses in the query string regardless of
  // URL-encoding (e.g. "Spinach (Fresh)" fails, "Spinach Fresh" doesn't).
  return query.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}

// Barcode scans (upc_a: 12 digits, ean13: 13, ean8: 8) come in at whatever
// length the symbology decodes to, but USDA stores every product's GTIN
// zero-padded to 14 digits and its search doesn't treat the unpadded and
// padded forms as equivalent — a raw 12-digit UPC-A search returns zero
// results even when the product exists under its 14-digit GTIN. Left-pad
// any all-digit query to 14 so a scanned barcode matches on the first try.
// Non-barcode text searches are never pure digits, so this never fires for
// them.
function normalizeBarcodeQuery(query) {
  const trimmed = query.trim();
  return /^\d{6,14}$/.test(trimmed) ? trimmed.padStart(14, "0") : query;
}

async function fetchUSDA(query, pageSize, dataType) {
  const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", sanitizeQuery(query));
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("dataType", dataType);

  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`USDA API error (${resp.status}): ${text}`);
  }
  const data = await resp.json();
  return data.foods || [];
}

// USDA's relevance ranking often buries Branded results behind generic
// Foundation/SR Legacy matches for common terms (e.g. "yogurt" returns 20+
// SR Legacy entries before a single Branded one) — raising pageSize alone
// doesn't fix this, since the extra slots just go to more of the same
// dataType. Querying Branded separately and merging guarantees real brand-
// name products actually show up instead of being crowded out by ranking.
export async function searchUSDAFoods(query, pageSize = 25) {
  const normalized = normalizeBarcodeQuery(query);
  const brandedCount = 10;
  const genericCount = pageSize - brandedCount;

  const [genericFoods, brandedFoods] = await Promise.all([
    fetchUSDA(normalized, genericCount, "Foundation,SR Legacy"),
    fetchUSDA(normalized, brandedCount, "Branded"),
  ]);

  return [...genericFoods, ...brandedFoods].map(simplifyFood);
}

router.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "q query param is required" });

  // Results depend on both live USDA data and our own transformation logic
  // (nutrient extraction, unit derivation) — a browser silently reusing a
  // cached response for the same query string could serve stale data
  // indefinitely once either changes.
  res.set("Cache-Control", "no-store");

  try {
    const foods = await searchUSDAFoods(q);
    res.json({ foods });
  } catch (err) {
    res.status(502).json({ error: "Failed to reach USDA API", detail: err.message });
  }
});

export default router;
