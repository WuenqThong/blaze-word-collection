import time
import hmac
from typing import Optional

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_access_token, credential_fingerprint, decode_token
from app.models import User
from app.services.auth_service import AuthService

settings = get_settings()


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(db)


def set_auth_cookie(response: Response, user: User) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=create_access_token(user.id, user.role, user.password_hash),
        max_age=settings.access_token_ttl_min * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


def get_current_user(request: Request, response: Response, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Chưa đăng nhập")

    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Phiên không hợp lệ")

    try:
        user_id = int(payload['sub'])
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Phiên không hợp lệ")
    user = AuthService(db).get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Không tìm thấy user")
    fingerprint = payload.get('pwd')
    if not isinstance(fingerprint, str) or not hmac.compare_digest(fingerprint, credential_fingerprint(user.password_hash)):
        raise HTTPException(status_code=401, detail="Phiên đã hết hiệu lực. Vui lòng đăng nhập lại.")
    if user.account_status == 'suspended':
        raise HTTPException(status_code=403, detail="Tài khoản đang bị tạm dừng")
    db.info['actor_id'] = user.id

    # Sliding session: once half the lifetime has passed, any authenticated request
    # renews the cookie, so only an idle session expires.
    issued = payload.get("iat", 0)
    if time.time() - issued > settings.access_token_ttl_min * 30:
        set_auth_cookie(response, user)
    return user


def get_optional_user(request: Request, response: Response, db: Session = Depends(get_db)) -> Optional[User]:
    try:
        return get_current_user(request, response, db)
    except HTTPException:
        return None


def require_role(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        from app.core.roles import canonical_role
        if canonical_role(user.role) not in {canonical_role(role) for role in roles}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền")
        return user

    return checker
