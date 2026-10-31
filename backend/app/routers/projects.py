from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User
from app.schemas.project import (
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberPublic,
    ProjectPublic,
    ProjectReport,
    ProjectUpdate,
)
from app.services.project_service import ProjectService

from .deps import get_current_user, require_role

router = APIRouter(prefix="/projects", tags=["projects"])


def _service(db: Session = Depends(get_db)) -> ProjectService:
    return ProjectService(db)


@router.get("", response_model=list[ProjectPublic])
def list_projects(
    user: User = Depends(get_current_user),
    svc: ProjectService = Depends(_service),
):
    return [ProjectPublic.model_validate(svc.to_public_dict(p)) for p in svc.list_for_user(user)]


@router.post("", response_model=ProjectPublic, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    user: User = Depends(require_role("admin")),
    svc: ProjectService = Depends(_service),
):
    project = svc.create(user, payload)
    return ProjectPublic.model_validate(svc.to_public_dict(project))


@router.get("/{project_id}", response_model=ProjectPublic)
def get_project(
    project_id: int,
    user: User = Depends(get_current_user),
    svc: ProjectService = Depends(_service),
):
    project = svc.get_or_404(project_id)
    svc.assert_member(project, user)
    return ProjectPublic.model_validate(svc.to_public_dict(project))


@router.patch("/{project_id}", response_model=ProjectPublic)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    _: User = Depends(require_role("admin")),
    svc: ProjectService = Depends(_service),
):
    project = svc.get_or_404(project_id)
    project = svc.update(project, payload)
    return ProjectPublic.model_validate(svc.to_public_dict(project))


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    _: User = Depends(require_role("admin")),
    svc: ProjectService = Depends(_service),
):
    project = svc.get_or_404(project_id)
    svc.delete(project)
    return None


@router.get("/{project_id}/members", response_model=list[ProjectMemberPublic])
def list_members(
    project_id: int,
    user: User = Depends(get_current_user),
    svc: ProjectService = Depends(_service),
):
    project = svc.get_or_404(project_id)
    svc.assert_member(project, user)
    return [
        ProjectMemberPublic(
            user_id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=m.role,
            joined_at=m.joined_at,
        )
        for m, u in svc.list_members(project)
    ]


@router.post("/{project_id}/members", response_model=ProjectMemberPublic, status_code=status.HTTP_201_CREATED)
def add_member(
    project_id: int,
    payload: ProjectMemberAdd,
    _: User = Depends(require_role("admin")),
    svc: ProjectService = Depends(_service),
    db: Session = Depends(get_db),
):
    project = svc.get_or_404(project_id)
    member = svc.add_member(project, payload)
    user = db.query(User).filter(User.id == member.user_id).first()
    assert user is not None
    return ProjectMemberPublic(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=member.role,
        joined_at=member.joined_at,
    )


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: int,
    user_id: int,
    _: User = Depends(require_role("admin")),
    svc: ProjectService = Depends(_service),
):
    project = svc.get_or_404(project_id)
    svc.remove_member(project, user_id)
    return None


@router.get("/{project_id}/report", response_model=ProjectReport)
def project_report(
    project_id: int,
    _: User = Depends(require_role("admin")),
    svc: ProjectService = Depends(_service),
):
    return ProjectReport(**svc.report(project_id))
