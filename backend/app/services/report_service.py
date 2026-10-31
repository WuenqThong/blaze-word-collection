"""Service quản lý report của annotator."""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.models import Annotation, Assignment, Task, Project, Report, User
from app.schemas.report import ReportRequest


class ReportService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---------- annotator ----------
    def create_report(
        self,
        user: User,
        assignment_id: int,
        payload: ReportRequest,
    ) -> Report:
        if user.account_status in {"suspended", "under_review"}:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đang được review — không thể report",
            )

        a = self.db.query(Assignment).filter(Assignment.id == assignment_id).first()
        if not a or a.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assignment không tồn tại")
        if a.status != "active":
            raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Assignment đã '{a.status}'")

        # Không cho double-report cùng audio
        existing = (
            self.db.query(Report)
            .filter(Report.user_id == user.id, Report.task_id == a.task_id)
            .first()
        )
        if existing:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Bạn đã report audio này rồi")

        # Không cho report nếu đã annotate audio đó
        already = (
            self.db.query(Annotation)
            .filter(Annotation.user_id == user.id, Annotation.task_id == a.task_id)
            .first()
        )
        if already:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Bạn đã gán annotation cho audio này",
            )

        report = Report(
            user_id=user.id,
            project_id=a.project_id,
            task_id=a.task_id,
            assignment_id=a.id,
            reason=payload.reason,
            description=payload.description,
            status="pending",
        )
        self.db.add(report)

        # Release assignment để audio quay về pool (user khác có thể nhận)
        a.status = "released"
        a.released_at = utcnow()

        self.db.commit()
        self.db.refresh(report)
        return report

    def list_for_user(self, user: User, limit: int = 100) -> list[Report]:
        return (
            self.db.query(Report)
            .filter(Report.user_id == user.id)
            .order_by(Report.created_at.desc())
            .limit(limit)
            .all()
        )

    # ---------- score helpers ----------
    @staticmethod
    def total_score_for_user(db: Session, user_id: int, status_: str) -> int:
        return int(
            db.query(func.coalesce(func.sum(Report.score_awarded), 0))
            .filter(Report.user_id == user_id, Report.status == status_)
            .scalar() or 0
        )

    @staticmethod
    def count_for_user(db: Session, user_id: int, status_: str) -> int:
        return int(
            db.query(func.count(Report.id))
            .filter(Report.user_id == user_id, Report.status == status_)
            .scalar() or 0
        )

    # ---------- admin ----------
    def list_for_admin(self, status_filter: Optional[str] = None, limit: int = 100) -> list[tuple[Report, User, Task]]:
        query = (
            self.db.query(Report, User, Task)
            .join(User, User.id == Report.user_id)
            .join(Task, Task.id == Report.task_id)
        )
        if status_filter:
            query = query.filter(Report.status == status_filter)
        return query.order_by(Report.created_at.desc()).limit(limit).all()

    def review(self, admin: User, report_id: int, approve: bool, note: Optional[str]) -> Report:
        rp = self.db.query(Report).filter(Report.id == report_id).first()
        if not rp:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Report không tồn tại")
        if rp.status != "pending":
            raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Report đã '{rp.status}'")

        rp.status = "approved" if approve else "rejected"
        rp.reviewed_by = admin.id
        rp.reviewed_at = utcnow()
        if note:
            rp.admin_note = note[:500]

        if approve:
            # Approved → award điểm = scoring của task type
            audio = self.db.query(Task).filter(Task.id == rp.task_id).first()
            project = self.db.query(Project).filter(Project.id == rp.project_id).first()
            if audio and project:
                rp.score_awarded = int((project.scoring or {}).get(audio.task_type, 0))

        self.db.commit()
        self.db.refresh(rp)
        return rp

    def to_public(self, rp: Report, user: Optional[User] = None, audio: Optional[Task] = None) -> dict:
        return {
            "id": rp.id,
            "user_id": rp.user_id,
            "user_full_name": user.full_name if user else None,
            "user_email": user.email if user else None,
            "project_id": rp.project_id,
            "task_id": rp.task_id,
            "audio_filename": audio.original_filename if audio else None,
            "reason": rp.reason,
            "description": rp.description,
            "status": rp.status,
            "score_awarded": rp.score_awarded,
            "admin_note": rp.admin_note,
            "reviewed_at": rp.reviewed_at,
            "created_at": rp.created_at,
        }


def get_report_service(db: Session) -> ReportService:
    return ReportService(db)
