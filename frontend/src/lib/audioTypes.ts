import type { TaskType } from "./projectTypes";

export interface AudioItem {
  id: number;
  project_id: number;
  original_filename: string;
  mime: string | null;
  size_bytes: number | null;
  duration_sec: number | null;
  task_type: TaskType;
  payload: Record<string, unknown>;
  is_golden: boolean;
  status: "ready" | "processing" | "error";
  error_message: string | null;
  uploaded_at: string;
  annotators_count: number;
}

export interface AudioAnnotatorItem {
  annotation_id: number;
  user_id: number;
  full_name: string;
  email: string;
  answer: Record<string, unknown>;
  answer_audio_url: string | null;
  review_status: "pending" | "approved" | "rejected";
  score_awarded: number;
  is_repeat_check: boolean;
  created_at: string;
}

export interface AudioAnnotatorsResponse {
  task_id: number;
  items: AudioAnnotatorItem[];
  total: number;
}

export interface AudioListResponse {
  items: AudioItem[];
  total: number;
}

export interface PrelabelConflictItem {
  task_id: number;
  filename: string;
  current: Record<string, unknown>;
  new: Record<string, unknown>;
}

export interface PrelabelApplyResponse {
  applied: number;
  conflicts: PrelabelConflictItem[];
  unmatched: number;
  unmatched_filenames: string[];
}

export interface ExternalSyncRequest {
  endpoint: string;
  access_key: string;
  secret_key: string;
  secure: boolean;
  bucket: string;
  prefix?: string;
  task_type: TaskType;
  is_golden?: boolean;
  limit?: number;
  prelabel_default?: Record<string, unknown>;
}

export interface ExternalSyncResponse {
  imported: number;
  skipped: number;
  errors: string[];
}

export function humanSize(bytes: number | null): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
