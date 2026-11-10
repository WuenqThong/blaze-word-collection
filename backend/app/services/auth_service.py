from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.core.security import hash_password, verify_password
from app.models import User
from app.schemas.auth import LoginRequest, RegisterRequest


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def register(self, payload: RegisterRequest) -> User:
        email = payload.email.lower()
        if self.db.query(User).filter(User.email == email).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email đã được đăng ký",
            )

        user = User(
            email=email,
            full_name=payload.full_name.strip(),
            password_hash=hash_password(payload.password),
            role="annotator",
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def authenticate(self, payload: LoginRequest) -> User:
        email = payload.email.lower()
        user = self.db.query(User).filter(User.email == email).first()
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email hoặc mật khẩu không đúng",
            )

        user.last_login_at = utcnow()
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_name(self, user: User, full_name: str) -> User:
        name = " ".join(full_name.split())
        if not name:
            raise HTTPException(status_code=422, detail="Tên hiển thị không được để trống")
        user.full_name = name
        self.db.commit()
        self.db.refresh(user)
        return user

    def change_password(self, user: User, current: str, new: str) -> None:
        # 400, not 401: a wrong current password must not look like an expired session.
        if not verify_password(current, user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mật khẩu hiện tại không đúng")
        if verify_password(new, user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mật khẩu mới phải khác mật khẩu hiện tại")
        user.password_hash = hash_password(new)
        self.db.commit()

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()
