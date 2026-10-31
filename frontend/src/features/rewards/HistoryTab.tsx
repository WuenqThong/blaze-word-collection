import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner, Alert, Form, Button, Nav } from "react-bootstrap";
import { reviewApi } from "../../api/review";
import { audiosApi } from "../../api/audios";
import { extractError } from "../../api/client";
import { type AnnotationItem, type ReviewStatus } from "../../lib/reviewTypes";
import { type TaskType } from "../../lib/projectTypes";
import { RelabelModal } from "./RelabelModal";

type TaskFilter = TaskType;
const TASK_TABS: { key: TaskFilter; label: string; icon: string }[] = [
  { key: "audio_label", label: "Gán nhãn", icon: "bi-pencil-square" },
  { key: "audio_verify", label: "Xác minh", icon: "bi-headphones" },
  { key: "qa", label: "Hỏi đáp", icon: "bi-chat-square-text" },
];

const STATUS_PILL: Record<ReviewStatus, { cls: string; text: string }> = {
  pending: { cls: "status-pending", text: "Chờ duyệt" },
  approved: { cls: "status-approved", text: "Đã duyệt" },
  rejected: { cls: "status-rejected", text: "Bị từ chối" },
};

function answerLabel(item: AnnotationItem): string {
  const a = item.answer ?? {};
  if (typeof a.text === "string") return a.text as string;
  if (typeof a.verdict === "string") return a.verdict === "correct" ? "Đúng" : "Sai";
  if (typeof a.option === "string") return a.option as string;
  return "—";
}

function fmtDateTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " · "
    + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function HistoryTab() {
  const [items, setItems] = useState<AnnotationItem[] | null>(null);
  const [filter, setFilter] = useState<"" | ReviewStatus>("");
  const [taskTab, setTaskTab] = useState<TaskFilter>("audio_label");
  const [error, setError] = useState<string | null>(null);
  const [relabelId, setRelabelId] = useState<number | null>(null);

  const filteredItems = useMemo(() => {
    if (!items) return null;
    return items.filter((it) => it.task_type === taskTab);
  }, [items, taskTab]);

  const counts = useMemo(() => {
    const c: Record<TaskFilter, number> = { audio_label: 0, audio_verify: 0, qa: 0 };
    items?.forEach((it) => { if (c[it.task_type] !== undefined) c[it.task_type]++; });
    return c;
  }, [items]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlCacheRef = useRef<Map<number, string>>(new Map());

  const load = (status: "" | ReviewStatus) => {
    reviewApi
      .myAnnotations({ review_status: status || undefined, limit: 200 })
      .then((r) => setItems(r.items))
      .catch((e) => setError(extractError(e)));
  };

  useEffect(() => { load(filter); }, [filter]);

  // Stop on unmount
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const togglePlay = async (it: AnnotationItem) => {
    const a = audioRef.current;
    if (!a) return;

    // toggle off if same row
    if (playingId === it.id && !a.paused) {
      a.pause();
      return;
    }

    // resume if same row paused
    if (playingId === it.id && a.paused && a.src) {
      void a.play();
      return;
    }

    setBusyId(it.id);
    try {
      let url = urlCacheRef.current.get(it.id);
      if (!url) {
        const r = await audiosApi.presign(it.project_id, it.task_id);
        url = r.url;
        urlCacheRef.current.set(it.id, url);
      }
      a.src = url;
      setPlayingId(it.id);
      await a.play();
    } catch (e) {
      setError(extractError(e, "Không phát được audio"));
      setPlayingId(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <audio
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        onPause={() => {
          // Phát hiện pause do hết bài hoặc thao tác khác — không reset playingId nếu chỉ paused giữa chừng
        }}
        preload="none"
        style={{ display: "none" }}
      />

      <div className="d-flex flex-wrap align-items-end justify-content-between mb-3 gap-2">
        <Nav variant="tabs" activeKey={taskTab} onSelect={(k) => k && setTaskTab(k as TaskFilter)} className="history-tabs">
          {TASK_TABS.map((t) => (
            <Nav.Item key={t.key}>
              <Nav.Link eventKey={t.key}>
                <i className={`bi ${t.icon} me-1`}></i>
                {t.label}
                <span className="history-tab-count">{counts[t.key]}</span>
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
        <Form.Select
          size="sm"
          style={{ width: 180 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value as "" | ReviewStatus)}
        >
          <option value="">Mọi trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Bị từ chối</option>
        </Form.Select>
      </div>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {filteredItems === null ? (
        <div className="text-center py-5"><Spinner animation="border" size="sm" /></div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-inbox" style={{ fontSize: "2.2rem" }}></i>
          <p className="mt-2 mb-0">Chưa có annotation nào ở loại này.</p>
        </div>
      ) : (
        <div className="history-list">
          {filteredItems.map((it) => {
            const pill = STATUS_PILL[it.review_status];
            const canEdit = it.review_status === "pending";
            const isPlaying = playingId === it.id && !audioRef.current?.paused;
            const isBusy = busyId === it.id;
            return (
              <div key={it.id} className={`history-row ${isPlaying ? "is-playing" : ""}`}>
                <button
                  type="button"
                  className="history-play"
                  onClick={() => togglePlay(it)}
                  disabled={isBusy}
                  title={isPlaying ? "Tạm dừng" : "Nghe audio"}
                >
                  {isBusy ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <i className={`bi ${isPlaying ? "bi-pause-fill" : "bi-play-fill"}`}></i>
                  )}
                </button>
                <div className="history-body">
                  <div className="history-label">{answerLabel(it)}</div>
                  <div className="history-time">
                    <i className="bi bi-clock me-1"></i>{fmtDateTime(it.created_at)}
                  </div>
                </div>
                <span className={`status-pill ${pill.cls}`}>{pill.text}</span>
                <div className="history-action">
                  {canEdit && (
                    <Button size="sm" variant="outline-secondary"
                      onClick={() => setRelabelId(it.id)}
                      style={{ borderRadius: 999, padding: "0.3rem 0.85rem" }}>
                      <i className="bi bi-pencil me-1"></i>Sửa
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RelabelModal
        show={relabelId !== null}
        annotationId={relabelId}
        onHide={() => setRelabelId(null)}
        onSaved={() => load(filter)}
      />
    </>
  );
}
