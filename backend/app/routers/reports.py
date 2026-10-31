from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User
from app.schemas.report import (
    ReportListResponse,
    ReportPublic,
    ReportRequest,
    ReportReviewRequest,
)
from app.services.report_service import ReportService, get_report_service

from .deps import get_current_user, require_role

router = APIRouter(tags=["reports"])


def _svc(db: Session = Depends(get_db)) -> ReportService:
    return get_report_service(db)


# ---------- annotator ----------
@router.post("/assignments/{assignment_id}/report", response_model=ReportPublic, status_code=201)
def create_report(
    assignment_id: int,
    payload: ReportRequest,
    user: User = Depends(get_current_user),
    svc: ReportService = Depends(_svc),
):
    rp = svc.create_report(user, assignment_id, payload)
    return ReportPublic(**svc.to_public(rp, user))


@router.get("/me/reports", response_model=ReportListResponse)
def my_reports(
    user: User = Depends(get_current_user),
    svc: ReportService = Depends(_svc),
):
    items = svc.list_for_user(user)
    return ReportListResponse(
        items=[ReportPublic(**svc.to_public(r, user)) for r in items],
        total=len(items),
    )


# ---------- admin ----------
@router.get("/admin/reports", response_model=ReportListResponse)
def admin_list_reports(
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    _: User = Depends(require_role("admin")),
    svc: ReportService = Depends(_svc),
):
    rows = svc.list_for_admin(status_filter=status, limit=limit)
    return ReportListResponse(
        items=[ReportPublic(**svc.to_public(r, u, a)) for r, u, a in rows],
        total=len(rows),
    )


@router.post("/admin/reports/{report_id}/review", response_model=ReportPublic)
def admin_review(
    report_id: int,
    payload: ReportReviewRequest,
    admin: User = Depends(require_role("admin")),
    svc: ReportService = Depends(_svc),
    db: Session = Depends(get_db),
):
    rp = svc.review(admin, report_id, payload.approve, payload.note)
    user = db.query(User).filter(User.id == rp.user_id).first()
    return ReportPublic(**svc.to_public(rp, user))
