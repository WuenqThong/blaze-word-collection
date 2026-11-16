import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { apiClient } from "../src/api/client";
import { DemoContext } from "../src/features/demo/context";
import { DatasetDemo } from "../src/features/demo/DataPipeline";
import { seed } from "../src/features/demo/seed";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function open() {
  const state = seed();
  state.actor = "account:1";
  state.people = [{ id: state.actor, name: "Quản trị", role: "admin", verified: true, region: "", risk: "clear", appeal: "" }];
  state.contributions = []; state.releases = [];
  const run = vi.fn().mockResolvedValue(state);
  render(<MemoryRouter><DemoContext.Provider value={{ state, run, live: true, refresh: vi.fn(), syncAction: vi.fn(), error: null, clearError: vi.fn() }}><DatasetDemo /></DemoContext.Provider></MemoryRouter>);
  return run;
}
const preview = {
  ids: [91], eligible_count: 1, total: 26, excluded_count: 25, preview_digest: "a".repeat(64), splits: { "91": "train" }, warnings: [], data_card: "",
  items: [{ id: 91, text: "mô", region: "Hội An", eligible: true, reasons: [] }, { id: 92, text: "mô", region: "Hội An", eligible: false, reasons: ["Trùng bản chuẩn hóa của mẫu #91"] }],
};
it("uses the server's deduplicated IDs and preview digest even with an empty device cache", async () => {
  vi.spyOn(apiClient, "get").mockResolvedValue({ data: preview });
  const run = open();
  await screen.findByText("Sẵn sàng");
  expect(screen.getByText(/1\/26 mẫu sẵn sàng/)).toBeInTheDocument();
  expect(screen.getByText("Trùng bản chuẩn hóa của mẫu #91")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tạo phiên bản" }));
  await waitFor(() => expect(run).toHaveBeenCalledWith(expect.objectContaining({ type: "release", release: expect.objectContaining({ ids: ["c:91"], previewDigest: preview.preview_digest }) })));
});
it("disables creation while the server preview is unavailable and pages through server rows", async () => {
  const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: preview });
  open();
  expect(screen.getByRole("button", { name: "Tạo phiên bản" })).toBeDisabled();
  fireEvent.click(await screen.findByRole("button", { name: "Trang sau" }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith("/dialect/releases/preview", { params: { offset: 25 } }));
});
