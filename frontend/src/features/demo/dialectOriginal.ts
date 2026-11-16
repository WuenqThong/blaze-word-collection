import type { Answer, Question } from "./types";
export const isOpenQuestion = (q: Question) => q.kind === "OPEN_WORD" || q.kind === "OPEN_SENTENCE";
// Keep the legacy grammar identical to backend game_original.question_original.
const patterns: Record<string, [string, number][]> = {
  "SENTENCE": [
    [
      "(?:Diễn đạt câu|Viết lại(?: câu)?) <0> bằng tiếng Việt phổ thông\\.",
      0
    ],
    [
      "Câu <0> được biên soạn từ nguồn chưa kiểm chứng\\. Người quê bạn có nói vậy không\\? Viết bản phổ thông; nếu câu chưa tự nhiên, ghi cách nói đúng ở phần ngữ cảnh\\.",
      0
    ]
  ],
  "LEXEME": [
    [
      "(?:Giải thích(?: một nghĩa của)?|Bạn hiểu) <0>(?: \\([^<>]*\\))? (?:trong (?:<1>|một ngữ cảnh cụ thể)[^<>]*(?:<2>[^<>]*)?|bằng lời của bạn\\.(?: Nguồn tạm ghi: <1> \\(chưa kiểm chứng\\)\\.)?|và hoàn cảnh bạn nghe\\.)",
      0
    ],
    [
      "Nơi bạn sống có dùng <0>(?: \\([^<>]*\\))? không\\? Nguồn tạm ghi nghĩa <1>\\. Ghi nghĩa bạn hiểu và hoàn cảnh bạn hay nghe\\.",
      0
    ],
    [
      "Từ cần xác minh: <0> \\([^<>]*\\)\\. Bạn có nghe hoặc dùng từ này không\\? Ghi nghĩa phổ thông bạn hiểu, hoặc ghi <1>\\.",
      0
    ],
    [
      "Nguồn tra cứu chưa kiểm chứng ghi <0>(?: \\([^<>]*\\))? nghĩa là <1>\\. Theo bạn, <2>(?: \\([^<>]*\\))? nói theo tiếng phổ thông là gì\\? Nếu nghĩa khác hoặc bạn chưa nghe từ này, hãy ghi rõ\\.",
      2
    ]
  ],
  "GATE": [
    [
      "Trong(?: câu)? <0>, <1>(?: \\([^<>]*\\))? (?:có nghĩa(?: là)? gì|tương ứng cách nói nào|là gì|được hiểu thế nào|là hành động nào|tương ứng từ nào)\\?",
      1
    ],
    [
      "<0>: (?:tên phổ thông của )?<1> (?:là gì|dùng để làm gì trong câu này|là đồ dùng nào)\\?",
      1
    ],
    [
      "(?:Trong nghĩa đối chiếu của bộ đề, điền tên phổ thông của|Trong ngữ cảnh món canh, điền tên đối chiếu của|Điền tên phổ thông của|Điền động từ phổ thông tương ứng|Điền cách nói phổ thông của) <0>(?: \\([^<>]*\\))? trong(?: câu:? )? ?<1>",
      0
    ],
    [
      "(?:Trong ví dụ minh họa, <0> có nghĩa gì\\?|Câu hiệu chỉnh minh họa: <0> tương ứng cách nói nào\\?|Diễn đạt <0> bằng lời phổ thông\\.)",
      0
    ],
    [
      "Điền từ vào bản phổ thông của <0>",
      0
    ]
  ]
};
patterns.GOLD = patterns.GATE;
export function fixedOriginal(q: Question): string {
  if (isOpenQuestion(q)) return "";
  if (Object.hasOwn(q, "originalText")) return typeof q.originalText === "string" && q.originalText.length <= 5000 ? q.originalText.trim() : "";
  const quotes: string[] = [];
  const grammar = q.prompt.trim().replace(/‘([^’]*)’|“([^”]*)”|"([^"\n]*)"/g, (_match, a, b, c) => {
    quotes.push((a ?? b ?? c).trim());
    return `<${quotes.length - 1}>`;
  });
  if (grammar.startsWith("Nguồn tra cứu chưa kiểm chứng ghi ") && quotes.length === 3 && quotes[0] !== quotes[2]) return "";
  const candidates = new Set((patterns[q.kind] ?? []).filter(([pattern]) => new RegExp(`^(?:${pattern})$`).test(grammar)).map(([, index]) => quotes[index]));
  return candidates.size === 1 ? [...candidates][0] ?? "" : "";
}
export function answerOriginal(q: Question, a: Answer): string {
  return isOpenQuestion(q) ? a.originalText?.trim() || "" : fixedOriginal(q);
}
