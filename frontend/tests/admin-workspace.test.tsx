import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { DemoContext } from "../src/features/demo/context";
import { seed } from "../src/features/demo/seed";
import { SettingsDemo } from "../src/features/demo/SettingsDemo";
import { DashboardDemo } from "../src/features/demo/DashboardDemo";
import type { ReactNode } from "react";
import { QuestionBank, ExamAdmin } from "../src/features/demo/GameAdmin";
import { ContributionDemo, HistoryDemo } from "../src/features/demo/ContributionDemo";
import { applyCommand } from "../src/features/demo/domain";
import { consentDefault } from "../src/features/demo/seed";

afterEach(cleanup);

it("keeps the question bank paginated and resets pagination when searching", () => {
  adminPage(<QuestionBank />);
  expect(screen.getAllByRole("button", { name: "Xem / sửa", exact: true })).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: "Trang câu hỏi sau" }));
  expect(screen.getByRole("navigation", { name: "Phân trang câu hỏi" })).toHaveTextContent("2/");
  fireEvent.change(screen.getByLabelText("Tìm câu hỏi"), { target: { value: "không-có-câu-hỏi-này" } });
  expect(screen.getByText("Không có câu hỏi phù hợp.")).toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Phân trang câu hỏi" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Tìm câu hỏi"), { target: { value: "" } });
  expect(screen.getByRole("navigation", { name: "Phân trang câu hỏi" })).toHaveTextContent("1/");
});

it("keeps large exam lists paginated", () => {
  adminPage(<ExamAdmin />);
  expect(screen.getAllByRole("button", { name: "Xem / cấu hình", exact: true })).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: "Trang bộ đề sau" }));
  expect(screen.getByRole("navigation", { name: "Phân trang bộ đề" })).toHaveTextContent("2/");
});

function adminPage(children: ReactNode, prepare?: (state: ReturnType<typeof seed>) => void) {
  const state = seed();
  prepare?.(state);
  state.actor = "admin-workspace";
  state.people = [{id:state.actor,name:"Quản trị",role:"admin",verified:true,region:"",risk:"clear",appeal:""}];
  const run = vi.fn().mockResolvedValue(state);
  render(<MemoryRouter><DemoContext.Provider value={{state,run,refresh:vi.fn(),syncAction:vi.fn(),error:null,clearError:vi.fn(),live:false}}>{children}</DemoContext.Provider></MemoryRouter>);
  return run;
}

it("shows a saved region outside the current catalog without replacing it", () => {
  adminPage(<QuestionBank />, state => { state.questions[0].region = "Vùng trong tư liệu gốc"; });
  fireEvent.click(screen.getAllByRole("button", { name: "Xem / sửa", exact: true })[0]);
  expect(screen.getByRole("combobox", { name: "Vùng", exact: true })).toHaveValue("Vùng trong tư liệu gốc");
});

it("requires an explicit region for a new direct contribution", () => {
  adminPage(<ContributionDemo />);
  expect(screen.getByRole("combobox", { name: "Vùng dùng *", exact: true })).toHaveValue("");
});

it("does not withdraw a round until its owner confirms", () => {
  const run = adminPage(<HistoryDemo />, state => {
    Object.assign(state, applyCommand(state, { type: "start", id: "history-round", examId: "exam-demo", campaignId: "", consent: { ...consentDefault(), collect: true, train: true } }));
    state.sessions[0].owner = "admin-workspace";
  });
  fireEvent.click(screen.getByRole("button", { name: "Rút dữ liệu lượt này", exact: true }));
  expect(screen.getByRole("dialog", { name: "Xác nhận rút lượt" })).toBeInTheDocument();
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận rút lượt", exact: true }));
  expect(run).toHaveBeenCalledWith({ type: "withdrawSession", id: "history-round" });
});

it("shows one management section at a time and preserves edits when switching",()=>{
  const run = adminPage(<SettingsDemo />);
  expect(screen.getByRole("heading",{name:"Người dùng"})).toBeInTheDocument();
  expect(screen.queryByLabelText("Chủ đề")).toBeNull();
  expect(screen.queryByRole("heading",{name:"Nguồn dữ liệu & quyền sử dụng"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Vùng & chủ đề",exact:true}));
  fireEvent.change(screen.getByLabelText("Chủ đề"),{target:{value:"Sinh hoạt gia đình"}});
  fireEvent.click(screen.getByRole("button",{name:"Người dùng",exact:true}));
  expect(screen.queryByLabelText("Chủ đề")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Vùng & chủ đề",exact:true}));
  expect(screen.getByLabelText("Chủ đề")).toHaveValue("Sinh hoạt gia đình");
  expect(run).not.toHaveBeenCalled();
});

it("takes admins from a short work list to the corresponding tools",()=>{
  adminPage(<DashboardDemo />);
  expect(screen.getByRole("link",{name:/Duyệt đóng góp/})).toHaveAttribute("href","/demo/reviewer/review");
  expect(screen.getByRole("link",{name:/Kiểm tra nội dung cần bổ sung/})).toHaveAttribute("href","/demo/reviewer/review?status=HOLD");
  expect(screen.getByRole("link",{name:/Chuẩn bị bộ dữ liệu/})).toHaveAttribute("href","/demo/reviewer/datasets");
  expect(screen.getByText("Số liệu hoạt động và cách tính").closest("details")).not.toHaveAttribute("open");
});

it("does not change account flags until the administrator saves and confirms",async()=>{
  const run=adminPage(<SettingsDemo />);
  fireEvent.click(screen.getByRole("checkbox",{name:"Đã xác nhận tài khoản",exact:true}));
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Lưu thay đổi",exact:true}));
  expect(screen.getByRole("dialog", { name: "Lưu thay đổi tài khoản" })).toBeInTheDocument();
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button",{name:"Xác nhận",exact:true}));
  expect(run).toHaveBeenCalledWith(expect.objectContaining({type:"person",person:expect.objectContaining({verified:false})}));
});
