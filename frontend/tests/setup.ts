import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { Blob } from "node:buffer";
import { vi, beforeEach } from "vitest";
import { authApi } from "../src/api/auth";
vi.mock("../src/api/auth", () => ({ authApi: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() } }));
beforeEach(() => {
  localStorage.clear();
  vi.mocked(authApi.me).mockResolvedValue({ id: 101, email: "qa@example.com", full_name: "Tài khoản kiểm thử", role: "admin", created_at: "2026-11-05T00:00:00Z", last_login_at: null });
});
window.scrollTo = vi.fn();
// fake-indexeddb uses native structuredClone; jsdom's Blob loses its payload there.
Object.defineProperty(globalThis, "Blob", { value: Blob, configurable: true });
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
