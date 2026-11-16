from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from app.core.database import Base, utcnow


class GameResource(Base):
    __tablename__ = 'dialect_game_resources'
    kind = Column(String(24), primary_key=True)
    key = Column(String(128), primary_key=True)
    revision = Column(Integer, nullable=False, default=1)
    data = Column(JSON, nullable=False)
    updated_at = Column(DateTime, nullable=False, default=utcnow)


class GameResourceVersion(Base):
    __tablename__ = 'dialect_game_resource_versions'
    kind = Column(String(24), primary_key=True)
    key = Column(String(128), primary_key=True)
    revision = Column(Integer, primary_key=True)
    data = Column(JSON, nullable=False)
    actor_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class GameSession(Base):
    __tablename__ = 'dialect_game_sessions'
    session_ref = Column(String(128), ForeignKey('dialect_game_allocations.session_ref'), primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    start_hash = Column(String(64), nullable=False)
    revision = Column(Integer, nullable=False, default=1)
    snapshot = Column(JSON, nullable=False)
    data = Column(JSON, nullable=False)
    updated_at = Column(DateTime, nullable=False, default=utcnow)


class GameCommand(Base):
    __tablename__ = 'dialect_game_commands'
    id = Column(Integer, primary_key=True)
    session_ref = Column(String(128), ForeignKey('dialect_game_sessions.session_ref'), nullable=False, index=True)
    key = Column(String(128), nullable=False)
    request_hash = Column(String(64), nullable=False)
    revision = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    __table_args__ = (UniqueConstraint('session_ref', 'key', name='uq_game_command_key'),)
