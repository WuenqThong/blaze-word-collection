"""Service quản lý hồ sơ + ví tiền + yêu cầu rút."""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.core.config import get_settings
from app.models import Annotation, Report, User, UserProfile, Withdrawal
from app.schemas.wallet import ProfileUpdate

settings = get_settings()


class WalletService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---------- profile ----------
    def get_profile(self, user: User) -> dict:
        p = self.db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        return {
            "user_id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "phone": p.phone if p else None,
            "address": p.address if p else None,
            "date_of_birth": p.date_of_birth if p else None,
            "bank_name": p.bank_name if p else None,
            "bank_account_number": p.bank_account_number if p else None,
            "bank_account_holder": p.bank_account_holder if p else None,
            "updated_at": p.updated_at if p else None,
        }

    def update_profile(self, user: User, payload: ProfileUpdate) -> dict:
        p = self.db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        if not p:
            p = UserProfile(user_id=user.id)
            self.db.add(p)
        data = payload.model_dump(exclude_unset=True)
        for k, v in data.items():
            setattr(p, k, v.strip() if isinstance(v, str) else v)
        self.db.commit()
        return self.get_profile(user)

    # ---------- score / wallet ----------
    def _score_confirmed(self, user: User) -> int:
        ann_score = int(
            self.db.query(func.coalesce(func.sum(Annotation.score_awarded), 0))
            .filter(Annotation.user_id == user.id, Annotation.review_status == "approved")
            .scalar() or 0
        )
        report_score = int(
            self.db.query(func.coalesce(func.sum(Report.score_awarded), 0))
            .filter(Report.user_id == user.id, Report.status == "approved")
            .scalar() or 0
        )
        return ann_score + report_score

    def _score_pending(self, user: User) -> int:
        return int(
            self.db.query(func.coalesce(func.sum(Annotation.score_awarded), 0))
            .filter(Annotation.user_id == user.id, Annotation.review_status == "pending")
            .scalar() or 0
        )

    def _pending_withdrawals_points(self, user: User) -> int:
        """Tổng điểm đã rút hoặc đang chờ rút — phải trừ khỏi available.

        QUAN TRỌNG: phải bao gồm cả 'paid' để tránh user rút lại lượng đã được trả.
        """
        return int(
            self.db.query(func.coalesce(func.sum(Withdrawal.amount_points), 0))
            .filter(
                Withdrawal.user_id == user.id,
                Withdrawal.status.in_(("pending", "approved", "paid")),
            )
            .scalar() or 0
        )

    def wallet_summary(self, user: User) -> dict:
        confirmed = self._score_confirmed(user)
        pending_score = self._score_pending(user)
        pending_wd = self._pending_withdrawals_points(user)
        available = max(0, confirmed - pending_wd)
        return {
            "score_confirmed": confirmed,
            "score_pending": pending_score,
            "confirmed_vnd": confirmed * settings.point_to_vnd,
            "point_to_vnd": settings.point_to_vnd,
            "min_withdrawal_points": settings.min_withdrawal_points,
            "pending_withdrawal_points": pending_wd,
            "available_points": available,
        }

    # ---------- withdrawal — annotator ----------
    def request_withdrawal(self, user: User, amount_points: int, note: Optional[str]) -> Withdrawal:
        if user.account_status != "active":
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Tài khoản chưa active — chưa thể rút")
        if amount_points < settings.min_withdrawal_points:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Số điểm tối thiểu để rút là {settings.min_withdrawal_points}",
            )

        profile = self.db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        if not profile or not profile.bank_account_number or not profile.bank_name or not profile.bank_account_holder:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Hãy cập nhật đầy đủ thông tin tài khoản ngân hàng trước khi rút",
            )

        # Anti-race: lock row user trong transaction để check + insert atomic
        # Re-query summary trong cùng transaction để dữ liệu nhất quán
        try:
            self.db.query(User).filter(User.id == user.id).with_for_update().first()
        except Exception:
            # SQLite không hỗ trợ FOR UPDATE — fallback: dựa vào commit serialization
            pass

        summary = self.wallet_summary(user)
        if amount_points > summary["available_points"]:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Vượt quá số điểm khả dụng ({summary['available_points']})",
            )

        wd = Withdrawal(
            user_id=user.id,
            amount_points=amount_points,
            amount_vnd=amount_points * settings.point_to_vnd,
            bank_name=profile.bank_name,
            bank_account_number=profile.bank_account_number,
            bank_account_holder=profile.bank_account_holder,
            status="pending",
            note=note,
        )
        self.db.add(wd)
        self.db.commit()
        self.db.refresh(wd)
        return wd

    def list_my_withdrawals(self, user: User, limit: int = 100) -> list[Withdrawal]:
        return (
            self.db.query(Withdrawal)
            .filter(Withdrawal.user_id == user.id)
            .order_by(Withdrawal.requested_at.desc())
            .limit(limit)
            .all()
        )

    # ---------- withdrawal — admin ----------
    def list_for_admin(self, status_filter: Optional[str] = None, limit: int = 100) -> list[tuple[Withdrawal, User]]:
        query = (
            self.db.query(Withdrawal, User)
            .join(User, User.id == Withdrawal.user_id)
        )
        if status_filter:
            query = query.filter(Withdrawal.status == status_filter)
        return query.order_by(Withdrawal.requested_at.desc()).limit(limit).all()

    def _action(self, admin: User, withdrawal_id: int, new_status: str, note: Optional[str], allowed_from: list[str]) -> Withdrawal:
        wd = self.db.query(Withdrawal).filter(Withdrawal.id == withdrawal_id).first()
        if not wd:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Withdrawal không tồn tại")
        if wd.status not in allowed_from:
            raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Không thể chuyển '{wd.status}' → '{new_status}'")
        wd.status = new_status
        wd.processed_by = admin.id
        wd.processed_at = utcnow()
        if new_status == "paid":
            wd.paid_at = utcnow()
        if note:
            wd.admin_note = note[:500]
        self.db.commit()
        self.db.refresh(wd)
        return wd

    def approve(self, admin: User, withdrawal_id: int, note: Optional[str] = None) -> Withdrawal:
        return self._action(admin, withdrawal_id, "approved", note, allowed_from=["pending"])

    def reject(self, admin: User, withdrawal_id: int, note: Optional[str] = None) -> Withdrawal:
        return self._action(admin, withdrawal_id, "rejected", note, allowed_from=["pending"])

    def mark_paid(self, admin: User, withdrawal_id: int, note: Optional[str] = None) -> Withdrawal:
        return self._action(admin, withdrawal_id, "paid", note, allowed_from=["approved"])

    def to_public(self, wd: Withdrawal, user: Optional[User] = None) -> dict:
        return {
            "id": wd.id,
            "user_id": wd.user_id,
            "user_full_name": user.full_name if user else None,
            "user_email": user.email if user else None,
            "amount_points": wd.amount_points,
            "amount_vnd": wd.amount_vnd,
            "bank_name": wd.bank_name,
            "bank_account_number": wd.bank_account_number,
            "bank_account_holder": wd.bank_account_holder,
            "status": wd.status,
            "note": wd.note,
            "admin_note": wd.admin_note,
            "requested_at": wd.requested_at,
            "processed_at": wd.processed_at,
            "paid_at": wd.paid_at,
        }


def get_wallet_service(db: Session) -> WalletService:
    return WalletService(db)
