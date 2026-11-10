import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AxiosError } from "axios";
import { authApi } from "../src/api/auth";
import { demoRoute } from "../src/features/demo/routes";
import { repository, DemoRepository, REGIONS_PACK } from "../src/features/demo/repository";
import { returnPath } from "../src/features/auth/returnPath";
import { DISTRICTS, REGION_CHOICES } from "../src/features/demo/regions";
import { applyCommand, gameAllocation } from "../src/features/demo/domain";
import { consentDefault, seed } from "../src/features/demo/seed";
import { openDB } from "idb";
import type { User } from "../src/lib/types";

const unauthorized = () => new AxiosError("Unauthorized", "ERR_BAD_REQUEST", undefined, undefined, { status: 401 } as never);
const user = (id: number): User => ({ id, email: `person${id}@example.com`, full_name: `Person ${id}`, role: "annotator", created_at: "2026-11-05T00:00:00Z", last_login_at: null });
afterEach(cleanup);
describe("required login and district selection", () => {
  it.each(["/demo/play?campaign=c1", "/demo/game/private", "/demo/history"])("redirects signed-out visitors from %s", async (path) => {
    await repository().reset(); vi.mocked(authApi.me).mockRejectedValue(unauthorized());
    localStorage.setItem("auth.user", JSON.stringify({ ...user(1), role: "admin" }));
    const router = createMemoryRouter([demoRoute, { path: "/login", element: <h1>Đăng nhập bắt buộc</h1> }], { initialEntries: [path] });
    render(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Đăng nhập bắt buộc" }, { timeout: 5000 }); // first case pays the lazy demo chunk import
    expect(router.state.location.state.from.pathname).toBe(path.split("?")[0]);
    expect((await repository().load()).sessions).toHaveLength(0);
  });
  it("does not accept a cached account when session verification fails", async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error("Offline"));
    localStorage.setItem("auth.user", JSON.stringify(user(1)));
    render(<RouterProvider router={createMemoryRouter([demoRoute], { initialEntries: ["/demo/play"] })} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("chưa kiểm tra được phiên đăng nhập");
    expect(screen.queryByRole("button", { name: "Bắt đầu chơi" })).not.toBeInTheDocument();
  });
  it("keeps the homepage public without a session", async () => {
    vi.mocked(authApi.me).mockRejectedValue(unauthorized());
    render(<RouterProvider router={createMemoryRouter([demoRoute], { initialEntries: ["/demo"] })} />);
    expect(await screen.findByRole("heading", { name: /Tiếng quê mình/ })).toBeInTheDocument();
  });
  it("isolates account history and disallows opening another account's session", async () => {
    const repo = new DemoRepository(crypto.randomUUID()); await repo.load();
    await repo.bindAccount(user(1));
    await repo.dispatch({ type: "autoStart", id: "a", campaignId: "", consent: { ...consentDefault(), collect: true } }, user(1));
    const account2 = await repo.bindAccount(user(2));
    expect(gameAllocation(account2, account2.actor).pending).toBeUndefined();
    await expect(repo.dispatch({ type: "moveSession", id: "a", cursor: 1 }, user(2))).rejects.toThrow("không thuộc");
    // A second tab changing the stored actor cannot change the owner of this account's new game.
    await repo.bindAccount(user(1));
    await repo.dispatch({ type: "autoStart", id: "b", campaignId: "", consent: { ...consentDefault(), collect: true } }, user(2));
    const state = await repo.load(); expect(state.sessions.find((s) => s.id === "b")!.owner).toBe("account:2");
    expect(gameAllocation(await repo.bindAccount(user(1)), "account:1").pending!.id).toBe("a");
  });
  it("updates district options without rewriting old answers or region metadata", async () => {
    const name = crypto.randomUUID(); const repo = new DemoRepository(name); let state = await repo.load();
    state = applyCommand(state, { type: "start", id: "legacy", examId: "exam-demo", campaignId: "", consent: { ...consentDefault(), collect: true } });
    state.sessions[0].region = "Quảng Nam"; state.regions = ["Quảng Nam", "Đà Nẵng"];
    state.installedPacks = state.installedPacks?.filter((x) => x !== REGIONS_PACK);
    const db = await openDB(name, 1); await db.put("state", state, "main");
    const migrated = await repo.load(); expect(migrated.regions).toEqual(DISTRICTS); expect(migrated.sessions).toEqual(state.sessions); db.close();
  });
  it("preserves local return destinations and rejects external redirects", () => {
    expect(returnPath({ from: { pathname: "/demo/play", search: "?campaign=c1" } })).toBe("/demo/play?campaign=c1");
    expect(returnPath({ from: { pathname: "//evil.example" } })).toBe("/demo/play");
  });
  it("lists Đà Nẵng and Quảng Nam units and lets an account say it is unsure", () => {
    expect(DISTRICTS).toHaveLength(25);
    expect(DISTRICTS).toContain("TP. Hội An");
    expect(REGION_CHOICES.at(-1)).toBe("Không chắc");
    let s = applyCommand(seed(), { type: "start", id: "s1", examId: "exam-demo", campaignId: "", consent: { ...consentDefault(), collect: true } });
    s.people.push({ ...s.people.find((p) => p.id === s.actor)!, id: "account:1" });
    s.sessions[0].owner = s.actor = "account:1";
    s = applyCommand(s, { type: "sessionMeta", id: "s1", region: "TP. Hội An", upbringing: "Không chắc", usage: "" });
    expect(s.sessions[0].upbringing).toBe("Không chắc");
    expect(() => applyCommand(s, { type: "sessionMeta", id: "s1", region: "Hà Nội", upbringing: "", usage: "" })).toThrow(/Không chắc/);
  });
});
