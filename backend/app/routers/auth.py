from fastapi import APIRouter, Depends, Response, status

from app.core.config import get_settings
from app.core.security import create_access_token
from app.models import User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserPublic
from app.services.auth_service import AuthService

from .deps import get_auth_service, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_auth_cookie(response: Response, user: User) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=create_access_token(user.id, user.role),
        max_age=settings.access_token_ttl_min * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    response: Response,
    auth: AuthService = Depends(get_auth_service),
):
    user = auth.register(payload)
    _set_auth_cookie(response, user)
    return AuthResponse(user=UserPublic.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    response: Response,
    auth: AuthService = Depends(get_auth_service),
):
    user = auth.authenticate(payload)
    _set_auth_cookie(response, user)
    return AuthResponse(user=UserPublic.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(settings.cookie_name, path="/")
    return None


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(get_current_user)):
    return UserPublic.model_validate(user)
