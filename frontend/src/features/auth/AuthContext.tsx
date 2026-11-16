import { createContext, useContext } from "react";
import type { LoginPayload, RegisterPayload } from "../../api/auth";
import type { User } from "../../lib/types";
export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sessionError: string | null;
  /** True after a signed-in session was rejected by the server (cookie expired). */
  expired: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Replace the signed-in user after a profile change confirmed by the server. */
  updateUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
