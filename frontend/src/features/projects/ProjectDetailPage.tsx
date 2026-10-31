import { useEffect, useState } from "react";
import { Tab, Spinner, Alert, Button, Modal, Form, Dropdown } from "react-bootstrap";
import { Link, useParams, useNavigate } from "react-router-dom";
import { projectsApi } from "../../api/projects";
import { extractError } from "../../api/client";
import { useAuth } from "../auth/AuthContext";
import { type Project, type ProjectStatus, STATUS_BADGE } from "../../lib/projectTypes";
import { ProjectForm, type ProjectFormState } from "./ProjectForm";
import { ProjectScoringForm } from "./ProjectScoringForm";
import { AudiosTab } from "../audios/AudiosTab";
import { MembersTab } from "./MembersTab";
import { WorkspaceTab } from "./WorkspaceTab";
import { ReportTab } from "./ReportTab";
import { QualityControlTab } from "./QualityControlTab";
import { RolePlayTab } from "./RolePlayTab";
import { parseProjectId } from "../../lib/slug";

type TabKey = "dataset" | "quality" | "members" | "scoring" | "report" | "roleplay" | "config";

const ANNOTATE_TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "dataset", label: "Dữ liệu",            icon: "bi-database" },
  { key: "quality", label: "Dữ liệu kiểm soát",  icon: "bi-shield-check" },
  { key: "members", label: "Thành viên",         icon: "bi-people" },
  { key: "scoring", label: "Nhiệm vụ",           icon: "bi-list-check" },
  { key: "report",  label: "Báo cáo",            icon: "bi-bar-chart" },
  { key: "config",  label: "Cấu hình",           icon: "bi-gear" },
];

const COLLECT_TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "roleplay", label: "Role play",  icon: "bi-mic" },
  { key: "members",  label: "Thành viên", icon: "bi-people" },
  { key: "config",   label: "Cấu hình",   icon: "bi-gear" },
];

function projectToForm(p: Project): ProjectFormState {
  return {
    name: p.name,
    description: p.description ?? "",
    kind: p.kind,
    task_types: p.task_types,
    scoring: { ...p.scoring },
    redundancy: p.redundancy,
    golden_ratio: p.golden_ratio,
    repeat_ratio: p.repeat_ratio ?? 0,
    visibility: p.visibility,
    agent_endpoint: p.agent_endpoint ?? "",
    default_language: p.default_language ?? "vi",
  };
}

export function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = parseProjectId(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("dataset");
  const [roleplayDeep, setRoleplayDeep] = useState(false);

  useEffect(() => {
    projectsApi
      .get(projectId)
      .then((p) => {
        setProject(p);
        setForm(projectToForm(p));
        // collect-kind không có "dataset" — switch về roleplay khi load.
        if (p.kind === "collect" && (activeTab === "dataset" || activeTab === "quality" || activeTab === "scoring" || activeTab === "report")) {
          setActiveTab("roleplay");
        }
      })
      .catch((e) => setError(extractError(e, "Không tải được project")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaveOk(false);
    try {
      const updated = await projectsApi.update(projectId, {
        name: form.name,
        description: form.description || undefined,
        task_types: form.task_types,
        scoring: form.scoring,
        redundancy: form.redundancy,
        golden_ratio: form.golden_ratio,
        repeat_ratio: form.repeat_ratio,
        visibility: form.visibility,
        agent_endpoint: form.kind === "collect" ? (form.agent_endpoint || undefined) : undefined,
        default_language: form.kind === "collect" ? form.default_language : undefined,
      });
      setProject(updated);
      setForm(projectToForm(updated));
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e) {
      setError(extractError(e, "Lưu thất bại"));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (next: ProjectStatus) => {
    setSaving(true);
    try {
      const updated = await projectsApi.update(projectId, { status: next });
      setProject(updated);
    } catch (e) {
      setError(extractError(e, "Đổi trạng thái thất bại"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await projectsApi.remove(projectId);
      navigate("/projects", { replace: true });
    } catch (e) {
      setError(extractError(e, "Xoá thất bại"));
      setShowDelete(false);
    }
  };

  if (error && !project) return <Alert variant="danger">{error}</Alert>;
  if (!project || !form) return <div className="text-center py-5"><Spinner animation="border" /></div>;

  const badge = STATUS_BADGE[project.status];

  return (
    <>
      {isAdmin && !(activeTab === "roleplay" && roleplayDeep) ? (
        <div className="project-header rp-fullbleed">
          <Link to="/projects" className="project-breadcrumb">
            <i className="bi bi-arrow-left"></i><span>Tất cả project</span>
          </Link>

          <div className="project-header-row">
            <div className="project-header-main">
              <h1 className="project-title">{project.name}</h1>
              {project.description && (
                <p className="project-description">{project.description}</p>
              )}
            </div>
            <div className="project-meta project-meta-right">
              <span className={`project-status-dot status-dot-${project.status}`}></span>
              <span className="project-meta-text">{badge.text}</span>
              <span className="project-meta-sep">·</span>
              <i className={`bi ${project.visibility === "public" ? "bi-globe" : "bi-lock"} project-meta-icon`}></i>
              <span className="project-meta-text">{project.visibility === "public" ? "Public" : "Private"}</span>
              {(() => {
                const TABS = project.kind === "collect" ? COLLECT_TABS : ANNOTATE_TABS;
                return (
                  <>
                    <span className="project-meta-sep">·</span>
                    <Dropdown align="end">
                      <Dropdown.Toggle
                        as="button"
                        className="project-settings-btn"
                        title="Mở cài đặt project"
                      >
                        <i className="bi bi-gear"></i>
                      </Dropdown.Toggle>
                      <Dropdown.Menu className="project-settings-menu">
                        {TABS.map((t) => (
                          <Dropdown.Item
                            key={t.key}
                            active={activeTab === t.key}
                            onClick={() => setActiveTab(t.key)}
                          >
                            <i className={`bi ${t.icon}`}></i>
                            <span>{t.label}</span>
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {saveOk && <Alert variant="success" className="py-2"><i className="bi bi-check-circle me-2"></i>Đã lưu cấu hình.</Alert>}

      {!isAdmin ? (
        // === Annotator: clean focus, không tabs, không stats admin ===
        project.kind === "collect" ? (
          <RolePlayTab projectId={projectId} isAdmin={false} agentConfigured={!!project.agent_endpoint} />
        ) : (
          <WorkspaceTab project={project} />
        )
      ) : (
        <Tab.Container activeKey={activeTab} onSelect={(k) => k && setActiveTab(k as TabKey)}>
          <div className="project-tabs-content">
        <Tab.Content>
          <Tab.Pane eventKey="config">
            <ProjectForm state={form} onChange={setForm} disabled={saving} hideScoring />

            <div className="card mb-3">
              <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="flex-grow-1 min-w-0">
                  <h6 className="mb-1 fw-semibold">Trạng thái project</h6>
                  <div className="text-muted small">
                    {project.status === "draft" && "Bản nháp — chưa thể nhận task. Kích hoạt để bắt đầu phân bổ cho annotator."}
                    {project.status === "active" && "Đang chạy — annotator có thể nhận task. Đóng khi muốn tạm dừng."}
                    {project.status === "closed" && "Đã đóng — không nhận thêm task mới. Có thể mở lại bất kỳ lúc nào."}
                  </div>
                </div>
                <div>
                  {project.status === "draft" && (
                    <Button variant="link" className="p-0 text-decoration-none" onClick={() => handleStatusChange("active")} disabled={saving}>
                      <i className="bi bi-play-circle me-2"></i>Kích hoạt
                    </Button>
                  )}
                  {project.status === "active" && (
                    <Button variant="link" className="p-0 text-decoration-none text-secondary" onClick={() => handleStatusChange("closed")} disabled={saving}>
                      <i className="bi bi-stop-circle me-2"></i>Đóng
                    </Button>
                  )}
                  {project.status === "closed" && (
                    <Button variant="link" className="p-0 text-decoration-none" onClick={() => handleStatusChange("active")} disabled={saving}>
                      <i className="bi bi-arrow-counterclockwise me-2"></i>Mở lại
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="card mb-3">
              <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="flex-grow-1 min-w-0">
                  <h6 className="mb-1 fw-semibold">Xoá project</h6>
                  <div className="text-muted small">
                    Xoá project sẽ xoá toàn bộ audio, annotation, và mọi liên kết liên quan. Hành động không thể hoàn tác.
                  </div>
                </div>
                <Button variant="link" className="p-0 text-decoration-none text-danger" onClick={() => { setDeleteConfirm(""); setShowDelete(true); }} disabled={saving}>
                  <i className="bi bi-trash me-2"></i>Xoá project
                </Button>
              </div>
            </div>

            <div className="d-flex justify-content-end mt-4">
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang lưu...</> : (
                  <><i className="bi bi-check2 me-2"></i>Lưu cấu hình</>
                )}
              </Button>
            </div>
          </Tab.Pane>

          <Tab.Pane eventKey="scoring">
            <ProjectScoringForm state={form} onChange={setForm} disabled={saving} />
            <div className="d-flex justify-content-end mt-4">
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang lưu...</> : (
                  <><i className="bi bi-check2 me-2"></i>Lưu điểm thưởng</>
                )}
              </Button>
            </div>
          </Tab.Pane>

          <Tab.Pane eventKey="members">
            <MembersTab
              projectId={projectId}
              isPublic={project.visibility === "public"}
              isAdmin
            />
          </Tab.Pane>

          <Tab.Pane eventKey="dataset">
            <AudiosTab
              projectId={projectId}
              enabledTaskTypes={project.task_types}
              isAdmin
            />
          </Tab.Pane>

          <Tab.Pane eventKey="quality">
            <QualityControlTab
              projectId={projectId}
              enabledTaskTypes={project.task_types}
            />
          </Tab.Pane>

          <Tab.Pane eventKey="report">
            <ReportTab projectId={projectId} enabledTaskTypes={project.task_types} />
          </Tab.Pane>

          <Tab.Pane eventKey="roleplay">
            <RolePlayTab
              projectId={projectId}
              isAdmin
              agentConfigured={!!project.agent_endpoint}
              onDeepViewChange={setRoleplayDeep}
            />
          </Tab.Pane>
        </Tab.Content>
          </div>
        </Tab.Container>
      )}

      <Modal show={showDelete} onHide={() => setShowDelete(false)} centered>
        <Modal.Header closeButton className="border-0">
          <Modal.Title className="text-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>Xoá project?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3">
            Bạn sắp xoá project <strong>"{project.name}"</strong>. Toàn bộ audio,
            annotation, và yêu cầu rút tiền liên quan sẽ bị xoá vĩnh viễn.
          </p>
          <Alert variant="danger" className="py-2 small">
            <i className="bi bi-info-circle me-1"></i>
            Hành động này <strong>không thể hoàn tác</strong>.
          </Alert>
          <Form.Group>
            <Form.Label className="small">
              Gõ <code className="text-danger">{project.name}</code> để xác nhận:
            </Form.Label>
            <Form.Control
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={project.name}
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button variant="outline-secondary" onClick={() => setShowDelete(false)}>Huỷ</Button>
          <Button variant="danger" onClick={handleDelete}
            disabled={deleteConfirm.trim() !== project.name}>
            <i className="bi bi-trash me-2"></i>Xoá vĩnh viễn
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
