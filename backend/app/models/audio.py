
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)

from app.core.database import Base, utcnow


class Audio(Base):
    """File dữ liệu audio (storage layer).

    Chỉ chứa metadata file. 1 Audio có thể được tham chiếu bởi nhiều Task —
    ví dụ 1 audio gốc có 1 task audio_label, sau đó các submission spawn ra
    nhiều task audio_verify đều dùng chung file này.
    """
    __tablename__ = "audios"
    __table_args__ = (
        Index("ix_audios_project_status", "project_id", "status"),
        Index("ix_audios_minio_key", "minio_key"),
    )

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    # Storage
    minio_key = Column(String(512), nullable=False, unique=True)
    original_filename = Column(String(512), nullable=False)
    mime = Column(String(128), nullable=True)
    size_bytes = Column(Integer, nullable=True)
    duration_sec = Column(Integer, nullable=True)
    sample_rate = Column(Integer, nullable=True)

    # Lifecycle: ready | processing | error
    status = Column(String(16), nullable=False, default="ready")
    error_message = Column(Text, nullable=True)

    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at = Column(DateTime, nullable=False, default=utcnow)
