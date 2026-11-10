import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authApi, type LoginPayload, type RegisterPayload } from "../../api/auth";
import type { User } from "../../lib/types";
import axios from "axios";
import { SESSION_EXPIRED_EVENT } from "../../api/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sessionError: string | null;
  /** True after a signed-in session was rejected by the server (cookie expired). */
  expired: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Replace the signed-in user after a profile change confirmed by the server. */
  updateUser: (user: User) => void;
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
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setSessionError(null);
    try {
      const me = await authApi.me();
      setUser(me);
      writeCachedUser(me);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setUser(null);
        writeCachedUser(null);
      } else {
        setSessionError("Máy chủ chưa phản hồi nên chưa kiểm tra được phiên đăng nhập. Đợi ít phút rồi bấm Thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Any API call answered with 401 means the cookie is gone: drop the cached
  // user at once instead of showing a signed-in header that the server rejects.
  useEffect(() => {
    const onExpired = () => {
      // The cache mirrors `user`, so it tells us whether someone was signed in.
      if (readCachedUser()) setExpired(true);
      setUser(null);
      writeCachedUser(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      sessionError,
      expired,
      refresh,
      updateUser: (next) => {
        setUser(next);
        writeCachedUser(next);
      },
      login: async (payload) => {
        const me = await authApi.login(payload);
        setUser(me);
        setExpired(false);
        setSessionError(null);
        writeCachedUser(me);
      },
      register: async (payload) => {
        const me = await authApi.register(payload);
        setUser(me);
        setSessionError(null);
        writeCachedUser(me);
      },
      logout: async () => {
        await authApi.logout();
        setUser(null);
        writeCachedUser(null);
      },
    }),
    [user, loading, sessionError, expired, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
