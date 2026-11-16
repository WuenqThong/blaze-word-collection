import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AccountSettingsModal } from "../src/features/demo/AccountDemo";
import { authApi } from "../src/api/auth";

vi.mock("../src/api/auth", () => ({ authApi: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), updateMe: vi.fn(), changePassword: vi.fn() } }));
vi.mock("../src/features/auth/AuthContext", () => ({ useAuth: () => ({ user: { full_name: "Người góp", email: "player@example.com" }, updateUser: vi.fn() }) }));
vi.mock("../src/api/client", () => ({ apiClient: { get: vi.fn().mockResolvedValue({ data: { upbringing_area: "", usage_area: "" } }) }, errorMessage: () => "Chưa lưu được. Thử lại." }));
afterEach(cleanup);

it("checks profile errors on blur, not while typing", async () => {
  render(<AccountSettingsModal onHide={vi.fn()} />);
  const name = await screen.findByLabelText("Tên hiển thị");
  fireEvent.change(name, { target: { value: "" } });
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.blur(name);
  expect(screen.getByRole("alert")).toHaveTextContent("Nhập tên");
  expect(name).toHaveAccessibleDescription("Nhập tên bạn muốn hiển thị.");
  fireEvent.change(name, { target: { value: "Tên mới" } });
  expect(screen.getByRole("alert")).toBeInTheDocument();
  fireEvent.blur(name);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(authApi.updateMe).not.toHaveBeenCalled();
});

it("blocks mismatched passwords and focuses the invalid field without calling the API", async () => {
  render(<AccountSettingsModal onHide={vi.fn()} initialSection="mat-khau" />);
  const confirmation = await screen.findByLabelText("Nhập lại mật khẩu mới");
  fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: "existing123" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu mới (ít nhất 6 ký tự)"), { target: { value: "new-pass123" } });
  fireEvent.change(confirmation, { target: { value: "different123" } });
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu", exact: true }));
  expect(screen.getByRole("alert")).toHaveTextContent("Nhập giống ô Mật khẩu mới");
  expect(confirmation).toHaveFocus();
  expect(authApi.changePassword).not.toHaveBeenCalled();
});
