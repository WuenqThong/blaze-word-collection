
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.core.database import Base, utcnow


class Task(Base):
    """Một đơn vị công việc gán nhãn.

    Mỗi Task tham chiếu 1 Audio (file dữ liệu) qua audio_id và có task_type
    + payload riêng. 1 Audio có thể có nhiều Task: ví dụ 1 file dữ liệu có
    thể được gán label (audio_label) bởi nhiều annotator, mỗi label sinh ra
    1 verify task (audio_verify) cho các annotator khác xác nhận.
    """
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_project_status", "project_id", "status"),
        Index("ix_tasks_project_type", "project_id", "task_type"),
        Index("ix_tasks_audio", "audio_id"),
        Index("ix_tasks_parent", "parent_task_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    audio_id = Column(Integer, ForeignKey("audios.id", ondelete="CASCADE"), nullable=False)

    # audio_label | audio_verify | qa
    task_type = Column(String(32), nullable=False, index=True)
    # Schema phụ thuộc task_type:
    #   audio_label: { prelabel?: str }
    #   audio_verify: { suggested_label: str }
    #   qa: { question: str, options?: list[str] }
    payload = Column(JSON, nullable=False, default=dict)

    # Quality
    is_golden = Column(Boolean, nullable=False, default=False, index=True)
    golden_answer = Column(JSON, nullable=True)

    # Lifecycle: ready | processing | error
    status = Column(String(16), nullable=False, default="ready")

    # Spawn lineage: nếu task này được tự sinh từ một annotation audio_label
    # để verify (xác nhận âm thanh), parent_task_id trỏ về task gốc.
    parent_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    source_annotation_id = Column(Integer, ForeignKey("annotations.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, nullable=False, default=utcnow)

    # Relationship cho phép truy cập file metadata: task.audio.minio_key, ...
    audio = relationship("Audio", foreign_keys=[audio_id], lazy="joined")

    # Backwards-compat: nhiều code đang dùng task.minio_key, task.duration_sec
    # — proxy về Audio để tránh phải sửa hết một lượt. Code mới nên dùng
    # task.audio.<field> trực tiếp.
    @property
    def minio_key(self): return self.audio.minio_key if self.audio else None
    @property
    def original_filename(self): return self.audio.original_filename if self.audio else None
    @property
    def mime(self): return self.audio.mime if self.audio else None
    @property
    def size_bytes(self): return self.audio.size_bytes if self.audio else None
    @property
    def duration_sec(self): return self.audio.duration_sec if self.audio else None
    @property
    def sample_rate(self): return self.audio.sample_rate if self.audio else None
    @property
    def uploaded_by(self): return self.audio.uploaded_by if self.audio else None
    @property
    def uploaded_at(self): return self.audio.uploaded_at if self.audio else None
    @property
    def error_message(self): return self.audio.error_message if self.audio else None
