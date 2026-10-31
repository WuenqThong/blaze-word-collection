
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.core.database import Base, utcnow


class Report(Base):
    """Annotator báo cáo audio bị lỗi / không gán được.

    Khi admin approve → user vẫn nhận điểm (vì đã giúp lọc data xấu).
    Khi reject → không tính điểm.
    """
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="SET NULL"), nullable=True)

    # corrupt | inaudible | wrong_label | offensive | other
    reason = Column(String(32), nullable=False)
    description = Column(Text, nullable=True)

    # pending | approved | rejected
    status = Column(String(16), nullable=False, default="pending", index=True)

    score_awarded = Column(Integer, nullable=False, default=0)

    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    admin_note = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=utcnow)
