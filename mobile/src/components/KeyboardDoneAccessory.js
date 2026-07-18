import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

// iOS's numeric/decimal-pad keyboards have no built-in way to dismiss them
// (no return key, unlike the default keyboard) — this bar fills that gap.
// Android's numeric keyboards already have an adequate dismiss affordance,
// and InputAccessoryView is iOS-only, so this renders nothing there.
export const NUMERIC_KEYBOARD_ACCESSORY_ID = "numeric-keyboard-done";

export default function KeyboardDoneAccessory() {
  const theme = useTheme();
  if (Platform.OS !== "ios") return null;

  return (
    <InputAccessoryView nativeID={NUMERIC_KEYBOARD_ACCESSORY_ID}>
      <View style={[styles.bar, { backgroundColor: theme.surface1, borderTopColor: theme.border }]}>
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
          <Text style={[styles.doneText, { color: theme.series1 }]}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderTopWidth: 1,
  },
  doneText: { fontSize: 16, fontWeight: "600" },
});
