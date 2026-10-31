import { apiClient } from "./client";
import type { ReportItem, ReportReason } from "../lib/reportTypes";

export const reportsApi = {
  async create(assignmentId: number, reason: ReportReason, description?: string): Promise<ReportItem> {
    const { data } = await apiClient.post<ReportItem>(`/assignments/${assignmentId}/report`, {
      reason, description,
    });
    return data;
  },
  async listMine(): Promise<{ items: ReportItem[]; total: number }> {
    const { data } = await apiClient.get<{ items: ReportItem[]; total: number }>("/me/reports");
    return data;
  },
  async adminList(status?: string): Promise<{ items: ReportItem[]; total: number }> {
    const { data } = await apiClient.get<{ items: ReportItem[]; total: number }>("/admin/reports", { params: { status } });
    return data;
  },
  async adminReview(id: number, approve: boolean, note?: string): Promise<ReportItem> {
    const { data } = await apiClient.post<ReportItem>(`/admin/reports/${id}/review`, { approve, note });
    return data;
  },
};
