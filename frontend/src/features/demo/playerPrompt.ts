import type { Question } from "./types";
import { fixedOriginal, isOpenQuestion } from "./dialectOriginal";
export function playerPrompt(q: Question): string {
  if (q.kind === "GATE" || q.kind === "GOLD") return q.prompt;
  if (isOpenQuestion(q)) return `Góp một ${q.kind === "OPEN_SENTENCE" ? "câu" : "từ hoặc cụm từ"} địa phương bạn thường dùng về “${q.topic}”.`;
  const original = fixedOriginal(q);
  return original ? q.kind === "SENTENCE" ? `Viết lại bằng tiếng Việt phổ thông: “${original}”` : `“${original}” nói theo tiếng Việt phổ thông là gì?` : q.prompt;
}
