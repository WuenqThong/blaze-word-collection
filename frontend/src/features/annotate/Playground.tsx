import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Form, Alert, Spinner, Modal } from "react-bootstrap";
import { Link, useSearchParams, useBlocker } from "react-router-dom";
import { annotateApi } from "../../api/annotate";
import { reviewApi } from "../../api/review";
import { extractError } from "../../api/client";
import type { NextTaskResponse } from "../../lib/annotateTypes";
import { AudioPlayer, type AudioPlayerHandle } from "./AudioPlayer";
import { ReportModal } from "./ReportModal";
import { GuidelineOffcanvas } from "./GuidelineOffcanvas";
import { VoiceRecordCard } from "./VoiceRecordCard";
import { ANNOTATE_MODES, type ModeKey } from "./modes";

import { useAuth } from "../auth/AuthContext";

interface PlaygroundProps {
  /** Khi có projectId → dùng /projects/:id/next-task; khi null → /me/next-task (random global). */
  projectId?: number;
  /** Render khi không có task: tuỳ chỉnh (e.g., link quay lại) */
  emptyExtra?: React.ReactNode;
}

export function Playground({ projectId, emptyExtra }: PlaygroundProps) {
  const [searchParams] = useSearchParams();
  const mode = ((searchParams.get("mode") ?? "") as ModeKey);
  const [task, setTask] = useState<NextTaskResponse | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [verdict, setVerdict] = useState<"correct" | "incorrect" | null>(null);
  const [option, setOption] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showGuideline, setShowGuideline] = useState(false);

  const playerRef = useRef<AudioPlayerHandle>(null);
  const taskStartRef = useRef<number>(Date.now());

  const { user } = useAuth();
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const draftKey = task?.assignment_id && user ? `collection.task-draft.v1.${user.id}.${task.assignment_id}` : null;
  const dirty = !!task?.has_task && (text !== (task.task_type === "audio_label" ? String(task.payload.prelabel ?? "") : "") || verdict !== null || option !== null);
  const blocker = useBlocker(dirty && !submitting);
  useEffect(() => {
    if (!dirty || submitting) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, submitting]);
  useEffect(() => {
    if (!draftKey || !task?.expires_at || !dirty) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ taskId: task.task_id, expires: task.expires_at, text, verdict, option })); }
    catch { /* Answer stays in memory; storage may be unavailable. */ }
  }, [draftKey, task, text, verdict, option, dirty]);

  const resetForTask = useCallback((t: NextTaskResponse) => {
    if (t.task_type === "audio_label") {
      const prelabel = (t.payload?.prelabel as string) ?? "";
      setText(prelabel);
      setEditing(!prelabel);
    } else {
      setText("");
      setEditing(false);
    }
    setVerdict(null);
    setOption(null);
    setDraftNotice(null);
    if (user && t.assignment_id && t.expires_at && Date.parse(t.expires_at + (/Z$|[+-]\d\d:\d\d$/.test(t.expires_at) ? "" : "Z")) > Date.now()) {
      const key = `collection.task-draft.v1.${user.id}.${t.assignment_id}`;
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? "null");
        if (saved?.taskId === t.task_id && saved.expires === t.expires_at) {
          setText(typeof saved.text === "string" ? saved.text : "");
          setVerdict(saved.verdict === "correct" || saved.verdict === "incorrect" ? saved.verdict : null);
          setOption(typeof saved.option === "string" ? saved.option : null);
          setEditing(true);
          setDraftNotice("Đã khôi phục bản nháp của nhiệm vụ này. Bản nháp chưa được gửi.");
        }
      } catch { /* Invalid drafts are never submitted automatically. */ }
    }
    taskStartRef.current = Date.now();
  }, [user]);

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTask(null); // clear ngay để tránh hiển thị task cũ trong lúc fetch
    try {
      const t = projectId !== undefined
        ? await annotateApi.nextTask(projectId)
        : await annotateApi.myNextTask(mode || undefined);
      setTask(t);
      if (t.has_task) resetForTask(t);
    } catch (e) {
      setError(extractError(e, "Không lấy được task"));
    } finally {
      setLoading(false);
    }
  }, [projectId, mode, resetForTask]);

  useEffect(() => {
    void fetchNext();
    reviewApi.myScoreSummary()
      .then((s) => { setPendingCount(s.count_pending); })
      .catch(() => {});
  }, [fetchNext]);

  const buildAnswer = (): Record<string, unknown> | null => {
    if (!task?.task_type) return null;
    if (task.task_type === "audio_label") {
      const v = text.trim();
      return v ? { text: v } : null;
    }
    if (task.task_type === "audio_verify") {
      return verdict ? { verdict } : null;
    }
    if (task.task_type === "qa") {
      const opts = (task.payload?.options as string[] | undefined) ?? [];
      if (opts.length) return option ? { option } : null;
      const v = text.trim();
      return v ? { text: v } : null;
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!task?.assignment_id) return;
    const answer = buildAnswer();
    if (!answer) return;
    setSubmitting(true);
    setError(null);
    try {
      await annotateApi.submit(task.assignment_id, {
        answer,
        time_spent_ms: Date.now() - taskStartRef.current,
        audio_listened_sec: playerRef.current?.getListenedSec(),
        audio_play_count: playerRef.current?.getPlayCount(),
      });
      if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* optional storage */ } }
      setSubmissionMessage("Đã gửi thành công. Đóng góp đang chờ kiểm duyệt; điểm chưa được xác nhận.");
      setPendingCount((c) => c + 1);
      await fetchNext();
    } catch (e) {
      setError(extractError(e, "Gửi đóng góp thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!task?.assignment_id) return;
    setSubmitting(true);
    try {
      await annotateApi.skip(task.assignment_id);
      if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* optional storage */ } }
      await fetchNext();
    } catch (e) {
      setError(extractError(e, "Chưa thể bỏ qua nhiệm vụ"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !task) {
    return (
      <div className="text-center py-5"><Spinner animation="border" /></div>
    );
  }

  // Coi là "hết task" nếu API trả has_task=false hoặc trả task nhưng thiếu audio_url
  if (error && !task) return <Alert variant="danger" role="alert"><p>{error}</p><Button variant="outline-danger" onClick={() => void fetchNext()}>Thử lại</Button></Alert>;
  const noTask = !task?.has_task || (task.task_type !== "qa" && !task.audio_url);
  if (noTask) {
    const modeLabel = ANNOTATE_MODES.find((m) => m.key === mode)?.label;
    return (
      <>
        {submissionMessage && <Alert variant="success">{submissionMessage}</Alert>}
        <div className="empty-state-wrap">
          <div className="empty-state-figure">
            <i className="bi bi-check2"></i>
          </div>
          <h4 className="empty-state-title">Bạn đã gán xong rồi</h4>
          <p className="empty-state-sub">
            {mode
              ? `Không còn task nào ở chế độ "${modeLabel}". Thử chọn chế độ khác hoặc quay lại sau.`
              : "Hệ thống sẽ tự cấp task mới khi có dữ liệu. Quay lại sau bạn nhé."}
          </p>

          {pendingCount > 0 && (
            <div className="pending-review-callout">
              <div className="pending-review-icon">
                <i className="bi bi-hourglass-split"></i>
              </div>
              <div className="pending-review-body">
                <div className="pending-review-title">
                  Bạn đang còn <strong>{pendingCount}</strong> câu chờ duyệt
                </div>
                <div className="pending-review-desc">
                  Xem lại để đảm bảo gán chính xác — bạn vẫn có thể sửa câu chưa duyệt.
                </div>
              </div>
              <Link to="/history" className="btn btn-primary btn-sm pending-review-cta">
                Xem ngay<i className="bi bi-arrow-right ms-2"></i>
              </Link>
            </div>
          )}

          {emptyExtra}
        </div>
      </>
    );
  }

  const opts = (task.payload?.options as string[] | undefined) ?? [];
  const canSubmit = !!buildAnswer();
  const isLabel = task.task_type === "audio_label";
  const isVerify = task.task_type === "audio_verify";
  const isQA = task.task_type === "qa";

  const handleVoiceSubmit = async (blob: Blob, signals: { time_spent_ms: number; audio_listened_sec: number; audio_play_count: number }) => {
    if (!task?.assignment_id) return;
    setSubmitting(true);
    setError(null);
    try {
      await annotateApi.submitVoice(task.assignment_id, blob, signals);
      if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* optional storage */ } }
      setSubmissionMessage("Đã gửi thành công. Đóng góp đang chờ kiểm duyệt; điểm chưa được xác nhận.");
      setPendingCount((c) => c + 1);
      await fetchNext();
    } catch (e) {
      setError(extractError(e, "Gửi ghi âm thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {submissionMessage && <Alert variant="success" role="status" dismissible onClose={() => setSubmissionMessage(null)}>{submissionMessage}</Alert>}
      {draftNotice && <Alert variant="info">{draftNotice} <button className="btn btn-sm btn-outline-secondary" onClick={() => { if (draftKey) localStorage.removeItem(draftKey); setText(task?.task_type === "audio_label" ? String(task.payload.prelabel ?? "") : ""); setVerdict(null); setOption(null); setDraftNotice(null); }}>Bỏ bản nháp</button></Alert>}
      <Modal show={blocker.state === "blocked"} onHide={() => blocker.state === "blocked" && blocker.reset()} centered><Modal.Header closeButton><Modal.Title>Nội dung chưa gửi</Modal.Title></Modal.Header><Modal.Body>Bản nháp văn bản được giữ trên trình duyệt này nếu bộ nhớ khả dụng. Bản ghi âm chưa gửi không được lưu khi rời trang.</Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => blocker.state === "blocked" && blocker.reset()}>Tiếp tục làm</Button><Button onClick={() => blocker.state === "blocked" && blocker.proceed()}>Rời trang</Button></Modal.Footer></Modal>
      {error && <Alert variant="danger" className="py-2" onClose={() => setError(null)} dismissible>{error}</Alert>}


      <div className="play-stage">
      {isVerify ? (
        <VerifyCard
          audioUrl={task.audio_url ?? ""}
          suggestedLabel={(task.payload?.suggested_label as string) ?? ""}
          submitting={submitting}
          onAnswer={(v) => { setVerdict(v); setTimeout(handleSubmit, 0); }}
          scoreHint={task.project ? `+${task.project.scoring?.[task.task_type ?? ""] ?? 0} điểm` : undefined}
        />
      ) : isQA ? (
        <VoiceRecordCard
          audioUrl={task.audio_url ?? ""}
          question={(task.payload?.question as string) ?? ""}
          submitting={submitting}
          onSubmit={handleVoiceSubmit}
          scoreHint={task.project ? `+${task.project.scoring?.[task.task_type ?? ""] ?? 0} điểm` : undefined}
        />
      ) : (
      <div className="play-grid">
        <section className="play-card play-audio-card">
          <div className="play-card-title">Nghe</div>
          {task.audio_url && <AudioPlayer ref={playerRef} src={task.audio_url} />}
        </section>

        <section className="play-card play-task-card">
          {task.project && (
            <div className="play-card-points">
              <i className="bi bi-stars"></i>+{task.project.scoring?.[task.task_type ?? ""] ?? 0} điểm
            </div>
          )}
          <div className="play-card-title">Kiểm tra</div>
          <div className="play-content">
            {isLabel && (
              editing ? (
                <Form.Control
                  as="textarea"
                  className="task-textarea"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void handleSubmit(); }}
                  placeholder="Nhập nội dung audio..."
                  autoFocus
                />
              ) : (
                <div className={`task-prompt ${text ? "" : "empty"}`}>
                  {text || "Bấm Edit để nhập transcript bạn nghe được"}
                </div>
              )
            )}

            {task.task_type === "audio_verify" && (
              <div className="task-prompt center">
                "{(task.payload?.suggested_label as string) ?? ""}"
              </div>
            )}

            {task.task_type === "qa" && (
              <>
                <div className="task-prompt">
                  {(task.payload?.question as string) ?? ""}
                </div>
                {opts.length ? (
                  <div className="qa-options mt-3">
                    {opts.map((opt) => (
                      <Button key={opt} className="qa-option"
                        variant={option === opt ? "primary" : "outline-primary"}
                        onClick={() => setOption(opt)}>
                        <i className={`bi ${option === opt ? "bi-record-circle-fill" : "bi-circle"} me-2`}></i>{opt}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Form.Control as="textarea" className="task-textarea mt-3"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void handleSubmit(); }}
                    placeholder="Câu trả lời..."
                    autoFocus />
                )}
              </>
            )}
          </div>

          <div className="play-actions">
            {isLabel && (
              <div className="verify-row label-actions">
                {editing ? (
                  <Button variant="primary" className="verify-btn"
                    onClick={handleSubmit} disabled={submitting || !canSubmit}>
                    <i className="bi bi-send me-2"></i>Submit
                  </Button>
                ) : (
                  <>
                    <Button variant="outline-secondary" className="verify-btn"
                      onClick={handleSubmit} disabled={submitting || !canSubmit}>
                      <i className="bi bi-check2-circle me-2"></i>Correct
                    </Button>
                    <Button variant="outline-secondary" className="verify-btn"
                      onClick={() => setEditing(true)} disabled={submitting}>
                      <i className="bi bi-pencil-square me-2"></i>Edit
                    </Button>
                  </>
                )}
              </div>
            )}

            {task.task_type === "audio_verify" && (
              <div className="verify-row">
                <Button className="verify-btn"
                  variant={verdict === "correct" ? "success" : "outline-success"}
                  onClick={() => { setVerdict("correct"); setTimeout(handleSubmit, 0); }}
                  disabled={submitting}>
                  <i className="bi bi-check2 me-2"></i>Đúng
                </Button>
                <Button className="verify-btn"
                  variant={verdict === "incorrect" ? "danger" : "outline-danger"}
                  onClick={() => { setVerdict("incorrect"); setTimeout(handleSubmit, 0); }}
                  disabled={submitting}>
                  <i className="bi bi-x me-2"></i>Sai
                </Button>
              </div>
            )}

            {task.task_type === "qa" && (
              <div className="d-flex justify-content-end">
                <Button variant="primary" onClick={handleSubmit} disabled={submitting || !canSubmit}>
                  {submitting ? <Spinner size="sm" animation="border" /> : (
                    <>Submit <i className="bi bi-arrow-right ms-2"></i></>
                  )}
                </Button>
              </div>
            )}

          </div>
        </section>
      </div>
      )}
      </div>

      <div className="play-footer">
        <button type="button" className="play-tool-btn" onClick={() => setShowGuideline(true)}>
          <i className="bi bi-journal-text"></i><span>Hướng dẫn</span>
        </button>
        <button
          type="button"
          className="play-tool-btn play-tool-btn-warning"
          onClick={() => setShowReport(true)}
          disabled={!task?.assignment_id}
        >
          <i className="bi bi-flag"></i><span>Báo cáo audio</span>
        </button>
        <div className="flex-grow-1"></div>
        <button
          type="button"
          className="play-tool-btn play-tool-btn-skip"
          onClick={handleSkip}
          disabled={!task?.assignment_id || submitting}
          title="Bỏ qua câu này, lấy câu khác"
        >
          <i className="bi bi-skip-forward"></i><span>Bỏ qua</span>
        </button>
      </div>

      <ReportModal
        show={showReport}
        onHide={() => setShowReport(false)}
        assignmentId={task?.assignment_id ?? null}
        onSuccess={() => void fetchNext()}
      />

      <GuidelineOffcanvas
        show={showGuideline}
        onHide={() => setShowGuideline(false)}
        project={task?.project ?? null}
        taskType={task?.task_type ?? null}
      />
    </>
  );
}

interface VerifyCardProps {
  audioUrl: string;
  suggestedLabel: string;
  submitting: boolean;
  onAnswer: (v: "correct" | "incorrect") => void;
  scoreHint?: string;
}

function VerifyCard({ audioUrl, suggestedLabel, submitting, onAnswer, scoreHint }: VerifyCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(false);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, [audioUrl]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      if (a.ended || (a.duration && a.currentTime >= a.duration - 0.05)) {
        a.currentTime = 0;
      }
      void a.play();
    } else {
      a.pause();
    }
  };

  return (
    <div className="verify-shell">
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />

      <div className="verify-card-large">
        {scoreHint && (
          <div className="play-card-points">
            <i className="bi bi-stars"></i>{scoreHint}
          </div>
        )}
        <div className="verify-prompt">"{suggestedLabel}"</div>
      </div>

      <div className="verify-actions-row">
        <button
          type="button"
          className="verify-action verify-action-yes"
          onClick={() => onAnswer("correct")}
          disabled={submitting}
          title="Nhãn này đúng"
        >
          <i className="bi bi-hand-thumbs-up-fill"></i>
          <span>Đúng</span>
        </button>

        <button
          type="button"
          onClick={togglePlay}
          className="verify-play-btn"
          title={playing ? "Tạm dừng" : "Phát"}
        >
          <i className={`bi ${playing ? "bi-pause-fill" : "bi-play-fill"}`}></i>
        </button>

        <button
          type="button"
          className="verify-action verify-action-no"
          onClick={() => onAnswer("incorrect")}
          disabled={submitting}
          title="Nhãn này sai"
        >
          <i className="bi bi-hand-thumbs-down-fill"></i>
          <span>Sai</span>
        </button>
      </div>

    </div>
  );
}
