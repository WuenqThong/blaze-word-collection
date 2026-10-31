import { useEffect, useState } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";
import { audiosApi } from "../../api/audios";
import { extractError } from "../../api/client";
import type { AudioItem } from "../../lib/audioTypes";
import { TASK_TYPE_LABELS, type TaskType } from "../../lib/projectTypes";

interface EditLabelModalProps {
  show: boolean;
  onHide: () => void;
  projectId: number;
  item: AudioItem | null;
  onSaved: () => void;
}

interface Field {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  required?: boolean;
}

const FIELDS_BY_TASK: Record<TaskType, Field[]> = {
  audio_label: [
    { key: "prelabel", label: "Transcript đúng (ground truth)", placeholder: "Nhập transcript đúng...", multiline: true, required: true },
  ],
  audio_verify: [
    { key: "suggested_label", label: "Nhãn đúng", placeholder: "VD: xin chào", required: true },
  ],
  qa: [
    { key: "question", label: "Câu hỏi", placeholder: "VD: Người nói là nam hay nữ?", required: true },
    { key: "options", label: "Lựa chọn (cách nhau bởi |)", placeholder: "Nam|Nữ|Không rõ" },
    { key: "answer", label: "Đáp án đúng (ground truth)", placeholder: "VD: Nam", required: true },
  ],
};

export function EditLabelModal({ show, onHide, projectId, item, onSaved }: EditLabelModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) {
      setValues({});
      return;
    }
    const init: Record<string, string> = {};
    for (const f of FIELDS_BY_TASK[item.task_type] ?? []) {
      const v = item.payload?.[f.key];
      init[f.key] = typeof v === "string" ? v : "";
    }
    setValues(init);
    setError(null);
  }, [item]);

  if (!item) return null;
  const fields = FIELDS_BY_TASK[item.task_type] ?? [];
  const taskMeta = TASK_TYPE_LABELS[item.task_type];

  const hasMissingRequired = fields.some((f) => f.required && !values[f.key]?.trim());

  const handleSave = async () => {
    setBusy(true); setError(null);
    try {
      const patch: Record<string, unknown> = {};
      for (const f of fields) {
        const v = values[f.key]?.trim() ?? "";
        if (v) patch[f.key] = v;
        else if (item.payload?.[f.key]) patch[f.key] = ""; // clear field
      }
      await audiosApi.patchPayload(projectId, item.id, patch);
      onSaved();
      onHide();
    } catch (e) {
      setError(extractError(e, "Cập nhật thất bại"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop={busy ? "static" : true}>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-pencil-square me-2 text-primary"></i>
          Sửa nhãn ground truth
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 small text-muted">
          <i className={`bi ${taskMeta.icon} me-1`}></i>
          <strong>{taskMeta.title}</strong>
          <div className="mt-1">
            <i className="bi bi-music-note-beamed me-1"></i>
            <span className="text-truncate d-inline-block align-bottom" style={{ maxWidth: 320 }}>
              {item.original_filename}
            </span>
          </div>
        </div>

        {fields.map((f) => (
          <Form.Group key={f.key} className="mb-3">
            <Form.Label className="small">
              {f.label}
              {f.required && <span className="text-danger ms-1">*</span>}
            </Form.Label>
            {f.multiline ? (
              <Form.Control
                as="textarea"
                rows={3}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                disabled={busy}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            ) : (
              <Form.Control
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                disabled={busy}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            )}
          </Form.Group>
        ))}

        <Alert variant="warning" className="py-2 small mb-0">
          <i className="bi bi-exclamation-triangle me-1"></i>
          Lưu sẽ <strong>ghi đè</strong> nhãn hiện có (force update).
        </Alert>

        {error && <Alert variant="danger" className="py-2 mt-3 mb-0">{error}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={busy}>Huỷ</Button>
        <Button variant="primary" onClick={handleSave} disabled={busy || hasMissingRequired}>
          {busy ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang lưu...</> : (
            <><i className="bi bi-check2 me-2"></i>Lưu (force)</>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
