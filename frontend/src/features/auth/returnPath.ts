import type { User } from "../../lib/types";
import { routeAllowed, workspacePath } from "../demo/navigation";

export function loginReturnPath(state: unknown, role: User["role"]) {
  const fallback = ["admin", "reviewer"].includes(role) ? "/demo/reviewer/review" : "/demo/play";
  const path = workspacePath(returnPath(state, fallback));
  const pathname = path.split(/[?#]/, 1)[0];
  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    return routeAllowed(role === "annotator" ? "contributor" : role, pathname) ? path : fallback;
  }
  return path;
}

export function returnPath(state: unknown, fallback = "/demo/play") {
  const from = (state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
  const path = from?.pathname;
  if (!path?.startsWith("/") || path.startsWith("//") || path.includes("\\") || ["/login", "/register"].includes(path)) return fallback;
  return `${path}${from?.search ?? ""}${from?.hash ?? ""}`;
}
