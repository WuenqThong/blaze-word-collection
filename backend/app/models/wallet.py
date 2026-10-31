
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.core.database import Base, utcnow


class UserProfile(Base):
    """Hồ sơ cá nhân + thông tin thanh toán."""
    __tablename__ = "user_profiles"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    phone = Column(String(32), nullable=True)
    address = Column(String(512), nullable=True)
    date_of_birth = Column(String(16), nullable=True)  # YYYY-MM-DD

    bank_name = Column(String(128), nullable=True)
    bank_account_number = Column(String(64), nullable=True)
    bank_account_holder = Column(String(128), nullable=True)

    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class Withdrawal(Base):
    """Yêu cầu rút tiền."""
    __tablename__ = "withdrawals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    amount_points = Column(Integer, nullable=False)
    amount_vnd = Column(Integer, nullable=False)

    # snapshot bank info ở thời điểm yêu cầu
    bank_name = Column(String(128), nullable=True)
    bank_account_number = Column(String(64), nullable=True)
    bank_account_holder = Column(String(128), nullable=True)

    # pending | approved | rejected | paid
    status = Column(String(16), nullable=False, default="pending", index=True)
    note = Column(Text, nullable=True)
    admin_note = Column(Text, nullable=True)

    requested_at = Column(DateTime, nullable=False, default=utcnow)
    processed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    processed_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
