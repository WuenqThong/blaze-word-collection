"""Bounded review operations; RAW and independent votes are never overwritten."""
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.audit import request_id_context
from app.core.database import get_db
from app.models.dialect import DialectContribution as C, DialectContributionMeta as M
from app.models.dialect import DialectParticipant as DP, DialectVote as V
from app.models.security import SecurityAuditEvent
from app.models.user import User
from app.routers.dialect import event, reviewer
from app.services.collection_consent import contribution_write, lock_contributions, require_collection_consent
from app.services.review_binding import bound_votes

router = APIRouter(prefix="/dialect", tags=["dialect-review-ops"])


def enforce_region(db, user, item):
    """Require explicit reviewer assignment; admins may work across regions."""
    if item.owner_id == user.id:
        raise HTTPException(403, "Không được tự duyệt hoặc chuẩn hóa mẫu của mình")
    assignment = db.get(DP, user.id)
    if user.role not in ('admin', 'reviewer') and (not assignment or not assignment.review_region or assignment.review_region != item.raw.get("region")):
        raise HTTPException(403, "Mẫu nằm ngoài vùng chuyên môn được giao")


class BulkReviewInput(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=100)
    action: Literal["HOLD", "REJECT", "REQUEUE"]
    reason: str = Field(min_length=1, max_length=2000)

    @field_validator("reason")
    @classmethod
    def reason_required(cls, value):
        if not value.strip():
            raise ValueError("Phải ghi lý do cụ thể")
        return value.strip()

    @field_validator("ids")
    @classmethod
    def unique_positive_ids(cls, value):
        if len(set(value)) != len(value) or any(cid <= 0 for cid in value):
            raise ValueError("Mã mẫu phải dương và không trùng")
        return value


@router.post("/reviews/bulk")
def bulk_review(body: BulkReviewInput, db: Session = Depends(get_db), user: User = Depends(reviewer)):
    with contribution_write(db):
        items = lock_contributions(db, body.ids)
        if len(items) != len(body.ids):
            raise HTTPException(404, "Có mẫu không tồn tại; chưa thay đổi mẫu nào")
        for item in items:
            enforce_region(db, user, item)
            require_collection_consent(db, item)
            meta = db.get(M, item.id)
            votes = db.query(V).filter_by(contribution_id=item.id).all()
            if item.withdrawn_at or (meta and meta.duplicate_of) or db.query(C).filter(C.parent_id == item.id, C.withdrawn_at.is_(None)).first():
                raise HTTPException(409, "Mẫu đã rút, bị trùng hoặc có phiên bản mới")
            if body.action == "REQUEUE":
                # Only suspect/operational HOLD without votes: reopening a reviewed decision
                # would reuse old votes and violate the two-independent-reviewer SOP.
                if item.status != "HOLD" or votes:
                    raise HTTPException(409, "Chỉ đưa lại hàng chờ mẫu HOLD chưa có phiếu; mẫu đã duyệt cần phiên bản mới")
            elif body.action == "HOLD":
                if item.status not in ("RAW", "REVIEW") or votes:
                    raise HTTPException(409, "Chỉ tạm giữ mẫu chưa có phiếu; mẫu đang duyệt cần hai phiếu độc lập")
            else:
                if user.role not in ('admin', 'reviewer') or any(v.reviewer_id == user.id for v in votes):
                    raise HTTPException(403, "Từ chối hàng loạt cần quản trị viên độc lập")
                if item.status != "REVIEW" or len({v.reviewer_id for v in bound_votes(db, item)}) < 2:
                    raise HTTPException(409, "Cần ít nhất hai phiếu độc lập trước khi từ chối")
        request_id = request_id_context.get() or uuid4().hex
        for item in items:
            before = item.status
            item.status = "RAW" if body.action == "REQUEUE" else body.action
            event(db, item, user, "BULK_" + body.action, body.reason)
            db.add(SecurityAuditEvent(actor_id=user.id, action="REVIEW_BULK_" + body.action,
                entity_type="dialect_contributions", entity_id=str(item.id), request_id=request_id,
                details={"before": before, "after": item.status, "batch_size": len(items)}))
        db.commit()
        return {"updated": len(items), "ids": [item.id for item in items], "action": body.action}
