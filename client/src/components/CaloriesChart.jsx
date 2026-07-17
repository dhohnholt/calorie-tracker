import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatShortDate } from "../dates";

export default function CaloriesChart({ data, goal, selectedDate, onSelectDate }) {
  return (
    <div className="card calories-chart">
      <div className="card__header">
        <h2>Daily calories</h2>
        <div className="legend-inline">
          <span className="legend-inline__swatch" style={{ background: "var(--series-1)" }} />
          <span>Calories</span>
          <span className="legend-inline__swatch legend-inline__swatch--line" />
          <span>Goal ({goal})</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--baseline)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
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
          <Bar dataKey="calories" radius={[4, 4, 0, 0]} cursor="pointer" maxBarSize={28}>
            {data.map((d) => (
              <Cell
                key={d.date}
                fill="var(--series-1)"
                opacity={d.date === selectedDate ? 1 : 0.55}
                onClick={() => onSelectDate(d.date)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="calories-chart__hint">Click a bar to see that day's meals</div>
    </div>
  );
}
