import { useEffect, useState } from "react";
import { Card, Spinner, Alert, Button, Form, Modal } from "react-bootstrap";
import { Link } from "react-router-dom";
import { reportsApi } from "../../api/reports";
import { audiosApi } from "../../api/audios";
import { extractError } from "../../api/client";
import {
  type ReportItem,
  type ReportStatus,
  REPORT_REASON_LABEL,
  REPORT_STATUS_LABEL,
} from "../../lib/reportTypes";

const STATUS_OPTIONS: { key: ReportStatus | ""; label: string }[] = [
  { key: "", label: "Tất cả" },
  { key: "pending", label: "Chờ duyệt" },
  { key: "approved", label: "Đã duyệt" },
  { key: "rejected", label: "Bị từ chối" },
];

export function ReportsAdminPage() {
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [filter, setFilter] = useState<ReportStatus | "">("pending");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [reject, setReject] = useState<{ id: number; note: string } | null>(null);

  const load = (status: ReportStatus | "") => {
    reportsApi.adminList(status || undefined)
      .then((r) => setItems(r.items))
      .catch((e) => setError(extractError(e)));
  };

  useEffect(() => { load(filter); }, [filter]);

  const handleApprove = async (id: number) => {
    setBusy(id);
    try { await reportsApi.adminReview(id, true); load(filter); }
    catch (e) { setError(extractError(e)); }
    finally { setBusy(null); }
  };

  const handleReject = async () => {
    if (!reject) return;
    setBusy(reject.id);
    try {
      await reportsApi.adminReview(reject.id, false, reject.note || undefined);
      setReject(null);
      load(filter);
    } catch (e) { setError(extractError(e)); }
    finally { setBusy(null); }
  };

  const handlePresign = async (projectId: number, audioId: number) => {
    try {
      const r = await audiosApi.presign(projectId, audioId);
      window.open(r.url, "_blank");
    } catch (e) { setError(extractError(e)); }
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <Link to="/dashboard" className="small text-muted">
            <i className="bi bi-arrow-left me-1"></i>Dashboard
          </Link>
          <h3 className="mt-1 mb-1">Báo cáo audio</h3>
          <p className="text-muted mb-0 mt-1">
            Annotator báo cáo audio bị lỗi. Approved → user nhận điểm như annotation thường. Rejected → không tính.
          </p>
        </div>
        <Form.Select size="sm" style={{ width: 200 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value as ReportStatus | "")}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </Form.Select>
      </div>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {items === null ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : items.length === 0 ? (
        <Card>
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-flag" style={{ fontSize: "2.4rem" }}></i>
            <p className="mt-2 mb-0">Không có báo cáo nào ở trạng thái này.</p>
          </Card.Body>
        </Card>
      ) : (
        <div className="ledger-list">
          {items.map((r) => {
            const reason = REPORT_REASON_LABEL[r.reason];
            const status = REPORT_STATUS_LABEL[r.status];
            return (
              <div key={r.id} className="ledger-row" style={{ alignItems: "stretch" }}>
                <button
                  type="button"
                  className="ledger-icon"
                  onClick={() => handlePresign(r.project_id, r.task_id)}
                  style={{ background: "var(--surface-2)", color: "var(--text-strong)", border: "none", cursor: "pointer" }}
                  title="Mở audio"
                >
                  <i className="bi bi-play-fill"></i>
                </button>
                <div className="ledger-body">
                  <div className="ledger-title d-flex align-items-center gap-2 flex-wrap">
                    <i className={`bi ${reason.icon}`} style={{ color: "var(--text-muted)" }}></i>
                    {reason.label}
                  </div>
                  <div className="ledger-meta">
                    {r.user_full_name} · {r.user_email} · {new Date(r.created_at).toLocaleString("vi-VN")}
                  </div>
                  <div className="ledger-meta">
                    <i className="bi bi-music-note-beamed me-1"></i>{r.audio_filename ?? `audio #${r.task_id}`}
                  </div>
                  {r.description && <div className="ledger-note">User: {r.description}</div>}
                  {r.admin_note && <div className="ledger-note">Admin: {r.admin_note}</div>}
                </div>
                <div className="d-flex flex-column align-items-end gap-2" style={{ minWidth: 200 }}>
                  <span className={`status-pill ${status.cls}`}>{status.text}</span>
                  {r.status === "approved" && r.score_awarded > 0 && (
                    <span className="small score-value">+{r.score_awarded} điểm đã trả</span>
                  )}
                  {r.status === "pending" && (
                    <div className="d-flex gap-1">
                      <Button size="sm" variant="outline-success" disabled={busy !== null}
                        onClick={() => handleApprove(r.id)}>
                        <i className="bi bi-check2 me-1"></i>Duyệt
                      </Button>
                      <Button size="sm" variant="outline-danger" disabled={busy !== null}
                        onClick={() => setReject({ id: r.id, note: "" })}>
                        <i className="bi bi-x me-1"></i>Từ chối
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal show={!!reject} onHide={() => setReject(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Lý do từ chối báo cáo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control as="textarea" rows={3}
            placeholder="VD: audio vẫn nghe rõ, không phải lỗi..."
            value={reject?.note ?? ""}
            onChange={(e) => reject && setReject({ ...reject, note: e.target.value })}
            autoFocus />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setReject(null)}>Huỷ</Button>
          <Button variant="danger" onClick={handleReject} disabled={busy !== null}>
            {busy !== null ? <Spinner size="sm" animation="border" /> : "Từ chối"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
