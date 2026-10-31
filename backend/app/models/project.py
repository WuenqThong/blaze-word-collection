
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base, utcnow


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)

    # ["audio_label", "audio_verify", "qa"]
    task_types = Column(JSON, nullable=False, default=list)
    # {"audio_label": 10, "audio_verify": 5, "qa": 8}
    scoring = Column(JSON, nullable=False, default=dict)

    redundancy = Column(Integer, nullable=False, default=3)
    golden_ratio = Column(Float, nullable=False, default=0.1)
    # Tỉ lệ tái-gán: xác suất hệ thống serve lại 1 audio user đã annotate để check consistency.
    repeat_ratio = Column(Float, nullable=False, default=0.0)

    # draft | active | closed
    status = Column(String(16), nullable=False, default="draft", index=True)

    # private | public — public cho phép mọi user đăng nhập tham gia gán mà không cần là member
    visibility = Column(String(16), nullable=False, default="private", index=True)

    # annotate (gán nhãn audio) | collect (thu thập dữ liệu qua role-play)
    kind = Column(String(16), nullable=False, default="annotate", index=True)

    # Cho project kind=collect: cấu hình agent role-play. Mọi scenario của
    # project share cùng agent + ngôn ngữ default.
    agent_endpoint = Column(String(512), nullable=True)
    default_language = Column(String(16), nullable=True, default="vi")

    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_project_member"),)

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # member | manager
    role = Column(String(16), nullable=False, default="member")
    joined_at = Column(DateTime, nullable=False, default=utcnow)

    project = relationship("Project", back_populates="members")
