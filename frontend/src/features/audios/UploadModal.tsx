import { useEffect, useRef, useState } from "react";
import { Modal, Button, Form, Alert, ProgressBar, Badge, InputGroup, Tabs, Tab } from "react-bootstrap";
import { audiosApi } from "../../api/audios";
import { extractError } from "../../api/client";
import { TASK_TYPE_LABELS, type TaskType } from "../../lib/projectTypes";

interface UploadModalProps {
  show: boolean;
  onHide: () => void;
  projectId: number;
  enabledTaskTypes: TaskType[];
  onUploaded: () => void;
  isGolden?: boolean;
  /** Khi truyền vào: dùng đúng loại task này, bỏ qua bước chọn task. */
  lockedTaskType?: TaskType;
}

const TASK_HINT: Record<TaskType, string> = {
  audio_label: "Annotator nghe và nhập transcript / chọn label. Có thể đính kèm prelabel để chỉnh sửa.",
  audio_verify: "Annotator nghe + xem nhãn gợi ý → bấm đúng / sai. Bắt buộc đính kèm `suggested_label`.",
  qa: "Mỗi audio gắn với 1 câu hỏi. Annotator ghi âm trả lời. Bắt buộc đính kèm `question`.",
};

interface MetaHint { title: string; format: string; required: boolean; description?: string; }

const META_HINT: Record<TaskType, MetaHint> = {
  audio_label: {
    title: "Prelabel / Transcript gợi ý",
    format: "filename,prelabel\nfoo.wav,xin chào hôm nay là thứ hai",
    required: false,
  },
  audio_verify: {
    title: "Nhãn gợi ý cho từng audio",
    format: "filename,suggested_label\nfoo.wav,xin chào\nbar.wav,tạm biệt",
    required: true,
  },
  qa: {
    title: "Câu hỏi cho từng audio",
    format: "filename,question,options\nfoo.wav,Người nói nam hay nữ?,Nam|Nữ|Không rõ",
    required: true,
  },
};

/** Khi upload vào kiểm soát chất lượng (golden), MỌI loại task phải kèm nhãn đúng. */
const META_HINT_GOLDEN: Record<TaskType, MetaHint> = {
  audio_label: {
    title: "Transcript đúng (ground truth)",
    format: "filename,prelabel\nfoo.wav,xin chào hôm nay là thứ hai",
    required: true,
    description: "Ground truth dùng để kiểm tra accuracy annotator.",
  },
  audio_verify: {
    title: "Nhãn đúng (ground truth)",
    format: "filename,suggested_label\nfoo.wav,xin chào",
    required: true,
    description: "Annotator sẽ thấy nhãn này và phải xác nhận đúng/sai trùng với ground truth.",
  },
  qa: {
    title: "Câu hỏi + đáp án đúng",
    format: "filename,question,options,answer\nfoo.wav,Người nói nam hay nữ?,Nam|Nữ|Không rõ,Nam",
    required: true,
    description: "Cột `answer` là đáp án đúng — bắt buộc cho dữ liệu kiểm soát.",
  },
};

type Step = 1 | 2 | 3 | 4;

export function UploadModal({ show, onHide, projectId, enabledTaskTypes, onUploaded, isGolden = false, lockedTaskType }: UploadModalProps) {
  const initialStep: Step = lockedTaskType ? 2 : 1;
  const [step, setStep] = useState<Step>(initialStep);
  const [taskType, setTaskType] = useState<TaskType>(lockedTaskType ?? enabledTaskTypes[0] ?? "audio_label");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: upload method (direct / sync / qa-text)
  const [method, setMethod] = useState<"direct" | "sync" | "qa-text">(
    (lockedTaskType ?? enabledTaskTypes[0]) === "qa" ? "qa-text" : "direct",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const dropRef = useRef<HTMLLabelElement>(null);

  // Step 2 — QA text upload
  const [qaTextFile, setQaTextFile] = useState<File | null>(null);

  // Step 1 sync form
  const [endpoint, setEndpoint] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [bucket, setBucket] = useState("");
  const [prefix, setPrefix] = useState("");
  const [secure, setSecure] = useState(false);
  const [limit, setLimit] = useState(100);

  // Step 2: prelabel CSV
  const [prelabelFile, setPrelabelFile] = useState<File | null>(null);

  // Result tracking
  const [uploadedCount, setUploadedCount] = useState(0);
  const [matchedPrelabel, setMatchedPrelabel] = useState(0);
  const [unmatchedPrelabel, setUnmatchedPrelabel] = useState(0);

  useEffect(() => {
    if (lockedTaskType) {
      // Sync với pill đang active
      setTaskType(lockedTaskType);
      return;
    }
    if (!enabledTaskTypes.includes(taskType) && enabledTaskTypes.length) {
      setTaskType(enabledTaskTypes[0]);
    }
  }, [enabledTaskTypes, taskType, lockedTaskType]);

  // QA: chỉ cho phép upload câu hỏi text. Các task khác: direct hoặc sync.
  useEffect(() => {
    if (taskType === "qa") setMethod("qa-text");
    else if (method === "qa-text") setMethod("direct");
  }, [taskType, method]);

  const reset = () => {
    setStep(lockedTaskType ? 2 : 1);
    setMethod("direct");
    setFiles([]);
    setQaTextFile(null);
    setProgress(0);
    setEndpoint(""); setAccessKey(""); setSecretKey("");
    setBucket(""); setPrefix(""); setSecure(false); setLimit(100);
    setPrelabelFile(null);
    setUploadedCount(0); setMatchedPrelabel(0); setUnmatchedPrelabel(0);
    setError(null); setBusy(false);
  };

  const closeModal = () => { reset(); onHide(); };

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) =>
      f.type.startsWith("audio/") || /\.(wav|mp3|m4a|flac|ogg|webm|aac)$/i.test(f.name)
    );
    setFiles((prev) => [...prev, ...arr]);
  };

  // ---------- Step 1 actions ----------
  const handleDirectUpload = async () => {
    if (!files.length) return;
    setBusy(true); setError(null); setProgress(0);
    try {
      const created = await audiosApi.upload(
        projectId, files,
        { task_type: taskType, is_golden: isGolden },
        (pct) => setProgress(pct),
      );
      setUploadedCount(created.length);
      setStep(3); // luôn qua bước metadata; user có thể skip nếu không bắt buộc
    } catch (e) {
      setError(extractError(e, "Upload thất bại"));
    } finally {
      setBusy(false);
    }
  };

  const handleQaText = async () => {
    if (!qaTextFile) return;
    setBusy(true); setError(null);
    try {
      const created = await audiosApi.uploadQaQuestions(projectId, qaTextFile, isGolden);
      setUploadedCount(created.length);
      setStep(4); // skip prelabel — question đã được parse từ file
    } catch (e) {
      setError(extractError(e, "Upload câu hỏi thất bại"));
    } finally {
      setBusy(false);
    }
  };

  const downloadQaTemplate = () => {
    const csv = "question\nNgười nói nam hay nữ?\nCó bao nhiêu người trong audio?\nTâm trạng người nói thế nào?\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qa-questions-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSync = async () => {
    setBusy(true); setError(null);
    try {
      const r = await audiosApi.sync(projectId, {
        endpoint, access_key: accessKey, secret_key: secretKey, secure,
        bucket, prefix, task_type: taskType, is_golden: isGolden, limit,
      });
      setUploadedCount(r.imported);
      if (r.errors.length) setError(`${r.errors.length} file lỗi: ${r.errors.slice(0, 2).join("; ")}`);
      setStep(3);
    } catch (e) {
      setError(extractError(e, "Sync thất bại"));
    } finally {
      setBusy(false);
    }
  };

  // ---------- Step 2 actions ----------
  const handleApplyPrelabel = async () => {
    if (!prelabelFile) return;
    setBusy(true); setError(null);
    try {
      const r = await audiosApi.applyPrelabel(projectId, prelabelFile, taskType, { force: true });
      setMatchedPrelabel(r.applied);
      setUnmatchedPrelabel(r.unmatched);
      setStep(4);
    } catch (e) {
      setError(extractError(e, "Áp dụng metadata thất bại"));
    } finally {
      setBusy(false);
    }
  };

  const skipMetadata = () => setStep(4);

  const finishAll = () => {
    onUploaded();
    closeModal();
  };

  const meta = (isGolden ? META_HINT_GOLDEN : META_HINT)[taskType];
  const taskMeta = TASK_TYPE_LABELS[taskType];

  // ---------- Render ----------
  return (
    <Modal show={show} onHide={closeModal} size="lg" centered backdrop={busy ? "static" : true}>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-cloud-upload me-2"></i>
          {step === 1 && "Chọn loại task"}
          {step === 2 && "Upload dataset"}
          {step === 3 && (meta.required ? "Metadata bắt buộc" : "Prelabel (tuỳ chọn)")}
          {step === 4 && "Hoàn tất"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>

        {/* Step 1: choose task type */}
        {step === 1 && (
          <>
            <p className="text-muted small mb-3">
              <i className="bi bi-info-circle me-1"></i>
              Mỗi lần upload chỉ chọn 1 loại task. Bạn có thể upload thêm loại khác trong lần khác.
            </p>
            <div className="d-grid gap-2">
              {enabledTaskTypes.map((tt) => {
                const active = tt === taskType;
                const m = TASK_TYPE_LABELS[tt];
                return (
                  <button
                    key={tt}
                    type="button"
                    onClick={() => setTaskType(tt)}
                    className="text-start p-3 border rounded-3 d-flex align-items-center gap-3"
                    style={{
                      background: active ? "var(--brand-50)" : "var(--surface-0)",
                      borderColor: active ? "var(--brand-500)" : "var(--surface-3)",
                      borderWidth: active ? 2 : 1,
                      cursor: "pointer",
                    }}
                  >
                    <i className={`bi ${m.icon}`} style={{
                      fontSize: "1.5rem",
                      color: active ? "var(--brand-700)" : "var(--text-muted)",
                    }}></i>
                    <div className="flex-grow-1">
                      <div style={{ fontWeight: 600 }}>{m.title}</div>
                      <div className="small text-muted">{TASK_HINT[tt]}</div>
                    </div>
                    {active && <i className="bi bi-check-circle-fill text-primary"></i>}
                  </button>
                );
              })}
            </div>

          </>
        )}

        {/* Step 2: upload audio */}
        {step === 2 && (
          <>
            {!lockedTaskType && (
              <div className="upload-task-summary mb-3">
                <i className={`bi ${TASK_TYPE_LABELS[taskType].icon} me-2 text-primary`}></i>
                <strong>{TASK_TYPE_LABELS[taskType].title}</strong>
                {isGolden && <Badge bg="warning" text="dark" className="ms-2">Golden</Badge>}
              </div>
            )}
            {taskType === "qa" ? (
              <div>
                <p className="small text-muted mb-2">
                  Mỗi câu hỏi sẽ tạo thành 1 task QA. Annotator ghi âm trả lời cho từng câu.
                </p>
                <ul className="small text-muted mb-3 ps-3">
                  <li><strong>CSV / Excel</strong>: cột <code>question</code> (hoặc cột đầu nếu không có header)</li>
                  <li><strong>TXT</strong>: mỗi dòng = 1 câu hỏi</li>
                </ul>
                <div className="mb-2">
                  <Button variant="link" size="sm" className="p-0 text-decoration-none" onClick={downloadQaTemplate} disabled={busy}>
                    <i className="bi bi-download me-1"></i>Tải file mẫu CSV
                  </Button>
                </div>
                <InputGroup>
                  <InputGroup.Text><i className="bi bi-paperclip"></i></InputGroup.Text>
                  <Form.Control
                    type="file"
                    accept=".csv,.tsv,.txt,.xlsx,.xlsm"
                    disabled={busy}
                    onChange={(e) => setQaTextFile((e.target as HTMLInputElement).files?.[0] ?? null)}
                  />
                </InputGroup>
                {qaTextFile && (
                  <div className="small text-muted mt-2">
                    <i className="bi bi-file-earmark-text me-1"></i>{qaTextFile.name}
                  </div>
                )}
              </div>
            ) : (
              <Tabs activeKey={method} onSelect={(k) => k && setMethod(k as "direct" | "sync")} className="mb-3">
                <Tab eventKey="direct" title={<><i className="bi bi-upload me-1"></i>Upload trực tiếp</>}>
                  <Form.Label
                    ref={dropRef}
                    htmlFor="audio-files"
                    onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add("border-primary"); }}
                    onDragLeave={() => dropRef.current?.classList.remove("border-primary")}
                    onDrop={(e) => {
                      e.preventDefault();
                      dropRef.current?.classList.remove("border-primary");
                      onPickFiles(e.dataTransfer.files);
                    }}
                    className="d-block w-100 text-center p-4 rounded-3 border border-2 border-dashed"
                    style={{ cursor: busy ? "not-allowed" : "pointer", background: "var(--surface-1)" }}
                  >
                    <i className="bi bi-cloud-arrow-up" style={{ fontSize: "2rem", color: "var(--brand-500)" }}></i>
                    <div className="mt-2"><strong>Kéo thả</strong> file audio vào đây hoặc bấm để chọn</div>
                    <div className="small text-muted">WAV / MP3 / M4A / FLAC / OGG · tối đa 50MB/file</div>
                    <input
                      id="audio-files"
                      type="file"
                      accept="audio/*"
                      multiple
                      hidden
                      disabled={busy}
                      onChange={(e) => onPickFiles(e.target.files)}
                    />
                  </Form.Label>

                  {files.length > 0 && (
                    <div className="mt-3">
                      <div className="small text-muted mb-2">{files.length} file sẵn sàng:</div>
                      <div className="d-flex flex-wrap gap-1">
                        {files.slice(0, 12).map((f, i) => (
                          <Badge key={i} bg="light" text="dark" className="border">
                            <i className="bi bi-music-note-beamed me-1"></i>{f.name}
                          </Badge>
                        ))}
                        {files.length > 12 && <Badge bg="secondary">+{files.length - 12}</Badge>}
                      </div>
                    </div>
                  )}

                  {progress > 0 && progress < 100 && busy && (
                    <ProgressBar now={progress} label={`${progress}%`} className="mt-3" animated />
                  )}
                </Tab>

                <Tab eventKey="sync" title={<><i className="bi bi-arrow-down-up me-1"></i>Sync từ MinIO/S3</>}>
                  <p className="small text-muted">
                    Cung cấp credential để hệ thống kết nối + copy audio từ bucket nguồn về MinIO của bạn.
                  </p>
                  <Form.Group className="mb-2">
                    <Form.Label className="small">Endpoint</Form.Label>
                    <Form.Control
                      placeholder="vd: s3.amazonaws.com hoặc 192.168.1.10:9000"
                      value={endpoint} onChange={(e) => setEndpoint(e.target.value)} disabled={busy}
                    />
                  </Form.Group>
                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <Form.Label className="small">Access key</Form.Label>
                      <Form.Control value={accessKey} onChange={(e) => setAccessKey(e.target.value)} disabled={busy} />
                    </div>
                    <div className="col-md-6">
                      <Form.Label className="small">Secret key</Form.Label>
                      <Form.Control type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} disabled={busy} />
                    </div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-md-5">
                      <Form.Label className="small">Bucket</Form.Label>
                      <Form.Control value={bucket} onChange={(e) => setBucket(e.target.value)} disabled={busy} />
                    </div>
                    <div className="col-md-5">
                      <Form.Label className="small">Prefix</Form.Label>
                      <Form.Control placeholder="vd: 2025-q4/" value={prefix} onChange={(e) => setPrefix(e.target.value)} disabled={busy} />
                    </div>
                    <div className="col-md-2">
                      <Form.Label className="small">Limit</Form.Label>
                      <Form.Control type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(Number(e.target.value))} disabled={busy} />
                    </div>
                  </div>
                  <Form.Check
                    type="switch" id="sync-secure" label="HTTPS"
                    checked={secure} onChange={(e) => setSecure(e.target.checked)} disabled={busy}
                  />
                </Tab>
              </Tabs>
            )}
          </>
        )}

        {/* Step 3: prelabel metadata */}
        {step === 3 && (
          <>
            <Alert variant={meta.required ? "warning" : "info"} className="d-flex align-items-start gap-2 py-2">
              <i className={`bi ${meta.required ? "bi-exclamation-triangle" : "bi-info-circle"} mt-1`}></i>
              <div className="small">
                <strong>{meta.title}</strong> {meta.required ? "(bắt buộc)" : "(tuỳ chọn)"}
                <div className="text-muted mt-1">
                  {meta.description
                    ?? (meta.required
                      ? `Task ${taskMeta.title} cần metadata cho mỗi audio. Nếu bỏ qua, annotator không thể gán nhãn.`
                      : "Bạn có thể bỏ qua bước này — annotator sẽ tự nhập transcript từ đầu.")}
                </div>
              </div>
            </Alert>

            <p className="small text-muted mb-2">Định dạng CSV/JSONL:</p>
            <pre className="bg-body-tertiary p-3 rounded small mb-3">{meta.format}</pre>

            <InputGroup className="mb-2">
              <InputGroup.Text><i className="bi bi-paperclip"></i></InputGroup.Text>
              <Form.Control
                type="file"
                accept=".csv,.tsv,.jsonl,.ndjson,.json,.xlsx,.xlsm"
                disabled={busy}
                onChange={(e) => setPrelabelFile((e.target as HTMLInputElement).files?.[0] ?? null)}
              />
            </InputGroup>
            {prelabelFile && (
              <div className="small text-muted">
                <i className="bi bi-file-earmark-text me-1"></i>{prelabelFile.name}
              </div>
            )}
          </>
        )}

        {/* Step 4: done */}
        {step === 4 && (
          <div className="upload-done">
            <div className="upload-done-icon"><i className="bi bi-check2-circle"></i></div>
            <h5 className="upload-done-title">Hoàn tất!</h5>
            <p className="text-muted">
              Đã thêm <strong>{uploadedCount}</strong> audio vào project.
              {matchedPrelabel > 0 && <> Áp dụng metadata cho <strong>{matchedPrelabel}</strong> audio.</>}
              {unmatchedPrelabel > 0 && <> ({unmatchedPrelabel} dòng metadata không khớp tên file)</>}
            </p>
          </div>
        )}

        {error && <Alert variant="danger" className="py-2 mt-3 mb-0">{error}</Alert>}
      </Modal.Body>

      <Modal.Footer>
        {((step === 2 && !lockedTaskType) || step === 3) && (
          <Button variant="outline-secondary" onClick={() => setStep((s) => (s - 1) as Step)} disabled={busy}>
            <i className="bi bi-arrow-left me-1"></i>Quay lại
          </Button>
        )}

        {/* Step 1: chọn task → tiếp tục */}
        {step === 1 && (
          <Button variant="primary" onClick={() => setStep(2)} disabled={!taskType}>
            Tiếp tục <i className="bi bi-arrow-right ms-1"></i>
          </Button>
        )}

        {/* Step 2: upload */}
        {step === 2 && method === "direct" && (
          <Button variant="primary" onClick={handleDirectUpload} disabled={!files.length || busy}>
            {busy ? "Đang upload..." : <>Upload &amp; tiếp tục <i className="bi bi-arrow-right ms-1"></i></>}
          </Button>
        )}
        {step === 2 && method === "sync" && (
          <Button variant="primary" onClick={handleSync}
            disabled={busy || !endpoint || !accessKey || !secretKey || !bucket}>
            {busy ? "Đang sync..." : <>Sync &amp; tiếp tục <i className="bi bi-arrow-right ms-1"></i></>}
          </Button>
        )}
        {step === 2 && method === "qa-text" && (
          <Button variant="primary" onClick={handleQaText} disabled={!qaTextFile || busy}>
            {busy ? "Đang tạo..." : <>Tạo câu hỏi <i className="bi bi-arrow-right ms-1"></i></>}
          </Button>
        )}

        {/* Step 3: prelabel */}
        {step === 3 && (
          <>
            {!meta.required && (
              <Button variant="outline-secondary" onClick={skipMetadata} disabled={busy}>
                Bỏ qua
              </Button>
            )}
            <Button variant="primary" onClick={handleApplyPrelabel} disabled={!prelabelFile || busy}>
              {busy ? "Đang áp dụng..." : <>Áp dụng &amp; tiếp tục <i className="bi bi-arrow-right ms-1"></i></>}
            </Button>
          </>
        )}

        {/* Step 4: done */}
        {step === 4 && (
          <Button variant="primary" onClick={finishAll}>
            <i className="bi bi-check2 me-1"></i>Đóng
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

