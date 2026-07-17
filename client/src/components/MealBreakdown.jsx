import { formatFullDate } from "../dates";
import FoodItemRow from "./FoodItemRow";

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export default function MealBreakdown({ date, entries, onUpdate, onDelete }) {
  const byMeal = MEAL_ORDER.map((meal) => ({
    meal,
    entries: entries.filter((e) => e.meal === meal),
  })).filter((g) => g.entries.length > 0);

  const dayTotal = entries.reduce((sum, e) => sum + e.calories, 0);
  const dayProtein = entries.reduce((sum, e) => sum + e.protein_g, 0);
  const dayCarbs = entries.reduce((sum, e) => sum + e.carbs_g, 0);
  const dayFat = entries.reduce((sum, e) => sum + e.fat_g, 0);

  return (
    <div className="card meal-breakdown">
      <div className="card__header">
        <h2>{formatFullDate(date)}</h2>
        <div className="meal-breakdown__total tabular">{Math.round(dayTotal)} kcal</div>
      </div>

      {entries.length > 0 && (
        <div className="meal-breakdown__day-macros">
          {Math.round(dayProtein)}g protein · {Math.round(dayCarbs)}g carbs ·{" "}
          {Math.round(dayFat)}g fat
        </div>
      )}

      {byMeal.length === 0 ? (
        <div className="today-summary__empty">No food logged this day</div>
      ) : (
        byMeal.map(({ meal, entries: mealEntries }) => {
          const mealTotal = mealEntries.reduce((sum, e) => sum + e.calories, 0);
          return (
            <div className="meal-group" key={meal}>
              <div className="meal-group__header">
                <span className="meal-group__name">{MEAL_LABELS[meal]}</span>
                <span className="meal-group__total tabular">{Math.round(mealTotal)} kcal</span>
              </div>
              <ul className="meal-group__items">
                {mealEntries.map((e) => (
                  <FoodItemRow key={e.id} entry={e} onUpdate={onUpdate} onDelete={onDelete} />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
