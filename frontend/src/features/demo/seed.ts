import type { Consent, DemoState, Exam, Question, Raw } from "./types";
import { addDatasetQuestions } from "./datasetQuestions";
import { addDatasetBank } from "./datasetBank";
import { DISTRICTS } from "./regions";
export const consentDefault = (): Consent => ({
  collect: false,
  train: false,
  public: false,
  audio: false,
  version: "demo-consent-v1",
});
export const blankRaw = (): Raw => ({
  kind: "word",
  text: "",
  meaning: "",
  standard: "",
  context: "",
  region: DISTRICTS[0],
  topic: "Sinh hoạt",
  partOfSpeech: "",
  variants: "",
  keywords: "",
  evidence: "",
  method: "direct",
  family: "",
  confidence: "self_report",
  response: "answer",
  mediaIds: [],
});
export const METHODS = [
  "Liệt kê nhanh",
  "Kể quy trình",
  "Sửa câu gượng",
  "Ảnh gọi tên vật",
  "Video câm",
  "Chuỗi họ từ",
  "Nhật ký từ",
  "Tình huống nhắn tin",
  "Từ nghề nghiệp",
];
export const QUESTION_KINDS: Question["kind"][] = [
  "GATE",
  "GATE",
  "GATE",
  "LEXEME",
  "LEXEME",
  "GOLD",
  "SENTENCE",
  "GOLD",
  "OPEN_WORD",
  "OPEN_SENTENCE",
];
/** Q1–Q2 kiểm tra bằng mục đã đối chiếu nguồn; Q3–Q10 để người chơi xác nhận mục chưa kiểm chứng. */
export const SOURCED_KINDS: Question["kind"][] = [
  "GATE",
  "GATE",
  "LEXEME",
  "LEXEME",
  "LEXEME",
  "SENTENCE",
  "SENTENCE",
  "LEXEME",
  "OPEN_WORD",
  "OPEN_SENTENCE",
];
export const examKinds = (e: Pick<Exam, "layout">) => (e.layout === "sourced2" ? SOURCED_KINDS : QUESTION_KINDS);
export const gateCount = (e: Pick<Exam, "layout">) => examKinds(e).filter((k) => k === "GATE").length;
export function seed(): DemoState {
  const prompts = [
    "Trong ví dụ minh họa, “chi” có nghĩa gì?",
    "Diễn đạt “răng” bằng lời phổ thông.",
    "Trong ví dụ minh họa, “mô” có nghĩa gì?",
    "Giải thích một nghĩa của “tê” và hoàn cảnh bạn nghe.",
    "Giải thích “chừ” trong một ngữ cảnh cụ thể.",
    "Câu hiệu chỉnh minh họa: “chừ” tương ứng cách nói nào?",
    "Diễn đạt câu “Mi đi mô rứa?” bằng tiếng Việt phổ thông.",
    "Câu hiệu chỉnh minh họa: “tê” tương ứng cách nói nào?",
    "Góp một từ/cụm từ cùng nghĩa, bản phổ thông và ngữ cảnh.",
    "Góp một câu bạn thực dùng cùng nghĩa, bản phổ thông và ngữ cảnh.",
  ];
  const accepted = [
    ["cái gì", "gì"],
    ["sao", "thế nào", "tại sao"],
    ["đâu", "ở đâu"],
    [],
    [],
    ["bây giờ", "hiện giờ"],
    [],
    ["kia", "đằng kia"],
    [],
    [],
  ];
  const questions: Question[] = prompts.map((prompt, i) => ({
    id: `q${i + 1}`,
    version: 1,
    kind: QUESTION_KINDS[i],
    prompt,
    accepted: accepted[i],
    region: "Quảng Nam",
    topic: "Sinh hoạt",
    sourceId: "source-demo",
    approval: "DEMO_APPROVED",
    demo: true,
    difficulty: 1,
  }));
  const now = new Date().toISOString();
  const state: DemoState = {
    schema: 1,
    models: [
      {
        id: "rules-v1",
        name: "Kịch bản quy tắc",
        version: 1,
        rules: { chi: "cái gì", mô: "đâu", răng: "sao" },
        notes: "Không phải model AI. Dùng kiểm thử màn hình.",
        active: true,
      },
      {
        id: "rules-v2",
        name: "Kịch bản sau bổ sung",
        version: 2,
        rules: { chi: "cái gì", mô: "đâu", răng: "sao", chừ: "bây giờ" },
        notes: "Bổ sung một quy tắc minh họa để so sánh benchmark.",
        active: true,
      },
    ],
    revision: 0,
    actor: "guest",
    people: [
      {
        id: "guest",
        name: "Khách ẩn danh",
        role: "guest",
        verified: false,
        region: "Quảng Nam",
        risk: "clear",
        appeal: "",
      },
      {
        id: "member",
        name: "Người đóng góp mẫu",
        role: "contributor",
        verified: false,
        region: "Quảng Nam",
        risk: "clear",
        appeal: "",
      },
      {
        id: "reviewer-a",
        name: "Reviewer A",
        role: "reviewer",
        verified: true,
        region: DISTRICTS[0],
        risk: "clear",
        appeal: "",
      },
      {
        id: "reviewer-b",
        name: "Reviewer B",
        role: "reviewer",
        verified: true,
        region: DISTRICTS[0],
        risk: "clear",
        appeal: "",
      },
      {
        id: "admin",
        name: "Điều phối viên",
        role: "admin",
        verified: true,
        region: "Quảng Nam",
        risk: "clear",
        appeal: "",
      },
    ],
    questions,
    exams: [
      {
        id: "exam-demo",
        version: 1,
        title: "Tiếng quê · Bộ minh họa 10 câu",
        questionIds: questions.map((q) => q.id),
        mode: "signal",
        status: "active",
        demo: true,
        adaptive: false,
        region: "Quảng Nam",
        topic: "Sinh hoạt",
      },
    ],
    sessions: [],
    contributions: [],
    votes: [],
    sources: [
      {
        id: "source-demo",
        title: "Nội dung tự soạn để thử giao diện",
        evidence:
          "Dữ liệu minh họa, chưa được xác minh ngôn ngữ. Không dùng làm gold hoặc huấn luyện thật.",
        train: true,
        public: true,
        audio: false,
        demo: true,
      },
    ],
    campaigns: [
      {
        id: "campaign-demo",
        title: "Trải nghiệm tiếng quê",
        examIds: ["exam-demo"],
        region: "Quảng Nam",
        topic: "Sinh hoạt",
        active: true,
        mode: "standard",
      },
    ],
    tasks: METHODS.map((method, i) => ({
      id: `task-${i}`,
      title: method,
      method,
      prompt: `${method}: chia sẻ cách diễn đạt bạn thực sự biết và ghi ngữ cảnh.`,
      region: "Quảng Nam",
      topic: "Sinh hoạt",
      mediaId: null,
      active: true,
    })),
    events: [
      {
        id: "seed",
        actor: "system",
        action: "DEMO_INITIALIZED",
        entity: "demo",
        note: "Kho demo riêng; chưa có dữ liệu thu thật.",
        at: now,
      },
    ],
    credits: [],
    feedback: [],
    jobs: [],
    releases: [],
    media: [],
    drafts: [],
    regions: [...DISTRICTS],
    topics: ["Sinh hoạt", "Gia đình", "Nghề nghiệp", "Ẩm thực"],
    rewardEnabled: false,
    simulate: "none",
    backupAt: null,
  };
  addDatasetQuestions(state);
  addDatasetBank(state);
  return state;
}
