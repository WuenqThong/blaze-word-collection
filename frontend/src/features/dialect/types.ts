export type ContributionStatus = "RAW" | "REVIEW" | "VERIFIED" | "HOLD" | "REJECT";
export interface ContributionForm {
  kind: "word" | "sentence"; original_text: string; meaning: string; standard_vi: string;
  region: string; context: string; source_evidence: string;
  consent_collect: boolean; consent_train: boolean; consent_public: boolean;
  consent_version: "dialect-2026-11-v1"; idempotency_key: string; parent_id: number | null;
}
export interface Contribution {
  id: number; owner_id: number; parent_id: number | null; source_id: number;
  raw: ContributionForm; status: ContributionStatus; withdrawn_at: string | null;
  created_at: string; rights_confirmed: boolean; rights_note: string;
  vote_count: number; has_voted: boolean;
  votes: {reviewer_id: number; verdict: string; rubric: Record<string, boolean>; note: string}[];
  events: {action: string; note: string; created_at: string}[];
}
export interface Page<T> { items: T[]; total: number; }
export const STATUS: Record<ContributionStatus, {label: string; tone: string}> = {
  RAW: {label: "Đã tiếp nhận", tone: "secondary"}, REVIEW: {label: "Đang đánh giá", tone: "primary"},
  VERIFIED: {label: "Đã xác minh", tone: "success"}, HOLD: {label: "Cần bổ sung", tone: "warning"}, REJECT: {label: "Chưa chấp nhận", tone: "danger"},
};
export function dateLabel(date: string) { return new Date(/Z$|[+-]\d\d:\d\d$/.test(date) ? date : `${date}Z`).toLocaleString("vi-VN"); }
