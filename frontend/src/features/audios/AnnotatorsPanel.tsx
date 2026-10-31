import { useEffect, useState } from "react";
import { Spinner, Alert, Badge } from "react-bootstrap";
import { audiosApi } from "../../api/audios";
import { extractError } from "../../api/client";
import type { AudioAnnotatorItem, AudioItem } from "../../lib/audioTypes";

interface AnnotatorsPanelProps {
  projectId: number;
  audio: AudioItem | null;
  onClose: () => void;
}

const REVIEW_STATUS_LABEL: Record<string, { text: string; bg: string }> = {
  pending:  { text: "Chờ duyệt",  bg: "secondary" },
  approved: { text: "Đã duyệt",   bg: "success" },
  rejected: { text: "Từ chối",    bg: "danger" },
};

function isVoiceAnswer(answer: Record<string, unknown>): boolean {
  return typeof answer?.audio_key === "string" && (answer.audio_key as string).length > 0;
}

function formatAnswer(answer: Record<string, unknown>): string {
  if (!answer) return "—";
  if (typeof answer.text === "string" && answer.text) return answer.text;
  if (typeof answer.option === "string" && answer.option) return answer.option;
  if (typeof answer.verdict === "string" && answer.verdict) return answer.verdict;
  const keys = Object.keys(answer);
  if (keys.length === 0) return "—";
  return JSON.stringify(answer);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

export function AnnotatorsPanel({ projectId, audio, onClose }: AnnotatorsPanelProps) {
  const [items, setItems] = useState<AudioAnnotatorItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);

  const hasAudio = !!audio && audio.task_type !== "qa" && (audio.mime ?? "").startsWith("audio/");

  useEffect(() => {
    if (!audio) {
      setItems(null);
      setError(null);
      return;
    }
    setItems(null);
    setError(null);
    audiosApi
      .annotators(projectId, audio.id)
      .then((r) => setItems(r.items))
      .catch((e) => setError(extractError(e, "Không tải được danh sách người gán")));
  }, [audio, projectId]);

  useEffect(() => {
    setAudioUrl(null);
    if (!audio || !hasAudio) return;
    setAudioLoading(true);
    let cancelled = false;
    audiosApi
      .presign(projectId, audio.id)
      .then((r) => {
        if (!cancelled) setAudioUrl(r.url);
      })
      .catch((e) => {
        if (!cancelled) setError(extractError(e, "Không tải được audio"));
      })
      .finally(() => {
        if (!cancelled) setAudioLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audio, projectId, hasAudio]);

  if (!audio) return null;

  const headerText =
    audio.task_type === "qa"
      ? ((audio.payload?.question as string) ?? audio.original_filename)
      : audio.original_filename;

  return (
    <aside className="ds-side-panel">
      <div className="ds-side-panel-header">
        <div className="flex-grow-1 min-w-0">
          <div className="ds-side-panel-title">
            <i className="bi bi-people me-2"></i>Người đã gán dữ liệu
          </div>
          <div className="ds-side-panel-sub" title={headerText}>{headerText}</div>
        </div>
        <button
          type="button"
          className="ds-side-panel-close"
          onClick={onClose}
          title="Đóng"
        >
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      <div className="ds-side-panel-body">
        {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

        {hasAudio && (
          <div className="ds-side-panel-audio">
            {audioLoading && !audioUrl ? (
              <div className="d-flex align-items-center gap-2 text-muted small py-2">
                <Spinner animation="border" size="sm" /> Đang tải audio...
              </div>
            ) : audioUrl ? (
              <audio
                key={audioUrl}
                src={audioUrl}
                controls
                preload="metadata"
                style={{ width: "100%" }}
              />
            ) : null}
          </div>
        )}

        {items === null && !error ? (
          <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
        ) : items && items.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <div className="mb-2"><i className="bi bi-people fs-3"></i></div>
            <div>Chưa có người gán dữ liệu này</div>
          </div>
        ) : items ? (
          <ul className="ds-annotator-list">
            {items.map((it) => {
              const rs = REVIEW_STATUS_LABEL[it.review_status] ?? { text: it.review_status, bg: "secondary" };
              return (
                <li key={it.annotation_id} className="ds-annotator-item">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="fw-semibold text-truncate" title={it.full_name}>{it.full_name}</div>
                      <div className="text-muted small text-truncate" title={it.email}>{it.email}</div>
                    </div>
                    <Badge bg={rs.bg} className="fw-normal flex-shrink-0">{rs.text}</Badge>
                  </div>
                  {isVoiceAnswer(it.answer) ? (
                    it.answer_audio_url ? (
                      <div className="ds-annotator-voice">
                        <audio
                          src={it.answer_audio_url}
                          controls
                          preload="metadata"
                          style={{ width: "100%" }}
                        />
                      </div>
                    ) : (
                      <div className="ds-annotator-answer text-muted small">
                        <i className="bi bi-mic-mute me-1"></i>Audio không khả dụng
                      </div>
                    )
                  ) : (
                    <div className="ds-annotator-answer" title={formatAnswer(it.answer)}>
                      <i className="bi bi-chat-left-text me-1 text-muted"></i>
                      {formatAnswer(it.answer)}
                    </div>
                  )}
                  <div className="text-muted small mt-1">
                    <i className="bi bi-clock me-1"></i>{formatDate(it.created_at)}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
