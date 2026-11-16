import type { Raw } from "./types";
/** Advisory HOLD policy: bump version on code/threshold changes. Never edits RAW. */
export const QUALITY_POLICY_VERSION = "contribution-quality-v2";
export interface QualityRaw {
  kind?: string; original_text?: string; meaning?: string; standard_vi?: string;
  context?: string; response?: string; method?: string;
  question_kind?: string; question_format?: string;
}
const explanatoryKinds = new Set(["explanation", "explain", "OPEN_WORD", "OPEN_SENTENCE"]);
const keyboardRuns = ["qwerty", "asdfgh", "zxcvbn", "qwertz", "azerty"];
export const qualityReasonLabels: Record<string, string> = {
  invalid_control: "Có ký tự điều khiển không hợp lệ.",
  punctuation_only: "Có trường nội dung chỉ gồm dấu hoặc ký hiệu.",
  repeated_noise: "Có chuỗi lặp bất thường cần kiểm tra.",
  keyboard_mash: "Có chuỗi phím liên tiếp cần kiểm tra.",
  missing_context: "Câu yêu cầu giải thích còn thiếu ngữ cảnh.",
};
/** Ordered codes mirror backend quality_reasons. No minimum word length.
 * Only explicit explanatory kinds require context. Keyboard runs match whole
 * ASCII tokens (including reverse/repeated runs); newline/tab/CR are allowed.
 */
export function qualityReasons(raw: QualityRaw): string[] {
  const reasons: string[] = [];
  const values = [raw.original_text, raw.meaning, raw.standard_vi, raw.context].map(v => typeof v === "string" ? v : "");
  if (values.some(v => [...v].some(c => /[\p{Cc}\p{Cf}]/u.test(c) && !["\t", "\n", "\r"].includes(c)))) reasons.push("invalid_control");
  if ((raw.response ?? "answer") !== "answer") return reasons;
  const add = (reason: string) => { if (!reasons.includes(reason)) reasons.push(reason); };
  for (const value of values) {
    const text = value.normalize("NFC").trim();
    if (!text) continue;
    if (!/[\p{L}\p{N}]/u.test(text)) add("punctuation_only");
    const compact = [...text.toLowerCase()].filter(c => !/\s/u.test(c)).join("");
    if ([1, 2, 3].some(w => compact.length >= 6 && compact.length % w === 0 && compact.length / w >= (w === 1 ? 6 : 4) && compact === compact.slice(0, w).repeat(compact.length / w))) add("repeated_noise");
    const runs = [...keyboardRuns, ...keyboardRuns.map(r => [...r].reverse().join(""))];
    if ((text.toLowerCase().match(/[a-z]+/g) ?? []).some(t => runs.some(r => t.length % r.length === 0 && t === r.repeat(t.length / r.length)))) add("keyboard_mash");
  }
  if (explanatoryKinds.has(raw.question_kind ?? "") && !values[3].trim() && !(raw.method === "game" && values[1].trim())) add("missing_context");
  return reasons;
}
export function localQualityReasons(raw: Raw, question?: { kind: string; format?: string }): string[] {
  return qualityReasons({ ...raw, original_text: raw.text, standard_vi: raw.standard,
    question_kind: question?.kind ?? raw.questionKind, question_format: question?.format ?? raw.questionFormat });
}
