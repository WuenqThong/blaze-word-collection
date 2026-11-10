"""Authenticated, append-only raw collection and independent text review."""
import hashlib
import json
import unicodedata
from collections import Counter
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db, utcnow
from app.models.user import User
from app.models.dialect import DialectContribution as C, DialectSource as S, DialectVote as V, DialectEvent as E, DialectRelease as R, DialectProfile as P
from app.models.dialect import DialectContributionMeta as M, DialectSourceRights as SR, DialectParticipant as DP, DialectReleaseCard as RC
from app.routers.deps import get_current_user

router = APIRouter(prefix="/dialect", tags=["dialect"])
CONSENT_VERSION = "dialect-2026-11-v1"
# Consent texts shown by the /demo screens; each version maps to a text the participant actually saw.
ACCEPTED_CONSENT_VERSIONS = (CONSENT_VERSION, "demo-consent-v1", "demo-import-v1", "demo-ai-feedback-v1")
RESPONSES = ("answer", "unknown", "no_term", "same_standard")


def active(user: User = Depends(get_current_user)):
    if user.account_status == "suspended":
        raise HTTPException(403, "Tài khoản đang bị tạm dừng")
    return user


def admin(user: User = Depends(active)):
    if user.role != "admin":
        raise HTTPException(403, "Chỉ quản trị viên được thực hiện thao tác này")
    return user


def reviewer(user: User = Depends(active)):
    if user.role not in ("admin", "reviewer"):
        raise HTTPException(403, "Bạn chưa được cấp quyền duyệt")
    return user


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def find(db, cid):
    item = db.get(C, cid)
    if not item:
        raise HTTPException(404, "Không tìm thấy mẫu đóng góp")
    return item


def event(db, item, user, action, note=""):
    db.add(E(contribution_id=item.id, actor_id=user.id, action=action, note=note))


def meta_of(db, cid, create=False):
    row = db.get(M, cid)
    if not row and create:
        row = M(contribution_id=cid)
        db.add(row)
    return row


def consent_of(item, meta=None):
    """Effective consent: a later override in meta wins over the consent captured in RAW."""
    if meta is not None and meta.consent:
        return meta.consent
    raw = item.raw
    return {"collect": bool(raw.get("consent_collect")), "train": bool(raw.get("consent_train")), "public": bool(raw.get("consent_public")),
            "audio": bool(raw.get("consent_audio")), "version": raw.get("consent_version", "")}


def pack(item, db, user, adjudication=False):
    votes = db.query(V).filter_by(contribution_id=item.id).all()
    own_vote = next((v for v in votes if v.reviewer_id == user.id), None)
    source = db.get(S, item.source_id)
    meta = db.get(M, item.id)
    return {"id": item.id, "owner_id": item.owner_id, "parent_id": item.parent_id, "source_id": item.source_id,
            "raw": item.raw, "status": item.status, "withdrawn_at": item.withdrawn_at, "created_at": item.created_at,
            "rights_confirmed": source.rights_confirmed, "rights_note": source.rights_note,
            "vote_count": len(votes), "has_voted": own_vote is not None,
            "votes": [{"id": v.id, "reviewer_id": v.reviewer_id, "verdict": v.verdict, "rubric": v.rubric, "note": v.note, "created_at": v.created_at} for v in votes] if own_vote or (adjudication and user.role == "admin" and len(votes) >= 2) else [],
            "events": [{"action": e.action, "note": e.note, "created_at": e.created_at} for e in db.query(E).filter_by(contribution_id=item.id).order_by(E.id).all()],
            "consent": consent_of(item, meta),
            # Owner-only: lets the client match its pending local copy to the stored row.
            "client_ref": item.idempotency_key if item.owner_id == user.id else None,
            "meta": {"session_ref": meta.session_ref if meta else None, "duplicate_of": meta.duplicate_of if meta else None,
                     "curated": meta.curated if meta else None, "sense_id": meta.sense_id if meta else "", "qa_audio": meta.qa_audio if meta else ""}}


class ProfileInput(BaseModel):
    upbringing_area: str = Field(default="", max_length=255)
    usage_area: str = Field(default="", max_length=255)


class ContributionInput(BaseModel):
    kind: Literal["word", "sentence"]
    original_text: str = Field(default="", max_length=5000)
    meaning: str = Field(default="", max_length=5000)
    standard_vi: str = Field(default="", max_length=5000)
    region: str = Field(min_length=1, max_length=255)
    context: str = Field(default="", max_length=5000)
    source_evidence: str = Field(default="", max_length=5000)
    consent_version: Literal[ACCEPTED_CONSENT_VERSIONS]
    consent_collect: Literal[True]
    consent_train: bool = False
    consent_public: bool = False
    consent_audio: bool = False
    # Optional structure used by the /demo game and contribution screens.
    response: Literal[RESPONSES] = "answer"
    method: str = Field(default="direct", max_length=64)
    topic: str = Field(default="", max_length=255)
    part_of_speech: str = Field(default="", max_length=255)
    variants: str = Field(default="", max_length=5000)
    keywords: str = Field(default="", max_length=5000)
    family: str = Field(default="", max_length=255)
    confidence: str = Field(default="", max_length=64)
    media_ids: list[str] = Field(default_factory=list, max_length=20)
    session_ref: str | None = Field(default=None, max_length=128)
    parent_id: int | None = None
    idempotency_key: str = Field(min_length=8, max_length=128)


def required_fields(body: ContributionInput):
    """Direct entries need the full description. Game answers 1-8 only ask for the
    word itself; 'unknown'/'no term' responses carry no word at all."""
    if body.response != "answer":
        return ()
    if body.method == "game":
        return ("original_text",)
    return ("original_text", "meaning", "standard_vi", "context", "source_evidence")


def normal(value):
    return unicodedata.normalize("NFC", value or "").strip().casefold()


DUPLICATE_KEYS = ("original_text", "meaning", "standard_vi", "context", "region")


def find_game_duplicate(db, item):
    """First live, non-duplicate contribution with identical normalized content."""
    key = [normal(item.raw.get(k)) for k in DUPLICATE_KEYS]
    flagged = {cid for (cid,) in db.query(M.contribution_id).filter(M.duplicate_of.is_not(None)).all()}
    candidates = db.query(C).filter(C.id != item.id, C.withdrawn_at.is_(None)).order_by(C.id)
    for other in candidates:
        if other.id in flagged or other.raw.get("kind") != item.raw.get("kind"):
            continue
        if [normal(other.raw.get(k)) for k in DUPLICATE_KEYS] == key:
            return other
    return None


@router.get("/profile")
def profile(db: Session = Depends(get_db), user: User = Depends(active)):
    p = db.get(P, user.id)
    return {"upbringing_area": p.upbringing_area if p else "", "usage_area": p.usage_area if p else ""}


@router.put("/profile")
def save_profile(body: ProfileInput, db: Session = Depends(get_db), user: User = Depends(active)):
    p = db.get(P, user.id)
    if not p:
        p = P(user_id=user.id)
        db.add(p)
    p.upbringing_area, p.usage_area = body.upbringing_area, body.usage_area
    db.commit()
    return body


@router.post("/contributions", status_code=201)
def create(body: ContributionInput, db: Session = Depends(get_db), user: User = Depends(active)):
    raw = body.model_dump(exclude={"idempotency_key", "parent_id", "session_ref"})
    for key in ("region", *required_fields(body)):
        if not raw[key].strip():
            raise HTTPException(422, "Thiếu nội dung, nghĩa, bản phổ thông, ngữ cảnh hoặc nguồn")
    request_hash = digest(body.model_dump())
    existing = db.query(C).filter_by(owner_id=user.id, idempotency_key=body.idempotency_key).first()
    if existing:
        if existing.request_hash != request_hash:
            raise HTTPException(409, "Mã gửi đã được dùng cho nội dung khác. Hãy bắt đầu lượt gửi mới.")
        return pack(existing, db, user)
    if body.parent_id:
        parent = find(db, body.parent_id)
        if parent.owner_id != user.id or parent.withdrawn_at:
            raise HTTPException(403, "Không thể tạo phiên bản cho mẫu này")
    source = S(owner_id=user.id, evidence=body.source_evidence)
    db.add(source)
    db.flush()
    item = C(owner_id=user.id, source_id=source.id, parent_id=body.parent_id, raw=raw, idempotency_key=body.idempotency_key, request_hash=request_hash)
    db.add(item)
    try:
        db.flush()
        duplicate = find_game_duplicate(db, item) if body.method == "game" else None
        if body.session_ref or duplicate:
            db.add(M(contribution_id=item.id, session_ref=body.session_ref, duplicate_of=duplicate.id if duplicate else None))
        if duplicate:
            # Same rule as the demo: an identical game answer is parked, not queued for review again.
            item.status = "HOLD"
        event(db, item, user, "SUBMITTED", "Đã tiếp nhận bản gốc và phạm vi đồng ý sử dụng")
        if duplicate:
            event(db, item, user, "DUPLICATE", f"Trùng nội dung với mẫu #{duplicate.id}; tạm giữ, không vào hàng chờ duyệt")
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(C).filter_by(owner_id=user.id, idempotency_key=body.idempotency_key).first()
        if not existing or existing.request_hash != request_hash:
            raise HTTPException(409, "Xung đột lượt gửi, vui lòng thử lại")
        return pack(existing, db, user)
    return pack(item, db, user)


@router.get("/contributions")
def mine(db: Session = Depends(get_db), user: User = Depends(active), offset: int = 0, limit: int = 25, status: str = "", query: str = ""):
    q = db.query(C).filter_by(owner_id=user.id)
    if status == "WITHDRAWN":
        q = q.filter(C.withdrawn_at.is_not(None))
    elif status:
        q = q.filter(C.status == status, C.withdrawn_at.is_(None))
    if query:
        q = q.filter(C.raw["original_text"].as_string().contains(query))
    return {"total": q.count(), "items": [pack(c, db, user) for c in q.order_by(C.id.desc()).offset(max(0, offset)).limit(min(max(limit, 1), 100))]}


@router.get("/contributions/{cid}")
def detail(cid: int, db: Session = Depends(get_db), user: User = Depends(active)):
    item = find(db, cid)
    if item.owner_id != user.id and user.role not in ("admin", "reviewer"):
        raise HTTPException(403, "Mẫu này không thuộc quyền truy cập của bạn")
    return pack(item, db, user)


@router.post("/contributions/{cid}/withdraw")
def withdraw(cid: int, db: Session = Depends(get_db), user: User = Depends(active)):
    item = find(db, cid)
    if item.owner_id != user.id:
        raise HTTPException(403, "Chỉ người đóng góp được rút mẫu của mình")
    if not item.withdrawn_at:
        item.withdrawn_at = utcnow()
        event(db, item, user, "WITHDRAWN", "Đã rút quyền sử dụng; ngừng xuất trong các bản phát hành được hệ thống kiểm soát")
        db.commit()
    return pack(item, db, user)


@router.get("/duplicates")
def duplicates(text: str = "", db: Session = Depends(get_db), user: User = Depends(active)):
    # Only search the caller's own data; do not leak other participants' RAW.
    normalized = unicodedata.normalize("NFC", text).strip().casefold()
    matches = [c for c in db.query(C).filter_by(owner_id=user.id).filter(C.withdrawn_at.is_(None)).all() if unicodedata.normalize("NFC", c.raw["original_text"]).strip().casefold() == normalized] if normalized else []
    return [{"id": c.id, "text": c.raw["original_text"], "meaning": c.raw["meaning"], "region": c.raw["region"]} for c in matches[:10]]


@router.get("/reviews")
def queue(view: str = "pending", db: Session = Depends(get_db), user: User = Depends(reviewer), offset: int = 0, region: str = "", source_rights: str = ""):
    voted = db.query(V.contribution_id).filter_by(reviewer_id=user.id)
    q = db.query(C).filter(C.owner_id != user.id, C.withdrawn_at.is_(None))
    if view == "mine":
        q = q.filter(C.id.in_(voted))
    elif view == "disputes":
        if user.role != "admin":
            raise HTTPException(403, "Chỉ điều phối viên xử lý bất đồng")
        ids = [cid for (cid,) in db.query(V.contribution_id).group_by(V.contribution_id).having(func.count(V.id) >= 2, func.count(func.distinct(V.verdict)) > 1).all()]
        q = q.filter(C.id.in_(ids), C.status == "REVIEW")
    elif view == "hold":
        q = q.filter(C.status == "HOLD")
    else:
        q = q.filter(C.status.in_(["RAW", "REVIEW"]), ~C.id.in_(voted))
    if region:
        q = q.filter(C.raw["region"].as_string() == region)
    if source_rights in ("confirmed", "pending"):
        q = q.join(S, C.source_id == S.id).filter(S.rights_confirmed.is_(source_rights == "confirmed"))
    return {"total": q.count(), "items": [pack(c, db, user, adjudication=view == "disputes") for c in q.order_by(C.id).offset(max(0, offset)).limit(25)]}


class VoteInput(BaseModel):
    verdict: Literal["VERIFIED", "HOLD", "REJECT"]
    meaning_ok: bool
    region_ok: bool
    context_ok: bool
    translation_ok: bool
    note: str = Field(min_length=1, max_length=5000)


@router.post("/reviews/{cid}/votes")
def vote(cid: int, body: VoteInput, db: Session = Depends(get_db), user: User = Depends(reviewer)):
    item = find(db, cid)
    if item.owner_id == user.id:
        raise HTTPException(403, "Không được tự duyệt mẫu của mình")
    if item.withdrawn_at or item.status not in ("RAW", "REVIEW"):
        raise HTTPException(409, "Mẫu đã rút hoặc đã có quyết định; hãy tải lại")
    meta = db.get(M, cid)
    if meta and meta.duplicate_of:
        raise HTTPException(409, "Mẫu trùng không thuộc hàng chờ duyệt mới")
    participant = db.get(DP, user.id)
    if user.role != "admin" and participant and participant.review_region and participant.review_region != item.raw.get("region"):
        raise HTTPException(403, "Mẫu nằm ngoài vùng chuyên môn được giao")
    rubric = body.model_dump(exclude={"verdict", "note"})
    if body.verdict == "VERIFIED" and not all(rubric.values()):
        raise HTTPException(422, "Chỉ xác minh khi tất cả tiêu chí đạt")
    db.add(V(contribution_id=cid, reviewer_id=user.id, verdict=body.verdict, rubric=rubric, note=body.note))
    try:
        db.flush()
        votes = db.query(V).filter_by(contribution_id=cid).all()
        decisions = {v.verdict for v in votes}
        item.status = next(iter(decisions)) if len(votes) >= 2 and len(decisions) == 1 else "REVIEW"
        event(db, item, user, "REVIEWED", "Đã tiếp nhận một phiếu độc lập")
        if item.status != "REVIEW":
            event(db, item, user, item.status, "Hai hoặc nhiều phiếu độc lập đồng thuận. " + " / ".join(v.note for v in votes))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Bạn đã gửi phiếu cho mẫu này")
    return pack(item, db, user)


class DecisionInput(BaseModel):
    verdict: Literal["VERIFIED", "HOLD", "REJECT"]
    note: str = Field(min_length=1, max_length=5000)


@router.post("/reviews/{cid}/finalize")
def finalize(cid: int, body: DecisionInput, db: Session = Depends(get_db), user: User = Depends(admin)):
    item = find(db, cid)
    votes = db.query(V).filter_by(contribution_id=cid).all()
    if item.owner_id == user.id or any(v.reviewer_id == user.id for v in votes):
        raise HTTPException(403, "Điều phối viên phải độc lập với người góp và người đã bỏ phiếu")
    if item.withdrawn_at or item.status != "REVIEW" or len(votes) < 2:
        raise HTTPException(409, "Mẫu cần ít nhất hai phiếu và đang chờ điều phối")
    item.status = body.verdict
    event(db, item, user, body.verdict, body.note)
    db.commit()
    return pack(item, db, user)


@router.get("/sources")
def sources(db: Session = Depends(get_db), user: User = Depends(admin), offset: int = 0, query: str = "", rights_status: str = ""):
    q = db.query(S)
    if query:
        q = q.filter(S.evidence.contains(query))
    if rights_status in ("confirmed", "pending"):
        q = q.filter(S.rights_confirmed.is_(rights_status == "confirmed"))
    return {"total": q.count(), "items": [{"id": s.id, "evidence": s.evidence, "rights_confirmed": s.rights_confirmed, "rights_note": s.rights_note,
            "contributions": [{"id": c.id, "text": c.raw["original_text"]} for c in db.query(C).filter_by(source_id=s.id).all()]} for s in q.order_by(S.id.desc()).offset(max(0, offset)).limit(25)]}


class RightsInput(BaseModel):
    rights_confirmed: bool
    note: str = Field(min_length=1, max_length=5000)
    # Optional per-purpose rights used by the /demo source editor.
    title: str | None = Field(default=None, max_length=255)
    public: bool | None = None
    audio: bool | None = None


@router.post("/sources/{sid}/rights")
def rights(sid: int, body: RightsInput, db: Session = Depends(get_db), user: User = Depends(admin)):
    source = db.get(S, sid)
    if not source:
        raise HTTPException(404, "Không tìm thấy nguồn")
    source.rights_confirmed, source.rights_note, source.reviewed_by = body.rights_confirmed, body.note, user.id
    if body.title is not None or body.public is not None or body.audio is not None:
        extra = db.get(SR, sid) or SR(source_id=sid)
        db.add(extra)
        if body.title is not None:
            extra.title = body.title.strip()
        if body.public is not None:
            extra.public = body.public
        if body.audio is not None:
            extra.audio = body.audio
    for item in db.query(C).filter_by(source_id=sid).all():
        event(db, item, user, "RIGHTS_REVIEWED", body.note)
    db.commit()
    return {"ok": True}


def exclusion_reasons(db, c, superseded):
    """Every reason a contribution cannot be exported; empty means eligible."""
    meta = db.get(M, c.id)
    consent = consent_of(c, meta)
    reasons = []
    if c.withdrawn_at:
        reasons.append("Đã rút mẫu")
    if c.status != "VERIFIED":
        reasons.append("Chưa xác minh nội dung")
    if db.query(V).filter_by(contribution_id=c.id).count() < 2:
        reasons.append("Chưa đủ hai phiếu")
    if not db.get(S, c.source_id).rights_confirmed:
        reasons.append("Chưa xác nhận quyền nguồn")
    if not consent.get("train"):
        reasons.append("Không đồng ý huấn luyện")
    if not consent.get("collect") or consent.get("version") not in ACCEPTED_CONSENT_VERSIONS:
        reasons.append("Phạm vi tiếp nhận hoặc phiên bản đồng ý không hợp lệ")
    if c.id in superseded:
        reasons.append("Có phiên bản bổ sung chưa rút")
    if meta and meta.duplicate_of:
        reasons.append(f"Trùng mẫu #{meta.duplicate_of}")
    if c.raw.get("response", "answer") != "answer":
        reasons.append("Phản hồi không phải mục từ khẳng định")
    return reasons


def superseded_ids(db):
    return {cid for (cid,) in db.query(C.parent_id).filter(C.parent_id.is_not(None), C.withdrawn_at.is_(None)).all()}


def eligible(db):
    superseded = superseded_ids(db)
    items = db.query(C).join(S, C.source_id == S.id).filter(C.status == "VERIFIED", C.withdrawn_at.is_(None), S.rights_confirmed.is_(True)).all()
    return [c for c in items if not exclusion_reasons(db, c, superseded)]


CURATED_KEYS = ("text", "meaning", "standard", "context")


def curated_ok(db, c):
    meta = db.get(M, c.id)
    return bool(meta and meta.curated and all(str(meta.curated.get(k, "")).strip() for k in CURATED_KEYS))


@router.get("/metrics")
def metrics(db: Session = Depends(get_db), user: User = Depends(admin)):
    items = db.query(C).filter(C.withdrawn_at.is_(None)).all()
    return {"submissions": len(items), "distinct": len({(unicodedata.normalize("NFC", c.raw["original_text"]).casefold(), c.raw["meaning"].casefold(), c.raw["region"]) for c in items}), "verified": sum(c.status == "VERIFIED" for c in items), "eligible": len(eligible(db)), "statuses": dict(Counter(c.status for c in items))}


@router.get("/admin/contributions")
def admin_contributions(db: Session = Depends(get_db), user: User = Depends(admin), offset: int = 0, status: str = "", query: str = ""):
    q = db.query(C)
    if status == "WITHDRAWN":
        q = q.filter(C.withdrawn_at.is_not(None))
    elif status:
        q = q.filter(C.status == status, C.withdrawn_at.is_(None))
    if query:
        q = q.filter(C.raw["original_text"].as_string().contains(query))
    return {"total": q.count(), "items": [pack(c, db, user) for c in q.order_by(C.id.desc()).offset(max(0, offset)).limit(25)]}


@router.get("/participants")
def participants(db: Session = Depends(get_db), user: User = Depends(admin), offset: int = 0, query: str = "", role: str = ""):
    q = db.query(User)
    if query:
        q = q.filter(User.full_name.contains(query))
    if role in ("annotator", "reviewer", "admin"):
        q = q.filter(User.role == role)
    return {"total": q.count(), "items": [{"id": u.id, "full_name": u.full_name, "role": u.role, "account_status": u.account_status} for u in q.order_by(User.id).offset(max(0, offset)).limit(25)]}


class ReviewerRoleInput(BaseModel):
    role: Literal["annotator", "reviewer"]


@router.post("/participants/{uid}/role")
def reviewer_role(uid: int, body: ReviewerRoleInput, db: Session = Depends(get_db), user: User = Depends(admin)):
    target = db.get(User, uid)
    if not target:
        raise HTTPException(404, "Không tìm thấy tài khoản")
    if target.role == "admin":
        raise HTTPException(409, "Không thay quyền quản trị tại màn hình reviewer")
    target.role = body.role
    db.commit()
    return {"id": target.id, "role": target.role}


def release_meta(db, row):
    card = db.get(RC, row.id)
    return {"data_card": card.data_card if card else "", "curated": bool(card and card.curated),
            "ids": [record["id"] for record in row.records], "splits": {str(r["id"]): r.get("split", "") for r in row.records}}


@router.get("/releases")
def releases(db: Session = Depends(get_db), user: User = Depends(admin)):
    allowed = {c.id for c in eligible(db)}
    return [{"id": r.id, "created_at": r.created_at, "count": len(r.records), "checksum": r.checksum,
             "affected_count": sum(record["id"] not in allowed for record in r.records), **release_meta(db, r)} for r in db.query(R).order_by(R.id.desc()).limit(100)]


def release_records(db):
    return [{"id": c.id, "source_id": c.source_id, "raw": c.raw} for c in sorted(eligible(db), key=lambda c: c.id)]


@router.get("/releases/preview")
def preview_release(db: Session = Depends(get_db), user: User = Depends(admin), offset: int = 0):
    records = release_records(db)
    allowed = {r["id"] for r in records}
    superseded = superseded_ids(db)
    rows = []
    excluded = Counter()
    for c in db.query(C).order_by(C.id):
        reasons = exclusion_reasons(db, c, superseded)
        if c.id not in allowed:
            excluded.update(reasons)
        rows.append({"id": c.id, "text": c.raw["original_text"], "region": c.raw["region"], "eligible": c.id in allowed, "reasons": reasons})
    start = max(0, offset)
    return {"eligible_count": len(records), "total": len(rows), "excluded_count": len(rows) - len(records),
            "excluded_reasons": dict(excluded), "preview_digest": digest(records), "items": rows[start:start + 25]}


class ReleaseInput(BaseModel):
    preview_digest: str | None = Field(default=None, min_length=64, max_length=64)
    # Curated mode (/demo dataset screen): export exactly these ids, using the CURATED text.
    ids: list[int] | None = Field(default=None, max_length=10000)
    splits: dict[str, Literal["train", "dev", "test"]] = Field(default_factory=dict)
    data_card: str = Field(default="", max_length=20000)


def curated_records(db, ids, splits):
    allowed = {c.id: c for c in eligible(db)}
    records = []
    for cid in sorted(set(ids)):
        c = allowed.get(cid)
        if not c:
            raise HTTPException(409, f"Mẫu #{cid} không còn đủ điều kiện xuất; hãy tải lại danh sách")
        if not curated_ok(db, c):
            raise HTTPException(409, f"Mẫu #{cid} chưa có bản chuẩn hóa đầy đủ")
        meta = db.get(M, cid)
        records.append({"id": c.id, "source_id": c.source_id, "raw": c.raw, "curated": meta.curated, "sense_id": meta.sense_id,
                        "split": splits.get(str(cid), "train")})
    return records


@router.post("/releases", status_code=201)
def release(body: ReleaseInput | None = None, db: Session = Depends(get_db), user: User = Depends(admin)):
    curated = bool(body and body.ids is not None)
    if curated:
        if not body.ids:
            raise HTTPException(409, "Chưa chọn mẫu để xuất")
        records = curated_records(db, body.ids, body.splits)
    else:
        records = release_records(db)
        if body and body.preview_digest and body.preview_digest != digest(records):
            raise HTTPException(409, "Danh sách đủ điều kiện đã thay đổi. Hãy tải lại bản xem trước rồi xác nhận.")
    if not records:
        raise HTTPException(409, "Chưa có mẫu đủ QA, quyền sử dụng và đồng ý huấn luyện")
    row = R(created_by=user.id, records=records, checksum=digest(records))
    db.add(row)
    db.flush()
    if curated or (body and body.data_card):
        db.add(RC(release_id=row.id, data_card=body.data_card if body else "", curated=curated))
    db.commit()
    return {"id": row.id, "count": len(records), "checksum": row.checksum}


@router.get("/releases/{rid}")
def download(rid: int, db: Session = Depends(get_db), user: User = Depends(admin)):
    row = db.get(R, rid)
    if not row:
        raise HTTPException(404, "Không tìm thấy bản phát hành")
    allowed = {c.id for c in eligible(db)}
    if any(record["id"] not in allowed for record in row.records):
        raise HTTPException(409, "Bản phát hành có mẫu đã rút, thay phiên bản hoặc thay đổi quyền; hãy tạo bản mới")
    meta = release_meta(db, row)
    split_policy = "train/dev/test theo nhóm liên thông; chưa dùng làm benchmark/gold" if meta["curated"] else "unsplit; chưa dùng làm benchmark/gold"
    return {"manifest": {"version": row.id, "created_at": row.created_at, "count": len(row.records), "sha256": row.checksum,
                         "scope": "verified-training-candidates", "split_policy": split_policy, "data_card": meta["data_card"]},
            "records": row.records}
