from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator
from app.core.roles import canonical_role


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_validator('role')
    @classmethod
    def normalize_role(cls, value):
        return canonical_role(value)


class AuthResponse(BaseModel):
    user: UserPublic


class UpdateMeRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)
