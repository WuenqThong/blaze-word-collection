import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, Badge, Button, Form, Spinner } from "react-bootstrap";
import { roleplayApi, type RolePlayScenario, type RolePlayTestCase } from "../../api/roleplay";
import { extractError } from "../../api/client";
import { useWebSocketAgent } from "./useWebSocketAgent";
import "./roleplay.css";

type Phase = "idle" | "starting" | "live" | "stopping" | "report" | "done" | "error";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RolePlaySessionPage() {
  const { id } = useParams<{ id: string }>();
  const scenarioId = Number(id);

  const [scenario, setScenario] = useState<RolePlayScenario | null>(null);
  const [testCases, setTestCases] = useState<RolePlayTestCase[]>([]);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [, setStatusMsg] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [agentState, setAgentState] = useState<string>("");
  const [report, setReport] = useState<Record<string, any> | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [note, setNote] = useState<string>("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [sideTab, setSideTab] = useState<"guide" | "report">("guide");

  const sessionRef = useRef<{
    taskId: number;
    language: string;
    maxDurationSec: number;
    instructions: string | null;
  } | null>(null);

  const stopRef = useRef<(() => Promise<void>) | null>(null);

  const ws = useWebSocketAgent({
    onConnectionStateChange: (s) => {
      if (s === "closed" || s === "error") {
        setStatusMsg(s === "error" ? "Mất kết nối với agent" : "");
      }
    },
    onAgentClosed: () => {
      setStatusMsg("Agent đã kết thúc cuộc gọi");
      void stopRef.current?.();
    },
    onReport: (r) => {
      setReport(r);
    },
    onAgentState: (s) => {
      setAgentState(s);
    },
  });

  useEffect(() => {
    if (!scenarioId) return;
    roleplayApi
      .getScenario(scenarioId)
      .then(setScenario)
      .catch((e) => setError(extractError(e, "Không tải được kịch bản")));
    roleplayApi
      .listScenarioTestCases(scenarioId)
      .then((tcs) => {
        setTestCases(tcs);
        if (tcs.length === 1) setSelectedTestCaseId(tcs[0].id); // auto-select if only 1
      })
      .catch(() => setTestCases([]));
  }, [scenarioId]);

  useEffect(() => {
    if (phase !== "live") return;
    const startedAt = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [phase]);

  const stop = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    setPhase("stopping");
    setStatusMsg("Đang dừng phiên · backend đang lưu recording…");
    const clientId = ws.clientId.current;
    try {
      await ws.disconnect();
    } catch {
      /* ignore */
    }
    try {
      const ended = await roleplayApi.endTask(session.taskId, { client_id: clientId });
      if (!report && ended.report_data) setReport(ended.report_data);
      // Luôn vào phase report để annotator điền feedback, dù agent có emit report hay không.
      setPhase("report");
      setStatusMsg("");
    } catch (e) {
      setError(extractError(e, "Lỗi khi dừng phiên"));
      setPhase("error");
    }
  }, [ws, report]);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  useEffect(() => {
    const session = sessionRef.current;
    if (phase !== "live" || !session) return;
    if (session.maxDurationSec > 0 && elapsed >= session.maxDurationSec) {
      void stop();
    }
  }, [elapsed, phase, stop]);

  useEffect(() => {
    return () => {
      const session = sessionRef.current;
      if (!session) return;
      if (phase === "live" || phase === "starting") {
        roleplayApi
          .endTask(session.taskId, {
            client_id: ws.clientId.current,
            error: "Closed mid-session",
          })
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    if (!scenarioId) return;
    setError(null);
    setReport(null);
    setRating(0);
    setNote("");
    setPhase("starting");
    setStatusMsg("Đang khởi tạo phiên…");
    try {
      const startResp = await roleplayApi.startTask(scenarioId, selectedTestCaseId ?? undefined);
      sessionRef.current = {
        taskId: startResp.task_id,
        language: startResp.language,
        maxDurationSec: startResp.max_duration_sec,
        instructions: startResp.instructions,
      };
      setStatusMsg("Đang kết nối agent…");

      await ws.connect({
        taskId: startResp.task_id,
        language: startResp.language,
        mode: "ai",
      });

      setPhase("live");
      setStatusMsg("");
      setElapsed(0);
    } catch (e) {
      const msg = extractError(e, "Không khởi động được phiên");
      setError(msg);
      setPhase("error");
      const session = sessionRef.current;
      if (session) {
        try {
          await roleplayApi.endTask(session.taskId, { error: msg });
        } catch {
          /* ignore */
        }
      }
    }
  }, [scenarioId, ws, selectedTestCaseId]);

  const submitReport = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || rating < 1) return;
    setSubmittingReport(true);
    try {
      await roleplayApi.submitReportRating(session.taskId, { rating, note });
      setPhase("done");
      setStatusMsg("Đã lưu đánh giá.");
    } catch (e) {
      setError(extractError(e, "Submit đánh giá thất bại"));
    } finally {
      setSubmittingReport(false);
    }
  }, [rating, note]);

  if (error && phase === "idle") return <Alert variant="danger">{error}</Alert>;
  if (!scenario) return <Spinner animation="border" />;

  const max = sessionRef.current?.maxDurationSec ?? scenario.max_duration_sec;
  const isLive = phase === "live";
  const isCalling = phase === "starting" || isLive || phase === "stopping";
  const phoneStatus =
    phase === "starting" ? "Đang gọi…" :
    phase === "stopping" ? "Đang ngắt…" :
    isLive
      ? agentState === "speaking" ? "Đang nói…"
      : agentState === "thinking" ? "Đang suy nghĩ…"
      : agentState === "listening" ? "Đang lắng nghe"
      : "Đã kết nối"
      : "";

  const selectedTestCase = testCases.find((tc) => tc.id === selectedTestCaseId);
  const instructions =
    sessionRef.current?.instructions ||
    (selectedTestCase?.instructions || scenario.instructions);
  const expectedOutcome = selectedTestCase?.expected_outcome;

  return (
    <div className="rp-stage rp-fullbleed">
      {selectedTestCase && (
        <div className="rp-stage-top">
          <div className="rp-test-case-banner">
            <div className="small text-uppercase text-muted mb-1">Trường hợp đang test</div>
            <strong>{selectedTestCase.name}</strong>
            {selectedTestCase.description && (
              <div className="small text-muted mt-1">{selectedTestCase.description}</div>
            )}
          </div>
        </div>
      )}

      <div className={`rp-phone ${isLive ? "rp-phone-active" : ""} ${agentState === "speaking" ? "rp-speaking" : ""}`}>
        <div className="rp-phone-notch"></div>
        <div className="rp-phone-screen">
          <div className="rp-status-bar">
            <span>{new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
            <div className="d-flex gap-1 align-items-center">
              <i className="bi bi-reception-4"></i>
              <i className="bi bi-wifi"></i>
              <i className="bi bi-battery-full"></i>
            </div>
          </div>

          <div className="rp-phone-content">
            <div className="rp-avatar">
              <i className="bi bi-robot"></i>
              {agentState === "speaking" && <span className="rp-pulse"></span>}
            </div>
            <h3 className="rp-task-name">{scenario.name}</h3>
            <Badge bg="light" text="dark" className="rp-lang">
              {scenario.language.toUpperCase()}
            </Badge>

            {isCalling && (
              <>
                <div className="rp-status">{phoneStatus}</div>
                {isLive && (
                  <div className="rp-timer font-monospace">{fmt(elapsed)}</div>
                )}
                {max > 0 && isLive && (
                  <div className="rp-progress">
                    <div className="rp-progress-fill" style={{ width: `${Math.min(100, (elapsed / max) * 100)}%` }}></div>
                  </div>
                )}
                {phase === "starting" && <Spinner animation="border" size="sm" />}
              </>
            )}

            {phase === "idle" && scenario.description && (
              <p className="text-muted small text-center mt-3 px-3">{scenario.description}</p>
            )}
            {phase === "idle" && testCases.length > 1 && (
              <div className="rp-test-case-picker">
                <label className="small fw-semibold mb-1 d-block">Chọn trường hợp kiểm thử:</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedTestCaseId ?? ""}
                  onChange={(e) => setSelectedTestCaseId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— Mặc định scenario —</option>
                  {testCases.map((tc) => (
                    <option key={tc.id} value={tc.id}>{tc.name}</option>
                  ))}
                </select>
              </div>
            )}

            {phase === "done" && (
              <div className="rp-done">
                <i className="bi bi-check-circle-fill text-success display-3"></i>
                <p className="mt-3 mb-0">Hoàn tất</p>
              </div>
            )}

            {phase === "error" && error && (
              <Alert variant="danger" className="mt-3 small">{error}</Alert>
            )}
          </div>

          <div className="rp-phone-controls">
            {phase === "idle" && (
              <button
                className="rp-btn rp-btn-call"
                onClick={start}
                title="Gọi"
                disabled={testCases.length > 1 && selectedTestCaseId === null}
              >
                <i className="bi bi-telephone-fill"></i>
              </button>
            )}
            {(phase === "starting" || isLive) && (
              <button className="rp-btn rp-btn-end" onClick={stop} title="Kết thúc">
                <i className="bi bi-telephone-x-fill"></i>
              </button>
            )}
            {(phase === "done" || phase === "error") && (
              <button className="rp-btn rp-btn-restart" onClick={start} title="Gọi lại">
                <i className="bi bi-arrow-clockwise"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rp-side">
        <div className="rp-side-tabs">
          <button
            type="button"
            className={`rp-side-tab ${sideTab === "guide" ? "active" : ""}`}
            onClick={() => setSideTab("guide")}
          >
            <i className="bi bi-clipboard-check me-1"></i> Hướng dẫn
          </button>
          <button
            type="button"
            className={`rp-side-tab ${sideTab === "report" ? "active" : ""}`}
            onClick={() => setSideTab("report")}
          >
            <i className="bi bi-pencil-square me-1"></i> Report
            {phase === "done" && <i className="bi bi-check-circle-fill ms-1 text-success"></i>}
          </button>
        </div>

        {sideTab === "guide" ? (
          <div className="rp-side-content">
            {instructions ? (
              <div className="rp-instructions">
                <h6 className="mb-2 small text-uppercase text-muted">Hướng dẫn</h6>
                <pre className="rp-instructions-text">{instructions}</pre>
              </div>
            ) : (
              <p className="text-muted small">Không có hướng dẫn cho trường hợp này.</p>
            )}
            {expectedOutcome && (
              <div className="rp-expected mt-3">
                <h6 className="mb-2 small text-uppercase text-muted">
                  <i className="bi bi-flag me-1"></i>Kết quả kỳ vọng
                </h6>
                <pre className="rp-instructions-text">{expectedOutcome}</pre>
              </div>
            )}
          </div>
        ) : (
          <div className="rp-side-content">
            {!sessionRef.current ? (
              <p className="text-muted small">Bấm "Gọi" để bắt đầu phiên trước khi đánh giá.</p>
            ) : (
              <>
                <div className="mb-2">
                  <label className="small text-muted d-block mb-1">Chất lượng</label>
                  <div className="rp-stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`rp-star ${n <= rating ? "active" : ""}`}
                        onClick={() => setRating(n)}
                        disabled={phase === "done"}
                      >
                        <i className="bi bi-star-fill"></i>
                      </button>
                    ))}
                  </div>
                </div>

                <Form.Control
                  as="textarea"
                  rows={6}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú: agent có hiểu đúng không? Có lỗi gì cần sửa kịch bản? Bạn có thể gõ ngay khi đang nói."
                  disabled={phase === "done"}
                  className="mb-2"
                />

                {report && (
                  <details className="mb-2">
                    <summary className="small text-primary" style={{ cursor: "pointer" }}>
                      Xem report agent đã thu thập
                    </summary>
                    <pre className="small text-muted mt-2 mb-0" style={{ whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto" }}>
                      {JSON.stringify(report, null, 2)}
                    </pre>
                  </details>
                )}

                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-muted">
                    {phase === "done" ? (
                      <><i className="bi bi-check-circle-fill text-success me-1"></i>Đã lưu</>
                    ) : phase === "live" ? (
                      <>Có thể gõ note + chấm sao ngay</>
                    ) : null}
                  </span>
                  <Button
                    size="sm"
                    onClick={submitReport}
                    disabled={rating < 1 || submittingReport || phase === "done"}
                  >
                    {submittingReport ? <Spinner animation="border" size="sm" /> : (
                      <><i className="bi bi-send me-1"></i> Gửi đánh giá</>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="text-muted small mt-3">
          <p className="mb-2">
            <i className="bi bi-shield-lock me-1"></i>
            Phiên (cả giọng bạn và agent) được ghi âm server-side.
          </p>
          {isLive && (
            <p className="mb-0">
              <i className="bi bi-info-circle me-1"></i>
              Bạn có thể cắt lời agent — cứ nói, hệ thống sẽ tự ngắt audio.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
