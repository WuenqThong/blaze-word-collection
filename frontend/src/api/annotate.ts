import { apiClient } from "./client";
import type {
  NextTaskResponse,
  SubmitAnnotationRequest,
  SubmitAnnotationResponse,
  ProjectStatsResponse,
} from "../lib/annotateTypes";

export const annotateApi = {
  async nextTask(projectId: number): Promise<NextTaskResponse> {
    const { data } = await apiClient.get<NextTaskResponse>(`/projects/${projectId}/next-task`);
    return data;
  },
  async myNextTask(taskType?: string): Promise<NextTaskResponse> {
    const { data } = await apiClient.get<NextTaskResponse>(`/me/next-task`, {
      params: taskType ? { task_type: taskType } : undefined,
    });
    return data;
  },
  async submit(assignmentId: number, payload: SubmitAnnotationRequest): Promise<SubmitAnnotationResponse> {
    const { data } = await apiClient.post<SubmitAnnotationResponse>(
      `/assignments/${assignmentId}/submit`, payload,
    );
    return data;
  },
  async skip(assignmentId: number): Promise<void> {
    await apiClient.post(`/assignments/${assignmentId}/skip`);
  },
  async submitVoice(assignmentId: number, audioBlob: Blob, signals: {
    time_spent_ms?: number;
    audio_listened_sec?: number;
    audio_play_count?: number;
  }): Promise<SubmitAnnotationResponse> {
    const fd = new FormData();
    fd.append("audio_file", audioBlob, "answer.webm");
    if (signals.time_spent_ms != null) fd.append("time_spent_ms", String(signals.time_spent_ms));
    if (signals.audio_listened_sec != null) fd.append("audio_listened_sec", String(signals.audio_listened_sec));
    if (signals.audio_play_count != null) fd.append("audio_play_count", String(signals.audio_play_count));
    const { data } = await apiClient.post<SubmitAnnotationResponse>(
      `/assignments/${assignmentId}/submit-voice`, fd,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },
  async myStats(projectId: number): Promise<ProjectStatsResponse> {
    const { data } = await apiClient.get<ProjectStatsResponse>(`/me/projects/${projectId}/stats`);
    return data;
  },
};
