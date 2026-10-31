import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { roleplayApi, type RolePlayTask } from "../../api/roleplay";
import { extractError } from "../../api/client";

function statusBadge(status: RolePlayTask["status"]) {
  const variant = status === "ended" ? "success" : status === "failed" ? "danger" : "secondary";
  return <Badge bg={variant}>{status}</Badge>;
}

function fmtDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="d-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="btn btn-link p-0"
          style={{ fontSize: "1.2rem", color: n <= value ? "#fbbf24" : "#d1d5db" }}
          onClick={() => onChange(n)}
        >
          <i className="bi bi-star-fill"></i>
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ value }: { value: number }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          className="bi bi-star-fill"
          style={{ color: n <= value ? "#fbbf24" : "#d1d5db", fontSize: "0.85rem", marginRight: 1 }}
        />
      ))}
    </span>
  );
}

export function RolePlayHistoryPage() {
  const [items, setItems] = useState<RolePlayTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [reportSession, setReportSession] = useState<RolePlayTask | null>(null);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    roleplayApi
      .listMyTasks()
      .then((r) => setItems(r.items))
      .catch((e) => setError(extractError(e, "Không tải được lịch sử")));

  useEffect(() => {
    load();
  }, []);

  const playRecording = async (s: RolePlayTask) => {
    if (playingId === s.id) {
      setPlayingId(null);
      setAudioUrl(null);
      return;
    }
    try {
      const url = await roleplayApi.getRecordingUrl(s.id);
      setPlayingId(s.id);
      setAudioUrl(url);
    } catch (e) {
      setError(extractError(e, "Không lấy được recording"));
    }
  };

  const openReport = (s: RolePlayTask) => {
    setReportSession(s);
    setRating(s.report_rating || 0);
    setNote(s.report_note || "");
  };

  const submitReport = async () => {
    if (!reportSession || rating < 1) return;
    setSaving(true);
    try {
      await roleplayApi.submitReportRating(reportSession.id, { rating, note });
      setReportSession(null);
      load();
    } catch (e) {
      setError(extractError(e, "Lưu đánh giá thất bại"));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!items) return <Spinner animation="border" />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Lịch sử role-play</h2>
        <Link to="/roleplay" className="btn btn-outline-primary btn-sm">
          <i className="bi bi-arrow-left me-1"></i> Về danh sách
        </Link>
      </div>
      {items.length === 0 ? (
        <Card body className="text-muted text-center">
          Bạn chưa thực hiện phiên role-play nào.
        </Card>
      ) : (
        <Table responsive hover>
          <thead>
            <tr>
              <th>Project</th>
              <th>Kịch bản</th>
              <th>Bắt đầu</th>
              <th>Thời lượng</th>
              <th>Trạng thái</th>
              <th>Recording</th>
              <th>Đánh giá report</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <>
                <tr key={s.id}>
                  <td className="small text-muted">{s.project_name || "—"}</td>
                  <td>{s.scenario_name}</td>
                  <td className="small">{new Date(s.started_at).toLocaleString("vi-VN")}</td>
                  <td>{fmtDuration(s.duration_sec)}</td>
                  <td>{statusBadge(s.status)}</td>
                  <td>
                    {s.has_recording ? (
                      <Button
                        size="sm"
                        variant={playingId === s.id ? "primary" : "outline-primary"}
                        onClick={() => playRecording(s)}
                      >
                        <i className={`bi ${playingId === s.id ? "bi-stop-fill" : "bi-play-fill"} me-1`}></i>
                        {playingId === s.id ? "Đóng" : "Nghe"}
                      </Button>
                    ) : (
                      <span className="text-muted small">—</span>
                    )}
                  </td>
                  <td>
                    {s.has_report || s.report_rating ? (
                      <div className="d-flex align-items-center gap-2">
                        {s.report_rating ? (
                          <StarDisplay value={s.report_rating} />
                        ) : (
                          <span className="text-muted small">chưa đánh giá</span>
                        )}
                        <Button size="sm" variant="link" className="p-0" onClick={() => openReport(s)}>
                          {s.report_rating ? "Sửa" : "Đánh giá"}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted small">—</span>
                    )}
                  </td>
                </tr>
                {playingId === s.id && audioUrl && (
                  <tr key={`${s.id}-player`}>
                    <td colSpan={7} className="bg-light">
                      <audio src={audioUrl} controls autoPlay style={{ width: "100%" }} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={!!reportSession} onHide={() => setReportSession(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Đánh giá báo cáo agent</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {reportSession?.report_data ? (
            <Card body className="bg-light mb-3">
              <pre className="small mb-0" style={{ maxHeight: 240, overflow: "auto", whiteSpace: "pre-wrap" }}>
                {JSON.stringify(reportSession.report_data, null, 2)}
              </pre>
            </Card>
          ) : (
            <p className="text-muted small">Phiên này không có report từ agent.</p>
          )}

          <Form.Group className="mt-3">
            <Form.Label>Chất lượng (1-5 sao)</Form.Label>
            <StarRating value={rating} onChange={setRating} />
          </Form.Group>

          <Form.Group className="mt-3">
            <Form.Label>Ghi chú</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Phiên có vấn đề gì? Agent hiểu/sai chỗ nào?"
            />
          </Form.Group>

          {reportSession?.report_submitted_at && (
            <p className="small text-muted mt-2">
              Đã đánh giá lúc: {new Date(reportSession.report_submitted_at).toLocaleString("vi-VN")}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setReportSession(null)}>
            Đóng
          </Button>
          <Button onClick={submitReport} disabled={rating < 1 || saving}>
            {saving ? <Spinner animation="border" size="sm" /> : (
              <><i className="bi bi-send me-1"></i> Lưu đánh giá</>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
