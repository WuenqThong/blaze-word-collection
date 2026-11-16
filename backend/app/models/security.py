"""Persistent throttling, security audit, and one-use account recovery."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from app.core.database import Base, utcnow


class SecurityThrottle(Base):
    __tablename__ = 'security_throttles'
    key = Column(String(64), primary_key=True)
    window = Column(Integer, nullable=False)
    count = Column(Integer, nullable=False)


class SecurityAuditEvent(Base):
    __tablename__ = 'security_audit_events'
    id = Column(Integer, primary_key=True)
    actor_id = Column(Integer, nullable=True)
    action = Column(String(64), nullable=False)
    entity_type = Column(String(64), nullable=False)
    entity_id = Column(String(128), nullable=False)
    request_id = Column(String(64), nullable=False)
    details = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class PasswordRecovery(Base):
    __tablename__ = 'password_recoveries'
    token_hash = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    issued_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
