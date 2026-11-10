from fastapi import APIRouter, Depends, Response, status

from app.core.config import get_settings
from app.models import User
from app.schemas.auth import AuthResponse, ChangePasswordRequest, LoginRequest, RegisterRequest, UpdateMeRequest, UserPublic
from app.services.auth_service import AuthService

from .deps import get_auth_service, get_current_user, set_auth_cookie as _set_auth_cookie

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


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


@router.patch("/me", response_model=UserPublic)
def update_me(
    payload: UpdateMeRequest,
    user: User = Depends(get_current_user),
    auth: AuthService = Depends(get_auth_service),
):
    return UserPublic.model_validate(auth.update_name(user, payload.full_name))


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    user: User = Depends(get_current_user),
    auth: AuthService = Depends(get_auth_service),
):
    auth.change_password(user, payload.current_password, payload.new_password)
    _set_auth_cookie(response, user)
    return None
