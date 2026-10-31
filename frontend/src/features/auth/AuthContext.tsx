import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authApi, type LoginPayload, type RegisterPayload } from "../../api/auth";
import type { User } from "../../lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const CACHE_KEY = "auth.user";

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  try {
    if (user) localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable — fine, cache is best-effort */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hydrate from localStorage so a logged-in reload renders the user menu
  // immediately. /me runs in the background to validate the session.
  const [user, setUser] = useState<User | null>(() => readCachedUser());
  const [loading, setLoading] = useState<boolean>(() => readCachedUser() === null);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
      writeCachedUser(me);
    } catch {
      setUser(null);
      writeCachedUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      login: async (payload) => {
        const me = await authApi.login(payload);
        setUser(me);
        writeCachedUser(me);
      },
      register: async (payload) => {
        const me = await authApi.register(payload);
        setUser(me);
        writeCachedUser(me);
      },
      logout: async () => {
        await authApi.logout();
        setUser(null);
        writeCachedUser(null);
      },
    }),
    [user, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
