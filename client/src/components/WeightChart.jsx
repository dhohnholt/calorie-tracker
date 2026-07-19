import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { formatShortDate, formatFullDate, todayISO } from "../dates";
import { computeWeightTrend, computeWeightLossStreak } from "../weightTrend";
import { computeBMI, bmiCategory } from "../bodyMetrics";

export default function WeightChart({ data, goalWeight, unit, heightCm, onAdd }) {
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(todayISO());

  const values = data.map((d) => d.weight);
  const min = values.length ? Math.min(...values, goalWeight) : goalWeight;
  const max = values.length ? Math.max(...values, goalWeight) : goalWeight;
  const pad = Math.max((max - min) * 0.1, 3);

  const trend = computeWeightTrend(data, goalWeight);
  const lossStreak = computeWeightLossStreak(data);
  const currentWeight = data.length ? data[data.length - 1].weight : null;
  const bmi = computeBMI(currentWeight, unit, heightCm);
  const bmiInfo = bmi ? bmiCategory(bmi) : null;

  function handleSubmit(e) {
    e.preventDefault();
    const w = parseFloat(weight);
    if (!Number.isFinite(w)) return;
    onAdd({ date, weight: w, unit });
    setWeight("");
  }

  return (
    <div className="card weight-chart">
      <div className="card__header">
        <h2>Weight</h2>
        <div className="legend-inline">
          <span className="legend-inline__swatch" style={{ background: "var(--series-1)" }} />
          <span>Weight ({unit})</span>
          <span className="legend-inline__swatch legend-inline__swatch--line" />
          <span>Goal ({goalWeight})</span>
        </div>
      </div>

      {lossStreak > 0 && (
        <div className="weight-loss-streak">
          {lossStreak}-day streak of lower weigh-ins
        </div>
      )}

      <div className="weight-trend-stats">
        {trend.status === "insufficient" && (
          <span className="weight-trend-stats__muted">
            Log a few more weigh-ins to see your weekly trend
          </span>
        )}
        {trend.status === "flat" && (
          <span className="weight-trend-stats__muted">Weight steady over your logged history</span>
        )}
        {trend.status === "away" && (
          <span className="weight-trend-stats__warning">
            Trending {trend.weeklyRate > 0 ? "up" : "down"} (
            {trend.weeklyRate > 0 ? "+" : ""}
            {trend.weeklyRate.toFixed(1)} {unit}/week), away from your {goalWeight} {unit} goal
          </span>
        )}
        {trend.status === "projecting" && (
          <span>
            {trend.weeklyRate < 0 ? "Losing" : "Gaining"} {Math.abs(trend.weeklyRate).toFixed(1)}{" "}
            {unit}/week · on pace for {goalWeight} {unit} by{" "}
            <strong>{formatFullDate(trend.projectedDate)}</strong>
          </span>
        )}
      </div>

      {bmiInfo ? (
        <div className="weight-bmi">
          <span className={`nutrition-quality__dot nutrition-quality__dot--${bmiInfo.level}`} />
          <span>
            BMI {bmi.toFixed(1)} · {bmiInfo.label}
          </span>
        </div>
      ) : (
        currentWeight != null && (
          <div className="weight-bmi weight-bmi--muted">
            Add your height in Settings to see your BMI
          </div>
        )
      )}

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--baseline)" }}
            tickLine={false}
          />
          <YAxis
            domain={[min - pad, max + pad]}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            formatter={(value) => [`${value} ${unit}`, "Weight"]}
            labelFormatter={formatShortDate}
            contentStyle={{
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
            }}
          />
          <ReferenceLine y={goalWeight} stroke="var(--baseline)" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--series-1)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <form className="weight-form" onSubmit={handleSubmit}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={todayISO()}
        />
        <input
          type="number"
          step="0.1"
          placeholder={`Weight (${unit})`}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <button type="submit" className="button-primary">
          Log weight
        </button>
      </form>
    </div>
  );
}
