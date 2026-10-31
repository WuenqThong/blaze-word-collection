import { useState, useEffect, useMemo } from "react";
import { Modal, Button, Form, Alert, InputGroup, Dropdown } from "react-bootstrap";
import { audiosApi } from "../../api/audios";
import { extractError } from "../../api/client";
import { TASK_TYPE_LABELS, type TaskType } from "../../lib/projectTypes";
import type { PrelabelApplyResponse, PrelabelConflictItem } from "../../lib/audioTypes";

type TemplateFormat = "csv" | "tsv" | "jsonl" | "json" | "xlsx";

const TEMPLATE_FORMATS: { key: TemplateFormat; label: string; icon: string; desc: string }[] = [
  { key: "csv",   label: "CSV",   icon: "bi-filetype-csv",   desc: "Mở bằng Excel / Google Sheets" },
  { key: "xlsx",  label: "Excel", icon: "bi-file-earmark-excel", desc: ".xlsx — định dạng Excel native" },
  { key: "tsv",   label: "TSV",   icon: "bi-table",          desc: "Tab-separated, dễ paste vào sheet" },
  { key: "jsonl", label: "JSONL", icon: "bi-filetype-json",  desc: "Mỗi dòng là 1 JSON object" },
  { key: "json",  label: "JSON",  icon: "bi-braces",         desc: "1 mảng JSON hoàn chỉnh" },
];

interface UploadLabelsModalProps {
  show: boolean;
  onHide: () => void;
  projectId: number;
  taskType: TaskType;
  isGolden: boolean;
  filenames?: string[];
  onApplied: () => void;
}

const HEADERS_BY_TASK: Record<TaskType, { golden: string[]; normal: string[] }> = {
  audio_label: {
    golden: ["filename", "prelabel"],
    normal: ["filename", "prelabel"],
  },
  audio_verify: {
    golden: ["filename", "suggested_label"],
    normal: ["filename", "suggested_label"],
  },
  qa: {
    golden: ["filename", "question", "options", "answer"],
    normal: ["filename", "question", "options"],
  },
};

const EXAMPLE_BY_TASK: Record<TaskType, { golden: string[]; normal: string[] }> = {
  audio_label: {
    golden: ["foo.wav", "xin chào hôm nay là thứ hai"],
    normal: ["foo.wav", "xin chào hôm nay là thứ hai"],
  },
  audio_verify: {
    golden: ["foo.wav", "xin chào"],
    normal: ["foo.wav", "xin chào"],
  },
  qa: {
    golden: ["foo.wav", "Người nói nam hay nữ?", "Nam|Nữ|Không rõ", "Nam"],
    normal: ["foo.wav", "Người nói nam hay nữ?", "Nam|Nữ|Không rõ"],
  },
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(" | ");
  return JSON.stringify(v);
}

export function UploadLabelsModal({
  show, onHide, projectId, taskType, isGolden, filenames, onApplied,
}: UploadLabelsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrelabelApplyResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!show) {
      setFile(null);
      setError(null);
      setResult(null);
      setBusy(false);
      setSelected(new Set());
    }
  }, [show]);

  const meta = TASK_TYPE_LABELS[taskType];
  const variant = isGolden ? "golden" : "normal";
  const headers = HEADERS_BY_TASK[taskType][variant];
  const example = EXAMPLE_BY_TASK[taskType][variant];
  const formatPreview = `${headers.join(",")}\n${example.join(",")}`;
  const conflicts: PrelabelConflictItem[] = result?.conflicts ?? [];
  const hasConflicts = conflicts.length > 0;

  const [downloading, setDownloading] = useState<TemplateFormat | null>(null);

  const handleDownloadTemplate = async (format: TemplateFormat) => {
    setDownloading(format);
    setError(null);
    try {
      const { blob, filename } = await audiosApi.downloadTemplate(
        projectId,
        taskType,
        isGolden,
        format,
        true,
      );
      triggerDownload(blob, filename);
    } catch (e) {
      setError(extractError(e, "Không tải được template"));
    } finally {
      setDownloading(null);
    }
  };

  const allSelected = useMemo(
    () => hasConflicts && conflicts.every((c) => selected.has(c.filename)),
    [conflicts, selected, hasConflicts],
  );
  const someSelected = useMemo(
    () => conflicts.some((c) => selected.has(c.filename)),
    [conflicts, selected],
  );

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(conflicts.map((c) => c.filename)));
  };

  const toggleOne = (fn: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fn)) next.delete(fn);
      else next.add(fn);
      return next;
    });
  };

  const handleApply = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const r = await audiosApi.applyPrelabel(projectId, file, taskType, {
        force: isGolden,
      });
      setResult(r);
      setSelected(new Set());
      if (r.applied > 0 || r.conflicts.length === 0) onApplied();
    } catch (e) {
      setError(extractError(e, "Áp dụng nhãn thất bại"));
    } finally {
      setBusy(false);
    }
  };

  const handleForceSelected = async () => {
    if (!file || selected.size === 0) return;
    setBusy(true); setError(null);
    try {
      const r = await audiosApi.applyPrelabel(projectId, file, taskType, {
        force: true,
        onlyFilenames: Array.from(selected),
      });
      setResult({
        applied: (result?.applied ?? 0) + r.applied,
        conflicts: conflicts.filter((c) => !selected.has(c.filename)),
        unmatched: result?.unmatched ?? 0,
        unmatched_filenames: result?.unmatched_filenames ?? [],
      });
      setSelected(new Set());
      onApplied();
    } catch (e) {
      setError(extractError(e, "Force update thất bại"));
    } finally {
      setBusy(false);
    }
  };

  const closeAndReset = () => {
    if (busy) return;
    onHide();
  };

  return (
    <Modal show={show} onHide={closeAndReset} centered size="lg" backdrop={busy ? "static" : true}>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-filetype-csv me-2 text-primary"></i>
          Upload nhãn hàng loạt
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 small text-muted">
          <i className={`bi ${meta.icon} me-1`}></i>
          <strong>{meta.title}</strong>
          {isGolden && <span className="ms-2 badge bg-warning text-dark">Golden</span>}
        </div>

        {!result && (
          <>
            <Alert variant={isGolden ? "warning" : "info"} className="py-2 small">
              <i className={`bi ${isGolden ? "bi-exclamation-triangle" : "bi-info-circle"} me-1`}></i>
              {isGolden
                ? <>File này sẽ <strong>ghi đè</strong> nhãn hiện có khi tên file trùng (force update).</>
                : <>Hệ thống sẽ <strong>merge</strong> nhãn vào những file chưa có. Nếu phát hiện file đã có nhãn khác, sẽ liệt kê để bạn xác nhận force update.</>
              }
            </Alert>

            <div className="d-flex align-items-center justify-content-between mb-1 gap-2">
              <div className="small text-muted">Định dạng CSV (hoặc JSONL/Excel):</div>
              <Dropdown>
                <Dropdown.Toggle
                  size="sm"
                  variant="outline-primary"
                  disabled={busy || downloading !== null}
                  className="template-download-btn"
                >
                  {downloading ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span>Đang tạo {downloading.toUpperCase()}...</>
                  ) : (
                    <>
                      <i className="bi bi-download me-1"></i>
                      Tải template
                      {filenames && filenames.length > 0 && (
                        <span className="ms-1 small opacity-75">({filenames.length} dòng)</span>
                      )}
                    </>
                  )}
                </Dropdown.Toggle>
                <Dropdown.Menu align="end" className="template-format-menu">
                  <Dropdown.Header className="small text-muted">Chọn định dạng tải về</Dropdown.Header>
                  {TEMPLATE_FORMATS.map((f) => (
                    <Dropdown.Item
                      key={f.key}
                      onClick={() => handleDownloadTemplate(f.key)}
                      disabled={downloading !== null}
                    >
                      <div className="d-flex align-items-start gap-2">
                        <i className={`bi ${f.icon} template-format-icon`}></i>
                        <div className="flex-grow-1">
                          <div className="fw-semibold">{f.label} <span className="text-muted small fw-normal">.{f.key}</span></div>
                          <div className="small text-muted">{f.desc}</div>
                        </div>
                      </div>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </div>
            <pre className="bg-body-tertiary p-3 rounded small mb-2">{formatPreview}</pre>
            {filenames && filenames.length > 0 ? (
              <div className="small text-muted mb-3">
                <i className="bi bi-info-circle me-1"></i>
                Template tải về đã <strong>điền sẵn {filenames.length} tên file</strong> đang có — bạn chỉ cần điền cột nhãn rồi upload lại.
              </div>
            ) : (
              <div className="small text-muted mb-3">
                <i className="bi bi-info-circle me-1"></i>
                Template tải về kèm 1 dòng ví dụ.
              </div>
            )}

            <div className="small text-muted mb-1">
              Định dạng được hỗ trợ: <code>.csv</code> · <code>.tsv</code> · <code>.jsonl</code> · <code>.json</code> · <code>.xlsx</code>
            </div>
            <InputGroup className="mb-1">
              <InputGroup.Text><i className="bi bi-paperclip"></i></InputGroup.Text>
              <Form.Control
                type="file"
                accept=".csv,.tsv,.jsonl,.ndjson,.json,.xlsx,.xlsm"
                disabled={busy}
                onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)}
              />
            </InputGroup>
            {file && (
              <div className="small text-muted">
                <i className="bi bi-file-earmark-text me-1"></i>{file.name}
              </div>
            )}
          </>
        )}

        {result && (
          <>
            <Alert variant={result.applied > 0 ? "success" : "secondary"} className="py-2 small">
              <i className="bi bi-check-circle-fill me-1"></i>
              Đã áp dụng <strong>{result.applied}</strong> file
              {result.unmatched > 0 && <> · <span className="text-muted">{result.unmatched} dòng không khớp tên file</span></>}
            </Alert>

            {hasConflicts && (
              <div className="conflict-panel">
                <div className="conflict-header">
                  <div>
                    <div className="conflict-title">
                      <i className="bi bi-exclamation-octagon-fill text-warning me-2"></i>
                      {conflicts.length} file đang có nhãn khác
                    </div>
                    <div className="conflict-sub">
                      Tích chọn các dòng muốn <strong>ghi đè</strong> rồi bấm "Force update". Các dòng không tích sẽ giữ nhãn cũ.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="conflict-toggle-all"
                    onClick={toggleAll}
                  >
                    <i className={`bi ${allSelected ? "bi-check-square-fill" : "bi-square"}`}></i>
                    {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                  </button>
                </div>

                <div className="conflict-table-wrap">
                  <table className="conflict-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
                        <th>File</th>
                        <th>Giá trị hiện tại</th>
                        <th>Giá trị mới</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conflicts.map((c) => {
                        const checked = selected.has(c.filename);
                        return (
                          <tr
                            key={c.task_id}
                            className={checked ? "conflict-row-selected" : ""}
                            onClick={() => toggleOne(c.filename)}
                          >
                            <td>
                              <Form.Check
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleOne(c.filename)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="conflict-fname">
                              <i className="bi bi-music-note-beamed me-1 text-muted"></i>
                              {c.filename}
                            </td>
                            <td>
                              {Object.entries(c.current).map(([k, v]) => (
                                <div key={k} className="conflict-kv">
                                  <span className="conflict-key">{k}:</span>
                                  <span className="conflict-val-old">{formatValue(v)}</span>
                                </div>
                              ))}
                            </td>
                            <td>
                              {Object.entries(c.new).map(([k, v]) => (
                                <div key={k} className="conflict-kv">
                                  <span className="conflict-key">{k}:</span>
                                  <span className="conflict-val-new">{formatValue(v)}</span>
                                </div>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.unmatched_filenames.length > 0 && (
              <Alert variant="warning" className="py-2 small mt-3 mb-0">
                <i className="bi bi-question-circle me-1"></i>
                <strong>{result.unmatched}</strong> filename trong file không khớp với audio nào trong dataset:
                <div className="mt-1 small text-muted" style={{ maxHeight: 80, overflow: "auto" }}>
                  {result.unmatched_filenames.slice(0, 20).join(", ")}
                  {result.unmatched_filenames.length > 20 && ` ... +${result.unmatched_filenames.length - 20}`}
                </div>
              </Alert>
            )}
          </>
        )}

        {error && <Alert variant="danger" className="py-2 mt-3 mb-0">{error}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={closeAndReset} disabled={busy}>
          {result ? "Đóng" : "Huỷ"}
        </Button>
        {!result && (
          <Button variant="primary" onClick={handleApply} disabled={!file || busy}>
            {busy
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang áp dụng...</>
              : <><i className="bi bi-cloud-upload me-2"></i>Áp dụng nhãn</>
            }
          </Button>
        )}
        {result && hasConflicts && (
          <Button
            variant="warning"
            onClick={handleForceSelected}
            disabled={busy || !someSelected}
          >
            {busy
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang force update...</>
              : <><i className="bi bi-arrow-clockwise me-2"></i>Force update {selected.size > 0 && <>({selected.size})</>}</>
            }
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
