import { describe, it, expect } from "vitest";
import {
  applyCommand,
  blankAnswer,
  canAdvance,
  eligible,
  publiclyVisible,
  splitRecords,
} from "../src/features/demo/domain";
import { seed, blankRaw } from "../src/features/demo/seed";
import type {
  Command,
  Contribution,
  DemoState,
} from "../src/features/demo/types";
const consent = {
  collect: true,
  train: true,
  public: true,
  audio: false,
  version: "demo-consent-v1",
};
function send(s: DemoState, ...commands: Command[]) {
  return commands.reduce(applyCommand, s);
}
function sample(s: DemoState, id = "c1") {
  return send(s, {
    type: "contribute",
    id,
    raw: {
      ...blankRaw(),
      text: "Từ minh họa",
      meaning: "Nghĩa minh họa",
      standard: "Bản phổ thông",
      context: "Ngữ cảnh tự soạn",
      evidence: "Nguồn demo",
    },
    consent,
    parent: null,
    sourceId: "source-demo",
  });
}
function reviewed(s: DemoState, id = "c1") {
  s = send(
    s,
    { type: "actor", id: "reviewer-a" },
    {
      type: "vote",
      id,
      verdict: "VERIFIED",
      checks: [true, true, true, true],
      note: "Phiếu độc lập A",
    },
    { type: "actor", id: "reviewer-b" },
    {
      type: "vote",
      id,
      verdict: "VERIFIED",
      checks: [true, true, true, true],
      note: "Phiếu độc lập B",
    },
    {
      type: "curate",
      id,
      raw: s.contributions.find((c) => c.id === id)!.raw,
      senseId: "sense-1",
      qaAudio: "",
    },
  );
  return s;
}
describe("10-question game invariants", () => {
  it("does not accept drafts as submitted answers or keep a stale gate score after editing", () => {
    let s = send(seed(), {
      type: "start",
      id: "drafts",
      examId: "exam-demo",
      consent,
      campaignId: "",
    });
    for (let index = 0; index < 10; index++) {
      s = send(s, {
        type: "draftAnswer",
        id: "drafts",
        index,
        answer: {
          ...blankAnswer(),
          text: "Nháp",
          meaning: "Nghĩa",
          standard: "Phổ thông",
          context: "Ngữ cảnh",
        },
      });
    }
    expect(() =>
      send(s, {
        type: "submit",
        id: "drafts",
        region: "Quảng Nam",
        upbringing: "Quảng Nam",
        usage: "Quảng Nam",
      }),
    ).toThrow(/10 câu/);
    s.sessions[0].exam.mode = "strict";
    for (let index = 0; index < 3; index++) {
      s = send(s, {
        type: "answer",
        id: "drafts",
        index,
        answer: {
          ...blankAnswer(),
          text: s.sessions[0].questions[index].accepted[0],
        },
        next: index + 1,
      });
    }
    expect(canAdvance(s.sessions[0], 3)).toBe(true);
    s = send(s, {
      type: "draftAnswer",
      id: "drafts",
      index: 0,
      answer: {
        ...s.sessions[0].answers[0],
        text: "Đổi thành đáp án chưa gửi",
      },
    });
    expect(canAdvance(s.sessions[0], 3)).toBe(false);
    expect(s.sessions[0].answers[0].attempts).toHaveLength(1);
  });
  it("finishes all ten slots, preserves skip/attempts, is idempotent and gives no credits", () => {
    let s = send(seed(), {
      type: "start",
      id: "session-1",
      examId: "exam-demo",
      consent,
      campaignId: "",
    });
    s = send(s, {
      type: "start",
      id: "session-1",
      examId: "exam-demo",
      consent,
      campaignId: "",
    });
    expect(s.sessions).toHaveLength(1);
    for (let i = 0; i < 10; i++)
      s = send(s, {
        type: "answer",
        id: "session-1",
        index: i,
        answer: {
          ...blankAnswer(),
          text: i === 3 ? "" : `Đáp án ${i}`,
          meaning: "Nghĩa",
          standard: "Phổ thông",
          context: "Ngữ cảnh",
          skipped: i === 3,
        },
        next: i + 1,
      });
    s = send(s, {
      type: "submit",
      id: "session-1",
      region: "Quảng Nam",
      upbringing: "Không chắc",
      usage: "Quảng Nam",
    });
    const after = s.contributions.length;
    s = send(s, {
      type: "submit",
      id: "session-1",
      region: "Quảng Nam",
      upbringing: "Không chắc",
      usage: "Quảng Nam",
    });
    expect(s.sessions[0].answers).toHaveLength(10);
    expect(s.sessions[0].answers[3].skipped).toBe(true);
    expect(s.sessions[0].answers.every((a) => a.attempts.length === 1)).toBe(
      true,
    );
    expect(s.sessions[0].state).toBe("submitted");
    expect(s.contributions).toHaveLength(after);
    expect(s.credits).toHaveLength(0);
    expect(s.contributions.every((c) => c.status === "RAW")).toBe(true);
  });
  it("strict gate stores wrong attempts and blocks forward navigation until 3/3", () => {
    let s = seed();
    s.exams[0].mode = "strict";
    s = send(s, {
      type: "start",
      id: "strict",
      examId: "exam-demo",
      consent,
      campaignId: "",
    });
    s = send(s, {
      type: "answer",
      id: "strict",
      index: 2,
      answer: { ...blankAnswer(), text: "sai" },
      next: 3,
    });
    expect(s.sessions[0].cursor).toBe(2);
    expect(s.sessions[0].answers[2].attempts[0].correct).toBe(false);
    expect(canAdvance(s.sessions[0], 3)).toBe(false);
    expect(() =>
      send(s, { type: "moveSession", id: "strict", cursor: 3 }),
    ).toThrow();
    for (let i = 0; i < 3; i++)
      s = send(s, {
        type: "answer",
        id: "strict",
        index: i,
        answer: {
          ...blankAnswer(),
          text: s.sessions[0].questions[i].accepted.at(-1)!,
        },
        next: i + 1,
      });
    expect(canAdvance(s.sessions[0], 3)).toBe(true);
    expect(s.sessions[0].answers[2].attempts).toHaveLength(2);
  });
  it("keeps session snapshot when questions change and closed campaigns reject new starts", () => {
    let s = send(seed(), {
      type: "start",
      id: "a",
      examId: "exam-demo",
      consent,
      campaignId: "",
    });
    const prompt = s.sessions[0].questions[0].prompt;
    s.questions[0].prompt = "changed outside snapshot";
    expect(s.sessions[0].questions[0].prompt).toBe(prompt);
    s = send(
      s,
      { type: "actor", id: "admin" },
      { type: "closeExam", id: "exam-demo" },
    );
    expect(() =>
      send(s, {
        type: "start",
        id: "b",
        examId: "exam-demo",
        consent,
        campaignId: "",
      }),
    ).toThrow();
    s = send(
      s,
      { type: "actor", id: "guest" },
      {
        type: "draftAnswer",
        id: "a",
        index: 0,
        answer: { ...blankAnswer(), text: "vẫn làm được" },
      },
    );
    expect(s.sessions[0].answers[0].text).toBe("vẫn làm được");
  });
  it("prevents real publication of demo gold, malformed exams and editing published questions", () => {
    let s = send(seed(), { type: "actor", id: "admin" });
    expect(() =>
      send(s, { type: "publish", id: "exam-demo", real: true }),
    ).toThrow(/thu thật/);
    expect(() =>
      send(s, {
        type: "question",
        question: { ...s.questions[0], prompt: "overwrite" },
      }),
    ).toThrow(/nhân bản/);
    s = send(s, {
      type: "exam",
      exam: {
        ...s.exams[0],
        id: "broken",
        status: "draft",
        questionIds: ["q1"],
      },
    });
    expect(() =>
      send(s, { type: "publish", id: "broken", real: false }),
    ).toThrow(/10 câu/);
  });
  it("rotates calibration questions and chooses harder unseen questions in adaptive mode", () => {
    let s = send(seed(), {
      type: "start",
      id: "one",
      examId: "exam-demo",
      consent,
      campaignId: "",
    });
    const first = s.sessions[0].questions[0].id;
    s = send(s, {
      type: "start",
      id: "two",
      examId: "exam-demo",
      consent,
      campaignId: "",
    });
    expect(s.sessions[1].questions[0].id).not.toBe(first);
    s.sessions[0].answers[0].attempts = [
      { text: "đạt", correct: true, at: new Date().toISOString() },
    ];
    s.questions.push({ ...s.questions[0], id: "hard", difficulty: 2 });
    s.exams[0].adaptive = true;
    s = send(s, {
      type: "start",
      id: "three",
      examId: "exam-demo",
      consent,
      campaignId: "",
    });
    expect(s.sessions[2].questions[0].id).toBe("hard");
    expect(new Set(s.sessions[2].questions.map((q) => q.id)).size).toBe(10);
  });
});
describe("review, export and abuse controls", () => {
  it("removes dictionary and community visibility when collection permission is revoked", () => {
    const s = reviewed(sample(seed()));
    expect(publiclyVisible(s, s.contributions[0])).toBe(true);
    const changed = send(
      s,
      { type: "actor", id: "guest" },
      {
        type: "consent",
        id: "c1",
        consent: { ...consent, collect: false },
        withdraw: false,
      },
    );
    expect(publiclyVisible(changed, changed.contributions[0])).toBe(false);
    expect(changed.contributions[0].raw).toEqual(s.contributions[0].raw);
  });
  it("enforces independent votes, rubric and reviewer region", () => {
    let s = sample(seed());
    expect(() =>
      send(s, {
        type: "vote",
        id: "c1",
        verdict: "VERIFIED",
        checks: [true, true, true, true],
        note: "self",
      }),
    ).toThrow();
    s = send(
      s,
      { type: "actor", id: "admin" },
      {
        type: "person",
        person: {
          ...s.people.find((p) => p.id === "reviewer-a")!,
          region: "Đà Nẵng",
        },
      },
      { type: "actor", id: "reviewer-a" },
    );
    expect(() =>
      send(s, {
        type: "vote",
        id: "c1",
        verdict: "VERIFIED",
        checks: [true, true, true, true],
        note: "region",
      }),
    ).toThrow(/phạm vi/);
    s = send(s, { type: "actor", id: "reviewer-b" });
    expect(() =>
      send(s, {
        type: "vote",
        id: "c1",
        verdict: "VERIFIED",
        checks: [false, true, true, true],
        note: "bad",
      }),
    ).toThrow(/bốn/);
  });
  it("requires curation, training consent and rights; withdrawn samples invalidate releases", () => {
    let s = sample(seed());
    s = reviewed(s);
    const c = s.contributions[0];
    expect(eligible(s, c)).toBe(true);
    const release = {
      id: "r1",
      ids: [c.id],
      records: splitRecords([c]),
      checksum: "test",
      at: new Date().toISOString(),
      dataCard: "DEMO",
    };
    s = send(s, { type: "actor", id: "admin" }, { type: "release", release });
    expect(s.releases).toHaveLength(1);
    s = send(
      s,
      { type: "actor", id: "guest" },
      {
        type: "consent",
        id: c.id,
        consent: { ...consent, train: false },
        withdraw: false,
      },
    );
    expect(eligible(s, s.contributions[0])).toBe(false);
    expect(s.contributions[0].raw).toEqual(c.raw);
    expect(s.contributions[0].consent.public).toBe(true);
  });
  it("keeps old approved parent eligible while new child is RAW", () => {
    let s = reviewed(sample(seed()));
    s = send(
      s,
      { type: "actor", id: "guest" },
      {
        type: "contribute",
        id: "child",
        raw: { ...s.contributions[0].raw, meaning: "Bổ sung" },
        consent,
        parent: "c1",
        sourceId: "source-demo",
      },
    );
    expect(
      eligible(
        s,
        s.contributions.find((c) => c.id === "c1")!,
      ),
    ).toBe(true);
  });
  it("never rewards signup, completion, unverified accounts or duplicate grant", () => {
    let s = send(seed(), {
      type: "register",
      name: "Clone demo",
      region: "Quảng Nam",
    });
    expect(s.credits).toHaveLength(0);
    const owner = s.actor;
    s = reviewed(sample(s));
    s = send(
      s,
      { type: "actor", id: "admin" },
      { type: "rewardPolicy", enabled: true },
    );
    expect(() =>
      send(s, { type: "grant", owner, contributionId: "c1" }),
    ).toThrow(/xác nhận/);
    s = send(
      s,
      {
        type: "person",
        person: { ...s.people.find((p) => p.id === owner)!, verified: true },
      },
      { type: "grant", owner, contributionId: "c1" },
    );
    expect(s.credits[0].amount).toBe(5);
    expect(() =>
      send(s, { type: "grant", owner, contributionId: "c1" }),
    ).toThrow(/đã được cấp/);
    s = send(
      s,
      { type: "actor", id: owner },
      { type: "spend", owner, amount: 1 },
    );
    expect(s.credits[0].used).toBe(1);
    s = send(s, { type: "consent", id: "c1", consent, withdraw: true });
    expect(() => send(s, { type: "spend", owner, amount: 1 })).toThrow(
      /Chưa đủ/,
    );
  });
  it("keeps connected participant, source and sentence families in one split transitively", () => {
    const base: Contribution = {
      id: "a",
      owner: "p1",
      sourceId: "s1",
      sessionId: null,
      parent: null,
      raw: { ...blankRaw(), family: "f1" },
      curated: blankRaw(),
      consent,
      status: "VERIFIED",
      createdAt: "",
      withdrawn: false,
      senseId: "",
      qaAudio: "",
    };
    const records = splitRecords([
      base,
      {
        ...base,
        id: "b",
        owner: "p2",
        sourceId: "s1",
        raw: { ...base.raw, family: "f2" },
      },
      {
        ...base,
        id: "c",
        owner: "p3",
        sourceId: "s3",
        raw: { ...base.raw, family: "f2" },
      },
    ]);
    expect(new Set(records.map((r) => r.split)).size).toBe(1);
  });
  it("offline and spam simulations are retryable and do not mutate original state", () => {
    const initial = seed();
    const s = send(initial, { type: "simulate", value: "offline" });
    expect(() =>
      send(s, {
        type: "start",
        id: "a",
        examId: "exam-demo",
        consent,
        campaignId: "",
      }),
    ).toThrow(/Mô phỏng/);
    expect(initial.simulate).toBe("none");
    const online = send(
      s,
      { type: "simulate", value: "none" },
      { type: "start", id: "a", examId: "exam-demo", consent, campaignId: "" },
    );
    expect(online.sessions).toHaveLength(1);
  });
});
