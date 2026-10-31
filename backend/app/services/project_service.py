from collections import Counter
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Annotation, Task, Project, ProjectMember, User
from app.schemas.project import (
    DEFAULT_SCORING,
    ProjectCreate,
    ProjectMemberAdd,
    ProjectUpdate,
)


def _normalize_answer(ann: Annotation) -> Optional[str]:
    a = ann.answer or {}
    if "verdict" in a:
        return str(a.get("verdict") or "").strip().lower() or None
    if "option" in a:
        return str(a.get("option") or "").strip().lower() or None
    if "text" in a:
        return str(a.get("text") or "").strip().lower() or None
    return None


class ProjectService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---------- queries ----------
    def list_for_user(self, user: User) -> list[Project]:
        if user.role == "admin":
            return self.db.query(Project).order_by(Project.created_at.desc()).all()
        # Public projects + projects where user is member
        member_ids = {
            row.project_id
            for row in self.db.query(ProjectMember.project_id).filter(ProjectMember.user_id == user.id).all()
        }
        return (
            self.db.query(Project)
            .filter(
                (Project.visibility == "public") | (Project.id.in_(member_ids))
            )
            .order_by(Project.created_at.desc())
            .all()
        )

    def get_or_404(self, project_id: int) -> Project:
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Không tìm thấy project")
        return project

    def assert_member(self, project: Project, user: User) -> None:
        if user.role == "admin":
            return
        if getattr(project, "visibility", "private") == "public":
            return
        ok = (
            self.db.query(ProjectMember)
            .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == user.id)
            .first()
        )
        if not ok:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Không thuộc project này")

    def member_count(self, project_id: int) -> int:
        return self.db.query(ProjectMember).filter(ProjectMember.project_id == project_id).count()

    # ---------- mutations ----------
    def create(self, owner: User, payload: ProjectCreate) -> Project:
        # collect-kind project không cần task_types (gán nhãn) — chỉ cần
        # role-play scenarios. annotate-kind bắt buộc ≥ 1 task_type.
        if payload.kind == "annotate" and not payload.task_types:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Project gán nhãn phải bật ít nhất 1 loại task",
            )
        scoring = {tt: int(payload.scoring.get(tt, DEFAULT_SCORING.get(tt, 1))) for tt in payload.task_types}

        project = Project(
            name=payload.name.strip(),
            description=(payload.description or "").strip() or None,
            owner_id=owner.id,
            kind=payload.kind,
            task_types=list(payload.task_types),
            scoring=scoring,
            redundancy=payload.redundancy,
            golden_ratio=payload.golden_ratio,
            repeat_ratio=payload.repeat_ratio,
            status="draft",
            visibility=payload.visibility,
            agent_endpoint=(payload.agent_endpoint or "").strip() or None,
            default_language=payload.default_language or "vi",
        )
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def update(self, project: Project, payload: ProjectUpdate) -> Project:
        data = payload.model_dump(exclude_unset=True)

        if "task_types" in data and data["task_types"] is not None:
            new_types = list(data["task_types"])
            kind = getattr(project, "kind", "annotate")
            if kind == "annotate" and not new_types:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="Project gán nhãn phải bật ít nhất 1 loại task",
                )
            current_scoring = dict(project.scoring or {})
            scoring = {tt: current_scoring.get(tt, DEFAULT_SCORING.get(tt, 1)) for tt in new_types}
            project.task_types = new_types
            project.scoring = scoring
            data.pop("task_types")

        if "scoring" in data and data["scoring"] is not None:
            merged = dict(project.scoring or {})
            for k, v in data["scoring"].items():
                if k in (project.task_types or []):
                    merged[k] = int(v)
            project.scoring = merged
            data.pop("scoring")

        for key, value in data.items():
            setattr(project, key, value)

        self.db.commit()
        self.db.refresh(project)
        return project

    def delete(self, project: Project) -> None:
        self.db.delete(project)
        self.db.commit()

    # ---------- members ----------
    def add_member(self, project: Project, payload: ProjectMemberAdd) -> ProjectMember:
        user = self.db.query(User).filter(User.id == payload.user_id).first()
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Không tìm thấy user")
        existing = (
            self.db.query(ProjectMember)
            .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == user.id)
            .first()
        )
        if existing:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="User đã có trong project")
        member = ProjectMember(project_id=project.id, user_id=user.id, role=payload.role)
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)
        return member

    def remove_member(self, project: Project, user_id: int) -> None:
        member = (
            self.db.query(ProjectMember)
            .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == user_id)
            .first()
        )
        if not member:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Member không tồn tại")
        self.db.delete(member)
        self.db.commit()

    def list_members(self, project: Project) -> list[tuple[ProjectMember, User]]:
        return (
            self.db.query(ProjectMember, User)
            .join(User, User.id == ProjectMember.user_id)
            .filter(ProjectMember.project_id == project.id)
            .order_by(ProjectMember.joined_at.asc())
            .all()
        )

    def report(self, project_id: int) -> dict:
        """Báo cáo per-audio: tiến độ, số người gán, độ đồng thuận."""
        project = self.get_or_404(project_id)
        redundancy = max(1, int(project.redundancy or 1))

        tasks = (
            self.db.query(Task)
            .filter(Task.project_id == project_id)
            .order_by(Task.created_at.desc())
            .all()
        )
        annotations = (
            self.db.query(Annotation)
            .filter(
                Annotation.project_id == project_id,
                Annotation.is_repeat_check == False,  # noqa: E712 — repeat-checks không tính redundancy
            )
            .all()
        )

        by_audio: dict[int, list[Annotation]] = {}
        for a in annotations:
            by_audio.setdefault(a.task_id, []).append(a)

        items: list[dict] = []
        c_done = c_progress = c_idle = 0

        for audio in tasks:
            anns = by_audio.get(audio.id, [])
            n = len(anns)
            if n == 0:
                progress = "not_started"; c_idle += 1
            elif n >= redundancy:
                progress = "completed";   c_done += 1
            else:
                progress = "in_progress"; c_progress += 1

            consensus: Optional[float] = None
            distinct = 0
            if n >= 1:
                keys = [k for k in (_normalize_answer(a) for a in anns) if k is not None]
                if keys:
                    ctr = Counter(keys)
                    distinct = len(ctr)
                    if n >= 2:
                        consensus = ctr.most_common(1)[0][1] / n

            latest = max((a.created_at for a in anns), default=None)
            items.append({
                "task_id": audio.id,
                "filename": audio.original_filename,
                "task_type": audio.task_type,
                "is_golden": audio.is_golden,
                "num_annotations": n,
                "num_required": redundancy,
                "progress": progress,
                "consensus": consensus,
                "distinct_answers": distinct,
                "latest_at": latest,
            })

        return {
            "summary": {
                "total_items": len(tasks),
                "not_started": c_idle,
                "in_progress": c_progress,
                "completed": c_done,
                "redundancy": redundancy,
            },
            "items": items,
        }

    def to_public_dict(self, project: Project) -> dict:
        return {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "owner_id": project.owner_id,
            "kind": getattr(project, "kind", "annotate"),
            "task_types": list(project.task_types or []),
            "scoring": dict(project.scoring or {}),
            "redundancy": project.redundancy,
            "golden_ratio": project.golden_ratio,
            "repeat_ratio": float(getattr(project, "repeat_ratio", 0.0) or 0.0),
            "status": project.status,
            "visibility": getattr(project, "visibility", "private"),
            "member_count": self.member_count(project.id),
            "agent_endpoint": getattr(project, "agent_endpoint", None),
            "default_language": getattr(project, "default_language", None),
            "created_at": project.created_at,
            "updated_at": project.updated_at,
        }


def get_project_service(db: Session) -> ProjectService:
    return ProjectService(db)
