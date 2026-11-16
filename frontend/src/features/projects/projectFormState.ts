import type { ProjectKind, TaskType, ProjectVisibility } from "../../lib/projectTypes";
export interface ProjectFormState {
  name: string;
  description: string;
  kind: ProjectKind;
  task_types: TaskType[];
  scoring: Record<string, number>;
  redundancy: number;
  golden_ratio: number;
  repeat_ratio: number;
  visibility: ProjectVisibility;
  agent_endpoint: string;
  default_language: string;
}

export const DEFAULT_FORM: ProjectFormState = {
  name: "",
  description: "",
  kind: "annotate",
  task_types: ["audio_label"],
  scoring: { audio_label: 10, audio_verify: 5, qa: 8 },
  redundancy: 3,
  golden_ratio: 0.1,
  repeat_ratio: 0.0,
  visibility: "private",
  agent_endpoint: "",
  default_language: "vi",
};
