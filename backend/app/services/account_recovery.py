"""Admin-assisted recovery: verify identity out of band before issuing a link.

The issuer authenticates as an existing active admin. Tokens last 30 minutes,
are stored only as SHA-256, consumed atomically and invalidate older sessions.
"""
from datetime import timedelta
import hashlib
import secrets
from fastapi import HTTPException
from sqlalchemy import update
from app.core.database import utcnow
from app.core.security import hash_password
from app.models import User
from app.models.security import PasswordRecovery
from app.models.security import SecurityAuditEvent
from app.core.audit import request_id_context
from uuid import uuid4


def issue_recovery(db, issuer: User, target: User) -> str:
    from app.services.staff_access import can_operate
    if not can_operate(db, issuer) or issuer.account_status != 'active':
        raise HTTPException(403, 'Chỉ quản trị viên đang hoạt động được cấp liên kết khôi phục')
    token = secrets.token_urlsafe(32)
    now = utcnow()
    db.info['actor_id'] = issuer.id
    db.query(PasswordRecovery).filter_by(user_id=target.id, used_at=None).update({'used_at': now})
    db.add(PasswordRecovery(token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=target.id,
                            issued_by=issuer.id, expires_at=now + timedelta(minutes=30)))
    return token  # Caller must commit before showing the link; never log this value.


def consume_recovery(db, token: str, new_password: str):
    digest = hashlib.sha256(token.encode()).hexdigest()
    row = db.get(PasswordRecovery, digest)
    now = utcnow()
    if row is None or row.used_at is not None or row.expires_at <= now:
        raise HTTPException(400, 'Liên kết khôi phục không hợp lệ hoặc đã hết hạn')
    # Conditional write protects against two concurrent submissions of one token.
    changed = db.execute(update(PasswordRecovery).where(PasswordRecovery.token_hash == digest,
                         PasswordRecovery.used_at.is_(None), PasswordRecovery.expires_at > now)
                         .values(used_at=now)).rowcount
    if changed != 1:
        db.rollback()
        raise HTTPException(400, 'Liên kết khôi phục không hợp lệ hoặc đã hết hạn')
    user = db.get(User, row.user_id)
    if user is None:
        db.rollback()
        raise HTTPException(400, 'Liên kết khôi phục không hợp lệ hoặc đã hết hạn')
    db.info['actor_id'] = user.id
    user.password_hash = hash_password(new_password)
    db.add(SecurityAuditEvent(actor_id=user.id, action='RECOVERY_CONSUMED', entity_type='users',
                              entity_id=str(user.id), request_id=request_id_context.get() or uuid4().hex,
                              details={'operation': 'reset_password'}))
    db.commit()
