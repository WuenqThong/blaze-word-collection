import { describe, expect, it } from "vitest";
import { matchRoutes, type RouteObject } from "react-router-dom";
import { pilotRoutes } from "../src/lib/pilotRoutes";

const routes: RouteObject[] = [{ path: "/", children: [
  { path: "demo", children: [{ path: "history" }, { path: "admin/review" }, { path: "game/:id" }] },
  { children: [
    ...["legacy", "legacy/audio", "legacy/settings", "projects", "projects/new", "projects/:id/annotate",
      "roleplay", "roleplay/:id", "rewards", "history", "withdrawals", "admin/review", "admin/flagged",
      "admin/withdrawals", "admin/reports", "contribute/new", "review", "admin/contributions",
      "admin/datasets", "settings"].map((path) => ({ path })),
  ] },
] }];

describe("pilot route scope", () => {
  it("removes direct legacy routes, including nested admin and project routes", () => {
    for (const path of ["/legacy", "/legacy/audio", "/legacy/settings", "/projects", "/projects/new",
      "/projects/1/annotate", "/roleplay", "/roleplay/1", "/rewards", "/history", "/withdrawals",
      "/admin/review", "/admin/flagged", "/admin/withdrawals", "/admin/reports"]) {
      expect(matchRoutes(pilotRoutes(routes, false), path), path).toBeNull();
    }
  });
  it("keeps game history, dialect review, contribution, dataset and profile routes", () => {
    for (const path of ["/demo/history", "/demo/admin/review", "/demo/game/1", "/contribute/new",
      "/review", "/admin/contributions", "/admin/datasets", "/settings"]) {
      expect(matchRoutes(pilotRoutes(routes, false), path), path).not.toBeNull();
    }
  });
  it("retains legacy routes only when explicitly enabled", () => {
    expect(matchRoutes(pilotRoutes(routes, true), "/projects/1/annotate")).not.toBeNull();
  });
});
