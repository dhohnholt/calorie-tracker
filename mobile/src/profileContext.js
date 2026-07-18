import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { initProfile, setCurrentProfileId } from "./profile";

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await initProfile();
        const list = await api.getProfiles();
        const initial = list.some((p) => p.id === stored) ? stored : list[0]?.id ?? null;
        if (initial) await setCurrentProfileId(initial);
        setProfiles(list);
        setActiveProfileId(initial);
      } catch (err) {
        setError(err.message);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const switchProfile = useCallback(async (id) => {
    await setCurrentProfileId(id);
    setActiveProfileId(id);
  }, []);

  const addProfile = useCallback(
    async (name) => {
      const created = await api.createProfile(name);
      setProfiles((prev) => [...prev, created]);
      await switchProfile(created.id);
      return created;
    },
    [switchProfile]
  );

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || null;

  return (
    <ProfileContext.Provider
      value={{ profiles, activeProfileId, activeProfile, ready, error, switchProfile, addProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfiles must be used within a ProfileProvider");
  return ctx;
}
