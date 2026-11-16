import { describe, expect, it } from "vitest";
import { adminGroupFor, adminGroups, navigationFor, routeAllowed } from "../src/features/demo/navigation";

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
  it("offers direct contributions and personal history while keeping management private", () => {
    expect(navigationFor("contributor").map(([p]) => p)).toEqual(["/demo", "/demo/play", "/demo/contribute", "/demo/history"]);
    expect(routeAllowed("contributor", "/demo/contribute")).toBe(true);
    expect(routeAllowed("contributor", "/demo/admin/datasets")).toBe(false);
  });
  it("gives old admin and reviewer the same three navigation groups", () => {
    expect(navigationFor("reviewer")).toEqual(navigationFor("admin"));
    expect(navigationFor("reviewer").map(([, label]) => label)).toEqual(["Duyệt", "Dữ liệu", "Cài đặt"]);
    for (const path of ["/demo/reviewer/review", "/demo/reviewer/datasets", "/demo/reviewer/settings", "/demo/reviewer/exams"]) {
      expect(routeAllowed("reviewer", path)).toBe(true);
      expect(routeAllowed("contributor", path)).toBe(false);
    }
    expect(adminGroupFor("/demo/reviewer/questions")?.label).toBe("Cài đặt");
    expect(adminGroupFor("/demo/reviewer/datasets")?.label).toBe("Dữ liệu");
    expect(adminGroupFor("/demo/reviewer/settings", "?section=sources")?.label).toBe("Dữ liệu");
    expect(adminGroups.flatMap(g => g.more).map(([path]) => path)).toContain("/demo/reviewer/operations");
  });
});
