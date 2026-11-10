export function returnPath(state: unknown, fallback = "/demo/play") {
  const from = (state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
  const path = from?.pathname;
  if (!path?.startsWith("/") || path.startsWith("//") || path.includes("\\") || ["/login", "/register"].includes(path)) return fallback;
  return `${path}${from?.search ?? ""}${from?.hash ?? ""}`;
}
