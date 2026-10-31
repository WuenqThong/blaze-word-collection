
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
)

from app.core.database import Base, utcnow


class Assignment(Base):
    """Lock một task cho user trong khoảng thời gian — bắt buộc phân bổ duy nhất."""
    __tablename__ = "assignments"
    __table_args__ = (
        Index("ix_assignment_user_status", "user_id", "status"),
        Index("ix_assignment_task_status", "task_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # active | completed | released | expired
    status = Column(String(16), nullable=False, default="active", index=True)

    locked_at = Column(DateTime, nullable=False, default=utcnow)
    expires_at = Column(DateTime, nullable=False)
    released_at = Column(DateTime, nullable=True)


class Annotation(Base):
    __tablename__ = "annotations"
    __table_args__ = (
        Index("ix_ann_project_user", "project_id", "user_id"),
        Index("ix_ann_task", "task_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="SET NULL"), nullable=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    task_type = Column(String(32), nullable=False)
    # answer schema:
    #   audio_label  : { text: str }
    #   audio_verify : { verdict: "correct" | "incorrect" }
    #   qa           : { text: str } | { option: str }
    answer = Column(JSON, nullable=False, default=dict)

    # Behavior signals
    time_spent_ms = Column(Integer, nullable=True)
    audio_listened_sec = Column(Float, nullable=True)
    audio_play_count = Column(Integer, nullable=True)

    # Quality (golden check)
    is_golden_check = Column(Boolean, nullable=False, default=False)
    golden_correct = Column(Boolean, nullable=True)
    low_engagement = Column(Boolean, nullable=False, default=False)
    # Repeat check: annotation thứ 2+ trên cùng (task, user) — không tính vào redundancy/consensus
    is_repeat_check = Column(Boolean, nullable=False, default=False, index=True)

    # Admin review: pending → approved (score chính thức) / rejected (score = 0)
    review_status = Column(String(16), nullable=False, default="pending", index=True)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(String(512), nullable=True)

    score_awarded = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=utcnow)
