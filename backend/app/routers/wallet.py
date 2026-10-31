from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User
from app.schemas.wallet import (
    ProfilePublic,
    ProfileUpdate,
    WalletSummary,
    WithdrawalActionRequest,
    WithdrawalListResponse,
    WithdrawalPublic,
    WithdrawalRequest,
)
from app.services.wallet_service import WalletService, get_wallet_service

from .deps import get_current_user, require_role

router = APIRouter(tags=["wallet"])


def _svc(db: Session = Depends(get_db)) -> WalletService:
    return get_wallet_service(db)


# ---------- profile ----------
@router.get("/me/profile", response_model=ProfilePublic)
def my_profile(
    user: User = Depends(get_current_user),
    svc: WalletService = Depends(_svc),
):
    return ProfilePublic(**svc.get_profile(user))


@router.patch("/me/profile", response_model=ProfilePublic)
def update_my_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    svc: WalletService = Depends(_svc),
):
    return ProfilePublic(**svc.update_profile(user, payload))


# ---------- wallet ----------
@router.get("/me/wallet", response_model=WalletSummary)
def my_wallet(
    user: User = Depends(get_current_user),
    svc: WalletService = Depends(_svc),
):
    return WalletSummary(**svc.wallet_summary(user))


# ---------- withdrawals — annotator ----------
@router.post("/me/withdrawals", response_model=WithdrawalPublic, status_code=201)
def request_withdrawal(
    payload: WithdrawalRequest,
    user: User = Depends(get_current_user),
    svc: WalletService = Depends(_svc),
):
    wd = svc.request_withdrawal(user, payload.amount_points, payload.note)
    return WithdrawalPublic(**svc.to_public(wd, user))


@router.get("/me/withdrawals", response_model=WithdrawalListResponse)
def list_my_withdrawals(
    user: User = Depends(get_current_user),
    svc: WalletService = Depends(_svc),
):
    items = svc.list_my_withdrawals(user)
    return WithdrawalListResponse(
        items=[WithdrawalPublic(**svc.to_public(w, user)) for w in items],
        total=len(items),
    )


# ---------- withdrawals — admin ----------
@router.get("/admin/withdrawals", response_model=WithdrawalListResponse)
def admin_list_withdrawals(
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    _: User = Depends(require_role("admin")),
    svc: WalletService = Depends(_svc),
):
    rows = svc.list_for_admin(status_filter=status, limit=limit)
    return WithdrawalListResponse(
        items=[WithdrawalPublic(**svc.to_public(w, u)) for w, u in rows],
        total=len(rows),
    )


@router.post("/admin/withdrawals/{withdrawal_id}/approve", response_model=WithdrawalPublic)
def admin_approve(
    withdrawal_id: int,
    payload: WithdrawalActionRequest,
    admin: User = Depends(require_role("admin")),
    svc: WalletService = Depends(_svc),
    db: Session = Depends(get_db),
):
    wd = svc.approve(admin, withdrawal_id, payload.note)
    user = db.query(User).filter(User.id == wd.user_id).first()
    return WithdrawalPublic(**svc.to_public(wd, user))


@router.post("/admin/withdrawals/{withdrawal_id}/reject", response_model=WithdrawalPublic)
def admin_reject(
    withdrawal_id: int,
    payload: WithdrawalActionRequest,
    admin: User = Depends(require_role("admin")),
    svc: WalletService = Depends(_svc),
    db: Session = Depends(get_db),
):
    wd = svc.reject(admin, withdrawal_id, payload.note)
    user = db.query(User).filter(User.id == wd.user_id).first()
    return WithdrawalPublic(**svc.to_public(wd, user))


@router.post("/admin/withdrawals/{withdrawal_id}/mark-paid", response_model=WithdrawalPublic)
def admin_mark_paid(
    withdrawal_id: int,
    payload: WithdrawalActionRequest,
    admin: User = Depends(require_role("admin")),
    svc: WalletService = Depends(_svc),
    db: Session = Depends(get_db),
):
    wd = svc.mark_paid(admin, withdrawal_id, payload.note)
    user = db.query(User).filter(User.id == wd.user_id).first()
    return WithdrawalPublic(**svc.to_public(wd, user))
