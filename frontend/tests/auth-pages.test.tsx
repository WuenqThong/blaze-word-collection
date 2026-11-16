import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "../src/features/auth/LoginPage";
import { RegisterPage } from "../src/features/auth/RegisterPage";

const auth = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn() }));
vi.mock("../src/features/auth/AuthContext", () => ({ useAuth: () => auth }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function open(register = false) {
  render(<MemoryRouter initialEntries={[register ? "/register" : "/login"]}><Routes>
    <Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} />
    <Route path="/demo/play" element={<h1>Trang chủ APP</h1>} />
  </Routes></MemoryRouter>);
}
function fill(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
describe("account forms", () => {
  it("validates on blur and keeps the message stable while typing", () => {
    open(true);
    const email = screen.getByLabelText("Email");
    fireEvent.change(email, { target: { value: "wrong" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(email);
    expect(screen.getByRole("alert")).toHaveTextContent("Email chưa hợp lệ.");
    expect(email).toHaveAccessibleDescription("Email chưa hợp lệ.");

    fireEvent.change(email, { target: { value: "player@example.com" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.blur(email);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(email).toHaveAttribute("aria-invalid", "false");
  });
  it("rejects mismatching confirmation before calling registration API", async () => {
    open(true); fill("Họ và tên", "Người chơi"); fill("Email", "player@example.com"); fill("Mật khẩu", "secret123"); fill("Xác nhận mật khẩu", "different123");
    fireEvent.click(screen.getByRole("button", { name: "Đăng ký" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("chưa khớp");
    expect(auth.register).not.toHaveBeenCalled();
  });
  it("submits registration and navigates to the player homepage", async () => {
    auth.register.mockResolvedValue(undefined); open(true);
    fill("Họ và tên", "Người chơi"); fill("Email", "player@example.com"); fill("Mật khẩu", "secret123"); fill("Xác nhận mật khẩu", "secret123");
    fireEvent.click(screen.getByRole("button", { name: "Đăng ký" }));
    expect(await screen.findByRole("heading", { name: "Trang chủ APP" })).toBeInTheDocument();
    expect(auth.register).toHaveBeenCalledWith({ full_name: "Người chơi", email: "player@example.com", password: "secret123" });
  });
  it("keeps the form available after a failed login", async () => {
    auth.login.mockRejectedValue(new Error("offline")); open(); fill("Email", "player@example.com"); fill("Mật khẩu", "secret123");
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Đăng nhập thất bại");
    await waitFor(() => expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeEnabled());
  });
});
