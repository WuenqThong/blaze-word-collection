import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Spinner, Alert } from "react-bootstrap";
import { audiosApi } from "../../api/audios";
import { extractError } from "../../api/client";
import { type AudioItem, humanSize } from "../../lib/audioTypes";
import { TASK_TYPE_LABELS, type TaskType } from "../../lib/projectTypes";
import { UploadModal } from "../audios/UploadModal";
import { EditLabelModal } from "./EditLabelModal";
import { UploadLabelsModal } from "./UploadLabelsModal";
import { useConfirm } from "../../components/ConfirmProvider";

interface QualityControlTabProps {
  projectId: number;
  enabledTaskTypes: TaskType[];
}

const TASK_VIEW: Record<TaskType, {
  short: string;
  contentLabel: string;
  fileIcon: string;
  fileTone: "audio" | "qa";
  contentOf: (it: AudioItem) => string;
  isMissing: (it: AudioItem) => boolean;
}> = {
  audio_label: {
    short: "Transcript",
    contentLabel: "Ground truth",
    fileIcon: "bi-music-note-beamed",
    fileTone: "audio",
    contentOf: (it) => (it.payload?.prelabel as string) ?? "",
    isMissing: (it) => !it.payload?.prelabel,
  },
  audio_verify: {
    short: "Verify",
    contentLabel: "Nhãn đúng",
    fileIcon: "bi-music-note-beamed",
    fileTone: "audio",
    contentOf: (it) => (it.payload?.suggested_label as string) ?? "",
    isMissing: (it) => !it.payload?.suggested_label,
  },
  qa: {
    short: "Q&A",
    contentLabel: "Đáp án đúng",
    fileIcon: "bi-chat-dots",
    fileTone: "qa",
    // Ground truth của QA golden là `answer` — dùng để kiểm tra annotator.
    contentOf: (it) => (it.payload?.answer as string) ?? "",
    isMissing: (it) => !it.payload?.answer,
  },
};

export function QualityControlTab({ projectId, enabledTaskTypes }: QualityControlTabProps) {
  const confirm = useConfirm();
  const [items, setItems] = useState<AudioItem[] | null>(null);
  const [activeType, setActiveType] = useState<TaskType>(enabledTaskTypes[0] ?? "audio_label");
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [editing, setEditing] = useState<AudioItem | null>(null);

  const reload = useCallback(() => {
    audiosApi.list(projectId, { limit: 200 })
      .then((r) => setItems(r.items))
      .catch((e) => setError(extractError(e, "Không tải được dữ liệu kiểm soát")));
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!enabledTaskTypes.includes(activeType) && enabledTaskTypes.length > 0) {
      setActiveType(enabledTaskTypes[0]);
    }
  }, [enabledTaskTypes, activeType]);

  const goldenItems = useMemo(() => items?.filter((it) => it.is_golden) ?? null, [items]);

  const groupedByType = useMemo(() => {
    if (!goldenItems) return null;
    const map = new Map<TaskType, AudioItem[]>();
    for (const tt of enabledTaskTypes) map.set(tt, []);
    for (const it of goldenItems) {
      if (!map.has(it.task_type)) map.set(it.task_type, []);
      map.get(it.task_type)!.push(it);
    }
    return map;
  }, [goldenItems, enabledTaskTypes]);

  const activeItems = useMemo(
    () => groupedByType?.get(activeType) ?? [],
    [groupedByType, activeType],
  );

  const missingCount = useMemo(() => {
    const view = TASK_VIEW[activeType];
    return activeItems.filter((it) => view.isMissing(it)).length;
  }, [activeItems, activeType]);

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Xoá dữ liệu kiểm soát",
      message: "Xoá golden item này khỏi tập kiểm soát chất lượng?",
      confirmText: "Xoá",
      variant: "danger",
      icon: "bi-trash",
    });
    if (!ok) return;
    try {
      await audiosApi.remove(projectId, id);
      reload();
    } catch (e) {
      setError(extractError(e, "Xoá thất bại"));
    }
  };

  const handlePresign = async (id: number) => {
    try {
      const r = await audiosApi.presign(projectId, id);
      window.open(r.url, "_blank");
    } catch (e) {
      setError(extractError(e, "Không tạo được URL"));
    }
  };

  const totalCount = goldenItems?.length ?? 0;

  return (
    <>
      <div className="ds-pill-row mb-3">
        {enabledTaskTypes.map((tt) => {
          const meta = TASK_TYPE_LABELS[tt];
          const v = TASK_VIEW[tt];
          const count = groupedByType?.get(tt)?.length ?? 0;
          return (
            <button
              key={tt}
              type="button"
              className={`ds-pill ${activeType === tt ? "active" : ""}`}
              onClick={() => setActiveType(tt)}
            >
              <i className={`bi ${meta.icon}`}></i>
              <span>{v.short}</span>
              <span className="ds-pill-count">{count}</span>
            </button>
          );
        })}
      </div>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {missingCount > 0 && (
        <Alert variant="warning" className="py-2 small">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <strong>{missingCount}</strong> câu chưa có nhãn — không thể dùng để kiểm tra annotator.
          Bấm "Thêm nhãn" trên từng dòng hoặc upload CSV/Excel để bổ sung.
        </Alert>
      )}

      {goldenItems === null ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : totalCount === 0 ? (
        <div className="ds-empty">
          <div className="ds-empty-title">Không có dữ liệu kiểm soát</div>
          <Button variant="outline-warning" size="sm" className="mt-3" onClick={() => setShowUpload(true)}>
            <i className="bi bi-cloud-upload me-2"></i>Thêm dữ liệu kiểm soát đầu tiên
          </Button>
        </div>
      ) : (
        <GoldenGroup
          taskType={activeType}
          items={activeItems}
          onPlay={handlePresign}
          onDelete={handleDelete}
          onAdd={() => setShowUpload(true)}
          onUploadLabels={() => setShowLabels(true)}
          onEdit={(it) => setEditing(it)}
        />
      )}

      <UploadModal
        show={showUpload}
        onHide={() => setShowUpload(false)}
        projectId={projectId}
        enabledTaskTypes={enabledTaskTypes}
        onUploaded={reload}
        isGolden
        lockedTaskType={activeType}
      />

      <EditLabelModal
        show={!!editing}
        onHide={() => setEditing(null)}
        projectId={projectId}
        item={editing}
        onSaved={reload}
      />

      <UploadLabelsModal
        show={showLabels}
        onHide={() => setShowLabels(false)}
        projectId={projectId}
        taskType={activeType}
        isGolden
        filenames={activeItems.map((it) => it.original_filename)}
        onApplied={reload}
      />
    </>
  );
}

interface GoldenGroupProps {
  taskType: TaskType;
  items: AudioItem[];
  onPlay: (id: number) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
  onUploadLabels: () => void;
  onEdit: (item: AudioItem) => void;
}

function GoldenGroup({ taskType, items, onPlay, onDelete, onAdd, onUploadLabels, onEdit }: GoldenGroupProps) {
  const meta = TASK_TYPE_LABELS[taskType];
  const view = TASK_VIEW[taskType];
  const isQA = taskType === "qa";

  return (
    <div className="ds-group ds-group-golden">
      <div className="ds-group-header">
        <div className="ds-group-icon ds-group-icon-golden">
          <i className="bi bi-shield-check"></i>
        </div>
        <div className="flex-grow-1 min-w-0">
          <div className="ds-group-title">{meta.title}</div>
          <div className="ds-group-sub">Dữ liệu kiểm soát đã có ground truth</div>
        </div>
        <span className="ds-group-count">{items.length}</span>
        <button
          type="button"
          className="ds-group-upload-labels"
          onClick={onUploadLabels}
          title="Upload CSV nhãn (force update)"
        >
          <i className="bi bi-filetype-csv"></i>
          <span>Upload nhãn</span>
        </button>
        <button
          type="button"
          className="ds-group-add ds-group-add-warning"
          onClick={onAdd}
        >
          <i className="bi bi-plus-lg"></i>
          <span>Thêm dữ liệu kiểm soát</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="ds-group-empty">Chưa có dữ liệu kiểm soát cho loại này</div>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              {isQA ? (
                <tr>
                  <th>Câu hỏi</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              ) : (
                <tr>
                  <th style={{ width: "32%" }}>Tên file</th>
                  <th>{view.contentLabel}</th>
                  <th style={{ width: 90 }}>Size</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              )}
            </thead>
            <tbody>
              {items.map((it) => {
                const content = view.contentOf(it);
                const missing = view.isMissing(it);
                return (
                  <tr key={it.id} className={missing ? "ds-row-cannot-recheck" : ""}>
                    {isQA ? (
                      <td>
                        <QAGoldenCell
                          item={it}
                          text={content}
                          onAddLabel={() => onEdit(it)}
                        />
                      </td>
                    ) : (
                      <>
                        <td>
                          <div className="ds-file">
                            <button
                              type="button"
                              className="ds-action"
                              onClick={() => onPlay(it.id)}
                              title="Mở file"
                            >
                              <i className="bi bi-play-circle"></i>
                            </button>
                            <div className={`ds-file-icon ds-icon-${view.fileTone}`}>
                              <i className={`bi ${view.fileIcon}`}></i>
                            </div>
                            <span className="ds-file-name" title={it.original_filename}>
                              {it.original_filename}
                            </span>
                          </div>
                        </td>
                        <td>
                          {content
                            ? <span className="ds-content" title={content}>{content}</span>
                            : missing
                              ? (
                                <button
                                  type="button"
                                  className="ds-add-label"
                                  onClick={() => onEdit(it)}
                                >
                                  <i className="bi bi-plus-circle"></i> Thêm nhãn
                                </button>
                              )
                              : <span className="text-muted">—</span>
                          }
                        </td>
                      </>
                    )}
                    {!isQA && (
                      <td className="text-muted small">{humanSize(it.size_bytes)}</td>
                    )}
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <button
                          type="button"
                          className="ds-action"
                          onClick={() => onEdit(it)}
                          title="Sửa nhãn (force update)"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          type="button"
                          className="ds-action ds-action-danger"
                          onClick={() => onDelete(it.id)}
                          title="Xoá"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QAGoldenCell({ item, text, onAddLabel }: {
  item: AudioItem;
  text: string;
  onAddLabel: () => void;
}) {
  const question = (item.payload?.question as string) ?? "";
  const hasAnswer = !!text.trim();

  return (
    <div className="ds-qa-golden-cell">
      <div className="ds-qa-golden-row">
        <span className="ds-qa-question" title={question}>
          {question || <em className="text-muted">không có câu hỏi</em>}
        </span>
      </div>
      <div className="ds-qa-golden-answer">
        {hasAnswer ? (
          <span className="ds-qa-answer-ok">
            <i className="bi bi-check-circle-fill"></i> Đáp án: <strong>{text}</strong>
          </span>
        ) : (
          <button type="button" className="ds-qa-no-answer" onClick={onAddLabel}>
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span>Chưa có đáp án — không thể kiểm tra</span>
          </button>
        )}
      </div>
    </div>
  );
}
