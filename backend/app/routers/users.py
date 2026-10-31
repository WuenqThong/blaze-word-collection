from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User
from app.schemas.auth import UserPublic

from .deps import require_role

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserPublic])
def list_users(
    q: Optional[str] = Query(default=None, description="Search by email or name"),
    role: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    _: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(User.email.ilike(like), User.full_name.ilike(like)))
    if role:
        query = query.filter(User.role == role)
    return [UserPublic.model_validate(u) for u in query.order_by(User.created_at.desc()).limit(limit).all()]
