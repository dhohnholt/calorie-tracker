import { BarChart, Bar, ReferenceLine, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { formatShortDate } from "../dates";

function formatComparison({ avgCaloriesThisWeek, avgCaloriesLastWeek }) {
  if (avgCaloriesThisWeek == null || avgCaloriesLastWeek == null) return null;
  const diff = avgCaloriesThisWeek - avgCaloriesLastWeek;
  const pct = Math.round((Math.abs(diff) / avgCaloriesLastWeek) * 100);
  if (pct < 3) return "About the same as last week";
  return `${pct}% ${diff > 0 ? "above" : "below"} last week's average`;
}

export default function WeeklyTrend({ data, goal, streak = 0, comparison }) {
  const last7 = data.slice(-7);
  const trackedDays = last7.filter((d) => d.calories > 0);
  const avgCalories = trackedDays.length
    ? trackedDays.reduce((sum, d) => sum + d.calories, 0) / trackedDays.length
    : 0;
  const overGoalCount = trackedDays.filter((d) => d.calories > goal).length;
  const comparisonText = comparison ? formatComparison(comparison) : null;

  return (
    <div className="card weekly-trend">
      <div className="card__header">
        <h2>7-day trend</h2>
        {streak > 0 && (
          <span className="weekly-trend__streak">
            {streak}-day streak
          </span>
        )}
      </div>

      <div className="weekly-trend__stat">
        <div className="weekly-trend__value tabular">
          {trackedDays.length ? Math.round(avgCalories) : "—"}
          <span className="weekly-trend__unit"> avg kcal/day</span>
        </div>
        <div className="weekly-trend__sub">
          {trackedDays.length === 0
            ? "No days logged yet"
            : `${overGoalCount} of ${trackedDays.length} tracked day${
                trackedDays.length === 1 ? "" : "s"
              } over goal`}
        </div>
        {comparisonText && <div className="weekly-trend__comparison">{comparisonText}</div>}
      </div>

      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={last7} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <Tooltip
            cursor={{ fill: "var(--gridline)", opacity: 0.5 }}
            formatter={(value) => [`${Math.round(value)} kcal`, "Calories"]}
            labelFormatter={formatShortDate}
            contentStyle={{
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
            }}
          />
          <ReferenceLine y={goal} stroke="var(--baseline)" strokeDasharray="4 4" />
          <Bar dataKey="calories" radius={[3, 3, 0, 0]} maxBarSize={22}>
            {last7.map((d) => (
              <Cell key={d.date} fill="var(--series-1)" opacity={d.calories > 0 ? 0.85 : 0.25} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
