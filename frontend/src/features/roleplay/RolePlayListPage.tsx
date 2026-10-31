import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Card, Spinner } from "react-bootstrap";
import { roleplayApi, type RolePlayScenario } from "../../api/roleplay";
import { projectsApi } from "../../api/projects";
import { extractError } from "../../api/client";
import { useAuth } from "../auth/AuthContext";
import { projectPath } from "../../lib/slug";
import type { Project } from "../../lib/projectTypes";

export function RolePlayListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tasks, setTasks] = useState<RolePlayScenario[] | null>(null);
  const [collectProjects, setCollectProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    roleplayApi
      .listScenariosForMe()
      .then(setTasks)
      .catch((e) => setError(extractError(e, "Không tải được kịch bản")));
    // Load collect projects để gợi ý cho admin khi empty.
    if (isAdmin) {
      projectsApi
        .list()
        .then((ps) => setCollectProjects(ps.filter((p) => p.kind === "collect")))
        .catch(() => {});
    }
  }, [isAdmin]);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!tasks) return <Spinner animation="border" />;

  if (tasks.length === 0) {
    return (
      <div className="text-center py-5">
        <i className="bi bi-mic-mute display-1 d-block mb-3 text-muted"></i>
        <h4>Chưa có task role-play</h4>
        {isAdmin ? (
          <div className="mt-3">
            <p className="text-muted">
              {collectProjects.length === 0
                ? "Chưa có project loại 'thu thập'. Tạo project mới với loại 'Thu thập', sau đó vào tab Role play để import task từ agent."
                : "Vào project thu thập → tab Role play → Import từ agent. Đảm bảo task active và project public hoặc bạn là member."}
            </p>
            {collectProjects.length === 0 ? (
              <Link to="/projects/new" className="btn btn-primary mt-2">
                <i className="bi bi-plus-lg me-2"></i> Tạo project thu thập
              </Link>
            ) : (
              <div className="d-flex justify-content-center gap-2 flex-wrap mt-2">
                {collectProjects.map((p) => (
                  <Link key={p.id} to={projectPath(p)} className="btn btn-outline-primary btn-sm">
                    <i className="bi bi-mic me-1"></i> {p.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted mb-0">
            Bạn chưa thuộc project thu thập nào. Liên hệ admin để được thêm vào project.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="mb-1">Role play</h2>
          <p className="text-muted mb-0">
            Chọn task để nói chuyện với AI agent. Toàn bộ phiên sẽ được ghi âm.
          </p>
        </div>
        <Link to="/roleplay/history" className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-clock-history me-1"></i> Lịch sử của tôi
        </Link>
      </div>

      <div className="d-grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {tasks.map((t) => {
          const limit = t.max_tasks_per_user;
          const reachedLimit = limit > 0 && t.tasks_done >= limit;
          return (
            <Card key={t.id} className={reachedLimit ? "opacity-75" : ""}>
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h5 className="mb-0">{t.name}</h5>
                  <Badge bg="secondary" pill>
                    {t.language.toUpperCase()}
                  </Badge>
                </div>
                {t.project_name && (
                  <p className="text-muted small mb-1">
                    <i className="bi bi-folder me-1"></i> {t.project_name}
                  </p>
                )}
                {t.description && <p className="text-muted small mb-3">{t.description}</p>}
                <div className="small text-muted mb-3">
                  Đã thực hiện: <strong>{t.tasks_done}</strong>
                  {limit > 0 && ` / ${limit}`}
                  {t.max_duration_sec > 0 && (
                    <span className="ms-2">· Tối đa {Math.floor(t.max_duration_sec / 60)} phút/lượt</span>
                  )}
                </div>
                <Link
                  to={`/roleplay/${t.id}`}
                  className={`btn btn-primary w-100 ${reachedLimit ? "disabled" : ""}`}
                  aria-disabled={reachedLimit}
                >
                  <i className="bi bi-mic-fill me-2"></i>
                  {reachedLimit ? "Đã đạt giới hạn" : "Bắt đầu"}
                </Link>
              </Card.Body>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
