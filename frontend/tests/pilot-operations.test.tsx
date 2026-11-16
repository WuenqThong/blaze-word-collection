import { render, screen, cleanup, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { apiClient } from "../src/api/client";
import { PilotOperations } from "../src/features/demo/PilotOperations";
vi.mock("../src/api/client", () => ({ apiClient: { get: vi.fn() }, errorMessage: () => "Không tải được số liệu." }));
afterEach(cleanup);
const assessment = {
  scope: "whole_database",
  kpis: ["people", "samples", "review_hours", "noise_rate", "duplicate_rate", "disagreement_rate"].map(key => ({ key, status: "insufficient_evidence", reason: "Chưa có dữ liệu đúng đợt chạy thử." })),
  reviewer_gaps: [{ region: "TP. Hội An", reviewers: 1 }],
  review_timing: { completed: 3, measured: 2, missing_history: 1, completed_late: 1, pending_late: 2, oldest_waiting_hours: 60, max_completed_hours: 49 },
  next_release: { status: "pending", reason: "Chờ đánh giá trước khi chốt bản tiếp theo." },
};
it("shows unknown offline backlog and unapproved quality outcomes explicitly", async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { assessment, generated_at: "2026-11-11T00:00:00", database_engine: "sqlite", pilot_people: 20, active_reviewers: 2, targets: { samples: 1000, review_hours: 48, noise_rate: .1, duplicate_rate: .1, disagreement_rate: .2 }, pilot_evaluation: { reason: "Chưa bắt đầu đợt pilot" }, started: 2, submitted: 1, samples: 8, pending_review: 7, held: 1, rejected: 0, duplicates: 0, disagreements: 1, unresolved_disagreements: 1, oldest_pending_hours: 2, eligible_release: 0, by_region: { "TP. Hội An": 8 }, reference_questions: 10, verified_reference_questions: 0, definitions: { http: "Cửa sổ tiến trình hiện tại", expert: "Cần người bản địa duyệt độc lập" }, http: { requests: 2, server_errors: 0, unauthorized: 0, rate_limited: 0, p95_ms: 10, capped: false } } });
  render(<PilotOperations />);
  expect(await screen.findByText("Chưa thể đo từ máy chủ")).toBeInTheDocument();
  expect(screen.getByText(/Nhóm pilot:/)).toHaveTextContent("20 người");
  expect(screen.getByText(/Chưa có kết quả đánh giá chất lượng độc lập/)).toBeInTheDocument();
  const kpiTable = screen.getByRole("columnheader", { name: "Kết luận" }).closest("table")!;
  expect(within(kpiTable).getAllByText("Chưa đủ dữ liệu")).toHaveLength(6);
  expect(screen.getByText("TP. Hội An: 1/2 người duyệt được phân công.")).toBeInTheDocument();
  expect(screen.getByText("Đang chờ quá 48 giờ, gồm tạm giữ").closest("tr")).toHaveTextContent("2");
  expect(screen.getByText("Thiếu lịch sử để đo").closest("tr")).toHaveTextContent("1");
  expect(apiClient.get).toHaveBeenCalledWith("/dialect/operations/summary", expect.objectContaining({ signal: expect.any(AbortSignal) }));
});
it("offers a visible recovery action when the operations API fails", async () => {
  vi.mocked(apiClient.get).mockRejectedValue(new Error("offline"));
  render(<PilotOperations />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được số liệu");
  expect(screen.getByRole("button", { name: "Tải số liệu mới" })).toBeEnabled();
});
