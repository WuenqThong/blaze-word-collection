"""Consent checks and contribution locks shared by review and owner writes."""
from contextlib import contextmanager

from fastapi import HTTPException
from sqlalchemy import text, update

from app.models.dialect import DialectContribution as C, DialectContributionMeta as M


def consent_of(item, meta=None):
    if meta is not None and meta.consent is not None:
        return meta.consent
    raw = item.raw
    return {key: bool(raw.get('consent_' + key)) for key in ('collect', 'train', 'public', 'audio')} | {
        'version': raw.get('consent_version', '')}


@contextmanager
def contribution_write(db):
    """Reserve SQLite writes without nesting an existing physical transaction.

    A deferred transaction/savepoint already opened by a caller is upgraded by
    lock_contributions instead. Never commit or discard a caller's work to lock.
    """
    try:
        if db.get_bind().dialect.name == 'sqlite':
            connection = db.connection()
            if not connection.connection.driver_connection.in_transaction:
                connection.execute(text('BEGIN IMMEDIATE'))
        yield
    except Exception:
        db.rollback()
        raise


def lock_contributions(db, ids):
    with db.no_autoflush:
        if db.get_bind().dialect.name == 'sqlite':
            # Also upgrades an existing deferred transaction or SAVEPOINT.
            db.execute(update(C).where(C.id.in_(ids)).values(id=C.id),
                       execution_options={'synchronize_session': False})
        return (db.query(C).filter(C.id.in_(ids)).order_by(C.id)
                .populate_existing().with_for_update().all())


def locked_contribution(db, cid):
    items = lock_contributions(db, [cid])
    if not items:
        raise HTTPException(404, 'Không tìm thấy mẫu đóng góp')
    return items[0]


def require_collection_consent(db, item):
    # Refresh an identity-map entry after acquiring the contribution lock.
    with db.no_autoflush:
        meta = (db.query(M).filter_by(contribution_id=item.id)
                .populate_existing().with_for_update().first())
    if item.withdrawn_at or not consent_of(item, meta).get('collect'):
        raise HTTPException(409, 'Mẫu đã rút hoặc không còn quyền tiếp nhận; không thể duyệt hay chuẩn hóa')
