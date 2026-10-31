
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)

from app.core.database import Base, utcnow


class RolePlayScenario(Base):
    """Kịch bản role-play.

    Thuộc 1 Project (loại "thu thập"). Mỗi scenario tương ứng 1 use_case slug
    mà agent server hỗ trợ. Annotator vào project → chọn scenario → bấm
    "Bắt đầu" để tạo 1 RolePlayTask (= phiên hội thoại).

    Agent endpoint + language nằm trên Project (share cho tất cả scenarios).
    """
    __tablename__ = "roleplay_scenarios"
    __table_args__ = (
        Index("ix_roleplay_scenarios_project", "project_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    # Slug agent dùng để chọn use_case (vd "ha_scenario").
    use_case = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    # Hướng dẫn cho annotator hiển thị trong lúc nói chuyện.
    instructions = Column(Text, nullable=True)

    # Mỗi user được làm tối đa N task (0 = không giới hạn).
    max_tasks_per_user = Column(Integer, nullable=False, default=0)
    # Thời lượng tối đa của 1 task (giây). 0 = không giới hạn.
    max_duration_sec = Column(Integer, nullable=False, default=0)

    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class RolePlayTestCase(Base):
    """Trường hợp giả định (test case) để annotator kiểm thử.

    Mỗi Scenario có nhiều TestCase. Mỗi case là 1 tình huống cụ thể (vd
    "khách hài lòng", "khách không hài lòng", "khách từ chối"). Annotator
    chọn 1 case khi bắt đầu task để biết cần đóng vai gì.
    """
    __tablename__ = "roleplay_test_cases"
    __table_args__ = (
        Index("ix_roleplay_test_cases_scenario", "scenario_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(Integer, ForeignKey("roleplay_scenarios.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    # Hướng dẫn cụ thể cho annotator (override scenario.instructions nếu có).
    instructions = Column(Text, nullable=True)
    # Kết quả kỳ vọng — annotator dùng để tự kiểm tra agent có thu thập đúng không.
    expected_outcome = Column(Text, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class RolePlayTask(Base):
    """1 lần annotator thực hiện 1 scenario.

    "Task" theo nghĩa user dùng: mỗi lần annotator try = 1 task. Có recording,
    report do agent thu thập, và đánh giá của annotator.
    """
    __tablename__ = "roleplay_tasks"
    __table_args__ = (
        Index("ix_roleplay_tasks_user_scenario", "user_id", "scenario_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(Integer, ForeignKey("roleplay_scenarios.id", ondelete="CASCADE"), nullable=False)
    # Test case annotator chọn khi bắt đầu (nullable nếu scenario không có
    # test case → fallback dùng instructions của scenario).
    test_case_id = Column(Integer, ForeignKey("roleplay_test_cases.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    status = Column(String(16), nullable=False, default="pending", index=True)
    client_id = Column(String(64), nullable=True)
    agent_session_id = Column(String(128), nullable=True)

    started_at = Column(DateTime, nullable=False, default=utcnow)
    ended_at = Column(DateTime, nullable=True)
    duration_sec = Column(Integer, nullable=True)

    recording_minio_key = Column(String(512), nullable=True)
    recording_mime = Column(String(64), nullable=True)
    recording_size_bytes = Column(Integer, nullable=True)

    error_message = Column(Text, nullable=True)

    report_data = Column(JSON, nullable=True)
    report_rating = Column(Integer, nullable=True)
    report_note = Column(Text, nullable=True)
    report_submitted_at = Column(DateTime, nullable=True)
