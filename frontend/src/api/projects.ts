import { apiClient } from "./client";
import type { Project, ProjectKind, ProjectMember, ProjectReport, TaskType, ProjectStatus, ProjectVisibility } from "../lib/projectTypes";

export interface ProjectCreatePayload {
  name: string;
  description?: string;
  kind: ProjectKind;
  task_types: TaskType[];
  scoring?: Record<string, number>;
  redundancy: number;
  golden_ratio: number;
  repeat_ratio: number;
  visibility: ProjectVisibility;
  agent_endpoint?: string;
  default_language?: string;
}

export interface ProjectUpdatePayload {
  name?: string;
  description?: string;
  task_types?: TaskType[];
  scoring?: Record<string, number>;
  redundancy?: number;
  golden_ratio?: number;
  repeat_ratio?: number;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  agent_endpoint?: string;
  default_language?: string;
}

export const projectsApi = {
  async list(): Promise<Project[]> {
    const { data } = await apiClient.get<Project[]>("/projects");
    return data;
  },
  async get(id: number): Promise<Project> {
    const { data } = await apiClient.get<Project>(`/projects/${id}`);
    return data;
  },
  async create(payload: ProjectCreatePayload): Promise<Project> {
    const { data } = await apiClient.post<Project>("/projects", payload);
    return data;
  },
  async update(id: number, payload: ProjectUpdatePayload): Promise<Project> {
    const { data } = await apiClient.patch<Project>(`/projects/${id}`, payload);
    return data;
  },
  async remove(id: number): Promise<void> {
    await apiClient.delete(`/projects/${id}`);
  },
  async listMembers(id: number): Promise<ProjectMember[]> {
    const { data } = await apiClient.get<ProjectMember[]>(`/projects/${id}/members`);
    return data;
  },
  async addMember(id: number, user_id: number, role: "member" | "manager" = "member"): Promise<ProjectMember> {
    const { data } = await apiClient.post<ProjectMember>(`/projects/${id}/members`, { user_id, role });
    return data;
  },
  async removeMember(id: number, user_id: number): Promise<void> {
    await apiClient.delete(`/projects/${id}/members/${user_id}`);
  },
  async report(id: number): Promise<ProjectReport> {
    const { data } = await apiClient.get<ProjectReport>(`/projects/${id}/report`);
    return data;
  },
};
