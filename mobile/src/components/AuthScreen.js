import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../authContext";
import { useTheme, radii } from "../theme";
import Screen from "./Screen";

export default function AuthScreen() {
  const theme = useTheme();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await signup(name, username, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Calorie Tracker</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {mode === "login" ? "Log in to your account" : "Create an account"}
        </Text>

        <View style={[styles.card, { backgroundColor: theme.surface1, borderColor: theme.border }]}>
          {mode === "signup" ? (
            <>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Display name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border }]}
                placeholder="e.g. David"
                placeholderTextColor={theme.textMuted}
                value={name}
                onChangeText={setName}
              />
            </>
          ) : null}

          <Text style={[styles.label, { color: theme.textSecondary, marginTop: mode === "signup" ? 12 : 0 }]}>
            Username
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border }]}
            placeholder="e.g. david"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />

          <Text style={[styles.label, { color: theme.textSecondary, marginTop: 12 }]}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                { backgroundColor: theme.pagePlane, color: theme.textPrimary, borderColor: theme.border },
              ]}
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable style={styles.passwordToggle} onPress={() => setShowPassword((v) => !v)}>
              <Text style={{ color: theme.series1, fontSize: 12, fontWeight: "600" }}>
                {showPassword ? "Hide" : "Show"}
              </Text>
            </Pressable>
          </View>

          {error ? <Text style={{ color: theme.statusCritical, marginTop: 12 }}>{error}</Text> : null}

          <Pressable
            style={[styles.submitButton, { backgroundColor: theme.series1 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            setMode((m) => (m === "login" ? "signup" : "login"));
            setError(null);
          }}
        >
          <Text style={[styles.switchLink, { color: theme.series1 }]}>
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: 20 },
  label: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 6 },
  passwordWrap: { marginTop: 6 },
  passwordInput: { marginTop: 0, paddingRight: 56 },
  passwordToggle: { position: "absolute", right: 10, top: 0, bottom: 0, justifyContent: "center", paddingHorizontal: 4 },
  submitButton: { borderRadius: radii.sm, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  submitButtonText: { color: "#fff", fontWeight: "700" },
  switchLink: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});
