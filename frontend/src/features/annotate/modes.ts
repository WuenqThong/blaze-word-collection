export type ModeKey = "" | "audio_verify" | "audio_label" | "qa";

export interface AnnotateMode {
  key: ModeKey;
  label: string;
  icon: string;
}

export const ANNOTATE_MODES: AnnotateMode[] = [
  { key: "", label: "Ngẫu nhiên", icon: "bi-shuffle" },
  { key: "audio_verify", label: "Xác nhận âm thanh", icon: "bi-headphones" },
  { key: "audio_label", label: "Nghe → Viết", icon: "bi-pencil-square" },
  { key: "qa", label: "Hỏi đáp", icon: "bi-chat-square-text" },
];
