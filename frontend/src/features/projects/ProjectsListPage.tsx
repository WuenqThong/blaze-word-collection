import { useEffect, useState } from "react";
import { Card, Button, Row, Col, Badge, Spinner, Alert } from "react-bootstrap";
import { Link } from "react-router-dom";
import { projectsApi } from "../../api/projects";
import { extractError } from "../../api/client";
import { useAuth } from "../auth/AuthContext";
import { type Project, KIND_META, STATUS_BADGE, TASK_TYPE_LABELS } from "../../lib/projectTypes";
import { projectPath } from "../../lib/slug";

export function ProjectsListPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    projectsApi
      .list()
      .then(setProjects)
      .catch((e) => setError(extractError(e, "Không tải được danh sách project")));
  }, []);

  const isAdmin = user?.role === "admin";

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-3">
        <div>
          <h3 className="mb-1">Project</h3>
          <p className="text-muted mb-0">
            {isAdmin ? "Tất cả project trong hệ thống." : "Project bạn đang tham gia."}
          </p>
        </div>
        {isAdmin && (
          <Link to="/projects/new">
            <Button variant="primary"><i className="bi bi-plus-lg me-2"></i>Tạo project</Button>
          </Link>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {projects === null ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : projects.length === 0 ? (
        <Card>
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-folder2-open" style={{ fontSize: "2.4rem" }}></i>
            <p className="mt-2 mb-3">Chưa có project nào.</p>
            {isAdmin && (
              <Link to="/projects/new" className="btn btn-outline-primary">
                Tạo project đầu tiên
              </Link>
            )}
          </Card.Body>
        </Card>
      ) : (
        <Row className="g-3">
          {projects.map((p) => {
            const badge = STATUS_BADGE[p.status];
            return (
              <Col key={p.id} md={6} lg={4}>
                <Card className="h-100">
                  <Card.Body className="d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex align-items-center gap-2 flex-grow-1 min-w-0" style={{ maxWidth: "70%" }}>
                        <i
                          className={`bi ${KIND_META[p.kind].icon}`}
                          title={KIND_META[p.kind].label}
                          style={{ color: "var(--brand-700)" }}
                        ></i>
                        <h5 className="mb-0 text-truncate">{p.name}</h5>
                      </div>
                      <div className="d-flex flex-column align-items-end gap-1">
                        <Badge bg={badge.variant}>{badge.text}</Badge>
                        <span className={`badge bg-${p.visibility === "public" ? "info" : "secondary"}`}>
                          <i className={`bi ${p.visibility === "public" ? "bi-globe" : "bi-lock"} me-1`}></i>
                          {p.visibility === "public" ? "Public" : "Private"}
                        </span>
                      </div>
                    </div>
                    {p.description && (
                      <p className="text-muted small" style={{ minHeight: 36 }}>
                        {p.description.length > 100 ? p.description.slice(0, 100) + "…" : p.description}
                      </p>
                    )}

                    {p.kind === "annotate" ? (
                      <>
                        <div className="project-rewards mb-3">
                          {p.task_types.map((tt) => {
                            const meta = TASK_TYPE_LABELS[tt];
                            const points = p.scoring[tt] ?? 0;
                            return (
                              <div key={tt} className="project-reward-row">
                                <i className={`bi ${meta.icon}`}></i>
                                <span className="project-reward-name">{meta.title}</span>
                                <span className="project-reward-points">+{points}<span className="unit">đ/câu</span></span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="d-flex justify-content-between text-muted small mb-3">
                          <span><i className="bi bi-people me-1"></i>{p.member_count}</span>
                          <span title="Số người gán mỗi audio"><i className="bi bi-arrow-repeat me-1"></i>×{p.redundancy}</span>
                          <span title="Tỉ lệ task golden (kiểm tra)"><i className="bi bi-shield-check me-1"></i>{Math.round(p.golden_ratio * 100)}%</span>
                        </div>
                      </>
                    ) : (
                      <div className="d-flex flex-column gap-2 mb-3">
                        <div className="small text-muted">
                          <i className="bi bi-mic me-2"></i>
                          {KIND_META.collect.desc}
                        </div>
                        <div className="d-flex justify-content-between text-muted small">
                          <span><i className="bi bi-people me-1"></i>{p.member_count} member</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-auto">
                      <Link to={projectPath(p)} className="btn btn-outline-primary w-100">
                        Mở project<i className="bi bi-arrow-right ms-2"></i>
                      </Link>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </>
  );
}
