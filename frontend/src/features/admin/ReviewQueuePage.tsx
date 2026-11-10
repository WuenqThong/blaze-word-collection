import { useEffect, useState } from "react";
import { Button, Spinner, Alert, Form, Modal, Badge } from "react-bootstrap";
import { Link } from "react-router-dom";
import { reviewApi } from "../../api/review";
import { projectsApi } from "../../api/projects";
import { extractError } from "../../api/client";
import type {
  DataReviewItem,
  DataReviewDetail,
  DataReviewAnnotation,
  TaskTypeStats,
} from "../../lib/reviewTypes";
import type { Project, TaskType } from "../../lib/projectTypes";

const TASK_META: Record<string, { label: string; cls: string; icon: string }> = {
  audio_label: { label: "Nghe → Viết", cls: "task-pill-indigo", icon: "bi-pencil-square" },
  audio_verify: { label: "Xác nhận âm thanh", cls: "task-pill-purple", icon: "bi-patch-check" },
  qa: { label: "Q&A", cls: "task-pill-cyan", icon: "bi-chat-dots" },
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

function answerSummary(answer: Record<string, unknown>): string {
  if (typeof answer.text === "string") return answer.text;
  if (typeof answer.verdict === "string") return answer.verdict === "correct" ? "Đúng" : "Sai";
  if (typeof answer.option === "string") return answer.option;
  return "—";
}

function consensusBadge(rate: number | null): { variant: string; label: string } {
  if (rate == null) return { variant: "light", label: "—" };
  const pct = Math.round(rate * 100);
  if (pct === 100) return { variant: "success", label: `${pct}%` };
  if (pct >= 67) return { variant: "warning", label: `${pct}%` };
  return { variant: "danger", label: `${pct}%` };
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "vừa xong";
  if (sec < 3600) return `${Math.floor(sec / 60)} phút trước`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)} giờ trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

const PAGE_SIZE = 25;

export function ReviewQueuePage() {
  const [items, setItems] = useState<DataReviewItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState<number | "">("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [detailFor, setDetailFor] = useState<DataReviewItem | null>(null);

  const load = () => {
    setRefreshing(true);
    reviewApi
      .reviewByData({
        project_id: projectFilter === "" ? undefined : projectFilter,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      })
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e) => setError(extractError(e)))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    projectsApi.list()
      .then(setProjects)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter, page]);

  // Reset về trang 1 khi filter project thay đổi
  useEffect(() => { setPage(1); }, [projectFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      <div className={`data-review-shell ${detailFor ? "with-detail" : ""}`}>
        <div className="data-review-toolbar">
          <Link to="/dashboard" className="data-review-back" title="Quay lại Dashboard">
            <i className="bi bi-arrow-left"></i>
          </Link>
          <Form.Select
            size="sm"
            style={{ minWidth: 180, maxWidth: 240 }}
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Tất cả project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Form.Select>
          {detailFor && (
            <div className="data-review-toolbar-detail">
              <i className="bi bi-file-music data-review-file-icon"></i>
              <div className="min-w-0">
                <div className="data-review-side-title text-truncate" title={detailFor.filename}>{detailFor.filename}</div>
                <div className="text-muted small">
                  <i className="bi bi-folder2 me-1"></i>{detailFor.project_name}
                </div>
              </div>
              <Button size="sm" variant="light" onClick={() => setDetailFor(null)} title="Đóng">
                <i className="bi bi-x-lg"></i>
              </Button>
            </div>
          )}
        </div>
        <div className="data-review-cols">
        <div className="data-review-main">
          <div className="data-review-scroll">
            {items === null ? (
              <div className="text-center py-5"><Spinner animation="border" /></div>
            ) : items.length === 0 ? (
              <div className="queue-empty">
                <div className="queue-empty-icon"><i className="bi bi-check2-all"></i></div>
                <div className="queue-empty-title">Không còn data nào chờ duyệt</div>
                <div className="queue-empty-sub">Toàn bộ hàng đợi đã được xử lý 🎉</div>
              </div>
            ) : (
              <>
                <div className="data-review-thead">
                  <div className="data-review-th-file">Dữ liệu</div>
                  <div className="data-review-th-project">Dự án</div>
                  <div className="data-review-th-tasks">Đồng thuận</div>
                  <div className="data-review-th-action">Chờ duyệt</div>
                </div>
                <div className="data-review-list">
                  {items.map((it) => (
                    <DataRow
                      key={it.audio_id}
                      item={it}
                      active={detailFor?.audio_id === it.audio_id}
                      onReview={() => setDetailFor(it)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          {items !== null && total > 0 && (
            <div className="data-review-pager">
              <span className="text-muted small">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
              </span>
              <div className="d-flex align-items-center gap-1 ms-auto">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={page === 1 || refreshing}
                  onClick={() => setPage(1)}
                  title="Trang đầu"
                >
                  <i className="bi bi-chevron-double-left"></i>
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={page === 1 || refreshing}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <i className="bi bi-chevron-left"></i>
                </Button>
                <span className="data-review-page-num">{page} / {totalPages}</span>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={page >= totalPages || refreshing}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <i className="bi bi-chevron-right"></i>
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={page >= totalPages || refreshing}
                  onClick={() => setPage(totalPages)}
                  title="Trang cuối"
                >
                  <i className="bi bi-chevron-double-right"></i>
                </Button>
              </div>
            </div>
          )}
        </div>

        {detailFor && (
          <DataDetailPanel
            key={detailFor.audio_id}
            item={detailFor}
            onClose={() => setDetailFor(null)}
            onChanged={() => load()}
          />
        )}
        </div>
      </div>
    </>
  );
}

function aggregateConsensus(item: DataReviewItem): number | null {
  let totalAnns = 0;
  let weightedSum = 0;
  for (const t of item.task_types) {
    if (t.consensus_rate == null || t.annotations_total === 0) continue;
    weightedSum += t.consensus_rate * t.annotations_total;
    totalAnns += t.annotations_total;
  }
  return totalAnns > 0 ? weightedSum / totalAnns : null;
}

function DataRow({ item, active, onReview }: { item: DataReviewItem; active?: boolean; onReview: () => void }) {
  const consensus = aggregateConsensus(item);
  const cb = consensusBadge(consensus);
  return (
    <button
      type="button"
      onClick={onReview}

      className={`data-review-row data-review-row-clickable ${active ? "data-review-row-active" : ""}`}
    >
      <div className="data-review-row-main">
        <div className="data-review-file">
          <i className="bi bi-file-music data-review-file-icon"></i>
          <div className="data-review-filename text-truncate" title={item.filename}>{item.filename}</div>
        </div>
        <div className="data-review-project">
          <i className="bi bi-folder2"></i>
          <span className="text-truncate" title={item.project_name}>{item.project_name}</span>
        </div>
        <div className="data-review-metric">
          <span className={`data-review-consensus consensus-${cb.variant}`} title="Tỉ lệ đồng thuận">
            <i className="bi bi-people"></i> {cb.label}
          </span>
        </div>
      </div>
      <div className="data-review-actions">
        <span className="data-review-pending-pill">
          <i className="bi bi-hourglass-split"></i>
          {item.pending_count} chờ
        </span>
        <i className="bi bi-chevron-right data-review-row-chevron" aria-hidden="true"></i>
      </div>
    </button>
  );
}

function TaskTypeChip({ stats }: { stats: TaskTypeStats }) {
  const meta = TASK_META[stats.task_type] ?? { label: stats.task_type, cls: "", icon: "bi-tag" };
  const cb = consensusBadge(stats.consensus_rate);
  return (
    <div className={`data-review-tt-chip ${meta.cls}`}>
      <span className="data-review-tt-label">
        <i className={`bi ${meta.icon}`}></i> {meta.label}
      </span>
      <span className="data-review-tt-counts">
        {stats.annotations_pending > 0 && (
          <Badge bg="secondary" pill className="me-1">{stats.annotations_pending}</Badge>
        )}
        {stats.annotations_approved > 0 && (
          <Badge bg="success" pill className="me-1">{stats.annotations_approved}</Badge>
        )}
        {stats.annotations_rejected > 0 && (
          <Badge bg="danger" pill className="me-1">{stats.annotations_rejected}</Badge>
        )}
      </span>
      <span className={`data-review-consensus consensus-${cb.variant}`} title="Tỉ lệ đồng thuận">
        <i className="bi bi-people"></i> {cb.label}
      </span>
    </div>
  );
}

function DataDetailPanel({
  item,
  onClose,
  onChanged,
}: {
  item: DataReviewItem;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<DataReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyAnn, setBusyAnn] = useState<number | null>(null);
  const [reject, setReject] = useState<{ id: number; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let current = true;
    reviewApi
      .reviewDataDetail(item.audio_id)
      .then((data) => { if (current) setDetail(data); })
      .catch((e) => { if (current) setError(extractError(e)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [item.audio_id]);

  const reload = () => {
    reviewApi.reviewDataDetail(item.audio_id).then(setDetail).catch((e) => setError(extractError(e)));
  };

  const handleApprove = async (annId: number) => {
    setBusyAnn(annId);
    try {
      await reviewApi.review(annId, true);
      reload();
      onChanged();
    } catch (e) {
      setError(extractError(e));
    } finally {
      setBusyAnn(null);
    }
  };

  const handleReject = async () => {
    if (!reject) return;
    setBusyAnn(reject.id);
    try {
      await reviewApi.review(reject.id, false, reject.note || undefined);
      setReject(null);
      reload();
      onChanged();
    } catch (e) {
      setError(extractError(e));
    } finally {
      setBusyAnn(null);
    }
  };

  return (
    <>
      <aside className="data-review-side">
        <div className="collection-review-heading">
          <div className="min-w-0"><strong>{item.filename}</strong><span>{item.project_name}</span></div>
          <button type="button" className="workspace-icon-button" onClick={onClose} aria-label="Đóng chi tiết kiểm duyệt"><i className="bi bi-x-lg" aria-hidden="true" /></button>
        </div>
        <div className="data-review-side-body">
          <div className="d-flex flex-wrap gap-2 mb-3">{item.task_types.map((stats) => <TaskTypeChip key={stats.task_type} stats={stats} />)}</div>
          {item.audio_url && (
            <audio src={item.audio_url} controls className="w-100 mb-3" />
          )}
          {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
          {loading ? (
            <div className="text-center py-4"><Spinner animation="border" /></div>
          ) : detail ? (
            <div className="data-review-detail">
              {detail.groups.length === 0 ? (
                <div className="text-muted">Chưa có task nào.</div>
              ) : (
                detail.groups.map((g) => (
                  <DetailGroup
                    key={g.task_type}
                    taskType={g.task_type}
                    tasks={g.tasks}
                    busyAnn={busyAnn}
                    onApprove={handleApprove}
                    onReject={(id) => setReject({ id, note: "" })}
                  />
                ))
              )}
            </div>
          ) : null}
        </div>
      </aside>

      <Modal show={!!reject} onHide={() => setReject(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Lý do từ chối</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Label className="text-muted small">
            Note này sẽ hiển thị cho annotator để họ hiểu lý do bị từ chối.
          </Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            placeholder="VD: transcript sai, không nghe rõ..."
            value={reject?.note ?? ""}
            onChange={(e) => reject && setReject({ ...reject, note: e.target.value })}
            autoFocus
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setReject(null)}>Huỷ</Button>
          <Button variant="danger" onClick={handleReject} disabled={busyAnn !== null}>
            <i className="bi bi-x-circle me-2"></i>Reject
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function DetailGroup({
  taskType,
  tasks,
  busyAnn,
  onApprove,
  onReject,
}: {
  taskType: TaskType;
  tasks: { task_id: number; payload: Record<string, unknown>; is_golden: boolean; parent_task_id: number | null; annotations: DataReviewAnnotation[] }[];
  busyAnn: number | null;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const meta = TASK_META[taskType] ?? { label: taskType, cls: "", icon: "bi-tag" };
  return (
    <div className="data-review-group">
      {tasks.map((t) => (
        <div key={t.task_id} className={`data-review-task data-review-task-${taskType}`}>
          <div className="data-review-task-head">
            <span className="data-review-task-name">
              <i className={`bi ${meta.icon}`}></i>
              {meta.label}
            </span>
            <span className="text-muted small">{t.annotations.length} annotation</span>
          </div>
          {Object.keys(t.payload).length > 0 && (
            <div className="data-review-task-payload">
              {typeof t.payload.suggested_label === "string" && (
                <div><span className="text-muted small">Gợi ý:</span> "{t.payload.suggested_label as string}"</div>
              )}
              {typeof t.payload.question === "string" && (
                <div><span className="text-muted small">Câu hỏi:</span> {t.payload.question as string}</div>
              )}
            </div>
          )}
          {t.annotations.length === 0 ? (
            <div className="text-muted small">Chưa có annotation.</div>
          ) : (
            t.annotations.map((ann) => (
              <div
                key={ann.id}
                className={`data-review-ann data-review-ann-${ann.review_status}`}
                data-initials={initials(ann.user_full_name)}
              >
                <div className="data-review-ann-meta">
                  <span className="data-review-ann-user">{ann.user_full_name}</span>
                  <span className="text-muted small">{relTime(ann.created_at)}</span>
                  {ann.low_engagement && (
                    <Badge bg="warning" text="dark"><i className="bi bi-exclamation-triangle"></i> low</Badge>
                  )}
                  {ann.is_golden_check && (
                    <Badge bg="info"><i className="bi bi-shield-check"></i> golden</Badge>
                  )}
                </div>
                <div className="data-review-ann-answer">{answerSummary(ann.answer)}</div>
                <div className="data-review-ann-actions">
                  <span className="data-review-ann-score">+{ann.score_awarded}</span>
                  {ann.review_status === "pending" ? (
                    <>
                      <Button size="sm" variant="success" onClick={() => onApprove(ann.id)} disabled={busyAnn !== null}>
                        {busyAnn === ann.id ? <Spinner size="sm" animation="border" /> : <><i className="bi bi-check2"></i> Duyệt</>}
                      </Button>
                      <Button size="sm" variant="outline-danger" onClick={() => onReject(ann.id)} disabled={busyAnn !== null}>
                        <i className="bi bi-x-lg"></i> Từ chối
                      </Button>
                    </>
                  ) : (
                    <Badge bg={ann.review_status === "approved" ? "success" : "danger"}>
                      {ann.review_status === "approved" ? "Đã duyệt" : "Đã từ chối"}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
