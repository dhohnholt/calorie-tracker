import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// Claude Haiku 4.5 pricing: $1.00 / 1M input tokens, $5.00 / 1M output tokens
const INPUT_COST_PER_TOKEN = 1.0 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 5.0 / 1_000_000;

// AI spend tracking is global (about the household's Anthropic bill, not
// per-person data) — always profile_id 0, same sentinel used everywhere else
// for shared settings.
function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE profile_id = 0 AND key = ?").get(key);
  return row ? parseFloat(row.value) || 0 : 0;
}

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (profile_id, key, value) VALUES (0, ?, ?)
     ON CONFLICT(profile_id, key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value));
}

function recordAiUsage(inputTokens, outputTokens) {
  const costUsd = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;

  const totalInputTokens = getSetting("ai_total_input_tokens") + inputTokens;
  const totalOutputTokens = getSetting("ai_total_output_tokens") + outputTokens;
  const totalCostUsd = getSetting("ai_estimated_spend_usd") + costUsd;

  setSetting("ai_total_input_tokens", totalInputTokens);
  setSetting("ai_total_output_tokens", totalOutputTokens);
  setSetting("ai_estimated_spend_usd", totalCostUsd);

  return { costUsd, totalCostUsd, totalInputTokens, totalOutputTokens };
}

router.post("/ai", async (req, res) => {
  const { favoriteFoods = [], targetProteinG, planScope, recipes = [], guidance = "" } = req.body;
  if (favoriteFoods.length === 0 && recipes.length === 0) {
    return res.status(400).json({ error: "favoriteFoods or recipes must include at least one item" });
  }
  if (!targetProteinG || targetProteinG <= 0) {
    return res.status(400).json({ error: "targetProteinG must be a positive number" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error: "ANTHROPIC_API_KEY is not configured on the server. Add it to server/.env to use AI-generated plans.",
    });
  }

  const systemPrompt = `You are a creative, nutrition-savvy home cook. Given a list of favorite foods, optionally some saved recipes with exact known nutrition, a protein target in grams, and optional guidance from the user, propose a realistic, appetizing meal plan that hits the protein target as closely as possible without wildly overshooting calories.

Be genuinely creative: don't just list raw ingredients side by side — combine them into real, cohesive dishes a person would actually cook and enjoy (e.g. turn eggs + spinach + cheese into a vegetable & cheese scramble; turn chicken + broth + vegetables into a soup; turn ground meat + beans + spices into a chili). Favor balanced, whole-food combinations (protein + vegetables + a sensible carb or fat) over just stacking the highest-protein items back to back.

You may include a modest amount of complementary ingredients that are NOT in the favorite foods or saved recipes list if they meaningfully improve a dish (e.g. onion, garlic, herbs/spices, a vegetable, broth, olive oil, a whole grain). Mark any such added item with "from_favorites": false. Mark items that came from the user's favorite foods or saved recipes list with "from_favorites": true.

If saved recipes are provided, include each one exactly once as its own meal using its exact given protein_g and calories (do not recompute or alter these numbers) — treat them as fixed, already-cooked meal options. Give it "from_favorites": true.

If the user gives guidance (e.g. "soup for dinner", "a crockpot meal", "no eggs today"), treat it as a strong preference and design the plan around it wherever reasonably compatible with the protein target — mention briefly in the notes how you incorporated it.

Give each meal both a time-of-day "slot" (Breakfast, Lunch, Dinner, Snack, etc.) and a real "dish_name" describing the actual dish (e.g. "Crockpot Chicken & White Bean Soup", not just "Dinner").

Respond with ONLY valid JSON (no markdown fences, no commentary) matching exactly this shape:
{"meals":[{"slot":string,"dish_name":string,"items":[{"food":string,"amount":string,"protein_g":number,"calories":number,"from_favorites":boolean}],"meal_protein_g":number}],"total_protein_g":number,"total_calories":number,"notes":string}`;

  const recipeLines = recipes
    .map((r) => `- ${r.name}: ${r.protein_g}g protein, ${r.calories} kcal per serving (fixed, use as-is)`)
    .join("\n");

  const userPrompt = `Favorite foods: ${favoriteFoods.length ? favoriteFoods.join(", ") : "(none specified)"}
${recipes.length ? `Saved recipes (include exactly once each, using these exact numbers):\n${recipeLines}\n` : ""}Protein target: ${targetProteinG}g
Plan scope: ${planScope === "remaining" ? "remaining protein needed for today — a smaller number of meals/snacks is fine" : "a full day of meals"}
${guidance.trim() ? `User's requests: ${guidance.trim()}` : ""}`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(502).json({ error: "Anthropic API error", detail: text });
    }

    const data = await resp.json();

    const usage = data.usage
      ? recordAiUsage(data.usage.input_tokens || 0, data.usage.output_tokens || 0)
      : null;

    const rawText = data.content?.[0]?.text || "";
    const cleaned = rawText.replace(/^```json\s*|\s*```$/g, "").trim();

    let plan;
    try {
      plan = JSON.parse(cleaned);
    } catch {
      const truncated = data.stop_reason === "max_tokens";
      return res.status(502).json({
        error: truncated
          ? "The AI response was cut off before finishing (too many meals/items requested at once). Try a smaller favorite-foods list or simpler request."
          : "Could not parse AI response as JSON",
        detail: rawText,
      });
    }

    res.json({ ...plan, usage });
  } catch (err) {
    res.status(502).json({ error: "Failed to reach Anthropic API", detail: err.message });
  }
});

export default router;
