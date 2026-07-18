import "dotenv/config";
import express from "express";
import cors from "cors";
import "./db.js";

import profilesRouter from "./routes/profiles.js";
import foodEntriesRouter from "./routes/foodEntries.js";
import weightEntriesRouter from "./routes/weightEntries.js";
import summaryRouter from "./routes/summary.js";
import settingsRouter from "./routes/settings.js";
import nutritionRouter from "./routes/nutrition.js";
import mealPlanRouter from "./routes/mealPlan.js";
import recipesRouter from "./routes/recipes.js";
import favoriteFoodsRouter from "./routes/favoriteFoods.js";
import weeklyPlanRouter from "./routes/weeklyPlan.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/profiles", profilesRouter);
app.use("/api/food-entries", foodEntriesRouter);
app.use("/api/weight-entries", weightEntriesRouter);
app.use("/api/summary", summaryRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/nutrition", nutritionRouter);
app.use("/api/meal-plan", mealPlanRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/favorite-foods", favoriteFoodsRouter);
app.use("/api/weekly-plan", weeklyPlanRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

export default app;

// Only start listening when run directly (`node src/index.js`), not when
// imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
}
