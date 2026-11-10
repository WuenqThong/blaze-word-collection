import { describe, expect, it } from "vitest";
import { applyCommand, gameAllocation } from "../src/features/demo/domain";
import { seed, consentDefault } from "../src/features/demo/seed";
import { markKnownTestSessions } from "../src/features/demo/testSessions";

describe("browser QA sessions", () => {
  it("preserves known QA snapshots but does not resume them as the participant", () => {
    let state = applyCommand(seed(), { type: "start", id: "e0b3f5ee-f521-4413-95ec-75dac60bebd4", examId: "exam-demo", consent: { ...consentDefault(), collect: true }, campaignId: "" });
    const answers = structuredClone(state.sessions[0].answers);
    expect(gameAllocation(state, "guest").pending).toBeUndefined();
    expect(markKnownTestSessions(state)).toBe(true);
    expect(markKnownTestSessions(state)).toBe(false);
    expect(state.sessions[0].answers).toEqual(answers);
    state = applyCommand(state, { type: "autoStart", id: "participant", campaignId: "", consent: { ...consentDefault(), collect: true } });
    expect(state.sessions).toHaveLength(2);
    expect(gameAllocation(state, "guest").pending?.id).toBe("participant");
  });
});
