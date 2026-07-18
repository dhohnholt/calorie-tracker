import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatShortDate } from "calorie-tracker-shared/dates.js";
import { useTheme } from "../theme";

const CHART_HEIGHT = 140;

// Plain-View line chart (dots + rotated line segments) instead of an SVG
// charting library, so this has no native dependency — no pod/rebuild step
// needed to see it, unlike most React Native chart libraries.
export default function WeightChart({ data, goalWeight, unit }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  if (data.length === 0) return null;

  const values = data.map((d) => d.weight);
  const min = Math.min(...values, goalWeight || values[0]);
  const max = Math.max(...values, goalWeight || values[0]);
  const pad = Math.max((max - min) * 0.1, 1);
  const rangeMin = min - pad;
  const range = max + pad - rangeMin || 1;

  function xFor(i) {
    return data.length > 1 ? (i / (data.length - 1)) * width : width / 2;
  }
  function yFor(weight) {
    return CHART_HEIGHT - ((weight - rangeMin) / range) * CHART_HEIGHT;
  }

  const points = data.map((d, i) => ({ x: xFor(i), y: yFor(d.weight) }));
  const segments = points.slice(1).map((p, i) => {
    const prev = points[i];
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    return {
      length: Math.sqrt(dx * dx + dy * dy),
      angle: Math.atan2(dy, dx),
      midX: (prev.x + p.x) / 2,
      midY: (prev.y + p.y) / 2,
    };
  });
  const goalY = goalWeight ? yFor(goalWeight) : null;

  return (
    <View style={styles.container} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ height: CHART_HEIGHT }}>
        {width > 0 && (
          <>
            {goalY != null && (
              <View style={[styles.goalLine, { top: goalY, borderColor: theme.baseline }]} />
            )}
            {segments.map((s, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  {
                    left: s.midX - s.length / 2,
                    top: s.midY - 1,
                    width: s.length,
                    backgroundColor: theme.series1,
                    transform: [{ rotate: `${s.angle}rad` }],
                  },
                ]}
              />
            ))}
            {points.map((p, i) => (
              <View
                key={i}
                style={[styles.dot, { left: p.x - 3, top: p.y - 3, backgroundColor: theme.series1 }]}
              />
            ))}
          </>
        )}
      </View>
      <View style={styles.xLabels}>
        <Text style={[styles.axisLabel, { color: theme.textMuted }]}>{formatShortDate(data[0].date)}</Text>
        {goalWeight ? (
          <Text style={[styles.axisLabel, { color: theme.textMuted }]}>
            Goal {goalWeight} {unit}
          </Text>
        ) : null}
        <Text style={[styles.axisLabel, { color: theme.textMuted }]}>
          {formatShortDate(data[data.length - 1].date)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4, alignSelf: "stretch" },
  goalLine: { position: "absolute", left: 0, right: 0, borderTopWidth: 1, borderStyle: "dashed" },
  segment: { position: "absolute", height: 2, borderRadius: 1 },
  dot: { position: "absolute", width: 6, height: 6, borderRadius: 3 },
  xLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  axisLabel: { fontSize: 11 },
});
