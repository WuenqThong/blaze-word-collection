import { apiClient } from "./client";
import type {
  AdminOverview,
  AnnotationListResponse,
  AnnotationItem,
  UserScoreSummary,
  FlaggedUserItem,
  ReviewStatus,
  AccountStatus,
  RelabelContext,
  DataReviewListResponse,
  DataReviewDetail,
} from "../lib/reviewTypes";

export const reviewApi = {
  // Annotator
  async myAnnotations(params: { review_status?: ReviewStatus; project_id?: number; limit?: number } = {}): Promise<AnnotationListResponse> {
    const { data } = await apiClient.get<AnnotationListResponse>("/me/annotations", { params });
    return data;
  },
  async myScoreSummary(): Promise<UserScoreSummary> {
    const { data } = await apiClient.get<UserScoreSummary>("/me/score-summary");
    return data;
  },
  async relabelContext(annotationId: number): Promise<RelabelContext> {
    const { data } = await apiClient.get<RelabelContext>(`/me/annotations/${annotationId}/relabel-context`);
    return data;
  },
  async relabel(annotationId: number, payload: {
    answer: Record<string, unknown>;
    time_spent_ms?: number;
    audio_listened_sec?: number;
    audio_play_count?: number;
  }): Promise<AnnotationItem> {
    const { data } = await apiClient.patch<AnnotationItem>(`/me/annotations/${annotationId}`, payload);
    return data;
  },
  // Admin
  async adminOverview(): Promise<AdminOverview> {
    const { data } = await apiClient.get<AdminOverview>("/admin/overview");
    return data;
  },
  async pending(limit = 50): Promise<AnnotationListResponse> {
    const { data } = await apiClient.get<AnnotationListResponse>("/admin/annotations/pending", { params: { limit } });
    return data;
  },
  async review(annotationId: number, approve: boolean, note?: string): Promise<AnnotationItem> {
    const { data } = await apiClient.post<AnnotationItem>(`/admin/annotations/${annotationId}/review`, { approve, note });
    return data;
  },
  async flaggedUsers(): Promise<FlaggedUserItem[]> {
    const { data } = await apiClient.get<FlaggedUserItem[]>("/admin/users/flagged");
    return data;
  },
  async setAccountStatus(userId: number, status: AccountStatus): Promise<FlaggedUserItem> {
    const { data } = await apiClient.post<FlaggedUserItem>(`/admin/users/${userId}/account-status`, { status });
    return data;
  },
  async reviewByData(params: { project_id?: number; limit?: number; offset?: number } = {}): Promise<DataReviewListResponse> {
    const { data } = await apiClient.get<DataReviewListResponse>("/admin/review/by-data", { params });
    return data;
  },
  async reviewDataDetail(audioId: number): Promise<DataReviewDetail> {
    const { data } = await apiClient.get<DataReviewDetail>(`/admin/review/by-data/${audioId}`);
    return data;
  },
};
