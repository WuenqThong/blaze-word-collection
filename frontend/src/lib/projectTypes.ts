export type TaskType = "audio_label" | "audio_verify" | "qa";
export type ProjectStatus = "draft" | "active" | "closed";
export type ProjectVisibility = "private" | "public";
export type ProjectKind = "annotate" | "collect";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  kind: ProjectKind;
  task_types: TaskType[];
  scoring: Record<string, number>;
  redundancy: number;
  golden_ratio: number;
  repeat_ratio: number;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  member_count: number;
  agent_endpoint?: string | null;
  default_language?: string | null;
  created_at: string;
  updated_at: string;
}

export const KIND_META: Record<ProjectKind, { label: string; desc: string; icon: string }> = {
  annotate: {
    label: "Gán nhãn",
    desc: "Upload audio, annotator nghe + gán nhãn / xác minh / Q&A.",
    icon: "bi-tag",
  },
  collect: {
    label: "Thu thập",
    desc: "Annotator nói chuyện với agent role-play; phiên được ghi âm và lưu lại.",
    icon: "bi-mic",
  },
};

export interface ProjectMember {
  user_id: number;
  email: string;
  full_name: string;
  role: "member" | "manager";
  joined_at: string;
}

export const TASK_TYPE_LABELS: Record<TaskType, { title: string; desc: string; icon: string }> = {
  audio_label: {
    title: "Gán nhãn audio (label/transcript)",
    desc: "Nghe audio và nhập text hoặc chọn nhãn.",
    icon: "bi-mic",
  },
  audio_verify: {
    title: "Xác minh audio (true/false)",
    desc: "Nghe audio + nhãn gợi ý, xác nhận đúng/sai.",
    icon: "bi-check2-square",
  },
  qa: {
    title: "Hỏi đáp (Q&A)",
    desc: "Trả lời câu hỏi dựa trên audio hoặc văn bản.",
    icon: "bi-chat-square-text",
  },
};

export const STATUS_BADGE: Record<ProjectStatus, { variant: string; text: string }> = {
  draft: { variant: "secondary", text: "Bản nháp" },
  active: { variant: "success", text: "Đang chạy" },
  closed: { variant: "dark", text: "Đã đóng" },
};

export type ItemProgress = "not_started" | "in_progress" | "completed";

export interface AudioReportItem {
  task_id: number;
  filename: string;
  task_type: TaskType;
  is_golden: boolean;
  num_annotations: number;
  num_required: number;
  progress: ItemProgress;
  consensus: number | null;
  distinct_answers: number;
  latest_at: string | null;
}

export interface ProjectReportSummary {
  total_items: number;
  not_started: number;
  in_progress: number;
  completed: number;
  redundancy: number;
}

export interface ProjectReport {
  summary: ProjectReportSummary;
  items: AudioReportItem[];
}
