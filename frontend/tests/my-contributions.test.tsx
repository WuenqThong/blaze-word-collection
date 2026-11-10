import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DemoContext } from "../src/features/demo/context";
import { MyContributions } from "../src/features/demo/MyContributions";
import { blankRaw, consentDefault, seed } from "../src/features/demo/seed";
import type { Contribution, DemoState } from "../src/features/demo/types";

afterEach(cleanup);

function item(id: string, text: string, extra: Partial<Contribution> = {}): Contribution {
  return {
    id, owner: "account:1", sessionId: null, parent: null, sourceId: "s:1", status: "RAW", createdAt: "2026-11-09T05:22:00.000Z",
    withdrawn: false, curated: null, senseId: null, qaAudio: "",
    raw: { ...blankRaw(), text, meaning: `nghĩa ${text}`, region: "TP. Hội An" },
    consent: { ...consentDefault(), collect: true }, ...extra,
  };
}

function renderWith(contributions: Contribution[]) {
  const state: DemoState = { ...seed(), actor: "account:1", contributions };
  const run = vi.fn().mockResolvedValue(state);
  render(
    <MemoryRouter>
      <DemoContext.Provider value={{ state, run, error: null, clearError: () => {}, live: true }}>
        <MyContributions />
      </DemoContext.Provider>
    </MemoryRouter>,
  );
  return run;
}

describe("Đóng góp của tôi table", () => {
  it("lists one row per contribution with readable columns and filters by text and status", () => {
    renderWith([item("c:1", "mô"), item("c:2", "rứa", { status: "VERIFIED", consent: { ...consentDefault(), collect: true, train: true } }), item("c:3", "chi", { withdrawn: true })]);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    const row = within(table).getByRole("rowheader", { name: "rứa" }).closest("tr")!;
    expect(within(row).getByText("Đã xác minh")).toBeTruthy();
    expect(within(row).getByText("Huấn luyện")).toBeTruthy();
    expect(row.textContent).toMatch(/09\/11\/2026/);
    expect(row.textContent).toMatch(/12:22/); // 05:22 UTC shown in Vietnam time

    fireEvent.change(screen.getByLabelText("Tìm cách nói, nghĩa hoặc vùng"), { target: { value: "RỨA" } });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Tìm cách nói, nghĩa hoặc vùng"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "withdrawn" } });
    expect(within(table).getByRole("rowheader").textContent).toBe("chi");
  });

  it("opens details in place and asks before withdrawing", async () => {
    const run = renderWith([item("c:1", "mô")]);
    const toggle = screen.getByRole("button", { name: "Chi tiết" });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByText("nghĩa mô")).toHaveLength(2); // table cell + detail list
    fireEvent.click(screen.getByRole("button", { name: "Rút mẫu này" }));
    expect(run).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận rút mẫu" }));
    await vi.waitFor(() => expect(run).toHaveBeenCalledWith(expect.objectContaining({ type: "consent", id: "c:1", withdraw: true })));
  });

  it("points to the game when there is nothing yet", () => {
    renderWith([]);
    expect(screen.getByRole("link", { name: "Chơi game 10 câu" })).toBeTruthy();
  });
});
