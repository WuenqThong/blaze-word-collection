
from sqlalchemy import Column, DateTime, Integer, String

from app.core.database import Base, utcnow


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="annotator")
    # active | under_review (nhiều rejection → tạm khoá nhận task) | suspended
    account_status = Column(String(32), nullable=False, default="active", index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)
