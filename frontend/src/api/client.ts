import axios from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  timeout: 15000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

/** Fired when a request is rejected for a missing/expired session (not a failed login). */
export const SESSION_EXPIRED_EVENT = "auth:session-expired";
export const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";

apiClient.interceptors.response.use(undefined, (error) => {
  const url = axios.isAxiosError(error) ? error.config?.url ?? "" : "";
  const authAttempt = /\/auth\/(login|register|logout)$/.test(url);
  if (axios.isAxiosError(error) && error.response?.status === 401 && !authAttempt)
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  return Promise.reject(error);
});

/** Readable text for any thrown value: API errors are translated, app errors keep their message. */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) return extractError(err);
  return err instanceof Error ? err.message : String(err);
}

export function extractError(err: unknown, fallback = "Đã có lỗi xảy ra"): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return "Không kết nối được máy chủ. Vui lòng thử lại sau ít phút.";
    if (err.response.status === 401 && !/\/auth\/(login|register)$/.test(err.config?.url ?? "")) return SESSION_EXPIRED_MESSAGE;
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  }
  return fallback;
}
