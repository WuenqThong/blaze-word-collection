from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User
from app.schemas.review import (
    AccountStatusUpdate,
    AdminOverview,
    AnnotationItem,
    AnnotationListResponse,
    DataReviewDetail,
    DataReviewListResponse,
    FlaggedUserItem,
    RelabelContext,
    RelabelRequest,
    ReviewRequest,
    UserScoreSummary,
)
from app.services.review_service import ReviewService, get_review_service

from .deps import get_current_user, require_role

router = APIRouter(tags=["review"])


def _svc(db: Session = Depends(get_db)) -> ReviewService:
    return get_review_service(db)


# ---------- Annotator self ----------
@router.get("/me/annotations", response_model=AnnotationListResponse)
def my_annotations(
    review_status: Optional[str] = Query(default=None),
    project_id: Optional[int] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    svc: ReviewService = Depends(_svc),
):
    items, total = svc.list_for_user(user, review_status, project_id, limit, offset)
    return AnnotationListResponse(
        items=[AnnotationItem.model_validate(a) for a in items],
        total=total,
    )


@router.get("/me/annotations/{annotation_id}/relabel-context", response_model=RelabelContext)
def my_relabel_context(
    annotation_id: int,
    user: User = Depends(get_current_user),
    svc: ReviewService = Depends(_svc),
):
    return RelabelContext(**svc.get_relabel_context(user, annotation_id))


@router.patch("/me/annotations/{annotation_id}", response_model=AnnotationItem)
def my_update_pending(
    annotation_id: int,
    payload: RelabelRequest,
    user: User = Depends(get_current_user),
    svc: ReviewService = Depends(_svc),
):
    ann = svc.update_pending(
        user, annotation_id,
        new_answer=payload.answer,
        time_spent_ms=payload.time_spent_ms,
        audio_listened_sec=payload.audio_listened_sec,
        audio_play_count=payload.audio_play_count,
    )
    return AnnotationItem.model_validate(ann)


@router.get("/me/score-summary", response_model=UserScoreSummary)
def my_score_summary(
    user: User = Depends(get_current_user),
    svc: ReviewService = Depends(_svc),
):
    return UserScoreSummary(**svc.user_score_summary(user))


# ---------- Admin review ----------
@router.get("/admin/overview", response_model=AdminOverview)
def admin_overview(
    _: User = Depends(require_role("admin")),
    svc: ReviewService = Depends(_svc),
):
    return AdminOverview(**svc.admin_overview())


@router.get("/admin/annotations/pending", response_model=AnnotationListResponse)
def admin_pending(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_role("admin")),
    svc: ReviewService = Depends(_svc),
):
    items, total = svc.list_pending_for_admin(limit, offset)
    return AnnotationListResponse(
        items=[AnnotationItem.model_validate(a) for a in items],
        total=total,
    )


@router.post("/admin/annotations/{annotation_id}/review", response_model=AnnotationItem)
def admin_review(
    annotation_id: int,
    payload: ReviewRequest,
    admin: User = Depends(require_role("admin")),
    svc: ReviewService = Depends(_svc),
):
    ann = svc.review(admin, annotation_id, payload.approve, payload.note)
    return AnnotationItem.model_validate(ann)


@router.get("/admin/review/by-data", response_model=DataReviewListResponse)
def admin_review_by_data(
    project_id: Optional[int] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_role("admin")),
    svc: ReviewService = Depends(_svc),
):
    items, total = svc.list_pending_by_data(project_id=project_id, limit=limit, offset=offset)
    return DataReviewListResponse(items=items, total=total)


@router.get("/admin/review/by-data/{audio_id}", response_model=DataReviewDetail)
def admin_review_data_detail(
    audio_id: int,
    _: User = Depends(require_role("admin")),
    svc: ReviewService = Depends(_svc),
):
    return svc.data_review_detail(audio_id)


@router.get("/admin/users/flagged", response_model=list[FlaggedUserItem])
def admin_flagged_users(
    _: User = Depends(require_role("admin")),
    svc: ReviewService = Depends(_svc),
):
    out = []
    for user, summary in svc.list_flagged_users():
        out.append(FlaggedUserItem(
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            account_status=user.account_status,
            error_rate=summary["error_rate"],
            count_reviewed=summary["count_reviewed"],
            count_approved=summary["count_approved"],
            count_rejected=summary["count_rejected"],
            score_confirmed=summary["score_confirmed"],
        ))
    return out


@router.post("/admin/users/{user_id}/account-status", response_model=FlaggedUserItem)
def admin_set_status(
    user_id: int,
    payload: AccountStatusUpdate,
    admin: User = Depends(require_role("admin")),
    svc: ReviewService = Depends(_svc),
):
    user = svc.set_account_status(admin, user_id, payload.status)
    summary = svc.user_score_summary(user)
    return FlaggedUserItem(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        account_status=user.account_status,
        error_rate=summary["error_rate"],
        count_reviewed=summary["count_reviewed"],
        count_approved=summary["count_approved"],
        count_rejected=summary["count_rejected"],
        score_confirmed=summary["score_confirmed"],
    )
