import type { TaskType } from "./projectTypes";

export interface NextTaskProject {
  id: number;
  name: string;
  description: string | null;
  scoring: Record<string, number>;
  redundancy: number;
}

export interface NextTaskResponse {
  has_task: boolean;
  assignment_id: number | null;
  task_id: number | null;
  task_type: TaskType | null;
  payload: Record<string, unknown>;
  audio_url: string | null;
  audio_filename: string | null;
  expires_at: string | null;
  progress: { done: number; total: number };
  project: NextTaskProject | null;
}

export interface SubmitAnnotationRequest {
  answer: Record<string, unknown>;
  time_spent_ms?: number;
  audio_listened_sec?: number;
  audio_play_count?: number;
}

export interface SubmitAnnotationResponse {
  annotation: {
    id: number;
    score_awarded: number;
    low_engagement: boolean;
  };
  score_total: number;
  annotated_count: number;
}

export interface ProjectStatsResponse {
  annotated_count: number;
  score_pending: number;
  score_confirmed: number;
}
