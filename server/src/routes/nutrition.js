import { Router } from "express";

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
  };
}

function sanitizeQuery(query) {
  // USDA's API gateway 400s on parentheses in the query string regardless of
  // URL-encoding (e.g. "Spinach (Fresh)" fails, "Spinach Fresh" doesn't).
  return query.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}

export async function searchUSDAFoods(query, pageSize = 10) {
  const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", sanitizeQuery(query));
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("dataType", "Foundation,SR Legacy,Branded");

  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`USDA API error (${resp.status}): ${text}`);
  }
  const data = await resp.json();
  return (data.foods || []).map(simplifyFood);
}

router.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "q query param is required" });

  try {
    const foods = await searchUSDAFoods(q);
    res.json({ foods });
  } catch (err) {
    res.status(502).json({ error: "Failed to reach USDA API", detail: err.message });
  }
});

export default router;
