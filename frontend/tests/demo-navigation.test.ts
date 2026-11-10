import { describe, expect, it } from "vitest";
import { navigationFor, routeAllowed } from "../src/features/demo/navigation";

describe("role navigation and direct-route scope", () => {
  it("keeps guests focused on home and game without exposing extensions", () => {
    expect(navigationFor("guest")).toHaveLength(2);
    expect(routeAllowed("guest", "/demo/game/abc")).toBe(true);
    expect(routeAllowed("guest", "/demo/history")).toBe(true);
    for (const path of ["/demo/ai", "/demo/contribute", "/demo/campaigns", "/demo/admin/sessions", "/demo/admin/review"])
      expect(routeAllowed("guest", path)).toBe(false);
  });
  it("opens the profile page to every role (sign-in is enforced by the layout)", () => {
    for (const role of ["contributor", "reviewer", "admin"] as const) expect(routeAllowed(role, "/demo/account")).toBe(true);
  });
  it("adds only personal history for contributors", () => {
    expect(navigationFor("contributor").map(([p]) => p)).toEqual(["/demo", "/demo/play", "/demo/history"]);
    expect(routeAllowed("contributor", "/demo/admin/datasets")).toBe(false);
  });
  it("restricts reviewer routes to the queue and rights", () => {
    expect(navigationFor("reviewer")).toHaveLength(2);
    expect(routeAllowed("reviewer", "/demo/admin/review")).toBe(true);
    for (const path of ["/demo/admin/dashboard", "/demo/admin/sessions", "/demo/admin/questions", "/demo/admin/import", "/demo/admin/settings"])
      expect(routeAllowed("reviewer", path)).toBe(false);
  });
  it("groups admin navigation while retaining extension routes", () => {
    expect(navigationFor("admin")).toHaveLength(5);
    expect(routeAllowed("admin", "/demo/admin/operations")).toBe(true);
    expect(routeAllowed("admin", "/demo/ai")).toBe(true);
  });
});
