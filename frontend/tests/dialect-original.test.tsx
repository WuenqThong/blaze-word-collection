import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { seed, consentDefault } from "../src/features/demo/seed";
import { applyCommand, blankAnswer } from "../src/features/demo/domain";
import { fixedOriginal, answerOriginal } from "../src/features/demo/dialectOriginal";
import { AnswerTable, QuestionForm } from "../src/features/demo/GamePages";
const run = vi.hoisted(() => vi.fn());
vi.mock("../src/features/demo/context", () => ({ useDemo: () => ({ run }) }));
afterEach(() => { cleanup(); run.mockReset(); });
function state() {
  return applyCommand(seed(), { type: "start", id: "pair", examId: "dataset1-bank-01", consent: { ...consentDefault(), collect: true, train: true }, campaignId: "" });
}
it("resolves the whole corpus safely and rejects arbitrary quotes", () => {
  for (const q of seed().questions) {
    expect(() => fixedOriginal(q)).not.toThrow();
    if (["LEXEME", "SENTENCE"].includes(q.kind)) expect(fixedOriginal(q)).not.toBe("");
  }
  const q = { ...seed().questions[3] }; delete q.originalText;
  expect(fixedOriginal({ ...q, prompt: "Ghi chú ‘không phải mục tiêu’" })).toBe("");
  expect(fixedOriginal({ ...q, prompt: "Ghi chú ‘một’ và ‘hai’\nkhác nhau" })).toBe("");
  expect(fixedOriginal({ ...q, prompt: "Bạn hiểu ‘răng’ trong ‘Răng anh không báo công an sớm?’ thế nào? Hãy giải thích bằng lời của bạn." })).toBe("răng");
  expect(fixedOriginal({ ...q, kind: "SENTENCE", prompt: "Viết lại câu ‘Mi đi mô rứa?’ bằng tiếng Việt phổ thông." })).toBe("Mi đi mô rứa?");
  expect(fixedOriginal({ ...q, originalText: "", prompt: "Giải thích ‘tê’ và hoàn cảnh bạn nghe." })).toBe("");
});
it.each(["OPEN_WORD", "OPEN_SENTENCE"] as const)("requires actual original edit for %s", async kind => {
  const s = state().sessions[0]; s.cursor = 8; s.questions[8].kind = kind;
  s.answers[8] = { ...blankAnswer(), text: "bản phổ thông cũ", standard: "bản phổ thông cũ", meaning: "ngữ cảnh" };
  run.mockImplementation(async () => ({ sessions: [{ ...s, cursor: 9 }] }));
  render(<QuestionForm session={s} notify={vi.fn()} />);
  expect(screen.getByLabelText("Cách nói địa phương *")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Lưu & tiếp tục" }));
  expect(run).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Cách nói địa phương *"), { target: { value: "Mi đi mô rứa?" } });
  fireEvent.change(screen.getByLabelText("Cách nói phổ thông *"), { target: { value: "Bạn đi đâu vậy?" } });
  fireEvent.change(screen.getByLabelText("Giải thích *"), { target: { value: "Hỏi người quen đang đi đâu." } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu & tiếp tục" }));
  await waitFor(() => expect(run).toHaveBeenCalledWith(expect.objectContaining({ type: "answer", answer: expect.objectContaining({ originalText: "Mi đi mô rứa?", standard: "Bạn đi đâu vậy?", text: "Bạn đi đâu vậy?" }) })));
});
it("keeps two fixed inputs and displays original separately", () => {
  const s = state().sessions[0]; s.cursor = 2; s.questions[2].originalText = "tê";
  render(<QuestionForm session={s} notify={vi.fn()} />);
  expect(screen.getAllByRole("textbox")).toHaveLength(2); cleanup();
  s.answers[2] = { ...blankAnswer(), text: "kia", standard: "kia", originalText: "ignore override" };
  render(<AnswerTable session={s} />);
  expect(screen.getByText("Cách nói địa phương: tê")).toBeInTheDocument();
  expect(screen.getByText("Cách nói phổ thông: kia")).toBeInTheDocument();
  expect(answerOriginal(s.questions[8], { ...blankAnswer(), text: "standard only" })).toBe("");
});
it("fails offline submit atomically for missing fixed target including proposal", () => {
  for (const gate of [false, true]) {
    const st = state(); const s = st.sessions[0];
    s.answers = s.questions.map(() => ({ ...blankAnswer(), skipped: true }));
    s.questions[0] = { ...s.questions[0], kind: gate ? "GATE" : "LEXEME", originalText: "", prompt: "Ghi chú ‘không phải mục tiêu’" };
    s.answers[0] = { ...blankAnswer(), text: "response", standard: "response", attempts: gate ? [{ text: "response", correct: false, at: "now", proposal: "response" }] : [] };
    const before = structuredClone(st);
    expect(() => applyCommand(st, { type: "submit", id: "pair", region: "Quảng Nam", upbringing: "Quảng Nam", usage: "" })).toThrow();
    expect(st).toEqual(before);
  }
});
