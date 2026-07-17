import { useColorScheme } from "react-native";

// Mirrors the CSS custom properties in client/src/index.css so the mobile
// app and web app read as the same product.
const light = {
  scheme: "light",
  pagePlane: "#f9f9f7",
  surface1: "#fcfcfb",
  textPrimary: "#0b0b0b",
  textSecondary: "#52514e",
  textMuted: "#898781",
  gridline: "#e1e0d9",
  baseline: "#c3c2b7",
  border: "rgba(11, 11, 11, 0.1)",

  series1: "#2a78d6",
  series2: "#1baf7a",
  series3: "#eda100",
  series4: "#008300",
  series5: "#4a3aa7",
  series6: "#e34948",
  series7: "#e87ba4",
  series8: "#eb6834",

  statusGood: "#0ca30c",
  statusWarning: "#fab219",
  statusSerious: "#ec835a",
  statusCritical: "#d03b3b",
};

const dark = {
  scheme: "dark",
  pagePlane: "#0d0d0d",
  surface1: "#1a1a19",
  textPrimary: "#ffffff",
  textSecondary: "#c3c2b7",
  textMuted: "#898781",
  gridline: "#2c2c2a",
  baseline: "#383835",
  border: "rgba(255, 255, 255, 0.1)",

  series1: "#3987e5",
  series2: "#199e70",
  series3: "#c98500",
  series4: "#008300",
  series5: "#9085e9",
  series6: "#e66767",
  series7: "#d55181",
  series8: "#d95926",

  statusGood: "#0ca30c",
  statusWarning: "#fab219",
  statusSerious: "#ec835a",
  statusCritical: "#d03b3b",
};

export const radii = { lg: 16, md: 10, sm: 6 };

export function useTheme() {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}
