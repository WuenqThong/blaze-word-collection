import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../src/api/client";
import { authApi } from "../src/api/auth";
import { DemoProvider } from "../src/features/demo/DemoProvider";
import { useDemo } from "../src/features/demo/context";
import { repository } from "../src/features/demo/repository";
import { seed, blankRaw, consentDefault } from "../src/features/demo/seed";
import { SyncItem } from "../src/features/demo/SyncStatus";
import type { User } from "../src/lib/types";
import type { Command, Contribution } from "../src/features/demo/types";

vi.mock("../src/features/demo/server", async (original) => ({ ...await original<typeof import("../src/features/demo/server")>(), SERVER_ENABLED: true }));

const user = (id: number): User => ({ id, email: `${id}@example.test`, full_name: `User ${id}`, role: "annotator", created_at: "2026-11-01T00:00:00Z", last_login_at: null });
const a = user(7), b = user(8);
function pending(id: string, account: number): Contribution {
  return { id, owner: `account:${account}`, sessionId: null, parent: null, sourceId: "local-source", raw: { ...blankRaw(), text: id }, consent: { ...consentDefault(), collect: true, train: true }, status: "RAW", createdAt: "2026-11-01T00:00:00Z", withdrawn: false, curated: null, senseId: null, qaAudio: "" };
}
function workspace(id: number) {
  return { me: { id, full_name: `User ${id}`, role: "annotator", account_status: "active", region: "", verified: false, risk: "clear", review_region: "", appeal: "" }, contributions: [], sources: [], people: [], releases: [], credits: [], feedback: [], reward_enabled: false, next_cursor: null };
}
function Probe() {
  const { state, refresh, run } = useDemo();
  const guarded: Command[] = [
    { type: "start", id: "guarded-start", examId: "exam-demo", campaignId: "", consent: consentDefault() },
    { type: "autoStart", id: "guarded-auto", campaignId: "", consent: consentDefault() },
    { type: "submit", id: "guarded-submit", region: "", upbringing: "", usage: "" },
    { type: "contribute", id: "guarded-contribute", raw: blankRaw(), consent: consentDefault(), parent: null },
  ];
  return <>{guarded.map((command) => <button key={command.type} onClick={() => void run(command).catch(() => {})}>{command.type} guard probe</button>)}<div data-testid="actor">{state.actor}</div><div data-testid="items">{state.contributions.map((c) => c.id).join(",")}</div><button onClick={() => void refresh().catch(() => {})}>Refresh probe</button><button onClick={() => void run({ type: "draft", key: `${state.actor}.word.`, raw: { ...blankRaw(), text: "offline draft" }, consent: consentDefault(), parent: null }).catch(() => {})}>Save offline draft</button>{state.contributions.filter(c => c.owner === state.actor && !c.id.startsWith("c:")).map(c => <SyncItem key={c.id} c={c} />)}</>;
}
beforeEach(async () => {
  const repo = repository(true);
  await repo.replace(() => ({ ...seed(), contributions: [pending("old-a", 7), pending("old-b", 8)] }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("account-bound durable synchronization", () => {
  it("does not auto-upload restored items, persists approval outcomes, and keeps other account RAW", async () => {
    vi.spyOn(authApi, "me").mockResolvedValue(a);
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: workspace(7) });
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} });
    render(<DemoProvider account={a}><Probe /></DemoProvider>);
    await screen.findByTestId("actor");
    await waitFor(() => expect(screen.getByRole("button", { name: "Xác nhận gửi nguyên bản" })).toBeTruthy());
    expect(post).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Đồng bộ dữ liệu" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận gửi nguyên bản", exact: true }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    await waitFor(async () => expect((await repository().load()).contributions.find((c) => c.id === "old-a")?.sync?.status).toBe("accepted"));
    expect((await repository().load()).contributions.find((c) => c.id === "old-b")?.raw.text).toBe("old-b");
    expect(screen.getByTestId("items").textContent).not.toContain("old-b");
  });
  it("keeps local writes available when authentication refresh is offline", async () => {
    const auth = vi.spyOn(authApi, "me").mockResolvedValue(a);
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: workspace(7) });
    render(<DemoProvider account={a}><Probe /></DemoProvider>);
    await waitFor(async () => expect((await repository().load()).serverAccountId).toBe(7));
    await screen.findByRole("button", { name: "Save offline draft" });
    auth.mockRejectedValue(new Error("offline"));
    fireEvent.click(await screen.findByRole("button", { name: "Save offline draft" }));
    await waitFor(async () => expect((await repository().load()).drafts.find((d) => d.key === "account:7.word.")?.raw.text).toBe("offline draft"));
  });
  it.each(["start", "autoStart", "submit", "contribute"])("checks current cookie owner before %s even before the binding changes", async (kind) => {
    const auth = vi.spyOn(authApi, "me").mockResolvedValue(a);
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: workspace(7) });
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} });
    render(<DemoProvider account={a}><Probe /></DemoProvider>);
    await waitFor(async () => expect((await repository().load()).serverAccountId).toBe(7));
    await screen.findByRole("button", { name: `${kind} guard probe` });
    const before = await repository().load();
    const calls = auth.mock.calls.length;
    auth.mockResolvedValue(b);
    fireEvent.click(await screen.findByRole("button", { name: `${kind} guard probe` }));
    await waitFor(() => expect(auth.mock.calls.length).toBe(calls + 1));
    await act(async () => { await Promise.resolve(); });
    const after = await repository().load();
    expect(after.sessions).toEqual(before.sessions);
    expect(after.contributions).toEqual(before.contributions);
    expect(post).not.toHaveBeenCalled();
  });
  it("ignores a late workspace response after switching accounts", async () => {
    let resolve!: (value: { data: ReturnType<typeof workspace> }) => void;
    let current = a;
    vi.spyOn(authApi, "me").mockImplementation(async () => current);
    const get = vi.spyOn(apiClient, "get").mockImplementationOnce(() => new Promise((r) => { resolve = r; })).mockImplementation(async () => ({ data: workspace(current.id) }));
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} });
    const { rerender } = render(<DemoProvider account={a}><Probe /></DemoProvider>);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    current = b;
    rerender(<DemoProvider account={b}><Probe /></DemoProvider>);
    await act(async () => { resolve({ data: workspace(7) }); });
    await waitFor(() => expect(screen.getByTestId("actor").textContent).toBe("account:8"));
    await waitFor(async () => expect((await repository().load()).serverAccountId).toBe(8));
    expect(screen.getByTestId("items").textContent).toBe("old-b");
    expect(post).not.toHaveBeenCalled();
    expect((await repository().load()).contributions.some((c) => c.id === "old-a")).toBe(true);
  });
});
