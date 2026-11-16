import { describe, expect, it } from "vitest";
import fixtures from "../../test-fixtures/contribution-quality-v1.json";
import { QUALITY_POLICY_VERSION, qualityReasons } from "../src/features/demo/contributionQuality";
describe("shared advisory quality policy", () => {
  it("pins current policy version", () => expect(QUALITY_POLICY_VERSION).toBe("contribution-quality-v2"));
  for (const fixture of fixtures) it(fixture.name, () => {
    const raw = structuredClone(fixture.raw);
    expect(qualityReasons(raw)).toEqual(fixture.reasons);
    expect(raw).toEqual(fixture.raw);
  });
});

import { applyCommand } from "../src/features/demo/domain";
import { seed, blankRaw } from "../src/features/demo/seed";
import type { Contribution } from "../src/features/demo/types";

it("holds suspicious new contributions with reasons and unchanged RAW", () => {
  const raw = { ...blankRaw(), text: "qwerty", meaning: "nghĩa", standard: "từ", context: "ngữ cảnh", evidence: "nguồn" };
  const state = applyCommand(seed(), { type: "contribute", id: "quality-hold", raw, parent: null, sourceId: "source-demo",
    consent: { collect: true, train: true, public: false, audio: false, version: "demo-consent-v1" } });
  const item = state.contributions.find(c => c.id === "quality-hold") as Contribution & { qualityReasons?: string[] };
  expect(item.status).toBe("HOLD");
  expect(item.qualityReasons).toEqual(["keyboard_mash"]);
  expect(item.raw).toEqual(raw);
});
