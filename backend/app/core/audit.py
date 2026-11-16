"""Audit writes participate in the same transaction as the business change.

Only allowlisted state is retained: never passwords, tokens, free text, RAW,
CURATED content or request bodies. Rolled-back writes leave no audit record.
"""
from contextvars import ContextVar
from uuid import uuid4
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session
from app.models.security import SecurityAuditEvent

request_id_context = ContextVar('request_id', default='')

# Table -> action, permitted field values. Content fields are counted by name only.
TRACKED = {
    'dialect_game_resources': ('GAME_CATALOG_CHANGED', ('revision',)),
    'dialect_game_sessions': ('GAME_SESSION_CHANGED', ('revision',)),
    'users': ('ACCOUNT_CHANGED', ('role', 'account_status', 'password_hash')),
    'dialect_sources': ('SOURCE_RIGHTS_CHANGED', ('rights_confirmed',)),
    'dialect_source_rights': ('SOURCE_RIGHTS_CHANGED', ('public', 'audio')),
    'dialect_contribution_meta': ('CONTRIBUTION_CHANGED', ('consent', 'curated', 'qa_audio')),
    'dialect_contributions': ('CONTRIBUTION_CHANGED', ('status', 'withdrawn_at')),
    'dialect_releases': ('RELEASE_CREATED', ('checksum',)),
    'dialect_participants': ('PARTICIPANT_CHANGED', ('verified', 'risk', 'review_region')),
    'dialect_settings': ('POLICY_CHANGED', ('value',)),
    'dialect_credits': ('CREDIT_CHANGED', ('amount', 'used', 'revoked', 'expires_at')),
    'password_recoveries': ('RECOVERY_CHANGED', ('used_at',)),
    'dialect_game_receipts': ('GAME_RECEIPT_CHANGED', ('started_at', 'submitted_at', 'withdrawn_at')),
}


@event.listens_for(Session, 'after_flush')
def audit_changes(session, flush_context):
    for row in list(session.new) + list(session.dirty):
        table = getattr(row, '__tablename__', '')
        if table not in TRACKED:
            continue
        action, fields = TRACKED[table]
        state = inspect(row)
        changed = [name for name in fields if name in state.attrs and state.attrs[name].history.has_changes()]
        if not changed and row not in session.new:
            continue
        details = {'fields': changed, 'operation': 'create' if row in session.new else 'update'}
        # Retain only purpose flags / role/status, never arbitrary field contents.
        for name in changed:
            value = getattr(row, name)
            if name in ('role', 'account_status', 'status', 'risk', 'qa_audio', 'verified', 'rights_confirmed', 'public', 'audio', 'revoked', 'amount', 'used'):
                details[name] = value
            elif name == 'consent' and isinstance(value, dict):
                details['consent'] = {key: bool(value.get(key)) for key in ('collect', 'train', 'public', 'audio')}
        if table == 'password_recoveries':
            entity_id = str(row.user_id)  # Never store even a token digest in audit output.
        else:
            entity_id = str(getattr(row, 'id', None) or getattr(row, 'contribution_id', None) or getattr(row, 'session_ref', None) or getattr(row, 'user_id', None) or getattr(row, 'key', ''))
        session.add(SecurityAuditEvent(actor_id=session.info.get('actor_id'), action=action,
                                      entity_type=table, entity_id=entity_id,
                                      request_id=request_id_context.get() or session.info.get('request_id') or uuid4().hex,
                                      details=details))
