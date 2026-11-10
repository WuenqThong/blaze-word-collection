import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { demoRoute } from "../src/features/demo/routes";
import { repository } from "../src/features/demo/repository";
import { openDB } from "idb";
import { authApi } from "../src/api/auth";
function app(path = "/demo") {
  const router = createMemoryRouter([demoRoute], { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}
beforeEach(async () => {
  await repository().reset();
  const db = await openDB("appdichthuat-review-demo-v1", 1);
  const state = await db.get("state", "main");
  state.exams.forEach((e: { id: string; status: string }) => { if (e.id !== "exam-demo") e.status = "closed"; });
  await db.put("state", state, "main"); db.close();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("player to admin integration using actual routes and IndexedDB", () => {
  it("explains the required consent when starting a game and starts after consent", async () => {
    const user = userEvent.setup();
    app("/demo/play");
    const start = await screen.findByRole(
      "button",
      { name: /Bắt đầu chơi/ },
      { timeout: 5000 },
    );
    expect(start).toBeEnabled();
    await user.click(start);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Hãy tích chọn.*Tiếp nhận & kiểm duyệt/,
    );
    expect((await repository().load()).sessions).toHaveLength(0);

    await user.click(screen.getByLabelText(/Tiếp nhận & kiểm duyệt/));
    await user.click(start);
    await screen.findByRole("heading", { name: "Q01 / 10" });
    expect((await repository().load()).sessions).toHaveLength(1);
  });

  it("plays ten questions anonymously, reloads draft, submits and sees every answer in admin", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("No network should be needed"));
    const user = userEvent.setup();
    const view = app();
    await screen.findByRole("heading", { name: /Tiếng quê mình/ }, { timeout: 5000 });
    await user.click(
      within(screen.getByRole("main")).getByRole("link", {
        name: /Chơi game 10 câu/,
      }),
    );
    await screen.findByRole("heading", { name: /Mười câu hỏi/ });
    await user.click(screen.getByLabelText(/Tiếp nhận & kiểm duyệt/));
    await user.click(
      screen.getByRole("button", { name: /Bắt đầu chơi/ }),
    );
    await screen.findByRole("heading", { name: "Q01 / 10" });
    fireEvent.change(screen.getByLabelText("Cách nói phổ thông *"), {
      target: { value: "Nháp phục hồi" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Lưu & tiếp tục" }),
      ).toBeEnabled(),
    );
    const route = view.router.state.location.pathname;
    view.unmount();
    const resumed = app(route);
    await screen.findByRole("heading", { name: "Q01 / 10" });
    expect(screen.getByLabelText("Cách nói phổ thông *")).toHaveValue(
      "Nháp phục hồi",
    );
    for (let i = 0; i < 10; i++) {
      await screen.findByRole("heading", {
        name: `Q${String(i + 1).padStart(2, "0")} / 10`,
      });
      if (i === 2) {
        await user.click(
          screen.getByRole("button", { name: "Bỏ qua câu này" }),
        );
        continue;
      }
      fireEvent.change(screen.getByLabelText("Cách nói phổ thông *"), {
        target: { value: `Đáp án minh họa ${i + 1}` },
      });
      if (i >= 8) {
        for (const label of [
          "Nghĩa bạn muốn giải thích *",
          "Cách nói phổ thông *",
          "Ví dụ / ngữ cảnh *",
        ])
          fireEvent.change(screen.getByLabelText(label), {
            target: { value: `Nội dung ${i + 1}` },
          });
      }
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Lưu & tiếp tục" }),
        ).toBeEnabled(),
      );
      await user.click(screen.getByRole("button", { name: "Lưu & tiếp tục" }));
    }
    await screen.findByRole("heading", {
      name: "Bạn thường nghe cách nói này ở đâu?",
    });
    await user.selectOptions(
      screen.getByLabelText("Nơi đang sống *"),
      "Quận Hải Châu",
    );
    fireEvent.change(screen.getByLabelText("Nơi lớn lên *"), {
      target: { value: "Quận Hải Châu" },
    });
    expect(screen.queryByLabelText("Nơi dùng phương ngữ *")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Xem lại 10 câu" }));
    await screen.findByRole("heading", { name: "Xem lại trước khi gửi" });
    await user.click(
      screen.getByRole("button", { name: "Gửi kết quả 10 câu" }),
    );
    await screen.findByRole("heading", {
      name: "Cảm ơn bạn đã góp.",
    });
    const state = await repository().load();
    expect(state.sessions[0].answers).toHaveLength(10);
    expect(state.sessions[0].answers[2].skipped).toBe(true);
    expect(state.credits).toHaveLength(0);
    await resumed.router.navigate("/demo/internal");
    await screen.findByRole("heading", { name: "Thử nghiệm nội bộ" });
    await user.selectOptions(screen.getByLabelText("Vai trò DEMO"), "admin");
    await resumed.router.navigate(`/demo/admin/sessions/${state.sessions[0].id}`);
    await screen.findByRole("heading", {
      name: "Lượt chơi & từng câu trả lời",
    });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      11,
    );
    expect(screen.getByText("Đã bỏ qua")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);
  it("opens every public and management page without relying on the backend", async () => {
    await repository().dispatch({ type: "actor", id: "admin" });
    const paths = [
      "/demo",
      "/demo/play",
      "/demo/contribute",
      "/demo/history",
      "/demo/tasks",
      "/demo/campaigns",
      "/demo/dictionary",
      "/demo/community",
      "/demo/rewards",
      "/demo/ai",
      "/demo/rights",
      "/demo/admin/questions",
      "/demo/admin/exams",
      "/demo/admin/sessions",
      "/demo/admin/review",
      "/demo/admin/settings",
      "/demo/admin/import",
      "/demo/admin/datasets",
      "/demo/admin/dashboard",
      "/demo/admin/operations",
    ];
    for (const path of paths) {
      const view = app(path);
      await waitFor(() =>
        expect(
          within(screen.getByRole("main")).getAllByRole("heading", { level: 1 })
            .length,
        ).toBeGreaterThan(0),
      );
      expect(
        screen.queryByText(/Unexpected Application Error/),
      ).not.toBeInTheDocument();
      view.unmount();
    }
  }, 30000);
  it("shows denied management access to a contributor", async () => {
    vi.mocked(authApi.me).mockResolvedValue({ id: 102, email: "member@example.com", full_name: "Người tham gia", role: "annotator", created_at: "2026-11-05T00:00:00Z", last_login_at: null });
    app("/demo/admin/exams");
    await screen.findByRole("heading", { name: "Cần đổi vai trò demo" });
    expect(
      screen.queryByRole("button", { name: "Tạo bộ đề 10 câu" }),
    ).not.toBeInTheDocument();
  });
});
