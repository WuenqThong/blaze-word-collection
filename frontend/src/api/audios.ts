import { apiClient } from "./client";
import type {
  AudioAnnotatorsResponse,
  AudioItem,
  AudioListResponse,
  ExternalSyncRequest,
  ExternalSyncResponse,
  PrelabelApplyResponse,
} from "../lib/audioTypes";
import type { TaskType } from "../lib/projectTypes";

export interface UploadOptions {
  task_type: TaskType;
  is_golden?: boolean;
  payload_json?: Record<string, unknown>;
}

export const audiosApi = {
  async list(
    projectId: number,
    params: { task_type?: TaskType; status?: string; limit?: number; offset?: number } = {},
  ): Promise<AudioListResponse> {
    const { data } = await apiClient.get<AudioListResponse>(`/projects/${projectId}/tasks`, { params });
    return data;
  },

  async upload(
    projectId: number,
    files: File[],
    opts: UploadOptions,
    onProgress?: (pct: number) => void,
  ): Promise<AudioItem[]> {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    fd.append("task_type", opts.task_type);
    if (opts.is_golden) fd.append("is_golden", "true");
    if (opts.payload_json) fd.append("payload_json", JSON.stringify(opts.payload_json));

    const { data } = await apiClient.post<AudioItem[]>(
      `/projects/${projectId}/tasks/upload`,
      fd,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      },
    );
    return data;
  },

  async downloadTemplate(
    projectId: number,
    task_type: TaskType,
    is_golden: boolean,
    format: "csv" | "tsv" | "jsonl" | "json" | "xlsx",
    include_filenames = true,
  ): Promise<{ blob: Blob; filename: string }> {
    const r = await apiClient.get(`/projects/${projectId}/tasks/prelabel/template`, {
      params: { task_type, is_golden, format, include_filenames },
      responseType: "blob",
    });
    let filename = `prelabel_${task_type}_${is_golden ? "golden" : "dataset"}_template.${format}`;
    const cd = (r.headers["content-disposition"] ?? r.headers["Content-Disposition"]) as string | undefined;
    if (cd) {
      const m = /filename="?([^";]+)"?/i.exec(cd);
      if (m) filename = m[1];
    }
    return { blob: r.data as Blob, filename };
  },

  async applyPrelabel(
    projectId: number,
    file: File,
    task_type: TaskType,
    opts: { force?: boolean; onlyFilenames?: string[] } = {},
  ): Promise<PrelabelApplyResponse> {
    const fd = new FormData();
    fd.append("task_type", task_type);
    fd.append("file", file);
    if (opts.force) fd.append("force", "true");
    if (opts.onlyFilenames && opts.onlyFilenames.length > 0) {
      fd.append("only_filenames", JSON.stringify(opts.onlyFilenames));
    }
    const { data } = await apiClient.post<PrelabelApplyResponse>(
      `/projects/${projectId}/tasks/prelabel`,
      fd,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  async uploadQaQuestions(
    projectId: number,
    file: File,
    is_golden = false,
  ): Promise<AudioItem[]> {
    const fd = new FormData();
    fd.append("file", file);
    if (is_golden) fd.append("is_golden", "true");
    const { data } = await apiClient.post<AudioItem[]>(
      `/projects/${projectId}/tasks/qa-questions`,
      fd,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  async sync(projectId: number, payload: ExternalSyncRequest): Promise<ExternalSyncResponse> {
    const { data } = await apiClient.post<ExternalSyncResponse>(
      `/projects/${projectId}/tasks/sync`,
      payload,
    );
    return data;
  },

  async remove(projectId: number, audioId: number): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/tasks/${audioId}`);
  },

  async presign(projectId: number, audioId: number): Promise<{ url: string; ttl_sec: number }> {
    const { data } = await apiClient.get<{ url: string; ttl_sec: number }>(
      `/projects/${projectId}/tasks/${audioId}/presigned`,
    );
    return data;
  },

  async annotators(projectId: number, audioId: number): Promise<AudioAnnotatorsResponse> {
    const { data } = await apiClient.get<AudioAnnotatorsResponse>(
      `/projects/${projectId}/tasks/${audioId}/annotators`,
    );
    return data;
  },

  async patchPayload(
    projectId: number,
    audioId: number,
    patch: Record<string, unknown>,
  ): Promise<AudioItem> {
    const { data } = await apiClient.patch<AudioItem>(
      `/projects/${projectId}/tasks/${audioId}`,
      patch,
    );
    return data;
  },
};
