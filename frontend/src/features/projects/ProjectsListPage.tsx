import { useEffect, useState } from "react";
import { Card, Row, Col, Badge, Spinner, Alert } from "react-bootstrap";
import { Link } from "react-router-dom";
import { projectsApi } from "../../api/projects";
import { extractError } from "../../api/client";
import { useAuth } from "../auth/AuthContext";
import { type Project, KIND_META, STATUS_BADGE, TASK_TYPE_LABELS } from "../../lib/projectTypes";
import { projectPath } from "../../lib/slug";

type KindFilter = "all" | "annotate" | "collect";

export function ProjectsListPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [attempt, setAttempt] = useState(0);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    let cancelled = false;
    projectsApi.list().then((data) => { if (!cancelled) setProjects(data); })
      .catch((e) => { if (!cancelled) setError(extractError(e, "Không tải được danh sách dự án.")); });
    return () => { cancelled = true; };
  }, [attempt]);

  const visible = (projects ?? []).filter((p) =>
    (kind === "all" || p.kind === kind) &&
    `${p.name} ${p.description ?? ""}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));

  return <>
    <div className="projects-heading">
      <div><div className="page-eyebrow">KHÔNG GIAN DỮ LIỆU</div><h1>Dự án của bạn</h1>
        <p>{isAdmin ? "Quản lý dữ liệu, thành viên và chất lượng trong từng dự án." : "Chọn một dự án để bắt đầu đóng góp dữ liệu."}</p></div>
      {isAdmin && <Link to="/projects/new" className="btn btn-primary"><i className="bi bi-plus-lg" aria-hidden="true" /> Tạo dự án</Link>}
    </div>
    <div className="projects-toolbar">
      <div className="project-filter-tabs" role="group" aria-label="Lọc loại dự án">
        {([{ key: "all", label: "Tất cả dự án" }, { key: "annotate", label: "Gán nhãn" }, { key: "collect", label: "Thu thập" }] as const).map((filter) =>
          <button type="button" key={filter.key} className="project-filter-tab" aria-pressed={kind === filter.key} onClick={() => setKind(filter.key)}>{filter.label}</button>)}
      </div>
      <div className="projects-search"><i className="bi bi-search" aria-hidden="true" /><input type="search" className="form-control" aria-label="Tìm dự án theo tên hoặc mô tả" placeholder="Tìm kiếm dự án…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
    </div>

    {error ? <Alert variant="danger"><div className="d-flex flex-wrap align-items-center justify-content-between gap-3"><span>{error}</span><button className="btn btn-outline-danger btn-sm" onClick={() => { setError(null); setProjects(null); setAttempt((v) => v + 1); }}>Thử lại</button></div></Alert>
      : projects === null ? <div className="collection-empty" role="status"><Spinner animation="border" size="sm" className="mb-3 text-primary" /><span>Đang tải dự án…</span></div>
      : visible.length === 0 ? <div className="collection-empty"><i className={`bi ${projects.length ? "bi-search" : "bi-folder2-open"}`} aria-hidden="true" /><h2>{projects.length ? "Không tìm thấy dự án phù hợp" : "Chưa có dự án nào"}</h2><p>{projects.length ? "Thử một từ khóa khác hoặc thay đổi bộ lọc." : isAdmin ? "Tạo dự án đầu tiên để tổ chức dữ liệu và mời thành viên tham gia." : "Các dự án khả dụng sẽ xuất hiện tại đây khi được tạo hoặc khi bạn được thêm vào."}</p>
        {projects.length ? <button className="btn btn-outline-secondary" onClick={() => { setQuery(""); setKind("all"); }}>Xóa bộ lọc</button> : isAdmin && <Link className="btn btn-primary" to="/projects/new">Tạo dự án đầu tiên</Link>}</div>
      : <><div className="projects-result-count" role="status">{visible.length} dự án{query && ` phù hợp với “${query}”`}</div>
        <Row className="g-3">{visible.map((p) => <Col key={p.id} md={6} xl={4}>
          <Card className="project-grid-card h-100"><Card.Body className="d-flex flex-column">
            <div className="d-flex align-items-start justify-content-between gap-2"><div className="project-card-icon"><i className={`bi ${KIND_META[p.kind].icon}`} aria-hidden="true" /></div><Badge bg={STATUS_BADGE[p.status].variant}>{STATUS_BADGE[p.status].text}</Badge></div>
            <h2 className="mb-0">{p.name}</h2><p className="project-description">{p.description || (p.kind === "annotate" ? "Nghe, gán nhãn và kiểm tra chất lượng dữ liệu." : "Tham gia hội thoại để thu thập dữ liệu giọng nói.")}</p>
            {p.kind === "annotate" && <div className="project-rewards mb-3">{p.task_types.map((type) => <div key={type} className="project-reward-row"><i className={`bi ${TASK_TYPE_LABELS[type].icon}`} aria-hidden="true" /><span className="project-reward-name">{type === "audio_label" ? "Nghe và viết" : type === "audio_verify" ? "Xác minh âm thanh" : "Hỏi đáp"}</span><span className="project-reward-points">+{p.scoring[type] ?? 0}<span className="unit">đ/câu</span></span></div>)}</div>}
            <div className="d-flex flex-wrap gap-3 text-muted small mb-3"><span><i className="bi bi-people me-1" aria-hidden="true" />{p.member_count} thành viên</span><span><i className={`bi ${p.visibility === "public" ? "bi-globe2" : "bi-lock"} me-1`} aria-hidden="true" />{p.visibility === "public" ? "Công khai" : "Riêng tư"}</span></div>
            <div className="project-card-footer"><span className="text-muted small">{KIND_META[p.kind].label}</span><Link to={projectPath(p)} className="project-open-link" aria-label={`Mở dự án ${p.name}`}>Mở dự án <i className="bi bi-arrow-right" aria-hidden="true" /></Link></div>
          </Card.Body></Card>
        </Col>)}</Row></>}
  </>;
}
