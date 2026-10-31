import type { TaskType } from "./projectTypes";

export type ReviewStatus = "pending" | "approved" | "rejected";
export type AccountStatus = "active" | "under_review" | "suspended";

export interface AnnotationItem {
  id: number;
  project_id: number;
  task_id: number;
  task_type: TaskType;
  answer: Record<string, unknown>;
  score_awarded: number;
  review_status: ReviewStatus;
  review_note: string | null;
  reviewed_at: string | null;
  is_golden_check: boolean;
  low_engagement: boolean;
  created_at: string;
}

export interface AnnotationListResponse {
  items: AnnotationItem[];
  total: number;
}

export interface UserScoreSummary {
  score_pending: number;
  score_confirmed: number;
  score_rejected: number;
  count_pending: number;
  count_approved: number;
  count_rejected: number;
  count_reviewed: number;
  error_rate: number;
  account_status: AccountStatus;
}

export interface FlaggedUserItem {
  user_id: number;
  email: string;
  full_name: string;
  account_status: AccountStatus;
  error_rate: number;
  count_reviewed: number;
  count_approved: number;
  count_rejected: number;
  score_confirmed: number;
}

export interface TopAnnotator {
  user_id: number;
  full_name: string;
  score_confirmed: number;
  count_approved: number;
  count_reviewed: number;
  accuracy: number;
}

export interface AdminOverview {
  total_annotators: number;
  annotators_active: number;
  annotators_under_review: number;
  annotators_suspended: number;
  annotators_active_last_7d: number;
  total_annotations: number;
  annotations_pending: number;
  annotations_approved: number;
  annotations_rejected: number;
  annotations_new_today: number;
  annotations_new_last_7d: number;
  top_annotators: TopAnnotator[];
}

export interface RelabelContext {
  annotation_id: number;
  audio_url: string;
  audio_filename: string;
  task_type: TaskType;
  payload: Record<string, unknown>;
  current_answer: Record<string, unknown>;
}

export const STATUS_BADGE: Record<ReviewStatus, { variant: string; text: string }> = {
  pending: { variant: "secondary", text: "Chờ duyệt" },
  approved: { variant: "success", text: "Đã duyệt" },
  rejected: { variant: "danger", text: "Bị từ chối" },
};

// ----- Data-centric review (admin) -----

export interface TaskTypeStats {
  task_type: TaskType;
  total_tasks: number;
  annotations_total: number;
  annotations_pending: number;
  annotations_approved: number;
  annotations_rejected: number;
  consensus_rate: number | null;
}

export interface DataReviewItem {
  audio_id: number;
  project_id: number;
  project_name: string;
  filename: string;
  audio_url: string | null;
  pending_count: number;
  task_types: TaskTypeStats[];
}

export interface DataReviewListResponse {
  items: DataReviewItem[];
  total: number;
}

export interface DataReviewAnnotation {
  id: number;
  user_id: number;
  user_email: string;
  user_full_name: string;
  answer: Record<string, unknown>;
  review_status: ReviewStatus;
  review_note: string | null;
  score_awarded: number;
  low_engagement: boolean;
  is_golden_check: boolean;
  time_spent_ms: number | null;
  audio_listened_sec: number | null;
  audio_play_count: number | null;
  created_at: string | null;
}

export interface DataReviewTaskItem {
  task_id: number;
  payload: Record<string, unknown>;
  is_golden: boolean;
  parent_task_id: number | null;
  annotations: DataReviewAnnotation[];
}

export interface DataReviewGroup {
  task_type: TaskType;
  tasks: DataReviewTaskItem[];
}

export interface DataReviewDetail {
  audio_id: number;
  project_id: number | null;
  project_name: string | null;
  filename: string;
  audio_url: string | null;
  groups: DataReviewGroup[];
}
