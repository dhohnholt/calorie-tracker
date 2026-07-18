import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setUnauthorizedHandler } from "./api";
import { initAuth, getToken, setToken, clearToken } from "./auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState(null);

  const resetToLoggedOut = useCallback(() => {
    setMe(null);
    setReady(true);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(resetToLoggedOut);
  }, [resetToLoggedOut]);

  useEffect(() => {
    (async () => {
      await initAuth();
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        const profile = await api.getMe();
        setMe(profile);
      } catch {
        // getMe's 401 already cleared the token via the unauthorized handler.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = useCallback(async (username, password) => {
    const { token, profile } = await api.login(username, password);
    await setToken(token);
    setMe(profile);
  }, []);

  const signup = useCallback(async (name, username, password) => {
    const { token, profile } = await api.signup(name, username, password);
    await setToken(token);
    setMe(profile);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Already logged out server-side (e.g. expired session) — fine, we're
      // clearing local state regardless.
    }
    await clearToken();
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider value={{ ready, me, authenticated: !!me, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
