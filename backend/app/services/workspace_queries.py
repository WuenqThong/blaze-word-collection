"""Bounded pages for every workspace collection and explicit server metrics."""
import base64
import hashlib
import hmac
import json
import time
from fastapi import HTTPException
from sqlalchemy import func
from app.core.config import get_settings
from app.models import User
from app.models.dialect import (DialectContribution as C, DialectSource as S, DialectCredit as K,
                               DialectRelease as R, DialectFeedback as F, DialectGameReceipt as GR)

DEFINITIONS = {
    'started_sessions': 'Lượt có xác nhận bắt đầu được máy chủ tiếp nhận; gồm cả lượt đã rút.',
    'submitted_sessions': 'Lượt có xác nhận gửi bài được máy chủ tiếp nhận; gồm cả lượt đã rút, kể cả lượt không sinh mẫu.',
    'withdrawn_sessions': 'Lượt đã xác nhận bắt đầu và sau đó được rút.',
    'valid_samples': 'Mẫu VERIFIED, đủ một phiếu, CURATED đầy đủ, không trùng/rút/thay thế và đủ quyền/consent huấn luyện.',
    'coverage': 'Không suy lượt từ số mẫu. Lượt mới có bản đề được chấm và kiểm tra trên máy chủ. Lượt cũ chỉ có xác nhận từ ứng dụng, không được coi là chứng nhận làm đúng đề. Lượt ngoại tuyến chưa đồng bộ chưa được tính.',
}


def cursor_encode(data):
    payload = base64.urlsafe_b64encode(json.dumps(data, sort_keys=True, separators=(',', ':')).encode()).decode().rstrip('=')
    signature = hmac.new(get_settings().jwt_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return payload + '.' + signature


def cursor_decode(value, user):
    try:
        payload, signature = value.split('.')
        expected = hmac.new(get_settings().jwt_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature): raise ValueError()
        data = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        if data['v'] != 1 or data['user'] != user.id or data['role'] != user.role or time.time() - data['at'] > 900:
            raise ValueError()
        if any(not isinstance(n, int) or n < 0 for values in (data['high'], data['before']) for n in values.values()):
            raise ValueError()
        return data
    except (ValueError, TypeError, KeyError, AttributeError):
        raise HTTPException(400, 'Trang dữ liệu đã hết hạn hoặc không hợp lệ; hãy tải lại từ đầu')


def page_collections(db, user, cursor=None, limit=100):
    staff = user.role in ('admin', 'reviewer')
    from app.services.staff_access import can_operate
    admin = can_operate(db, user)
    contributions = db.query(C) if staff else db.query(C).filter(C.owner_id == user.id)
    source_ids = contributions.with_entities(C.source_id)
    queries = {
        'contributions': (contributions, C.id),
        'sources': (db.query(S) if admin else db.query(S).filter(S.id.in_(source_ids)), S.id),
        'people': (db.query(User) if admin else db.query(User).filter(User.id == user.id), User.id),
        'credits': (db.query(K) if admin else db.query(K).filter(K.user_id == user.id), K.id),
        'releases': (db.query(R) if admin else db.query(R).filter(R.id < 0), R.id),
        'feedback': (db.query(F) if staff else db.query(F).filter(F.user_id == user.id), F.id),
    }
    if cursor:
        data = cursor_decode(cursor, user)
        if set(data['high']) != set(queries) or set(data['before']) != set(queries):
            raise HTTPException(400, 'Trang dữ liệu không hợp lệ')
    else:
        high = {key: query.with_entities(func.max(column)).scalar() or 0 for key, (query, column) in queries.items()}
        data = {'v': 1, 'user': user.id, 'role': user.role, 'at': int(time.time()), 'high': high,
                'before': {key: value + 1 for key, value in high.items()}}
    result = {}
    more = False
    for key, (query, column) in queries.items():
        rows = query.filter(column <= data['high'][key], column < data['before'][key]).order_by(column.desc()).limit(limit + 1).all()
        result[key] = rows[:limit]
        if len(rows) > limit:
            data['before'][key] = getattr(rows[limit - 1], column.key)
            more = True
        else:
            data['before'][key] = 0
    return result, cursor_encode(data) if more else None


def statistics(db, user):
    from app.routers.dialect import eligible
    from app.services.dataset_release import release_candidates
    admin = user.role in ('admin', 'reviewer')
    receipts = db.query(GR) if admin else db.query(GR).filter(GR.user_id == user.id)
    rows = receipts.all()
    samples = db.query(C) if admin else db.query(C).filter(C.owner_id == user.id)
    contributions = samples.all()
    allowed = [c for c in release_candidates(db, eligible(db))[0].values() if admin or c.owner_id == user.id]
    people = db.query(User).all() if admin else [user]
    by_user = {}
    for person in people:
        plays = [r for r in rows if r.user_id == person.id]
        by_user[str(person.id)] = {
            'started_sessions': len(plays), 'submitted_sessions': sum(r.submitted_at is not None for r in plays),
            'withdrawn_sessions': sum(r.withdrawn_at is not None for r in plays),
            'valid_samples': sum(c.owner_id == person.id for c in allowed),
        }
    return {'started_sessions': len(rows), 'submitted_sessions': sum(r.submitted_at is not None for r in rows),
            'withdrawn_sessions': sum(r.withdrawn_at is not None for r in rows), 'valid_samples': len(allowed),
            'held_samples': sum(c.status == 'HOLD' and not c.withdrawn_at for c in contributions),
            'rejected_samples': sum(c.status == 'REJECT' and not c.withdrawn_at for c in contributions),
            'by_user': by_user, 'definitions': DEFINITIONS, 'coverage_since': 'explicit-receipts-v1'}
