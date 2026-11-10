import type { Question } from "./types";

export const formatLabels = { choice: "Trắc nghiệm", short: "Trả lời ngắn", fill: "Điền từ", open: "Trả lời mở" };
const key = (s: string) => s.normalize("NFC").trim().toLocaleLowerCase("vi").replace(/[.!?,;:]+$/, "").replace(/\s+/g, " ");
export function questionErrors(q: Question): string[] {
  const errors: string[] = [];
  if (q.format === "choice") {
    const options = q.options ?? [];
    if (options.length !== 4 || options.some((o) => !o.id.trim() || !o.text.trim()) || new Set(options.map((o) => o.id)).size !== 4 || new Set(options.map((o) => key(o.text))).size !== 4) errors.push("Trắc nghiệm cần 4 lựa chọn khác nhau, có ID và nội dung.");
    if (options.filter((o) => o.id === q.correctOptionId).length !== 1) errors.push("Cần đúng một lựa chọn đúng.");
    if (options.some((o) => o.id !== q.correctOptionId && q.accepted.some((a) => key(a) === key(o.text)))) errors.push("Phương án nhiễu trùng đáp án hoặc biến thể hợp lệ.");
  }
  if (q.format === "fill" && (q.blankTemplate?.match(/___/g) ?? []).length !== 1) errors.push("Câu điền từ cần đúng một chỗ trống ___.");
  if (["short", "fill"].includes(q.format ?? "") && !q.accepted.some((a) => a.trim())) errors.push("Cần đáp án hoặc biến thể cho câu ngắn/điền từ.");
  if (["GATE", "GOLD"].includes(q.kind) && q.format === "open") errors.push("Câu kiểm tra cần dạng có đáp án.");
  if (["LEXEME", "SENTENCE", "OPEN_WORD", "OPEN_SENTENCE"].includes(q.kind) && q.format && q.format !== "open") errors.push("Câu thu thập cần trả lời mở.");
  return errors;
}

export function shuffleOptions(q: Question): Question {
  const copy = structuredClone(q);
  if (copy.format === "choice" && copy.options) {
    for (let i = copy.options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy.options[i], copy.options[j]] = [copy.options[j], copy.options[i]];
    }
  }
  return copy;
}
