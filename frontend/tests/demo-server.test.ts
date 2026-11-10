import { afterEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { apiClient } from "../src/api/client";
import { seed, blankRaw, consentDefault } from "../src/features/demo/seed";
import { execute, flush, merge, outbox, runsOnServer, SERVER_COMMANDS, type Snapshot } from "../src/features/demo/server";
import type { Contribution, DemoState } from "../src/features/demo/types";
import type { User } from "../src/lib/types";

const me: User = { id: 7, email: "a@example.test", full_name: "Người góp", role: "annotator", created_at: "2026-11-01T00:00:00Z", last_login_at: null };
const person = (id: number, role: "annotator" | "reviewer" | "admin" = "annotator") => ({
  id, full_name: `User ${id}`, role, account_status: "active", region: "Hội An", verified: false, risk: "clear" as const, review_region: "", appeal: "",
});
const serverItem = (id: number, extra: Record<string, unknown> = {}) => ({
  id, owner_id: 7, parent_id: null, source_id: 30 + id, status: "REVIEW" as const, withdrawn_at: null, created_at: "2026-11-09T01:02:03",
  raw: { kind: "word" as const, original_text: "mô", meaning: "đâu", standard_vi: "đâu", region: "Hội An", context: "đi mô", source_evidence: "nhà", response: "answer" as const, method: "game" },
  vote_count: 2, has_voted: false, votes: [], events: [{ action: "SUBMITTED", note: "ok", created_at: "2026-11-09T01:02:03" }],
  consent: { collect: true, train: true, public: false, audio: false, version: "demo-consent-v1" },
  meta: { session_ref: "session-1", duplicate_of: null, curated: null, sense_id: "", qa_audio: "" },
  ...extra,
});
function snap(extra: Partial<Snapshot> = {}): Snapshot {
  return {
    me: person(7), contributions: [serverItem(1)], sources: [{ id: 31, evidence: "nhà", rights_confirmed: true, title: "", public: false, audio: false }],
    people: [person(7)], releases: [], credits: [], feedback: [], reward_enabled: false, ...extra,
  };
}
function local(id: string, owner = "account:7", withdrawn = false): Contribution {
  return { id, owner, sessionId: null, parent: null, raw: { ...blankRaw(), text: "rứa" }, consent: { ...consentDefault(), collect: true },
    sourceId: "x", status: "RAW", createdAt: "", withdrawn, curated: null, senseId: null, qaAudio: "" };
}
function stateWith(contributions: Contribution[]): DemoState {
  return { ...seed(), contributions };
}
const httpError = (status: number) => new AxiosError("fail", "ERR", undefined, undefined,
  { status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: { detail: "Không hợp lệ" } });

afterEach(() => vi.restoreAllMocks());

describe("server snapshot merge", () => {
  it("replaces server collections, keeps the account's pending items and seals other votes", () => {
    const base = stateWith([local("seed-other", "member"), local("pending-1"), local("gone", "account:7", true)]);
    const s = merge(base, snap());
    expect(s.contributions.map((c) => c.id)).toEqual(["c:1", "pending-1"]);
    const c = s.contributions[0];
    expect(c).toMatchObject({ owner: "account:7", sourceId: "s:31", sessionId: "session-1", createdAt: "2026-11-09T01:02:03.000Z" });
    expect(c.raw).toMatchObject({ text: "mô", standard: "đâu", evidence: "nhà", method: "game" });
    // Two sealed placeholders: right count for eligibility, nobody's identity.
    expect(s.votes).toHaveLength(2);
    expect(s.votes.every((v) => v.reviewer === "sealed")).toBe(true);
    expect(s.actor).toBe("account:7");
    expect(s.people.map((p) => p.id)).toEqual(["guest", "account:7"]);
    expect(s.people[1].role).toBe("contributor");
    expect(s.events.some((e) => e.entity === "c:1" && e.action === "SUBMITTED")).toBe(true);
  });

  it("drops a pending copy once the server stored it under the same idempotency key", () => {
    const base = stateWith([local("session-1:q4"), local("still-pending")]);
    const s = merge(base, snap({ contributions: [serverItem(1, { client_ref: "session-1:q4" })] }));
    expect(s.contributions.map((c) => c.id)).toEqual(["c:1", "still-pending"]);
  });

  it("keeps local sources only while the question bank uses them", () => {
    const base = seed();
    const used = base.questions[0].sourceId;
    base.sources.push({ id: "orphan", title: "x", evidence: "", train: false, public: false, audio: false, demo: true });
    const s = merge(base, snap());
    expect(s.sources.some((x) => x.id === used)).toBe(true);
    expect(s.sources.some((x) => x.id === "orphan")).toBe(false);
    expect(s.sources.find((x) => x.id === "s:31")).toMatchObject({ train: true, demo: false, title: "Nguồn #31" });
  });

  it("maps curation, duplicates, credits and releases", () => {
    const item = serverItem(2, { status: "VERIFIED", meta: { session_ref: null, duplicate_of: 1, curated: { text: "mô (chuẩn)" }, sense_id: "mo", qa_audio: "pass" } });
    const s = merge(seed(), snap({
      contributions: [item],
      credits: [{ id: 5, user_id: 7, contribution_id: 2, amount: 5, used: 1, expires_at: "2026-12-09T00:00:00", revoked: false, created_at: "2026-11-09T00:00:00" }],
      releases: [{ id: 3, created_at: "2026-11-09T00:00:00", count: 1, checksum: "abc", ids: [2], splits: { "2": "dev" }, data_card: "card" }],
    }));
    const c = s.contributions[0];
    expect(c.curated?.text).toBe("mô (chuẩn)");
    expect(c.curated?.meaning).toBe("đâu");
    expect(c.duplicateOf).toBe("c:1");
    expect(s.credits[0]).toMatchObject({ id: "k:5", owner: "account:7", contributionId: "c:2" });
    expect(s.releases[0]).toMatchObject({ id: "r:3", ids: ["c:2"], dataCard: "card" });
    expect(s.releases[0].records[0].split).toBe("dev");
  });
});

describe("outbox flush", () => {
  it("sends pending items with their id as idempotency key and separates permanent failures", async () => {
    const state = stateWith([local("ok-item"), local("bad-item"), local("net-item"), local("other", "member")]);
    const post = vi.spyOn(apiClient, "post").mockImplementation(async (_url, body) => {
      const key = (body as { idempotency_key: string }).idempotency_key;
      if (key === "bad-item") throw httpError(422);
      if (key === "net-item") throw new AxiosError("Network Error");
      return { data: {} };
    });
    const result = await flush(state, 7);
    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls[0][1]).toMatchObject({ original_text: "rứa", consent_collect: true, consent_version: "demo-consent-v1", idempotency_key: "ok-item" });
    expect(result.rejected.map((r) => r.id)).toEqual(["bad-item"]);
    expect(result.pending).toBeTruthy();
    expect(outbox(state, 7)).toHaveLength(3);
  });
});

describe("command routing", () => {
  it("sends every server-owned command to the API and keeps game/question-bank work local", () => {
    const source = { id: "s:3", title: "x", evidence: "y", train: true, public: false, audio: false, demo: false };
    expect(runsOnServer({ type: "source", source })).toBe(true);
    expect(runsOnServer({ type: "source", source: { ...source, id: "dataset1-source" } })).toBe(false);
    for (const type of ["vote", "decide", "curate", "consent", "person", "feedback", "resolve", "grant", "revoke", "spend", "release", "rewardPolicy", "appeal"] as const)
      expect(SERVER_COMMANDS.has(type)).toBe(true);
    for (const type of ["start", "answer", "submit", "contribute", "question", "exam", "campaign", "task", "draft"] as const)
      expect(SERVER_COMMANDS.has(type)).toBe(false);
  });
});

describe("server commands", () => {
  it("translates reviews, roles and releases into API calls", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} });
    const put = vi.spyOn(apiClient, "put").mockResolvedValue({ data: {} });
    const state = merge(seed(), snap({ people: [person(7), person(8, "reviewer"), person(9, "admin")] }));

    await execute({ type: "vote", id: "c:1", verdict: "VERIFIED", checks: [true, true, false, true], note: "ok" }, state, me);
    expect(post).toHaveBeenLastCalledWith("/dialect/reviews/1/votes", { verdict: "VERIFIED", meaning_ok: true, region_ok: true, context_ok: false, translation_ok: true, note: "ok" });

    const reviewer = state.people.find((p) => p.id === "account:8")!;
    await execute({ type: "person", person: { ...reviewer, role: "contributor", region: "Đà Nẵng" } }, state, me);
    expect(put).toHaveBeenLastCalledWith("/dialect/participants/8", { verified: false, risk: "clear", review_region: "Đà Nẵng", role: "annotator" });
    await expect(execute({ type: "person", person: { ...reviewer, role: "admin" } }, state, me)).rejects.toThrow(/admin/);

    await execute({ type: "release", release: { id: "x", ids: ["c:1"], records: [{ id: "c:1", raw: blankRaw(), split: "test" }], checksum: "", at: "", dataCard: "card" } }, state, me);
    expect(post).toHaveBeenLastCalledWith("/dialect/releases", { ids: [1], splits: { "1": "test" }, data_card: "card" });
  });

  it("refuses local-only ids and account switching", async () => {
    const state = stateWith([local("pending-1")]);
    await expect(execute({ type: "consent", id: "pending-1", consent: consentDefault(), withdraw: true }, state, me)).rejects.toThrow(/chờ đồng bộ/);
    await expect(execute({ type: "actor", id: "member" }, state, me)).rejects.toThrow(/tài khoản thật/);
    await expect(execute({ type: "spend", owner: "account:99", amount: 1 }, state, me)).rejects.toThrow(/người khác/);
  });
});

describe("server game allocation", () => {
  it("sends the runnable exams and starts the exam the server picked", async () => {
    const { allocate } = await import("../src/features/demo/server");
    const { applyCommand, gameAllocation } = await import("../src/features/demo/domain");
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: { session_ref: "p1", exam_id: "dataset1-bank-30", plays: 0, repeat: false } });
    const state = seed();
    const local = gameAllocation(state, state.actor);
    expect(local.exam!.id).toBe("dataset1-bank-01"); // per-browser fallback
    const picked = await allocate("p1", local.pool.map((e) => e.id), local.played, "");
    expect(post).toHaveBeenCalledWith("/dialect/allocation", expect.objectContaining({ session_ref: "p1", played: [], campaign_id: "" }));
    expect((post.mock.calls[0][1] as { exam_ids: string[] }).exam_ids).toContain("dataset1-bank-47");
    const next = applyCommand(state, { type: "autoStart", id: "p1", consent: { ...consentDefault(), collect: true }, campaignId: "", examId: picked.exam_id });
    expect(next.sessions[0].exam.id).toBe("dataset1-bank-30");
    // A pick the browser can no longer run falls back to the local balance.
    const closed = applyCommand(state, { type: "autoStart", id: "p2", consent: { ...consentDefault(), collect: true }, campaignId: "", examId: "dataset1-daily" });
    expect(closed.sessions[0].exam.id).toBe("dataset1-bank-01");
  });
});
