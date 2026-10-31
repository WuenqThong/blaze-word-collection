from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User
from app.schemas.annotation import (
    AnnotationPublic,
    NextTaskResponse,
    ProjectStatsResponse,
    SubmitAnnotationRequest,
    SubmitAnnotationResponse,
)
from app.services.allocation_service import AllocationService, get_allocation_service
from app.services.project_service import ProjectService

from .deps import get_current_user

router = APIRouter(tags=["annotate"])


def _alloc(db: Session = Depends(get_db)) -> AllocationService:
    return get_allocation_service(db)


def _projects(db: Session = Depends(get_db)) -> ProjectService:
    return ProjectService(db)


@router.get("/projects/{project_id}/next-task", response_model=NextTaskResponse)
def next_task(
    project_id: int,
    user: User = Depends(get_current_user),
    alloc: AllocationService = Depends(_alloc),
    psvc: ProjectService = Depends(_projects),
):
    project = psvc.get_or_404(project_id)
    assignment, audio = alloc.get_or_assign_next(user, project)
    return NextTaskResponse(**alloc.build_next_task_response(user, project, assignment, audio))


@router.get("/me/next-task", response_model=NextTaskResponse)
def my_next_task(
    task_type: str | None = None,
    user: User = Depends(get_current_user),
    alloc: AllocationService = Depends(_alloc),
):
    """Random task từ bất cứ project nào user có quyền. Optional filter theo task_type."""
    if task_type and task_type not in {"audio_label", "audio_verify", "qa"}:
        task_type = None
    assignment, audio, project = alloc.get_global_next(user, task_type=task_type)
    if not assignment or not audio or not project:
        return NextTaskResponse(has_task=False, progress={"done": 0, "total": 0})
    return NextTaskResponse(**alloc.build_next_task_response(user, project, assignment, audio))


@router.post("/assignments/{assignment_id}/submit", response_model=SubmitAnnotationResponse)
def submit(
    assignment_id: int,
    payload: SubmitAnnotationRequest,
    user: User = Depends(get_current_user),
    alloc: AllocationService = Depends(_alloc),
):
    annotation, _audio, project = alloc.submit(user, assignment_id, payload)
    stats = alloc.project_stats(user, project)
    return SubmitAnnotationResponse(
        annotation=AnnotationPublic.model_validate(annotation),
        score_total=stats["score_pending"],
        annotated_count=stats["annotated_count"],
    )


@router.post("/assignments/{assignment_id}/submit-voice", response_model=SubmitAnnotationResponse)
async def submit_voice(
    assignment_id: int,
    audio_file: UploadFile = File(...),
    time_spent_ms: Optional[int] = Form(default=None),
    audio_listened_sec: Optional[float] = Form(default=None),
    audio_play_count: Optional[int] = Form(default=None),
    user: User = Depends(get_current_user),
    alloc: AllocationService = Depends(_alloc),
):
    """Submit qa annotation kèm voice recording."""
    raw = await audio_file.read()
    annotation, _audio, project = alloc.submit_voice(
        user, assignment_id, raw,
        mime=audio_file.content_type or "audio/webm",
        time_spent_ms=time_spent_ms,
        audio_listened_sec=audio_listened_sec,
        audio_play_count=audio_play_count,
    )
    stats = alloc.project_stats(user, project)
    return SubmitAnnotationResponse(
        annotation=AnnotationPublic.model_validate(annotation),
        score_total=stats["score_pending"],
        annotated_count=stats["annotated_count"],
    )


@router.post("/assignments/{assignment_id}/skip", status_code=204)
def skip(
    assignment_id: int,
    user: User = Depends(get_current_user),
    alloc: AllocationService = Depends(_alloc),
):
    alloc.skip(user, assignment_id)
    return None


@router.get("/me/projects/{project_id}/stats", response_model=ProjectStatsResponse)
def my_project_stats(
    project_id: int,
    user: User = Depends(get_current_user),
    alloc: AllocationService = Depends(_alloc),
    psvc: ProjectService = Depends(_projects),
):
    project = psvc.get_or_404(project_id)
    return ProjectStatsResponse(**alloc.project_stats(user, project))
