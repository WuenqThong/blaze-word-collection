import { useEffect, useMemo, useState } from "react";
import { Card, Spinner, Form, Badge, Row, Col, ProgressBar, Nav } from "react-bootstrap";
import { projectsApi } from "../../api/projects";
import { extractError } from "../../api/client";
import { TASK_TYPE_LABELS, type AudioReportItem, type ItemProgress, type ProjectReport, type TaskType } from "../../lib/projectTypes";

interface ReportTabProps {
  projectId: number;
  enabledTaskTypes: TaskType[];
}

type ReportSubTab = "overview" | "stats";

const PROGRESS_META: Record<ItemProgress, { label: string; cls: string; icon: string }> = {
  not_started: { label: "Chưa gán",  cls: "report-pill-idle",     icon: "bi-circle" },
  in_progress: { label: "Đang gán",  cls: "report-pill-progress", icon: "bi-hourglass-split" },
  completed:   { label: "Hoàn tất",  cls: "report-pill-done",     icon: "bi-check2-circle" },
};

function consensusTone(c: number | null): string {
  if (c === null) return "consensus-na";
  if (c >= 0.8) return "consensus-high";
  if (c >= 0.5) return "consensus-mid";
  return "consensus-low";
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return "vừa xong";
  if (sec < 3600) return `${Math.floor(sec / 60)} phút trước`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)} giờ trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

export function ReportTab({ projectId, enabledTaskTypes }: ReportTabProps) {
  const [data, setData] = useState<ProjectReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ReportSubTab>("overview");
  const [progressFilter, setProgressFilter] = useState<ItemProgress | "">("");
  const [taskFilter, setTaskFilter] = useState<TaskType | "">("");

  useEffect(() => {
    setLoading(true);
    projectsApi.report(projectId)
      .then(setData)
      .catch((e) => setError(extractError(e, "Không tải được báo cáo")))
      .finally(() => setLoading(false));
  }, [projectId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.items.filter((it) =>
      (!progressFilter || it.progress === progressFilter) &&
      (!taskFilter || it.task_type === taskFilter),
    );
  }, [data, progressFilter, taskFilter]);

  if (loading && !data) {
    return <div className="text-center py-5"><Spinner animation="border" /></div>;
  }
  if (error && !data) {
    return <div className="report-empty">Không có dữ liệu</div>;
  }
  if (!data) return null;
  if (data.summary.total_items === 0) {
    return <div className="report-empty">Không có dữ liệu</div>;
  }

  const s = data.summary;
  const completedPct = s.total_items > 0 ? (s.completed / s.total_items) * 100 : 0;

  return (
    <>
      <Nav variant="tabs" activeKey={tab} onSelect={(k) => k && setTab(k as ReportSubTab)} className="pill-tabs">
        <Nav.Item>
          <Nav.Link eventKey="overview">
            <i className="bi bi-pie-chart me-1"></i>Tổng quan
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="stats">
            <i className="bi bi-list-ul me-1"></i>Thống kê
            <span className="history-tab-count">{data.items.length}</span>
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {tab === "overview" ? (
        <>
          {/* Summary tiles */}
          <Row className="g-3 mb-3">
            <Col md={3} sm={6}>
              <div className="report-stat report-stat-default">
                <div className="report-stat-label">Tổng câu</div>
                <div className="report-stat-value">{s.total_items}</div>
                <div className="report-stat-hint">Redundancy ×{s.redundancy}</div>
              </div>
            </Col>
            <Col md={3} sm={6}>
              <div className="report-stat report-stat-idle">
                <div className="report-stat-label">Chưa gán</div>
                <div className="report-stat-value">{s.not_started}</div>
                <div className="report-stat-hint">0 annotation</div>
              </div>
            </Col>
            <Col md={3} sm={6}>
              <div className="report-stat report-stat-progress">
                <div className="report-stat-label">Đang gán</div>
                <div className="report-stat-value">{s.in_progress}</div>
                <div className="report-stat-hint">1..{s.redundancy - 1} annotation</div>
              </div>
            </Col>
            <Col md={3} sm={6}>
              <div className="report-stat report-stat-done">
                <div className="report-stat-label">Hoàn tất</div>
                <div className="report-stat-value">{s.completed}</div>
                <div className="report-stat-hint">≥{s.redundancy} annotation</div>
              </div>
            </Col>
          </Row>

          <Card>
            <Card.Body className="py-3">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <div className="flex-grow-1 min-w-0">
                  <div className="small text-muted mb-1">Tiến độ tổng thể</div>
                  <ProgressBar style={{ height: 10 }}>
                    <ProgressBar variant="success" now={(s.completed / Math.max(1, s.total_items)) * 100} key="done" />
                    <ProgressBar variant="warning" now={(s.in_progress / Math.max(1, s.total_items)) * 100} key="inp" />
                  </ProgressBar>
                </div>
                <div className="text-end" style={{ minWidth: 120 }}>
                  <div className="fw-bold" style={{ fontSize: "1.4rem" }}>{completedPct.toFixed(0)}%</div>
                  <div className="small text-muted">đã hoàn tất</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </>
      ) : (
        <>
          {/* Filters */}
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <Form.Label className="mb-0 small text-muted">Lọc theo:</Form.Label>
            <Form.Select
              size="sm"
              style={{ width: "auto" }}
              value={progressFilter}
              onChange={(e) => setProgressFilter(e.target.value as ItemProgress | "")}
            >
              <option value="">Mọi trạng thái</option>
              <option value="not_started">Chưa gán</option>
              <option value="in_progress">Đang gán</option>
              <option value="completed">Hoàn tất</option>
            </Form.Select>
            <Form.Select
              size="sm"
              style={{ width: "auto" }}
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value as TaskType | "")}
            >
              <option value="">Mọi loại task</option>
              {enabledTaskTypes.map((tt) => (
                <option key={tt} value={tt}>{TASK_TYPE_LABELS[tt].title}</option>
              ))}
            </Form.Select>
            <Badge bg="light" text="dark" className="border ms-auto">
              {filtered.length}/{data.items.length}
            </Badge>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="report-empty">Không có câu nào khớp bộ lọc</div>
          ) : (
            <div className="report-list">
              {filtered.map((it) => <ReportRow key={it.task_id} item={it} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}

function ReportRow({ item }: { item: AudioReportItem }) {
  const meta = TASK_TYPE_LABELS[item.task_type];
  const pm = PROGRESS_META[item.progress];
  const fillPct = (item.num_annotations / Math.max(1, item.num_required)) * 100;

  return (
    <div className="report-row">
      <div className="report-row-main">
        <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
          <i className="bi bi-music-note-beamed text-muted"></i>
          <span className="report-filename">{item.filename}</span>
          <span className="task-pill task-pill-indigo">
            <i className={`bi ${meta.icon}`}></i> {meta.title.split(" ")[0]}
          </span>
          {item.is_golden && (
            <span className="queue-tag-golden">
              <i className="bi bi-shield-check"></i> golden
            </span>
          )}
          <span className={`report-pill ${pm.cls}`}>
            <i className={`bi ${pm.icon}`}></i> {pm.label}
          </span>
        </div>
        <div className="small text-muted">
          {item.latest_at
            ? <>Annotation gần nhất: {formatTime(item.latest_at)}</>
            : <>Chưa có annotation nào</>
          }
          {item.num_annotations > 0 && <> · {item.distinct_answers} đáp án phân biệt</>}
        </div>
      </div>

      <div className="report-row-progress">
        <div className="d-flex align-items-baseline justify-content-between mb-1">
          <span className="small text-muted">Annotator</span>
          <span className="report-progress-count">
            <strong>{item.num_annotations}</strong>/<span className="text-muted">{item.num_required}</span>
          </span>
        </div>
        <div className="report-progress-bar">
          <div className="report-progress-fill" style={{ width: `${Math.min(100, fillPct)}%` }} />
        </div>
      </div>

      <div className="report-row-consensus">
        <div className="small text-muted mb-1">Đồng thuận</div>
        <div className={`consensus-pill ${consensusTone(item.consensus)}`}>
          {item.consensus === null
            ? "—"
            : `${Math.round(item.consensus * 100)}%`
          }
        </div>
      </div>
    </div>
  );
}
