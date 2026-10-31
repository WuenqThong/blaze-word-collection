import { useState } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";
import { reportsApi } from "../../api/reports";
import { extractError } from "../../api/client";
import { type ReportReason, REPORT_REASON_LABEL } from "../../lib/reportTypes";

interface ReportModalProps {
  show: boolean;
  onHide: () => void;
  assignmentId: number | null;
  onSuccess: () => void;
}

export function ReportModal({ show, onHide, assignmentId, onSuccess }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!assignmentId || !reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await reportsApi.create(assignmentId, reason as ReportReason, description || undefined);
      setReason(""); setDescription("");
      onSuccess();
      onHide();
    } catch (e) {
      setError(extractError(e, "Gửi report thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop={submitting ? "static" : true}>
      <Modal.Header closeButton>
        <Modal.Title><i className="bi bi-flag me-2"></i>Báo cáo audio</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info" className="d-flex align-items-start gap-2 py-2">
          <i className="bi bi-info-circle mt-1"></i>
          <div className="small">
            <strong>Audio không thể gán?</strong> Hãy báo cáo. Nếu admin xác nhận hợp lệ, bạn vẫn được tính điểm như annotation thông thường.
          </div>
        </Alert>

        <Form.Group className="mb-3">
          <Form.Label>Lý do</Form.Label>
          <div className="d-grid gap-2">
            {(Object.keys(REPORT_REASON_LABEL) as ReportReason[]).map((r) => {
              const meta = REPORT_REASON_LABEL[r];
              const active = reason === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="text-start p-3 border rounded-3 d-flex align-items-center gap-2"
                  style={{
                    background: active ? "var(--brand-50)" : "var(--surface-0)",
                    borderColor: active ? "var(--brand-500)" : "var(--surface-3)",
                    borderWidth: active ? 2 : 1,
                    cursor: "pointer",
                  }}
                >
                  <i className={`bi ${meta.icon}`} style={{ color: active ? "var(--brand-700)" : "var(--text-muted)" }}></i>
                  <span style={{ fontWeight: active ? 600 : 500 }}>{meta.label}</span>
                  {active && <i className="bi bi-check-circle-fill text-primary ms-auto"></i>}
                </button>
              );
            })}
          </div>
        </Form.Group>

        <Form.Group>
          <Form.Label>Mô tả thêm (tuỳ chọn)</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="VD: phút 0:12 có tiếng ồn lớn, không nghe rõ giọng..."
          />
        </Form.Group>

        {error && <Alert variant="danger" className="py-2 mt-3 mb-0">{error}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={submitting}>Huỷ</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!reason || submitting}>
          {submitting ? <Spinner size="sm" animation="border" /> : (
            <><i className="bi bi-send me-2"></i>Gửi báo cáo</>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
