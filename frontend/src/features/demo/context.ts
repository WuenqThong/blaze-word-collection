import { createContext, useContext } from "react";
import type { Command, DemoState } from "./types";
export interface DemoContextValue {
  state: DemoState;
  run: (command: Command) => Promise<DemoState>;
  error: string | null;
  clearError: () => void;
  /** True when a signed-in account is bound: contributions, reviews, sources,
   *  releases, people, credits and feedback come from the server. */
  live: boolean;
}
export const DemoContext = createContext<DemoContextValue | null>(null);
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw Error("Thiếu DemoProvider.");
  return value;
}
