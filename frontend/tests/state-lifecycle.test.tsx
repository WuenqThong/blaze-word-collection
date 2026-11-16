import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VoiceRecordCard } from "../src/features/annotate/VoiceRecordCard";
import { ScoreBurst } from "../src/components/ScoreBurst";
import { EditLabelModal } from "../src/features/projects/EditLabelModal";
import type { AudioItem } from "../src/lib/audioTypes";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("state lifecycle after lint cleanup", () => {
  it("expires a score burst and gives a subsequent award its full animation duration", () => {
    vi.useFakeTimers();
    const { rerender } = render(<ScoreBurst trigger={0} points={8} />);
    expect(screen.queryByText("+8")).toBeNull();
    rerender(<ScoreBurst trigger={1} points={8} />);
    expect(screen.getByText("+8")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1000); });
    rerender(<ScoreBurst trigger={2} points={10} />);
    act(() => { vi.advanceTimersByTime(700); });
    expect(screen.getByText("+10")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByText("+10")).toBeNull();
  });

  it("initializes label fields on first open and discards edits when switching items", () => {
    const props = { show: true, projectId: 1, onHide: vi.fn(), onSaved: vi.fn() };
    const item = { id: 1, task_type: "audio_label", payload: { prelabel: "Bản gốc" } } as AudioItem;
    const { rerender } = render(<EditLabelModal {...props} item={item} />);
    const field = screen.getByDisplayValue("Bản gốc");
    fireEvent.change(field, { target: { value: "Bản nháp" } });
    rerender(<EditLabelModal {...props} item={{ ...item, id: 2, payload: { prelabel: "Mẫu khác" } }} />);
    expect(screen.queryByDisplayValue("Bản nháp")).toBeNull();
    expect(screen.getByDisplayValue("Mẫu khác")).toBeTruthy();
  });

  it("stops a microphone granted after the user switches to another task", async () => {
    let grant!: (stream: MediaStream) => void;
    const pending = new Promise<MediaStream>((resolve) => { grant = resolve; });
    const stop = vi.fn();
    const recorder = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(() => pending) } });
    vi.stubGlobal("MediaRecorder", recorder);
    const props = { question: "Câu hỏi", submitting: false, onSubmit: vi.fn() };
    const { rerender } = render(<VoiceRecordCard {...props} audioUrl="/first.wav" />);
    fireEvent.click(screen.getByRole("button", { name: /Ghi âm/ }));
    rerender(<VoiceRecordCard {...props} audioUrl="/second.wav" />);
    await act(async () => { grant({ getTracks: () => [{ stop }] } as unknown as MediaStream); await pending; });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(recorder).not.toHaveBeenCalled();
  });

});
