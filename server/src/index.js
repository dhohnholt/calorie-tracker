import "dotenv/config";
import express from "express";
import cors from "cors";
import "./db.js";
import { requireAuth } from "./auth.js";

import authRouter from "./routes/auth.js";
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

// Signup/login/health are the only public routes — everything else requires
// a valid session token.
app.use("/api/auth", authRouter);
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/food-entries", requireAuth, foodEntriesRouter);
app.use("/api/weight-entries", requireAuth, weightEntriesRouter);
app.use("/api/summary", requireAuth, summaryRouter);
app.use("/api/settings", requireAuth, settingsRouter);
app.use("/api/nutrition", requireAuth, nutritionRouter);
app.use("/api/meal-plan", requireAuth, mealPlanRouter);
app.use("/api/recipes", requireAuth, recipesRouter);
app.use("/api/favorite-foods", requireAuth, favoriteFoodsRouter);
app.use("/api/weekly-plan", requireAuth, weeklyPlanRouter);

export default app;

// Only start listening when run directly (`node src/index.js`), not when
// imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
}
