import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { apiClient, errorMessage, SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE } from "../src/api/client";
import { authApi } from "../src/api/auth";
import { AuthProvider, useAuth } from "../src/features/auth/AuthContext";

const user = { id: 1, email: "a@example.com", full_name: "Người chơi", role: "annotator" as const, created_at: "", last_login_at: null };
const reply401 = (config: InternalAxiosRequestConfig) =>
  Promise.reject(new AxiosError("Request failed with status code 401", "ERR_BAD_REQUEST", config, undefined,
    { status: 401, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: { detail: "Chưa đăng nhập" } }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

function Who() {
  const { user, expired } = useAuth();
  return <p>{user ? user.full_name : "khách"} · {expired ? "hết hạn" : "còn"}</p>;
}

describe("expired session", () => {
  it("signals expiry on a 401 from a normal request but not from a failed login", async () => {
    const seen = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, seen);
    const err = await apiClient.get("/dialect/workspace", { adapter: reply401 }).catch((e) => e);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(errorMessage(err)).toBe(SESSION_EXPIRED_MESSAGE);
    const login = await apiClient.post("/auth/login", {}, { adapter: reply401 }).catch((e) => e);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(errorMessage(login)).toBe("Chưa đăng nhập");
    window.removeEventListener(SESSION_EXPIRED_EVENT, seen);
  });

  it("drops the cached signed-in user as soon as the server rejects the cookie", async () => {
    vi.spyOn(authApi, "me").mockResolvedValue(user);
    render(<AuthProvider><Who /></AuthProvider>);
    await screen.findByText("Người chơi · còn");
    act(() => { window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)); });
    await waitFor(() => expect(screen.getByText("khách · hết hạn")).toBeTruthy());
    expect(localStorage.getItem("auth.user")).toBeNull();
  });
});
