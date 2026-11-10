"""Text contributions are separate from legacy audio annotations."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from app.core.database import Base, utcnow


class DialectProfile(Base):
    __tablename__ = "dialect_profiles"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    upbringing_area = Column(String(255), default="", nullable=False)
    usage_area = Column(String(255), default="", nullable=False)


class DialectSource(Base):
    __tablename__ = "dialect_sources"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    evidence = Column(Text, nullable=False)
    rights_confirmed = Column(Boolean, default=False, nullable=False)
    rights_note = Column(Text, default="", nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class DialectContribution(Base):
    __tablename__ = "dialect_contributions"
    __table_args__ = (UniqueConstraint("owner_id", "idempotency_key"),)
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    source_id = Column(Integer, ForeignKey("dialect_sources.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("dialect_contributions.id"), nullable=True)
    idempotency_key = Column(String(128), nullable=False)
    request_hash = Column(String(64), nullable=False)
    raw = Column(JSON, nullable=False)
    status = Column(String(16), default="RAW", nullable=False, index=True)
    withdrawn_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class DialectVote(Base):
    __tablename__ = "dialect_votes"
    __table_args__ = (UniqueConstraint("contribution_id", "reviewer_id"),)
    id = Column(Integer, primary_key=True)
    contribution_id = Column(Integer, ForeignKey("dialect_contributions.id"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    verdict = Column(String(16), nullable=False)
    rubric = Column(JSON, nullable=False)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class DialectEvent(Base):
    __tablename__ = "dialect_events"
    id = Column(Integer, primary_key=True)
    contribution_id = Column(Integer, ForeignKey("dialect_contributions.id"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(32), nullable=False)
    note = Column(Text, default="", nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class DialectRelease(Base):
    __tablename__ = "dialect_releases"
    id = Column(Integer, primary_key=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    records = Column(JSON, nullable=False)
    checksum = Column(String(64), nullable=False)


# --- Side tables added for the /demo workspace. No Alembic yet, so existing
# tables stay untouched and new state lives in tables that create_all can add.

class DialectContributionMeta(Base):
    """Server-managed state next to an immutable RAW contribution."""
    __tablename__ = "dialect_contribution_meta"
    contribution_id = Column(Integer, ForeignKey("dialect_contributions.id"), primary_key=True)
    session_ref = Column(String(128), nullable=True, index=True)
    duplicate_of = Column(Integer, ForeignKey("dialect_contributions.id"), nullable=True)
    consent = Column(JSON, nullable=True)  # override after submission; None = consent in RAW
    curated = Column(JSON, nullable=True)
    sense_id = Column(String(128), default="", nullable=False)
    qa_audio = Column(String(16), default="", nullable=False)
    curated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    curated_at = Column(DateTime, nullable=True)


class DialectSourceRights(Base):
    """Per-purpose rights; `train` mirrors DialectSource.rights_confirmed."""
    __tablename__ = "dialect_source_rights"
    source_id = Column(Integer, ForeignKey("dialect_sources.id"), primary_key=True)
    title = Column(String(255), default="", nullable=False)
    public = Column(Boolean, default=False, nullable=False)
    audio = Column(Boolean, default=False, nullable=False)


class DialectParticipant(Base):
    __tablename__ = "dialect_participants"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    verified = Column(Boolean, default=False, nullable=False)
    risk = Column(String(16), default="clear", nullable=False)  # clear | hold
    review_region = Column(String(255), default="", nullable=False)
    appeal = Column(Text, default="", nullable=False)


class DialectFeedback(Base):
    """Follows the legacy Report flow (open → resolved) without audio task FKs."""
    __tablename__ = "dialect_feedback"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    entity = Column(String(512), nullable=False, index=True)
    text = Column(Text, nullable=False)
    status = Column(String(16), default="open", nullable=False, index=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class DialectCredit(Base):
    """Internal AI-usage quota earned from eligible contributions. Never money:
    the VND wallet stays separate and is not touched by these rows."""
    __tablename__ = "dialect_credits"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    contribution_id = Column(Integer, ForeignKey("dialect_contributions.id"), nullable=False, unique=True)
    amount = Column(Integer, nullable=False)
    used = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    granted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class DialectSetting(Base):
    __tablename__ = "dialect_settings"
    key = Column(String(64), primary_key=True)
    value = Column(JSON, nullable=False)


class DialectReleaseCard(Base):
    __tablename__ = "dialect_release_cards"
    release_id = Column(Integer, ForeignKey("dialect_releases.id"), primary_key=True)
    data_card = Column(Text, default="", nullable=False)
    curated = Column(Boolean, default=False, nullable=False)


class DialectGameAllocation(Base):
    """One row per game session the server assigned an exam to.

    Exams and questions stay in the browser; the server only sees exam IDs, so it
    can balance plays across every account instead of per browser profile.
    """
    __tablename__ = "dialect_game_allocations"
    session_ref = Column(String(128), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    exam_id = Column(String(128), nullable=False, index=True)
    campaign_id = Column(String(128), default="", nullable=False)
    withdrawn_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
