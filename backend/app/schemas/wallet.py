from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ProfilePublic(BaseModel):
    user_id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_holder: Optional[str] = None
    updated_at: Optional[datetime] = None


class ProfileUpdate(BaseModel):
    phone: Optional[str] = Field(default=None, max_length=32)
    address: Optional[str] = Field(default=None, max_length=512)
    date_of_birth: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    bank_name: Optional[str] = Field(default=None, max_length=128)
    bank_account_number: Optional[str] = Field(default=None, max_length=64)
    bank_account_holder: Optional[str] = Field(default=None, max_length=128)


class WithdrawalRequest(BaseModel):
    amount_points: int = Field(ge=1)
    note: Optional[str] = Field(default=None, max_length=500)


class WithdrawalPublic(BaseModel):
    id: int
    user_id: int
    user_full_name: Optional[str] = None
    user_email: Optional[str] = None
    amount_points: int
    amount_vnd: int
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_holder: Optional[str] = None
    status: Literal["pending", "approved", "rejected", "paid"]
    note: Optional[str] = None
    admin_note: Optional[str] = None
    requested_at: datetime
    processed_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None


class WithdrawalListResponse(BaseModel):
    items: list[WithdrawalPublic]
    total: int


class WithdrawalActionRequest(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)


class WalletSummary(BaseModel):
    score_confirmed: int
    score_pending: int
    confirmed_vnd: int
    point_to_vnd: int
    min_withdrawal_points: int
    pending_withdrawal_points: int  # đang chờ admin duyệt
    available_points: int           # confirmed - pending withdrawals
