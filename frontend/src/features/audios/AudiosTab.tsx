import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Spinner, Alert } from "react-bootstrap";
import { audiosApi } from "../../api/audios";
import { extractError } from "../../api/client";
import { type AudioItem, humanSize } from "../../lib/audioTypes";
import { TASK_TYPE_LABELS, type TaskType } from "../../lib/projectTypes";
import { UploadModal } from "./UploadModal";
import { UploadLabelsModal } from "../projects/UploadLabelsModal";
import { AnnotatorsPanel } from "./AnnotatorsPanel";
import { useConfirm } from "../../components/ConfirmProvider";

interface AudiosTabProps {
  projectId: number;
  enabledTaskTypes: TaskType[];
  isAdmin: boolean;
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
    contentLabel: "Prelabel / Transcript gợi ý",
    fileIcon: "bi-music-note-beamed",
    fileTone: "audio",
    contentOf: (it) => (it.payload?.prelabel as string) ?? "",
    isMissing: () => false,
  },
  audio_verify: {
    short: "Verify",
    contentLabel: "Nhãn gợi ý",
    fileIcon: "bi-music-note-beamed",
    fileTone: "audio",
    contentOf: (it) => (it.payload?.suggested_label as string) ?? "",
    isMissing: (it) => !it.payload?.suggested_label,
  },
  qa: {
    short: "Q&A",
    contentLabel: "Câu hỏi",
    fileIcon: "bi-chat-dots",
    fileTone: "qa",
    contentOf: (it) => (it.payload?.question as string) ?? "",
    isMissing: (it) => !it.payload?.question,
  },
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  ready:      { text: "Sẵn sàng",  cls: "ds-status-ready" },
  processing: { text: "Đang xử lý", cls: "ds-status-progress" },
  error:      { text: "Lỗi",        cls: "ds-status-error" },
};

export function AudiosTab({ projectId, enabledTaskTypes, isAdmin }: AudiosTabProps) {
  const confirm = useConfirm();
  const [items, setItems] = useState<AudioItem[] | null>(null);
  const [activeType, setActiveType] = useState<TaskType>(enabledTaskTypes[0] ?? "audio_label");
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [annotatorsFor, setAnnotatorsFor] = useState<AudioItem | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Khi enabledTaskTypes đổi mà activeType không còn hợp lệ → reset
  useEffect(() => {
    if (!enabledTaskTypes.includes(activeType) && enabledTaskTypes.length > 0) {
      setActiveType(enabledTaskTypes[0]);
    }
  }, [enabledTaskTypes, activeType]);

  const reload = useCallback(() => {
    audiosApi.list(projectId, { limit: 200 })
      .then((r) => setItems(r.items))
      .catch((e) => setError(extractError(e, "Không tải được dữ liệu")));
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  // Bỏ golden — golden ở tab Kiểm soát chất lượng riêng
  const dataset = useMemo(() => items?.filter((it) => !it.is_golden) ?? null, [items]);

  const groupedByType = useMemo(() => {
    if (!dataset) return null;
    const map = new Map<TaskType, AudioItem[]>();
    for (const tt of enabledTaskTypes) map.set(tt, []);
    for (const it of dataset) {
      if (!map.has(it.task_type)) map.set(it.task_type, []);
      map.get(it.task_type)!.push(it);
    }
    return map;
  }, [dataset, enabledTaskTypes]);

  const activeItems = useMemo(
    () => groupedByType?.get(activeType) ?? [],
    [groupedByType, activeType],
  );

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Xoá dữ liệu",
      message: "Xoá dữ liệu này? Hành động không thể hoàn tác.",
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

  const handlePlay = async (id: number) => {
    if (playingId === id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    try {
      const r = await audiosApi.presign(projectId, id);
      if (audioRef.current) {
        audioRef.current.src = r.url;
        await audioRef.current.play();
      }
      setPlayingId(id);
    } catch (e) {
      setError(extractError(e, "Không phát được audio"));
    }
  };

  const totalCount = dataset?.length ?? 0;

  return (
    <>
      {/* Pill filter theo loại task */}
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

      {dataset === null ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : totalCount === 0 ? (
        <div className="ds-empty">
          <div className="ds-empty-title">Không có dữ liệu</div>
          {isAdmin && (
            <Button variant="outline-primary" size="sm" className="mt-3" onClick={() => setShowUpload(true)}>
              <i className="bi bi-cloud-upload me-2"></i>Thêm dữ liệu đầu tiên
            </Button>
          )}
        </div>
      ) : (
        <div className={`ds-split ${annotatorsFor ? "with-panel" : ""}`}>
          <div className="ds-split-main">
            <DatasetGroup
              taskType={activeType}
              items={activeItems}
              isAdmin={isAdmin}
              playingId={playingId}
              activeAudioId={annotatorsFor?.id ?? null}
              onPlay={handlePlay}
              onDelete={handleDelete}
              onShowAnnotators={(it) => setAnnotatorsFor(it)}
              onAdd={isAdmin ? () => setShowUpload(true) : undefined}
              onUploadLabels={isAdmin ? () => setShowLabels(true) : undefined}
            />
          </div>
          {annotatorsFor && (
            <AnnotatorsPanel
              projectId={projectId}
              audio={annotatorsFor}
              onClose={() => setAnnotatorsFor(null)}
            />
          )}
        </div>
      )}

      <audio
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        onPause={() => setPlayingId((cur) => (audioRef.current?.paused ? null : cur))}
        style={{ display: "none" }}
      />

      <UploadModal
        show={showUpload}
        onHide={() => setShowUpload(false)}
        projectId={projectId}
        enabledTaskTypes={enabledTaskTypes}
        onUploaded={reload}
        lockedTaskType={activeType}
      />

      <UploadLabelsModal
        show={showLabels}
        onHide={() => setShowLabels(false)}
        projectId={projectId}
        taskType={activeType}
        isGolden={false}
        filenames={activeItems.map((it) => it.original_filename)}
        onApplied={reload}
      />
    </>
  );
}

interface DatasetGroupProps {
  taskType: TaskType;
  items: AudioItem[];
  isAdmin: boolean;
  playingId: number | null;
  activeAudioId: number | null;
  onPlay: (id: number) => void;
  onDelete: (id: number) => void;
  onShowAnnotators: (item: AudioItem) => void;
  onAdd?: () => void;
  onUploadLabels?: () => void;
}

function DatasetGroup({ taskType, items, isAdmin, playingId, activeAudioId, onPlay, onDelete, onShowAnnotators, onAdd, onUploadLabels }: DatasetGroupProps) {
  const meta = TASK_TYPE_LABELS[taskType];
  const view = TASK_VIEW[taskType];
  const isQA = taskType === "qa";

  return (
    <div className="ds-group">
      <div className="ds-group-header">
        <div className="ds-group-icon"><i className={`bi ${meta.icon}`}></i></div>
        <div className="flex-grow-1 min-w-0">
          <div className="ds-group-title">{meta.title}</div>
          <div className="ds-group-sub">{meta.desc}</div>
        </div>
        <span className="ds-group-count">{items.length}</span>
        {onUploadLabels && (
          <button
            type="button"
            className="ds-group-upload-labels"
            onClick={onUploadLabels}
            title="Upload CSV/JSONL prelabel"
          >
            <i className="bi bi-filetype-csv"></i>
            <span>Upload prelabel</span>
          </button>
        )}
        {onAdd && (
          <button
            type="button"
            className="ds-group-add"
            onClick={onAdd}
          >
            <i className="bi bi-plus-lg"></i>
            <span>Thêm dữ liệu</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="ds-group-empty">Chưa có dữ liệu cho loại này</div>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              {isQA ? (
                <tr>
                  <th>Câu hỏi</th>
                  <th style={{ width: 130 }}>Đã gán</th>
                  <th style={{ width: 110 }}>Trạng thái</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              ) : (
                <tr>
                  <th style={{ width: 56 }} className="text-center">Âm thanh</th>
                  <th style={{ width: "32%" }}>Tên file</th>
                  <th>{view.contentLabel}</th>
                  <th style={{ width: 90 }}>Size</th>
                  <th style={{ width: 130 }}>Đã gán</th>
                  <th style={{ width: 110 }}>Trạng thái</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              )}
            </thead>
            <tbody>
              {items.map((it) => {
                const status = STATUS_LABEL[it.status] ?? { text: it.status, cls: "ds-status-progress" };
                const content = view.contentOf(it);
                const missing = view.isMissing(it);
                const isPlaying = playingId === it.id;
                const annCount = it.annotators_count ?? 0;
                const isActive = activeAudioId === it.id;
                return (
                  <tr
                    key={it.id}
                    className={`ds-row-clickable ${isActive ? "ds-row-active" : ""}`}
                    onClick={() => onShowAnnotators(it)}
                    title="Xem người đã gán dữ liệu"
                  >
                    {isQA ? (
                      <td>
                        <QADataCell item={it} text={content} />
                      </td>
                    ) : (
                      <>
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={`ds-action ${isPlaying ? "ds-action-playing" : ""}`}
                            onClick={() => onPlay(it.id)}
                            title={isPlaying ? "Tạm dừng" : "Phát"}
                          >
                            <i className={`bi ${isPlaying ? "bi-pause-circle-fill" : "bi-play-circle"}`}></i>
                          </button>
                        </td>
                        <td>
                          <div className="ds-file">
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
                              ? <span className="ds-missing"><i className="bi bi-exclamation-circle"></i> thiếu metadata</span>
                              : <span className="text-muted">—</span>
                          }
                        </td>
                      </>
                    )}
                    {!isQA && (
                      <td className="text-muted small">{humanSize(it.size_bytes)}</td>
                    )}
                    <td>
                      <span className={`ds-annotators-count ${annCount > 0 ? "has" : "zero"}`}>
                        <i className="bi bi-people"></i>
                        <span>{annCount} người</span>
                      </span>
                    </td>
                    <td>
                      <span className={`ds-status ${status.cls}`}>{status.text}</span>
                    </td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      {isAdmin && (
                        <button
                          type="button"
                          className="ds-action ds-action-danger ds-action-hover"
                          onClick={() => onDelete(it.id)}
                          title="Xoá"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      )}
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

/** Ô "Câu hỏi" cho QA: chỉ render text — bỏ audio/image. */
function QADataCell({ item, text }: { item: AudioItem; text: string }) {
  const question = text || ((item.payload?.question as string) ?? "");
  if (!question) {
    return <span className="ds-missing"><i className="bi bi-exclamation-circle"></i> thiếu câu hỏi</span>;
  }
  return <span className="ds-qa-text" title={question}>{question}</span>;
}

