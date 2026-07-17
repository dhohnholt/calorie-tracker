import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { sugarStatus, sodiumStatus, fiberStatus, proteinGoalStatus } from "../nutritionQuality";
import { useCountUp } from "../useCountUp";
import CalorieRing from "./CalorieRing";

const MACRO_COLORS = {
  protein_g: "var(--series-1)",
  carbs_g: "var(--series-2)",
  fat_g: "var(--series-3)",
};

const MACRO_LABELS = {
  protein_g: "Protein",
  carbs_g: "Carbs",
  fat_g: "Fat",
};

export default function TodaySummary({ totals, goal, proteinGoal }) {
  const calories = totals?.calories || 0;
  const remaining = Math.max(goal - calories, 0);
  const overBy = Math.max(calories - goal, 0);
  const animatedCalories = useCountUp(calories);

  const macroData = ["protein_g", "carbs_g", "fat_g"]
    .map((key) => ({ key, label: MACRO_LABELS[key], value: totals?.[key] || 0 }))
    .filter((d) => d.value > 0);

  const quality =
    calories > 0
      ? [
          ...(proteinGoal ? [proteinGoalStatus(totals?.protein_g || 0, proteinGoal)] : []),
          sugarStatus(totals?.sugar_g || 0, calories),
          sodiumStatus(totals?.sodium_mg || 0),
          fiberStatus(totals?.fiber_g || 0),
        ]
      : [];

  return (
    <div className="card today-summary-card">
      <div className="today-summary">
      <div className="today-summary__stat today-summary__stat--ring">
        <div className="today-summary__ring-wrap">
          <CalorieRing value={animatedCalories} goal={goal} overGoal={overBy > 0} />
          <div className="today-summary__ring-label tabular">{Math.round(animatedCalories)}</div>
        </div>
        <div className="today-summary__text">
          <div className="today-summary__label">Today's calories</div>
          <div className="today-summary__goal">of {goal} goal</div>
          <div className="today-summary__sub">
            {overBy > 0 ? (
              <span style={{ color: "var(--status-critical)" }}>
                {Math.round(overBy)} over goal
              </span>
            ) : (
              <span>{Math.round(remaining)} remaining</span>
            )}
          </div>
        </div>
      </div>

      {macroData.length > 0 ? (
        <div className="today-summary__macros">
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie
                data={macroData}
                dataKey="value"
                nameKey="label"
                innerRadius={36}
                outerRadius={56}
                paddingAngle={2}
                stroke="var(--surface-1)"
                strokeWidth={2}
              >
                {macroData.map((d) => (
                  <Cell key={d.key} fill={MACRO_COLORS[d.key]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${Math.round(value)} g`, name]}
                contentStyle={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="macro-legend">
            {macroData.map((d) => (
              <div className="macro-legend__row" key={d.key}>
                <span className="macro-legend__swatch" style={{ background: MACRO_COLORS[d.key] }} />
                <span className="macro-legend__label">{d.label}</span>
                <span className="macro-legend__value tabular">{Math.round(d.value)}g</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="today-summary__empty">No food logged yet today</div>
      )}
      </div>

      {quality.length > 0 && (
        <div className="nutrition-quality">
          {quality.map((q) => (
            <div className="nutrition-quality__item" key={q.label}>
              <span className={`nutrition-quality__dot nutrition-quality__dot--${q.level}`} />
              <span>{q.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
