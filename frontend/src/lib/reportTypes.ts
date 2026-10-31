export type ReportReason = "corrupt" | "inaudible" | "wrong_label" | "offensive" | "other";
export type ReportStatus = "pending" | "approved" | "rejected";

export interface ReportItem {
  id: number;
  user_id: number;
  user_full_name: string | null;
  user_email: string | null;
  project_id: number;
  task_id: number;
  audio_filename: string | null;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  score_awarded: number;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export const REPORT_REASON_LABEL: Record<ReportReason, { label: string; icon: string }> = {
  corrupt:     { label: "Audio bị lỗi / không phát được",     icon: "bi-file-earmark-x" },
  inaudible:   { label: "Audio quá nhỏ / không nghe rõ",      icon: "bi-volume-mute" },
  wrong_label: { label: "Nhãn / câu hỏi gợi ý sai",            icon: "bi-tag" },
  offensive:   { label: "Nội dung phản cảm / không phù hợp",   icon: "bi-shield-exclamation" },
  other:       { label: "Lý do khác",                          icon: "bi-three-dots" },
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, { text: string; cls: string }> = {
  pending:  { text: "Chờ duyệt",   cls: "status-pending" },
  approved: { text: "Đã duyệt",    cls: "status-approved" },
  rejected: { text: "Bị từ chối",  cls: "status-rejected" },
};
