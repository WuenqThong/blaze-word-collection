import type { Question } from "./types";
import { fixedOriginal, isOpenQuestion } from "./dialectOriginal";
export function playerPrompt(q: Question): string {
  if (q.kind === "GATE" || q.kind === "GOLD") return q.prompt;
  if (isOpenQuestion(q)) return `Với chủ đề “${q.topic}”, nhập ${q.kind === "OPEN_SENTENCE" ? "câu" : "từ hoặc cụm từ"} bạn thực dùng vào ô Cách nói địa phương, bản tiếng Việt phổ thông vào ô Cách nói phổ thông. Ô Giải thích dùng để làm rõ nghĩa hoặc nêu ví dụ cách dùng.`;
  const original = fixedOriginal(q);
  return `${original ? `Diễn đạt “${original}” bằng tiếng Việt phổ thông.` : q.prompt} Nhập bản phổ thông vào ô Cách nói phổ thông. Ô Giải thích dùng để làm rõ nghĩa hoặc nêu ví dụ cách dùng. Nếu không rõ cách nói cần diễn đạt, bấm Bỏ qua câu này.`;
}
