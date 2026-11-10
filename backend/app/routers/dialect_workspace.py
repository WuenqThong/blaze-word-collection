"""Server side of the /demo screens: one snapshot read plus the writes the demo
used to keep in IndexedDB (consent, curation, feedback, AI quota, participants).

Feedback follows the legacy Report flow (open -> resolved by a reviewer) and
credits follow the wallet's ledger idea, but both live in their own tables:
reports are bound to audio tasks and the wallet is VND money, while demo
credits are a non-transferable internal AI quota.
"""
import random
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db, utcnow
from app.models.dialect import DialectContribution as C
from app.models.dialect import DialectContributionMeta as M
from app.models.dialect import DialectCredit as K
from app.models.dialect import DialectFeedback as F
from app.models.dialect import DialectGameAllocation as GA
from app.models.dialect import DialectParticipant as DP
from app.models.dialect import DialectProfile as P
from app.models.dialect import DialectRelease as R
from app.models.dialect import DialectSetting as ST
from app.models.dialect import DialectSource as S
from app.models.dialect import DialectSourceRights as SR
from app.models.user import User
from app.routers.dialect import (ACCEPTED_CONSENT_VERSIONS, active, admin, consent_of, curated_ok, eligible, event, find,
                                 meta_of, normal, pack, release_meta, reviewer)

router = APIRouter(prefix="/dialect", tags=["dialect-workspace"])

CREDIT_AMOUNT = 5
CREDIT_DAYS = 30
CREDIT_DAILY_LIMIT = 4
WORKSPACE_LIMIT = 1000


def setting(db, key, default=None):
    row = db.get(ST, key)
    return row.value if row else default


def participant(db, uid, create=False):
    row = db.get(DP, uid)
    if not row and create:
        row = DP(user_id=uid)
        db.add(row)
    return row


def person(db, u: User):
    flags = db.get(DP, u.id)
    profile = db.get(P, u.id)
    region = (flags.review_region if flags else "") or (profile.usage_area if profile else "") or (profile.upbringing_area if profile else "")
    return {"id": u.id, "full_name": u.full_name, "role": u.role, "account_status": u.account_status, "region": region,
            "verified": bool(flags and flags.verified), "risk": flags.risk if flags else "clear",
            "review_region": flags.review_region if flags else "", "appeal": flags.appeal if flags else ""}


def source_row(db, s: S):
    extra = db.get(SR, s.id)
    return {"id": s.id, "owner_id": s.owner_id, "evidence": s.evidence, "rights_confirmed": s.rights_confirmed, "rights_note": s.rights_note,
            "title": extra.title if extra and extra.title else "", "public": bool(extra and extra.public), "audio": bool(extra and extra.audio)}


def credit_row(k: K):
    return {"id": k.id, "user_id": k.user_id, "contribution_id": k.contribution_id, "amount": k.amount, "used": k.used,
            "expires_at": k.expires_at, "revoked": k.revoked, "created_at": k.created_at}


def feedback_row(f: F):
    return {"id": f.id, "user_id": f.user_id, "entity": f.entity, "text": f.text, "status": f.status, "created_at": f.created_at}


@router.get("/workspace")
def workspace(db: Session = Depends(get_db), user: User = Depends(active)):
    """Everything the caller may see, in the shape the demo screens consume."""
    staff = user.role in ("admin", "reviewer")
    q = db.query(C)
    if not staff:
        q = q.filter(C.owner_id == user.id)
    items = q.order_by(C.id.desc()).limit(WORKSPACE_LIMIT).all()
    contributions = [pack(c, db, user, adjudication=user.role == "admin") for c in items]

    if user.role == "admin":
        sources = db.query(S).order_by(S.id.desc()).limit(WORKSPACE_LIMIT).all()
        people = db.query(User).order_by(User.id).all()
        credits = db.query(K).order_by(K.id.desc()).all()
        releases = [{"id": r.id, "created_at": r.created_at, "count": len(r.records), "checksum": r.checksum, **release_meta(db, r)}
                    for r in db.query(R).order_by(R.id.desc()).limit(100)]
    else:
        source_ids = {c.source_id for c in items}
        sources = db.query(S).filter(S.id.in_(source_ids)).all() if source_ids else []
        people = [user]
        credits = db.query(K).filter_by(user_id=user.id).order_by(K.id.desc()).all()
        releases = []
    feedback = db.query(F) if staff else db.query(F).filter_by(user_id=user.id)
    return {
        "me": person(db, user),
        "contributions": contributions,
        "sources": [source_row(db, s) for s in sources],
        "people": [person(db, u) for u in people],
        "releases": releases,
        "credits": [credit_row(k) for k in credits],
        "feedback": [feedback_row(f) for f in feedback.order_by(F.id.desc()).limit(WORKSPACE_LIMIT)],
        "reward_enabled": bool(setting(db, "reward_enabled", False)),
    }


# --- Contribution lifecycle ------------------------------------------------

class ConsentValue(BaseModel):
    collect: bool
    train: bool
    public: bool
    audio: bool
    version: Literal[ACCEPTED_CONSENT_VERSIONS]


class ConsentInput(BaseModel):
    consent: ConsentValue
    withdraw: bool = False


@router.post("/contributions/{cid}/consent")
def change_consent(cid: int, body: ConsentInput, db: Session = Depends(get_db), user: User = Depends(active)):
    item = find(db, cid)
    if item.owner_id != user.id and user.role != "admin":
        raise HTTPException(403, "Không có quyền quản lý mẫu này")
    if item.withdrawn_at and not body.withdraw:
        raise HTTPException(409, "Mẫu đã rút không thể khôi phục; hãy gửi bản mới")
    meta = meta_of(db, cid, create=True)
    previous = consent_of(item, meta)
    meta.consent = body.consent.model_dump()
    if meta.consent != previous:
        event(db, item, user, "CONSENT_UPDATED", ", ".join(f"{k}={'có' if v else 'không'}" for k, v in meta.consent.items() if k != "version"))
    if body.withdraw and not item.withdrawn_at:
        item.withdrawn_at = utcnow()
        event(db, item, user, "WITHDRAWN", "Đã rút quyền sử dụng; ngừng xuất trong các bản phát hành được hệ thống kiểm soát")
    db.commit()
    return pack(item, db, user)


@router.post("/sessions/{ref}/withdraw")
def withdraw_session(ref: str, db: Session = Depends(get_db), user: User = Depends(active)):
    ids = [cid for (cid,) in db.query(M.contribution_id).filter(M.session_ref == ref).all()]
    items = db.query(C).filter(C.id.in_(ids), C.owner_id == user.id).all() if ids else []
    for item in items:
        if not item.withdrawn_at:
            item.withdrawn_at = utcnow()
            event(db, item, user, "WITHDRAWN", "Đã rút cùng lượt chơi")
    allocation = db.get(GA, ref)
    if allocation and allocation.user_id == user.id and not allocation.withdrawn_at:
        allocation.withdrawn_at = utcnow()
    db.commit()
    return {"withdrawn": len(items)}



class AllocationInput(BaseModel):
    session_ref: str = Field(min_length=1, max_length=128)
    exam_ids: list[str] = Field(min_length=1, max_length=500)
    played: list[str] = Field(default_factory=list, max_length=500)
    campaign_id: str = Field(default="", max_length=128)


def allocation_row(a: GA, plays: int, repeat: bool):
    return {"session_ref": a.session_ref, "exam_id": a.exam_id, "plays": plays, "repeat": repeat}


@router.post("/allocation")
def allocate(body: AllocationInput, db: Session = Depends(get_db), user: User = Depends(active)):
    """Pick the exam with the fewest plays across all accounts.

    The client sends the exams it can run (active, valid, allowed by the campaign);
    the server never invents an exam ID. Exams this account already finished, on any
    device, are skipped while unplayed ones remain. Ties are broken at random so
    simultaneous new players do not all land on the first exam.
    """
    if any(not e or len(e) > 128 for e in body.exam_ids + body.played):
        raise HTTPException(422, "Mã đề không hợp lệ")
    existing = db.get(GA, body.session_ref)
    if existing:
        if existing.user_id != user.id:
            raise HTTPException(409, "Mã lượt đã thuộc tài khoản khác")
        return allocation_row(existing, 0, False)
    pool = list(dict.fromkeys(body.exam_ids))
    plays = dict(db.query(GA.exam_id, func.count()).filter(GA.exam_id.in_(pool), GA.withdrawn_at.is_(None)).group_by(GA.exam_id).all())
    submitted = db.query(M.session_ref).filter(M.session_ref.isnot(None))
    finished = {e for (e,) in db.query(GA.exam_id).filter(GA.user_id == user.id, GA.withdrawn_at.is_(None), GA.session_ref.in_(submitted)).all()}
    unplayed = [e for e in pool if e not in finished and e not in set(body.played)]
    candidates = unplayed or pool
    low = min(plays.get(e, 0) for e in candidates)
    row = GA(session_ref=body.session_ref, user_id=user.id, exam_id=random.choice([e for e in candidates if plays.get(e, 0) == low]),
             campaign_id=body.campaign_id)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:  # the same session asked twice at once
        db.rollback()
        row = db.get(GA, body.session_ref)
        if not row or row.user_id != user.id:
            raise HTTPException(409, "Mã lượt đã thuộc tài khoản khác")
    return allocation_row(row, low, not unplayed)


class CurateInput(BaseModel):
    raw: dict
    sense_id: str = Field(default="", max_length=128)
    qa_audio: Literal["", "pass", "hold"] = ""


@router.post("/reviews/{cid}/curate")
def curate(cid: int, body: CurateInput, db: Session = Depends(get_db), user: User = Depends(reviewer)):
    item = find(db, cid)
    if item.owner_id == user.id:
        raise HTTPException(403, "Không được tự chuẩn hóa mẫu của mình")
    if item.status != "VERIFIED" or item.withdrawn_at:
        raise HTTPException(409, "Chỉ chuẩn hóa mẫu đã xác minh và chưa rút")
    curated = {k: str(body.raw.get(k, ""))[:5000] for k in ("kind", "text", "meaning", "standard", "context", "variants", "region", "topic", "partOfSpeech", "keywords")}
    meta = meta_of(db, cid, create=True)
    meta.curated, meta.sense_id, meta.qa_audio = curated, body.sense_id or str(cid), body.qa_audio
    meta.curated_by, meta.curated_at = user.id, utcnow()
    event(db, item, user, "CURATED", "Lưu bản chuẩn hóa; RAW giữ nguyên")
    db.commit()
    return pack(item, db, user)


# --- Feedback (Report-style queue) ------------------------------------------

class FeedbackInput(BaseModel):
    entity: str = Field(min_length=1, max_length=512)
    text: str = Field(min_length=1, max_length=5000)


@router.post("/feedback", status_code=201)
def create_feedback(body: FeedbackInput, db: Session = Depends(get_db), user: User = Depends(active)):
    if not body.text.strip():
        raise HTTPException(422, "Cần nội dung phản hồi")
    row = F(user_id=user.id, entity=body.entity.strip(), text=body.text.strip())
    db.add(row)
    db.commit()
    return feedback_row(row)


@router.post("/feedback/{fid}/resolve")
def resolve_feedback(fid: int, db: Session = Depends(get_db), user: User = Depends(reviewer)):
    row = db.get(F, fid)
    if not row:
        raise HTTPException(404, "Không tìm thấy phản hồi")
    if row.status != "resolved":
        row.status, row.resolved_by, row.resolved_at = "resolved", user.id, utcnow()
        db.commit()
    return feedback_row(row)


# --- Internal AI quota (wallet-style ledger, never money) -----------------

class PolicyInput(BaseModel):
    enabled: bool


@router.put("/rewards/policy")
def reward_policy(body: PolicyInput, db: Session = Depends(get_db), user: User = Depends(admin)):
    row = db.get(ST, "reward_enabled") or ST(key="reward_enabled", value=False)
    row.value = body.enabled
    db.add(row)
    db.commit()
    return {"enabled": body.enabled}


class GrantInput(BaseModel):
    contribution_id: int


def has_live_duplicate(db, item):
    key = (normal(item.raw.get("original_text")), normal(item.raw.get("meaning")), item.raw.get("region"))
    for other in db.query(C).filter(C.id != item.id, C.withdrawn_at.is_(None)):
        if (normal(other.raw.get("original_text")), normal(other.raw.get("meaning")), other.raw.get("region")) == key:
            return True
    return False


@router.post("/credits", status_code=201)
def grant_credit(body: GrantInput, db: Session = Depends(get_db), user: User = Depends(admin)):
    if not setting(db, "reward_enabled", False):
        raise HTTPException(409, "Chưa bật chính sách cấp hạn mức")
    item = find(db, body.contribution_id)
    owner = db.get(User, item.owner_id)
    flags = db.get(DP, item.owner_id)
    if not owner or owner.account_status != "active" or not flags or not flags.verified or flags.risk != "clear":
        raise HTTPException(409, "Tài khoản chưa xác nhận hoặc đang rà soát")
    if item.id not in {c.id for c in eligible(db)} or not curated_ok(db, item) or has_live_duplicate(db, item):
        raise HTTPException(409, "Mẫu chưa đủ QA/quyền, chưa chuẩn hóa hoặc bị trùng")
    if db.query(K).filter_by(contribution_id=item.id).first():
        raise HTTPException(409, "Mẫu đã được cấp hạn mức")
    now = utcnow()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if db.query(K).filter(K.user_id == owner.id, K.created_at >= day_start).count() >= CREDIT_DAILY_LIMIT:
        raise HTTPException(409, "Đạt hạn mức cấp trong ngày")
    row = K(user_id=owner.id, contribution_id=item.id, amount=CREDIT_AMOUNT, expires_at=now + timedelta(days=CREDIT_DAYS), granted_by=user.id)
    db.add(row)
    event(db, item, user, "CREDIT_GRANTED", f"Cấp {CREDIT_AMOUNT} lượt AI nội bộ; không chuyển nhượng, không quy đổi tiền")
    db.commit()
    return credit_row(row)


@router.post("/credits/{kid}/revoke")
def revoke_credit(kid: int, db: Session = Depends(get_db), user: User = Depends(admin)):
    row = db.get(K, kid)
    if not row:
        raise HTTPException(404, "Không tìm thấy hạn mức")
    row.revoked = True
    db.commit()
    return credit_row(row)


class SpendInput(BaseModel):
    amount: int = Field(gt=0, le=100)


@router.post("/credits/spend")
def spend_credit(body: SpendInput, db: Session = Depends(get_db), user: User = Depends(active)):
    now = utcnow()
    allowed = {c.id for c in eligible(db)}
    rows = [k for k in db.query(K).filter(K.user_id == user.id, K.revoked.is_(False), K.expires_at > now).order_by(K.expires_at) if k.contribution_id in allowed]
    if sum(k.amount - k.used for k in rows) < body.amount:
        raise HTTPException(409, "Chưa đủ hạn mức AI nội bộ")
    left = body.amount
    for k in rows:
        n = min(left, k.amount - k.used)
        k.used += n
        left -= n
        if not left:
            break
    db.commit()
    return {"spent": body.amount}


# --- Participants ---------------------------------------------------------

class ParticipantInput(BaseModel):
    role: Literal["annotator", "reviewer"] | None = None
    verified: bool | None = None
    risk: Literal["clear", "hold"] | None = None
    review_region: str | None = Field(default=None, max_length=255)


@router.put("/participants/{uid}")
def update_participant(uid: int, body: ParticipantInput, db: Session = Depends(get_db), user: User = Depends(admin)):
    target = db.get(User, uid)
    if not target:
        raise HTTPException(404, "Không tìm thấy tài khoản")
    if body.role is not None and body.role != target.role:
        if target.role == "admin":
            raise HTTPException(409, "Không thay quyền quản trị tại màn hình này")
        target.role = body.role
    flags = participant(db, uid, create=True)
    if body.verified is not None:
        flags.verified = body.verified
    if body.risk is not None:
        flags.risk = body.risk
    if body.review_region is not None:
        flags.review_region = body.review_region.strip()
    db.commit()
    return person(db, target)


class AppealInput(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


@router.post("/me/appeal")
def appeal(body: AppealInput, db: Session = Depends(get_db), user: User = Depends(active)):
    flags = participant(db, user.id, create=True)
    flags.appeal = body.text.strip()
    db.commit()
    return person(db, user)
