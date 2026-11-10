import { describe, expect, it } from "vitest";
import { seed, consentDefault } from "../src/features/demo/seed";
import { applyCommand, blankAnswer, gameAllocation, eligible, publiclyVisible } from "../src/features/demo/domain";
import { DemoRepository } from "../src/features/demo/repository";
import type { DemoState } from "../src/features/demo/types";
const consent = { ...consentDefault(), collect: true };
function complete(input: DemoState, id: string) {
  let state = input;
  for (let i = 0; i < 10; i++) {
    const q = state.sessions.find((s) => s.id === id)!.questions[i];
    state = applyCommand(state, { type: "answer", id, index: i, next: i + 1, answer: { ...blankAnswer(), text: q.accepted[0] ?? `Nội dung đóng góp ${i}`, selectedOptionId: q.correctOptionId, meaning: `Nghĩa ${i}`, standard: `Phổ thông ${i}`, context: `Ngữ cảnh ${i}` } });
  }
  return applyCommand(state, { type: "submit", id, region: "Quảng Nam", upbringing: "Quảng Nam", usage: "Quảng Nam" });
}
describe("automatic game allocation", () => {
  it("cycles through three unseen exams before marking a repeat", () => {
    let state = seed(); const assigned = [];
    const open = ["dataset1-bank-01", "dataset1-bank-02", "dataset1-bank-03"];
    state.exams.forEach((e) => { if (!open.includes(e.id)) e.status = "closed"; });
    for (let i = 0; i < 4; i++) {
      state = applyCommand(state, { type: "autoStart", id: `play${i}`, campaignId: "", consent });
      const session = state.sessions.at(-1)!; assigned.push(session.exam.id);
      expect(session.repeat).toBe(i === 3);
      state = complete(state, session.id);
    }
    expect(new Set(assigned.slice(0, 3)).size).toBe(3);
    expect(assigned).not.toContain("exam-demo");
  });
  it("balances valid exams, but prioritizes the person's incomplete coverage", () => {
    const state = applyCommand(seed(), { type: "autoStart", id: "other", campaignId: "", consent });
    const taken = state.sessions[0].exam.id; state.sessions[0].owner = "someone-else";
    expect(gameAllocation(state, state.actor).exam!.id).not.toBe(taken);
    state.sessions[0].state = "submitted";
    state.sessions[0].submittedAt = new Date().toISOString();
    state.sessions[0].owner = state.actor;
    expect(gameAllocation(state, state.actor).exam!.id).not.toBe(taken);
  });
  it("reuses pending sessions, even when their exam has since closed", () => {
    let state = applyCommand(seed(), { type: "autoStart", id: "one", campaignId: "", consent });
    const snapshot = structuredClone(state.sessions[0]);
    state.exams.find((e) => e.id === snapshot.exam.id)!.status = "closed";
    state = applyCommand(state, { type: "autoStart", id: "two", campaignId: "", consent });
    expect(state.sessions).toEqual([snapshot]);
  });
  it("honors campaign restrictions and rejects inactive campaign links", () => {
    const state = seed();
    state.campaigns.push({ id: "one-exam", title: "Campaign", examIds: ["dataset1-bank-02"], region: "Quảng Nam", topic: "Ẩm thực", active: true, mode: "standard" });
    expect(gameAllocation(state, state.actor, "one-exam").exam!.id).toBe("dataset1-bank-02");
    state.campaigns.at(-1)!.active = false;
    expect(() => applyCommand(state, { type: "autoStart", id: "no", campaignId: "one-exam", consent })).toThrow();
  });
  it("serializes simultaneous starts into a single session", async () => {
    const repo = new DemoRepository(crypto.randomUUID()); await repo.load();
    await Promise.all(["first", "second"].map((id) => repo.dispatch({ type: "autoStart", id, campaignId: "", consent })));
    expect((await repo.load()).sessions).toHaveLength(1);
  });
  it("retains duplicate raw answers outside the new queue and export eligibility", () => {
    let state = seed();
    for (const id of ["first", "second"]) {
      state = applyCommand(state, { type: "start", id, examId: "exam-demo", campaignId: "", consent });
      state = complete(state, id);
    }
    const duplicate = state.contributions.find((c) => c.id === "second:q9")!;
    expect(duplicate.duplicateOf).toBe("first:q9"); expect(duplicate.status).toBe("HOLD");
    expect(state.sessions[1].answers).toHaveLength(10); expect(state.sessions[1].repeat).toBe(true);
    expect(eligible(state, duplicate)).toBe(false); expect(publiclyVisible(state, duplicate)).toBe(false);
    const before = state.contributions.length;
    state = applyCommand(state, { type: "submit", id: "second", region: "Quảng Nam", upbringing: "Quảng Nam", usage: "Quảng Nam" });
    expect(state.contributions).toHaveLength(before);
  });
});
