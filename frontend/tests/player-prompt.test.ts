import { describe, it, expect } from "vitest";
import { seed } from "../src/features/demo/seed";
import { playerPrompt } from "../src/features/demo/playerPrompt";

describe("participant question instructions", () => {
  it("uses the two answer fields throughout the collection bank", () => {
    const questions = seed().questions.filter(q => !["GATE", "GOLD"].includes(q.kind));
    expect(questions.length).toBeGreaterThan(100);
    for (const question of questions) {
      const prompt = playerPrompt(question);
      expect(prompt).toContain("phổ thông");
      expect(prompt).toContain("Giải thích");
      expect(prompt).not.toMatch(/chưa nghe|có nghe|có dùng|nguồn tạm|cần xác minh|phần ngữ cảnh/i);
    }
  });
});
