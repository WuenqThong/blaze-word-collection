import { useEffect, useRef, useState } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";
import { reviewApi } from "../../api/review";
import { extractError } from "../../api/client";
import type { RelabelContext } from "../../lib/reviewTypes";
import { AudioPlayer, type AudioPlayerHandle } from "../annotate/AudioPlayer";

interface RelabelModalProps {
  show: boolean;
  annotationId: number | null;
  onHide: () => void;
  onSaved: () => void;
}

export function RelabelModal({ show, annotationId, onHide, onSaved }: RelabelModalProps) {
  const [ctx, setCtx] = useState<RelabelContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [text, setText] = useState("");
  const [verdict, setVerdict] = useState<"correct" | "incorrect" | null>(null);
  const [option, setOption] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayerHandle>(null);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!show || !annotationId) {
      setCtx(null); setError(null);
      return;
    }
    setCtx(null);
    setError(null);
    reviewApi.relabelContext(annotationId)
      .then((c) => {
        setCtx(c);
        startRef.current = Date.now();
        const cur = c.current_answer ?? {};
        setText(typeof cur.text === "string" ? (cur.text as string) : "");
        setVerdict(typeof cur.verdict === "string" ? (cur.verdict as "correct" | "incorrect") : null);
        setOption(typeof cur.option === "string" ? (cur.option as string) : null);
      })
      .catch((e) => setError(extractError(e, "Không tải được dữ liệu")));
  }, [show, annotationId]);

  const buildAnswer = (): Record<string, unknown> | null => {
    if (!ctx) return null;
    if (ctx.task_type === "audio_label") {
      const v = text.trim();
      return v ? { text: v } : null;
    }
    if (ctx.task_type === "audio_verify") {
      return verdict ? { verdict } : null;
    }
    if (ctx.task_type === "qa") {
      const opts = (ctx.payload?.options as string[] | undefined) ?? [];
      if (opts.length) return option ? { option } : null;
      const v = text.trim();
      return v ? { text: v } : null;
    }
    return null;
  };

  const handleSave = async () => {
    if (!ctx) return;
    const answer = buildAnswer();
    if (!answer) return;
    setSaving(true);
    setError(null);
    try {
      await reviewApi.relabel(ctx.annotation_id, {
        answer,
        time_spent_ms: Date.now() - startRef.current,
        audio_listened_sec: playerRef.current?.getListenedSec(),
        audio_play_count: playerRef.current?.getPlayCount(),
      });
      onSaved();
      onHide();
    } catch (e) {
      setError(extractError(e, "Lưu thất bại"));
    } finally {
      setSaving(false);
    }
  };

  const opts = (ctx?.payload?.options as string[] | undefined) ?? [];
  const canSave = !!buildAnswer();

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop={saving ? "static" : true}>
      <Modal.Header closeButton>
        <Modal.Title>Sửa lại annotation</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        {!ctx ? (
          <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
        ) : (
          <>
            <AudioPlayer ref={playerRef} src={ctx.audio_url} />

            <div className="mt-4">
              {ctx.task_type === "audio_label" && (
                <Form.Control
                  as="textarea"
                  className="task-textarea"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Nhập transcript audio..."
                  autoFocus
                />
              )}

              {ctx.task_type === "audio_verify" && (
                <>
                  <div className="task-prompt center mb-3">
                    "{(ctx.payload?.suggested_label as string) ?? ""}"
                  </div>
                  <div className="d-flex gap-2 justify-content-center">
                    <Button variant={verdict === "correct" ? "success" : "outline-success"}
                      onClick={() => setVerdict("correct")} className="px-4">
                      <i className="bi bi-check2 me-2"></i>Đúng
                    </Button>
                    <Button variant={verdict === "incorrect" ? "danger" : "outline-danger"}
                      onClick={() => setVerdict("incorrect")} className="px-4">
                      <i className="bi bi-x me-2"></i>Sai
                    </Button>
                  </div>
                </>
              )}

              {ctx.task_type === "qa" && (
                <>
                  <div className="task-prompt mb-3">
                    {(ctx.payload?.question as string) ?? ""}
                  </div>
                  {opts.length ? (
                    <div className="d-grid gap-2">
                      {opts.map((opt) => (
                        <Button key={opt} variant={option === opt ? "primary" : "outline-primary"}
                          onClick={() => setOption(opt)} className="text-start">
                          <i className={`bi ${option === opt ? "bi-record-circle-fill" : "bi-circle"} me-2`}></i>{opt}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Form.Control as="textarea" className="task-textarea"
                      value={text} onChange={(e) => setText(e.target.value)}
                      placeholder="Câu trả lời..." autoFocus />
                  )}
                </>
              )}
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={saving}>Huỷ</Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSave || saving}>
          {saving ? <Spinner size="sm" animation="border" /> : (
            <><i className="bi bi-check2 me-2"></i>Lưu thay đổi</>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
