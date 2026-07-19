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
// length the symbology decodes to.
const BARCODE_RE = /^\d{6,14}$/;

// USDA stores every product's GTIN zero-padded to 14 digits and its search
// doesn't treat the unpadded and padded forms as equivalent — a raw
// 12-digit UPC-A search returns zero results even when the product exists
// under its 14-digit GTIN. Left-pad any all-digit query to 14 so a scanned
// barcode matches on the first try. Non-barcode text searches are never
// pure digits, so this never fires for them.
function normalizeBarcodeQuery(query) {
  const trimmed = query.trim();
  return BARCODE_RE.test(trimmed) ? trimmed.padStart(14, "0") : query;
}

const OFF_NUTRIENT_MAP = {
  "energy-kcal_100g": "calories",
  proteins_100g: "protein_g",
  fat_100g: "fat_g",
  carbohydrates_100g: "carbs_g",
  fiber_100g: "fiber_g",
  sugars_100g: "sugar_g",
};

// Open Food Facts' serving_size text bundles the count and its gram
// equivalent in one string (e.g. "27 crackers (30 g)"), but the shared
// household-serving parsers (gramsPerTablespoon/parseCountUnit) expect just
// the count phrase, since they get the gram figure separately from
// servingSize. Strip the trailing "(... g)" annotation so those parsers see
// the same shape they'd get from USDA data.
function stripServingGrams(text) {
  return typeof text === "string" ? text.replace(/\(.*?\)\s*$/, "").trim() : text;
}

// Maps an Open Food Facts product into this app's simplified food shape so
// it's a drop-in alongside USDA results. Returns null when the product
// doesn't even have calorie data, since that makes it useless to log
// against.
function simplifyOFFFood(product, barcode) {
  const n = product.nutriments || {};
  const per100g = {};
  for (const [offKey, key] of Object.entries(OFF_NUTRIENT_MAP)) {
    if (typeof n[offKey] === "number") per100g[key] = n[offKey];
  }
  // OFF reports sodium in grams per 100g; the rest of the app uses mg.
  if (typeof n.sodium_100g === "number") per100g.sodium_mg = n.sodium_100g * 1000;
  if (typeof per100g.calories !== "number") return null;

  const servingSize = typeof product.serving_quantity === "number" ? product.serving_quantity : undefined;
  const servingSizeUnit = product.serving_quantity_unit || (servingSize != null ? "g" : undefined);

  // gramsPerTablespoon/parseCountUnit only need these three fields off a
  // "food" object, so this stand-in is enough to reuse them as-is.
  const householdServingFood = {
    servingSize,
    servingSizeUnit,
    householdServingFullText: stripServingGrams(product.serving_size),
  };

  return {
    fdcId: `off:${barcode}`,
    description: product.product_name || product.generic_name || `Barcode ${barcode}`,
    dataType: "OpenFoodFacts",
    brandOwner: product.brands || product.brand_owner,
    servingSize,
    servingSizeUnit,
    per100g,
    gramsPerTbsp: gramsPerTablespoon(householdServingFood),
    countUnit: parseCountUnit(householdServingFood),
  };
}

// USDA's branded-food database has real coverage gaps for some products
// (see the GTIN zero-padding fix in this file's history for one that
// turned out not to be a gap at all) — Open Food Facts fills some of those
// in via its barcode-lookup endpoint. Only used as a fallback for
// barcode-shaped queries once USDA has confirmed it has nothing, since USDA
// stays the primary, better-curated source otherwise.
async function fetchOFFFallback(barcode) {
  try {
    const resp = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.status !== 1 || !data.product) return null;
    return simplifyOFFFood(data.product, barcode);
  } catch {
    return null;
  }
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

// SR Legacy mixes plain ingredients in with old restaurant/fast-food
// composite dishes, conventionally formatted as "BRANDNAME, dish
// description" (shouty-case brand prefix) or "Fast Foods, ...". USDA's own
// relevance ranking often puts these ahead of the plain ingredient a user
// is actually looking for (e.g. "grilled chicken" ranks "WENDY'S, Ultimate
// Chicken Grill Sandwich" above plain grilled chicken breast). Branded
// results are always shouty-case by convention, so this heuristic only
// makes sense scoped to the generic (Foundation/SR Legacy) bucket.
function isCompositeDish(description) {
  const prefix = description.split(",")[0].trim();
  if (/^fast foods?$/i.test(prefix)) return true;
  const letters = prefix.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 3) return false;
  const upperCount = (letters.match(/[A-Z]/g) || []).length;
  return upperCount / letters.length >= 0.7;
}

// Stable sort (Array#sort is spec-guaranteed stable) so within each group —
// plain ingredients and composite dishes — USDA's own relevance order is
// preserved; only the two groups get reshuffled relative to each other.
function rankGenericFoods(foods) {
  return [...foods].sort((a, b) => isCompositeDish(a.description) - isCompositeDish(b.description));
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

  const usdaFoods = [...rankGenericFoods(genericFoods), ...brandedFoods].map(simplifyFood);
  if (usdaFoods.length > 0) return usdaFoods;

  const trimmed = query.trim();
  if (!BARCODE_RE.test(trimmed)) return usdaFoods;

  const offFood = await fetchOFFFallback(trimmed);
  return offFood ? [offFood] : usdaFoods;
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
