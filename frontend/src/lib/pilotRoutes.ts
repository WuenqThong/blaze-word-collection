import type { RouteObject } from "react-router-dom";

export const LEGACY_ENABLED = import.meta.env.VITE_ENABLE_LEGACY === "on";

const legacyPath = /^\/(?:legacy|projects|roleplay|rewards|history|withdrawals|admin\/(?:review|flagged|withdrawals|reports))(?:\/|$)/;

export function pilotRoutes(routes: RouteObject[], enabled = LEGACY_ENABLED, parent = ""): RouteObject[] {
  if (enabled) return routes;
  return routes.flatMap((route): RouteObject[] => {
    const path = route.path?.startsWith("/") ? route.path : `${parent}/${route.path ?? ""}`.replace(/\/+/g, "/");
    if (legacyPath.test(path)) return [];
    if (route.children) return [{ ...route, children: pilotRoutes(route.children, enabled, path) }];
    return [route];
  });
}
