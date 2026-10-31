import { useParams, Link } from "react-router-dom";
import { Playground } from "./Playground";
import { parseProjectId } from "../../lib/slug";

export function AnnotatePage() {
  const { id } = useParams();
  const projectId = parseProjectId(id);

  return (
    <div className="annotate-shell">
      <Playground
        projectId={projectId}
        emptyExtra={
          <Link to={`/projects/${id ?? projectId}`} className="btn btn-outline-primary">
            Quay lại project
          </Link>
        }
      />
    </div>
  );
}
