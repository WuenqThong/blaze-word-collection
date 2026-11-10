import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { demoRoute } from "../src/features/demo/routes";
import { repository } from "../src/features/demo/repository";
import { DemoProvider } from "../src/features/demo/DemoProvider";
import { MediaAttach } from "../src/features/demo/ContributionDemo";
const mediaDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "mediaDevices",
);
beforeEach(async () => {
  await repository().reset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (mediaDescriptor)
    Object.defineProperty(navigator, "mediaDevices", mediaDescriptor);
  else Reflect.deleteProperty(navigator, "mediaDevices");
});
describe("import and audio failure paths", () => {
  it.each(["csv", "tsv", "jsonl"])(
    "imports %s with RAW rights and retry idempotency",
    async (ext) => {
      await repository().dispatch({ type: "actor", id: "admin" });
      render(
        <RouterProvider
          router={createMemoryRouter([demoRoute], {
            initialEntries: ["/demo/admin/import"],
          })}
        />,
      );
      const input = await screen.findByLabelText("Tệp CSV/TSV/JSONL");
      const row = {
        text: "Mẫu import",
        meaning: "Nghĩa mẫu",
        standard: "Bản mẫu",
        context: "Ngữ cảnh",
        evidence: "Nguồn tự soạn",
        region: "Quảng Nam",
        topic: "Sinh hoạt",
      };
      const delim = ext === "tsv" ? "\t" : ",";
      const text =
        ext === "jsonl"
          ? JSON.stringify(row)
          : `${Object.keys(row).join(delim)}\n${Object.values(row).join(delim)}`;
      const file = new File([text], `demo.${ext}`, { type: "text/plain" });
      Object.defineProperty(file, "text", { value: async () => text });
      fireEvent.change(input, { target: { files: [file] } });
      await screen.findByRole("cell", { name: "Mẫu import" });
      const button = screen.getByRole("button", {
        name: "Xác nhận nhập dòng hợp lệ / thử lại",
      });
      const user = userEvent.setup();
      await user.click(button);
      await waitFor(async () =>
        expect((await repository().load()).jobs).toHaveLength(1),
      );
      await waitFor(() => expect(button).toBeEnabled());
      await user.click(button);
      await waitFor(() => expect(button).toBeEnabled());
      const s = await repository().load();
      expect(s.contributions).toHaveLength(1);
      expect(s.contributions[0].status).toBe("RAW");
      expect(s.contributions[0].consent.train).toBe(false);
      expect(
        s.sources.find((x) => x.id === s.contributions[0].sourceId)?.train,
      ).toBe(false);
    },
  );
  it("offers upload when microphone permission is denied and creates no media", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    vi.stubGlobal("MediaRecorder", class {});
    const onChange = vi.fn();
    render(
      <DemoProvider>
        <MediaAttach ids={[]} onChange={onChange} audioAllowed />
      </DemoProvider>,
    );
    await screen.findByRole("button", { name: "Thu âm" });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("checkbox", { name: /Tôi có quyền chia sẻ/ }),
    );
    await user.click(screen.getByRole("button", { name: "Thu âm" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Tải file" })).toBeEnabled();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    expect((await repository().load()).media).toHaveLength(0);
  });
});
