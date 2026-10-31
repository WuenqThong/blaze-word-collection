import { useState, type FormEvent } from "react";
import { Button, Alert } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { projectsApi } from "../../api/projects";
import { extractError } from "../../api/client";
import { ProjectForm, DEFAULT_FORM, type ProjectFormState } from "./ProjectForm";
import { projectPath } from "../../lib/slug";

export function NewProjectPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<ProjectFormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await projectsApi.create({
        name: state.name,
        description: state.description || undefined,
        kind: state.kind,
        task_types: state.task_types,
        scoring: state.scoring,
        redundancy: state.redundancy,
        golden_ratio: state.golden_ratio,
        repeat_ratio: state.repeat_ratio,
        visibility: state.visibility,
        agent_endpoint: state.kind === "collect" ? (state.agent_endpoint || undefined) : undefined,
        default_language: state.kind === "collect" ? state.default_language : undefined,
      });
      navigate(projectPath(created), { replace: true });
    } catch (err) {
      setError(extractError(err, "Tạo project thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-3">
        <div>
          <Link to="/projects" className="small text-muted">
            <i className="bi bi-arrow-left me-1"></i>Quay lại danh sách
          </Link>
          <h3 className="mt-1 mb-0">Tạo project mới</h3>
        </div>
        <Button type="submit" variant="primary" disabled={submitting || !state.name.trim()}>
          {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang tạo...</> : (
            <><i className="bi bi-check2 me-2"></i>Tạo project</>
          )}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <ProjectForm state={state} onChange={setState} disabled={submitting} />

      <div className="d-flex justify-content-end mt-4">
        <Link to="/projects" className="btn btn-outline-secondary me-2">Huỷ</Link>
        <Button type="submit" variant="primary" disabled={submitting || !state.name.trim()}>
          {submitting ? "Đang tạo..." : "Tạo project"}
        </Button>
      </div>
    </form>
  );
}
