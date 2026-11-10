import { describe, expect, it } from "vitest";
import { seed, consentDefault, SOURCED_KINDS } from "../src/features/demo/seed";
import { applyCommand, blankAnswer, examErrors } from "../src/features/demo/domain";
import { questionErrors } from "../src/features/demo/questionFormats";
import { addDatasetBank, SOURCED_SOURCE, UNVERIFIED_SOURCE } from "../src/features/demo/datasetBank";
import { dataset1Bank } from "../src/features/demo/dataset1Bank";
import type { DemoState } from "../src/features/demo/types";

const consent = { ...consentDefault(), collect: true };
const bankExams = (s: DemoState) => s.exams.filter((e) => e.id.startsWith("dataset1-bank-"));
function only(s: DemoState, id: string) {
  s.exams.forEach((e) => { e.status = e.id === id ? "active" : "closed"; });
  return s;
}
function finish(input: DemoState, id: string) {
  let s = input;
  for (let i = 0; i < 10; i++) {
    const q = s.sessions.find((x) => x.id === id)!.questions[i];
    s = applyCommand(s, { type: "answer", id, index: i, next: i + 1, answer: { ...blankAnswer(), text: q.accepted[0] ?? `Trả lời ${i}`, selectedOptionId: q.correctOptionId, meaning: `Nghĩa ${i}`, standard: `Phổ thông ${i}`, context: `Ngữ cảnh ${i}` } });
  }
  return applyCommand(s, { type: "submit", id, region: "Quảng Nam", upbringing: "Quảng Nam", usage: "" });
}

describe("Dataset1 question bank", () => {
  it("builds valid exams with sourced Q1–Q2 and unverified open Q3–Q10", () => {
    const s = seed();
    const exams = bankExams(s);
    expect(exams).toHaveLength(dataset1Bank.exams.length);
    for (const e of exams) {
      expect(e.layout).toBe("sourced2");
      expect(e.status).toBe("active");
      expect(examErrors(s, e)).toEqual([]);
      expect(examErrors(s, e, true).length).toBeGreaterThan(0);
      const qs = e.questionIds.map((id) => s.questions.find((q) => q.id === id)!);
      expect(qs.map((q) => q.kind)).toEqual(SOURCED_KINDS);
      expect(qs.slice(0, 2).map((q) => q.format)).toEqual(["choice", "fill"]);
      expect(qs.slice(0, 2).every((q) => q.provenance!.verification === "sourced" && q.sourceId === SOURCED_SOURCE)).toBe(true);
      expect(qs.slice(2).every((q) => q.format === "open" && q.provenance!.verification === "unverified" && q.sourceId === UNVERIFIED_SOURCE)).toBe(true);
    }
    for (const id of ["dataset1-daily", "dataset1-kitchen", "dataset1-context"]) expect(s.exams.find((e) => e.id === id)!.status).toBe("closed");
  });
  it("keeps every bank question well-formed and installs only once", () => {
    const s = seed();
    const bank = s.questions.filter((q) => q.id.startsWith("d1b-"));
    expect(bank.filter((q) => q.provenance!.verification === "sourced")).toHaveLength(dataset1Bank.sourced.length);
    for (const q of bank) expect(questionErrors(q)).toEqual([]);
    const count = s.questions.length;
    expect(addDatasetBank(s)).toBe(false);
    expect(s.questions).toHaveLength(count);
  });
  it("rotates Q1–Q2 through unseen sourced questions on each play", () => {
    let s = only(seed(), "dataset1-bank-01");
    const seen: string[] = [];
    for (const id of ["a", "b", "c"]) {
      s = applyCommand(s, { type: "start", id, examId: "dataset1-bank-01", consent, campaignId: "" });
      const session = s.sessions.find((x) => x.id === id)!;
      expect(session.questions.slice(0, 2).every((q) => q.provenance!.verification === "sourced")).toBe(true);
      expect(session.questions.slice(0, 2).map((q) => q.format)).toEqual(["choice", "fill"]);
      seen.push(...session.exam.questionIds.slice(0, 2));
      s = finish(s, id);
    }
    expect(new Set(seen).size).toBe(6);
  });
  it("turns only the unverified Q3–Q10 answers into traceable RAW samples", () => {
    let s = applyCommand(only(seed(), "dataset1-bank-01"), { type: "start", id: "p", examId: "dataset1-bank-01", consent, campaignId: "" });
    s = finish(s, "p");
    const samples = s.contributions.filter((c) => c.sessionId === "p");
    expect(samples.map((c) => c.id)).toEqual([3, 4, 5, 6, 7, 8, 9, 10].map((n) => `p:q${n}`));
    expect(samples.every((c) => c.sourceId === UNVERIFIED_SOURCE && c.status === "RAW")).toBe(true);
    expect(samples.filter((c) => c.raw.kind === "sentence").map((c) => c.id)).toEqual(["p:q6", "p:q7", "p:q10"]);
    const row = s.sessions[0].questions[2].provenance!.rowId;
    expect(samples[0].raw.evidence).toContain(`Dataset1 ${row} (chưa kiểm chứng)`);
    expect(s.sessions[0].answers.slice(0, 2).every((a) => a.attempts[0].correct === true)).toBe(true);
  });
});
