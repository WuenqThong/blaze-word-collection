/** Một dòng Dataset1 đã rút gọn cho game. `url` là chỉ số trong `BankData.urls`. */
export interface BankItem {
  id: string;
  word: string;
  meaning: string;
  sentence?: string;
  standard?: string;
  sourceType: string;
  url: number;
  /** Tab 05 · Cần xác minh thêm. */
  candidate?: boolean;
  /** Câu minh họa tự nhiên (không phải câu theo khuôn tra cứu). */
  natural?: boolean;
  note?: string;
}
export interface SourcedItem extends BankItem {
  accepted: string[];
  /** Có khi dùng dạng trắc nghiệm. */
  distractors?: string[];
  /** Có khi dùng dạng điền từ: bản phổ thông với một chỗ ___. */
  blank?: string;
}
export interface BankData {
  urls: string[];
  sourced: SourcedItem[];
  unverified: BankItem[];
  /** Mỗi đề: 2 ID có nguồn (Q1 trắc nghiệm, Q2 điền từ) và 8 ID chưa kiểm chứng (Q3–Q10). */
  exams: { sourced: string[]; unverified: string[] }[];
}
