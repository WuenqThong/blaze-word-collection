import type { DemoState, Question, QuestionKind } from "./types";

const url = "https://docs.google.com/spreadsheets/d/1s9ydC5lWltZ-lZYigUHbceVj7SgyZamlDw6seZbAaWk/edit";
const sheets = ["01 · Dataset tổng hợp", "02 · Từ sinh hoạt thường ngày", "03 · Câu nói kiểm thử ĐN-QN"];
type Entry = [row: string, sheet: number, sense: string, prompt: string, answers: string[], distractors?: string[], blank?: string];
const packs: { slug: string; title: string; rows: Entry[] }[] = [
  { slug: "daily", title: "Cách nói hằng ngày", rows: [
    ["DN-001", 0, "mô: hỏi nơi chốn", "Trong ‘Anh để chiếc xe ở mô?’, ‘mô’ có nghĩa gì?", ["ở đâu", "đâu"], ["khi nào", "bao nhiêu", "vì sao"]],
    ["DN-005", 0, "khi hồi: lúc nãy", "Trong ‘Khi hồi tôi thấy một người đứng trước cổng’, ‘khi hồi’ tương ứng cách nói nào?", ["lúc nãy", "vừa nãy", "khi nãy"]],
    ["DN-002", 0, "tê: kia", "Điền từ vào bản phổ thông của ‘Người đó đứng bên tê đường.’", ["kia"], undefined, "Người đó đứng bên ___ đường."],
    ["DN-003", 0, "răng: tại sao", "Bạn hiểu ‘răng’ trong ‘Răng anh không báo công an sớm?’ thế nào? Hãy giải thích bằng lời của bạn.", []],
    ["DN-004", 0, "chừng mô: khi nào", "Giải thích ‘chừng mô’ trong ‘Chừng mô anh quay lại lấy giấy tờ?’ và hoàn cảnh bạn có thể dùng.", []],
    ["DN-006", 0, "rị: kéo", "Trong ‘Anh rị cái cửa ra giúp tôi’, ‘rị’ là hành động nào?", ["kéo"], ["đóng", "khóa", "sơn"]],
    ["DN-007", 0, "ních: ăn", "Viết lại câu ‘Hồi sáng tôi chưa kịp ních chi hết’ bằng tiếng Việt phổ thông.", []],
    ["DN-008", 0, "huơ: vẫy", "Điền động từ phổ thông tương ứng ‘huơ’ trong câu ‘Người đó huơ tay gọi tôi.’", ["vẫy"], undefined, "Người đó ___ tay gọi tôi."],
  ] },
  { slug: "kitchen", title: "Trong bếp, ngoài chợ", rows: [
    ["DN-SH-003", 1, "đậu khuôn: đậu phụ", "Trong ‘Mua hai miếng đậu khuôn về kho’, ‘đậu khuôn’ là gì?", ["đậu phụ"], ["đậu xanh", "đậu đen", "đậu đỏ"]],
    ["DN-SH-004", 1, "bắp su: bắp cải", "‘Cắt bắp su để xào’: tên phổ thông của ‘bắp su’ là gì?", ["bắp cải"]],
    ["DN-SH-008", 1, "bí rợ: bí đỏ", "Điền tên phổ thông của ‘bí rợ’ trong ‘Bữa ni nấu canh bí rợ.’", ["bí đỏ"], undefined, "Hôm nay nấu canh ___."],
    ["DN-SH-010", 1, "đậu phộng: lạc", "Bạn hiểu ‘đậu phộng / đậu phụng’ trong ‘Rang đậu phộng rồi giã sơ’ như thế nào? Nêu ngữ cảnh sử dụng.", []],
    ["DN-SH-009", 1, "bắp chuối: hoa chuối", "Giải thích ‘bắp chuối / búp chuối’ trong ‘Bào bắp chuối để trộn gỏi’ bằng lời của bạn.", []],
    ["DN-SH-002", 1, "cà mèn: cặp lồng", "‘Tui đem cơm trong cà mèn’: ‘cà mèn’ là đồ dùng nào?", ["cặp lồng đựng thức ăn"], ["rổ đựng rau", "ấm đun nước", "chảo rán"]],
    ["DN-SH-006", 1, "cải muỗng: cải thìa", "Viết lại ‘Rửa cải muỗng cho sạch’ bằng tiếng Việt phổ thông.", []],
    ["DN-SH-015", 1, "ngò gai: mùi tàu", "Điền tên phổ thông của ‘ngò gai’ trong ‘Xắt ngò gai cho vô canh.’", ["mùi tàu", "rau mùi tàu"], undefined, "Thái ___ cho vào canh."],
  ] },
  { slug: "context", title: "Hiểu đúng theo ngữ cảnh", rows: [
    ["CS-006", 2, "răng: nghi vấn", "Trong ‘Răng anh rời khỏi chỗ nớ?’, ‘răng’ được hiểu thế nào?", ["tại sao", "vì sao"], ["răng miệng", "lúc nãy", "ở đây"]],
    ["DN-SH-001", 1, "bùng binh: đồ đựng tiền", "‘Má mua cái bùng binh cho tui bỏ tiền lì xì’: ‘bùng binh’ dùng để làm gì trong câu này?", ["đựng tiền tiết kiệm", "đồ đựng tiền", "heo đất", "bỏ tiền tiết kiệm"]],
    ["DN-SH-011", 1, "mận: roi", "Trong nghĩa đối chiếu của bộ đề, điền tên phổ thông của ‘mận’ trong ‘Mận ni giòn, mua một ký đi.’", ["roi", "quả roi"], undefined, "___ này giòn, mua một ký đi."],
    ["CS-007", 2, "răng: cơ thể", "Giải thích ‘răng’ trong ‘Tui bị gãy hai cái răng’. Ngữ cảnh nào giúp bạn hiểu nghĩa?", []],
    ["CS-011", 2, "chi: chi tiêu", "Giải thích ‘chi’ trong ‘Tui đã chi hai trăm ngàn tiền xe’. Vì sao không hiểu là từ hỏi ‘gì’?", []],
    ["CS-010", 2, "chi: nghi vấn", "Trong ‘Anh cần giấy tờ chi?’, ‘chi’ tương ứng từ nào?", ["gì", "cái gì"], ["chi tiền", "ngày mai", "ở đó"]],
    ["CS-002", 2, "mô: phủ định", "Viết lại ‘Tui không đi mô cả’ bằng tiếng Việt phổ thông.", []],
    ["DN-SH-018", 1, "bạc hà: dọc mùng trong món ăn", "Trong ngữ cảnh món canh, điền tên đối chiếu của ‘bạc hà’ trong ‘Canh chua ni có bạc hà.’", ["dọc mùng"], undefined, "Canh chua này có ___."],
  ] },
];
const kinds: QuestionKind[] = ["GATE", "GATE", "GATE", "LEXEME", "LEXEME", "GOLD", "SENTENCE", "GOLD", "OPEN_WORD", "OPEN_SENTENCE"];
const formats: Question["format"][] = ["choice", "short", "fill", "open", "open", "choice", "open", "fill", "open", "open"];
export const datasetPackId = "dataset1-three-exams-v1";
export function addDatasetQuestions(s: DemoState): boolean {
  if (s.installedPacks?.includes(datasetPackId)) return false;
  for (const pack of packs) {
    const questions: Question[] = Array.from({ length: 10 }, (_, i) => {
      const row = pack.rows[i];
      const id = `dataset1-${pack.slug}-q${i + 1}`;
      return {
        id, version: 1, kind: kinds[i], format: formats[i],
        prompt: row?.[3] ?? (i === 8 ? `Góp một từ/cụm từ bạn thực dùng liên quan chủ đề ‘${pack.title}’, kèm nghĩa, cách nói phổ thông và ngữ cảnh.` : `Góp một câu bạn thực dùng liên quan chủ đề ‘${pack.title}’, kèm nghĩa, bản phổ thông và ngữ cảnh.`),
        accepted: row?.[4] ?? [], options: row?.[5] ? [row[4][0], ...row[5]].map((text, n) => ({ id: `${id}-o${n + 1}`, text })) : undefined,
        correctOptionId: row?.[5] ? `${id}-o1` : undefined, blankTemplate: row?.[6],
        region: "Quảng Nam – Đà Nẵng", topic: pack.slug === "kitchen" ? "Ẩm thực" : "Sinh hoạt", sourceId: "dataset1-source",
        approval: "DEMO_APPROVED", demo: true, difficulty: pack.slug === "context" ? 2 : 1,
        provenance: { rowId: row?.[0] ?? "", sheet: row ? sheets[row[1]] : "", url, sense: row?.[2] ?? "Đóng góp mới của người chơi", verification: "unverified", authored: true },
      };
    });
    for (const q of questions) if (!s.questions.some((x) => x.id === q.id)) s.questions.push(q);
    const id = `dataset1-${pack.slug}`;
    if (!s.exams.some((e) => e.id === id)) s.exams.push({ id, title: pack.title, version: 1, questionIds: questions.map((q) => q.id), mode: "signal", status: "active", demo: true, adaptive: false, region: "Quảng Nam – Đà Nẵng", topic: questions[0].topic });
  }
  if (!s.sources.some((x) => x.id === "dataset1-source")) s.sources.push({ id: "dataset1-source", title: "Dataset1 · đề biên soạn thử nghiệm", evidence: url, train: false, public: false, audio: false, demo: true });
  s.installedPacks = [...(s.installedPacks ?? []), datasetPackId];
  return true;
}
