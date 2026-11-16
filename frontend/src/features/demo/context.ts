import { createContext, useContext, type Context } from "react";
import type { Command, DemoState } from "./types";
export interface DemoContextValue {
  state: DemoState;
  refresh: () => Promise<void>;
  syncAction: (id: string | null, action: "retry" | "discard" | "approve") => Promise<void>;
  run: (command: Command) => Promise<DemoState>;
  error: string | null;
  clearError: () => void;
  /** True when a signed-in account is bound: contributions, reviews, sources,
   *  releases, people, credits and feedback come from the server. */
  live: boolean;
}
// React Router caches lazy route consumers across development hot updates.
// Keep the provider and those consumers bound to the same context instance.
const hot = import.meta.hot;
export const DemoContext: Context<DemoContextValue | null> =
  hot?.data.demoContext ?? createContext<DemoContextValue | null>(null);
if (hot) hot.data.demoContext = DemoContext;
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw Error("Thiếu DemoProvider.");
  return value;
}
