import { useState } from "react";
import { api } from "../api";
import { setToken } from "../auth";

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token, profile } =
        mode === "login" ? await api.login(username, password) : await api.signup(name, username, password);
      setToken(token);
      onAuthenticated(profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="card auth-screen__card">
        <h1 className="auth-screen__title">Calorie Tracker</h1>
        <p className="auth-screen__subtitle">
          {mode === "login" ? "Log in to your account" : "Create an account"}
        </p>

        <form onSubmit={handleSubmit} className="settings-form">
          {mode === "signup" && (
            <label>
              Display name
              <input
                type="text"
                placeholder="e.g. David"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          )}
          <label>
            Username
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="e.g. david"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <div className="auth-screen__password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-screen__password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error ? <p className="auth-screen__error">{error}</p> : null}

          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        <button
          type="button"
          className="auth-screen__switch"
          onClick={() => {
            setMode((m) => (m === "login" ? "signup" : "login"));
            setError(null);
          }}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
