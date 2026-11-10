import type { DemoState, Exam, Question } from "./types";
import type { BankItem, SourcedItem } from "./dataset1BankTypes";
import { dataset1Bank } from "./dataset1Bank";

/**
 * Kho câu hỏi Dataset1 chia hai tầng:
 * - Q1–Q2: mục đã đối chiếu nguồn (luận án, bài nghiên cứu, tư liệu văn hóa, báo) → có đáp án, chấm điểm.
 *   Mỗi lượt rút từ toàn bộ kho có nguồn, ưu tiên câu người chơi chưa gặp (xem `start` trong domain.ts).
 * - Q3–Q10: mục chưa kiểm chứng (kho trực tuyến, câu theo khuôn, tab "Cần xác minh thêm") → câu mở,
 *   câu trả lời thành mẫu RAW đi qua kiểm duyệt như mọi mẫu game khác.
 * Không mục nào là gold do người bản địa/chuyên gia duyệt; Dataset1 vẫn ghi "Chưa duyệt bản địa".
 */
export const verificationLabel = { verified: "Đã xác minh", sourced: "Đã đối chiếu nguồn, chưa duyệt bản địa", unverified: "Chưa kiểm chứng" } as const;
export const datasetBankPackId = "dataset1-bank-v1";
export const SOURCED_SOURCE = "dataset1-sourced";
export const UNVERIFIED_SOURCE = "dataset1-unverified";
const LEGACY_EXAMS = ["dataset1-daily", "dataset1-kitchen", "dataset1-context"];
const SHEET = { main: "01 · Dataset tổng hợp", verify: "05 · Cần xác minh thêm" };
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1s9ydC5lWltZ-lZYigUHbceVj7SgyZamlDw6seZbAaWk/edit";
const REGION = "Quảng Nam – Đà Nẵng";
const TOPIC = "Sinh hoạt";

/** ‘xiết’ (nghề cá) — tách chú thích trong ngoặc khỏi từ. */
export function wordLabel(word: string) {
  const m = word.match(/^(.*?)\s*\((.+)\)$/);
  return m ? `‘${m[1]}’ (${m[2]})` : `‘${word}’`;
}

type Role = "confirm" | "usage" | "explain" | "rewrite" | "natural" | "candidate" | "synonym" | "sentence";
const ROLES: { role: Role; kind: Question["kind"] }[] = [
  { role: "confirm", kind: "LEXEME" },
  { role: "usage", kind: "LEXEME" },
  { role: "explain", kind: "LEXEME" },
  { role: "rewrite", kind: "SENTENCE" },
  { role: "natural", kind: "SENTENCE" },
  { role: "candidate", kind: "LEXEME" },
  { role: "synonym", kind: "OPEN_WORD" },
  { role: "sentence", kind: "OPEN_SENTENCE" },
];

function openPrompt(role: Role, it: BankItem) {
  const w = wordLabel(it.word);
  const m = `“${it.meaning}”`;
  switch (role) {
    case "confirm": return `Nguồn tra cứu chưa kiểm chứng ghi ${w} nghĩa là ${m}. Theo bạn, ${w} nói theo tiếng phổ thông là gì? Nếu nghĩa khác hoặc bạn chưa nghe từ này, hãy ghi rõ.`;
    case "usage": return `Nơi bạn sống có dùng ${w} không? Nguồn tạm ghi nghĩa ${m}. Ghi nghĩa bạn hiểu và hoàn cảnh bạn hay nghe.`;
    case "explain": return `Giải thích ${w} bằng lời của bạn. Nguồn tạm ghi: ${m} (chưa kiểm chứng).`;
    case "rewrite": return `Viết lại câu ‘${it.sentence}’ bằng tiếng Việt phổ thông.`;
    case "natural": return `Câu ‘${it.sentence}’ được biên soạn từ nguồn chưa kiểm chứng. Người quê bạn có nói vậy không? Viết bản phổ thông; nếu câu chưa tự nhiên, ghi cách nói đúng ở phần ngữ cảnh.`;
    case "candidate": return `Từ cần xác minh: ${w} (${it.meaning.charAt(0).toLocaleLowerCase("vi") + it.meaning.slice(1)}). Bạn có nghe hoặc dùng từ này không? Ghi nghĩa phổ thông bạn hiểu, hoặc ghi “chưa nghe”.`;
    case "synonym": return `Ngoài ${w}, nguồn ghi nghĩa ${m}. Quê bạn còn cách gọi nào khác cho nghĩa này? Góp từ/cụm từ đó kèm nghĩa, cách nói phổ thông và ngữ cảnh.`;
    case "sentence": return `Đặt một câu bạn thật sự nói có dùng ${w}, nguồn ghi nghĩa ${m}. Ghi kèm nghĩa, bản phổ thông và ngữ cảnh.`;
  }
}

const provenance = (it: BankItem, verification: "sourced" | "unverified", sense: string): Question["provenance"] => ({
  rowId: it.id, sheet: it.candidate ? SHEET.verify : SHEET.main, url: dataset1Bank.urls[it.url], sense, verification, authored: true,
});

export function sourcedQuestion(it: SourcedItem): Question {
  const id = `d1b-v-${it.id}`;
  const w = wordLabel(it.word);
  const choice = !!it.distractors;
  return {
    id, version: 1, kind: "GATE", format: choice ? "choice" : "fill",
    prompt: choice ? `Trong câu ‘${it.sentence}’, ${w} có nghĩa là gì?` : `Điền cách nói phổ thông của ${w} trong câu: ‘${it.sentence}’`,
    accepted: it.accepted,
    options: choice ? [it.accepted[0], ...it.distractors!].map((text, n) => ({ id: `${id}-o${n + 1}`, text })) : undefined,
    correctOptionId: choice ? `${id}-o1` : undefined,
    blankTemplate: it.blank,
    region: REGION, topic: TOPIC, sourceId: SOURCED_SOURCE, approval: "DEMO_APPROVED", demo: true, difficulty: 1,
    provenance: provenance(it, "sourced", `${it.word}: ${it.meaning} · ${it.sourceType}`),
  };
}

export function unverifiedQuestion(it: BankItem, slot: number): Question {
  const { role, kind } = ROLES[slot];
  return {
    id: `d1b-u-${it.id}-${role}`, version: 1, kind, format: "open", prompt: openPrompt(role, it), accepted: [],
    region: REGION, topic: TOPIC, sourceId: UNVERIFIED_SOURCE, approval: "DEMO_APPROVED", demo: true, difficulty: 1,
    provenance: provenance(it, "unverified", `${it.word}: ${it.meaning} · ${it.sourceType}${it.note ? ` · ${it.note}` : ""}`),
  };
}

/** Nạp kho một lần; đóng ba đề Dataset1 cũ để luật Q1–Q2/Q3–Q10 là luật đang chạy. Lượt cũ giữ snapshot. */
export function addDatasetBank(s: DemoState): boolean {
  if (s.installedPacks?.includes(datasetBankPackId)) return false;
  const add = (q: Question) => { if (!s.questions.some((x) => x.id === q.id)) s.questions.push(q); return q.id; };
  const sourced = new Map(dataset1Bank.sourced.map((it) => [it.id, it]));
  const unverified = new Map(dataset1Bank.unverified.map((it) => [it.id, it]));
  for (const it of dataset1Bank.sourced) add(sourcedQuestion(it));
  dataset1Bank.exams.forEach((plan, n) => {
    const questionIds = [
      ...plan.sourced.map((id) => `d1b-v-${sourced.get(id)!.id}`),
      ...plan.unverified.map((id, slot) => add(unverifiedQuestion(unverified.get(id)!, slot))),
    ];
    const number = String(n + 1).padStart(2, "0");
    const exam: Exam = {
      id: `dataset1-bank-${number}`, title: `Kho Dataset1 · Đề ${number}`, version: 1, questionIds, mode: "signal", status: "active",
      demo: true, adaptive: false, region: REGION, topic: TOPIC, layout: "sourced2",
    };
    if (!s.exams.some((e) => e.id === exam.id)) s.exams.push(exam);
  });
  for (const e of s.exams) if (LEGACY_EXAMS.includes(e.id) && e.version === 1 && e.status === "active") e.status = "closed";
  if (!s.sources.some((x) => x.id === SOURCED_SOURCE)) s.sources.push({ id: SOURCED_SOURCE, title: "Dataset1 · mục từ đã đối chiếu nguồn (Q1–Q2)", evidence: SHEET_URL, train: false, public: false, audio: false, demo: true });
  if (!s.sources.some((x) => x.id === UNVERIFIED_SOURCE)) s.sources.push({ id: UNVERIFIED_SOURCE, title: "Dataset1 · mục chưa kiểm chứng (Q3–Q10)", evidence: SHEET_URL, train: false, public: false, audio: false, demo: true });
  s.installedPacks = [...(s.installedPacks ?? []), datasetBankPackId];
  return true;
}
