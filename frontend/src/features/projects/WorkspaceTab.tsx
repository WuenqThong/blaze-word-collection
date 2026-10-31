import { useEffect, useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import { annotateApi } from "../../api/annotate";
import { extractError } from "../../api/client";
import { TASK_TYPE_LABELS } from "../../lib/projectTypes";
import type { Project } from "../../lib/projectTypes";
import type { ProjectStatsResponse } from "../../lib/annotateTypes";
import { projectPath } from "../../lib/slug";

interface WorkspaceTabProps {
  project: Project;
  isAdmin?: boolean;
}

const STATUS_TEXT: Record<string, string> = {
  draft: "Bản nháp",
  active: "Đang chạy",
  closed: "Đã đóng",
};

export function WorkspaceTab({ project, isAdmin = false }: WorkspaceTabProps) {
  const [stats, setStats] = useState<ProjectStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) return;
    annotateApi.myStats(project.id)
      .then(setStats)
      .catch((e) => setError(extractError(e, "Không tải được thống kê")));
  }, [project.id, isAdmin]);

  const isReady = project.status === "active";

  return (
    <div className="ws-shell">
      {error && <Alert variant="danger" className="mb-3 py-2">{error}</Alert>}

      <div className="mb-2">
        <span className="ws-eyebrow">
          <span className={`ws-status-dot ${project.status}`}></span>
          {STATUS_TEXT[project.status] ?? project.status}
        </span>
      </div>
      <h1 className="ws-title">{project.name}</h1>
      <p className="ws-subtitle">
        {project.description?.trim() || "Tham gia gán nhãn để nhận điểm thưởng cho mỗi annotation hoàn tất."}
      </p>

      {!isAdmin && (
        <div className="ws-stats">
          <div>
            <div className="ws-stat-label">Đã hoàn thành</div>
            <div className="ws-stat-value">
              {stats?.annotated_count ?? 0}<span className="unit">audio</span>
            </div>
          </div>
          <div>
            <div className="ws-stat-label">Điểm pending</div>
            <div className="ws-stat-value score-value">
              {stats?.score_pending ?? 0}<span className="unit">điểm</span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="ws-section-label">Loại task &amp; điểm thưởng</div>
        {project.task_types.map((tt) => {
          const meta = TASK_TYPE_LABELS[tt];
          const points = project.scoring[tt] ?? 0;
          return (
            <div key={tt} className="ws-task-row">
              <div className="ws-task-icon"><i className={`bi ${meta.icon}`}></i></div>
              <div className="ws-task-name">{meta.title}</div>
              <div className="ws-task-points">+{points}</div>
            </div>
          );
        })}
      </div>

      {/* Friendly CTA — chỉ annotator mới có */}
      {!isAdmin && (
        <div className="ws-cta-row">
          {isReady ? (
            <>
              <Link to={projectPath(project, "annotate")}>
                <Button variant="primary" size="lg" className="ws-cta-btn">
                  Bắt đầu gán<i className="bi bi-arrow-right ms-2"></i>
                </Button>
              </Link>
              <span className="ws-cta-hint">
                <i className="bi bi-stars me-1"></i>
                Hệ thống sẽ chọn ngẫu nhiên một audio cho bạn.
              </span>
            </>
          ) : (
            <>
              <Button variant="primary" size="lg" className="ws-cta-btn" disabled>
                Bắt đầu gán<i className="bi bi-arrow-right ms-2"></i>
              </Button>
              <span className="ws-cta-hint">
                <i className="bi bi-info-circle me-1"></i>
                Project chưa active — quay lại sau nhé.
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
