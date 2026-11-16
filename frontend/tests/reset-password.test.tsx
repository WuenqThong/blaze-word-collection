import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { apiClient } from "../src/api/client";
import { ResetPasswordPage } from "../src/features/auth/ResetPasswordPage";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function open(token = "a".repeat(43)) {
  render(<MemoryRouter initialEntries={[`/reset-password#token=${token}`]}><ResetPasswordPage /></MemoryRouter>);
}
describe("password recovery", () => {
  it("refuses a missing link and mismatching passwords before calling the server", () => {
    const post = vi.spyOn(apiClient, "post");
    open(""); expect(screen.getByRole("alert")).toHaveTextContent("không hợp lệ"); cleanup();
    open();
    fireEvent.change(screen.getByLabelText("Mật khẩu mới", {exact:true}), {target:{value:"New-pass-123"}});
    fireEvent.change(screen.getByLabelText("Nhập lại mật khẩu mới", {exact:true}), {target:{value:"Different-123"}});
    fireEvent.click(screen.getByRole("button", {name:"Đặt lại mật khẩu", exact:true}));
    expect(screen.getByRole("alert")).toHaveTextContent("chưa khớp"); expect(post).not.toHaveBeenCalled();
  });
  it("submits the fragment token in the body and requires login after success", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({status:204});
    open();
    for (const label of ["Mật khẩu mới", "Nhập lại mật khẩu mới"])
      fireEvent.change(screen.getByLabelText(label, {exact:true}), {target:{value:"New-pass-123"}});
    fireEvent.click(screen.getByRole("button", {name:"Đặt lại mật khẩu", exact:true}));
    expect(await screen.findByRole("status")).toHaveTextContent("Các phiên đăng nhập cũ đã hết hiệu lực");
    expect(post).toHaveBeenCalledWith('/auth/reset-password', {token:'a'.repeat(43), new_password:'New-pass-123'});
    expect(screen.getByRole('link', {name:'Đăng nhập lại'})).toHaveAttribute('href', '/login');
  });
});
