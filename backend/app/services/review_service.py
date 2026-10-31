"""Review service — admin approve/reject annotation, auto-flag account."""
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import case, desc, func
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.core.storage import get_storage
from app.models import Annotation, Audio, Task, Project, Report, User
from app.services.allocation_service import AllocationService, REQUIRED_ANSWER_BY_TYPE

# Khi đánh giá kết quả, ngưỡng dưới đây sẽ flag user.
ERROR_RATE_FLAG_THRESHOLD = 0.30  # 30% rejection
MIN_REVIEWED_FOR_FLAG = 10        # cần tối thiểu 10 review trước khi flag


class ReviewService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---------- queries ----------
    def list_pending_for_admin(self, limit: int = 50, offset: int = 0) -> tuple[list[Annotation], int]:
        query = self.db.query(Annotation).filter(Annotation.review_status == "pending")
        total = query.count()
        items = query.order_by(Annotation.created_at.asc()).offset(offset).limit(limit).all()
        return items, total

    def list_pending_by_data(
        self,
        project_id: Optional[int] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Aggregate pending annotations by data (audio).

        Trả về list mỗi item = 1 audio với:
        - thông tin file + project
        - tasks_summary: per task_type → {total, pending, approved, rejected, consensus_rate}
        - pending_count: tổng pending của data đó
        """
        # Lấy danh sách audio_id có ít nhất 1 annotation pending
        pending_audio_q = (
            self.db.query(Annotation.task_id)
            .join(Task, Task.id == Annotation.task_id)
            .filter(Annotation.review_status == "pending")
        )
        if project_id is not None:
            pending_audio_q = pending_audio_q.filter(Task.project_id == project_id)

        pending_audio_ids = (
            self.db.query(Task.audio_id, func.count(Annotation.id).label("pending_count"))
            .join(Annotation, Annotation.task_id == Task.id)
            .filter(Annotation.review_status == "pending")
        )
        if project_id is not None:
            pending_audio_ids = pending_audio_ids.filter(Task.project_id == project_id)
        pending_audio_ids = pending_audio_ids.group_by(Task.audio_id)

        # Sort: nhiều pending trước
        pending_audio_ids = pending_audio_ids.order_by(desc("pending_count"))

        all_rows = pending_audio_ids.all()
        total = len(all_rows)
        page_rows = all_rows[offset:offset + limit]
        if not page_rows:
            return [], total

        audio_ids = [r[0] for r in page_rows]
        pending_count_by_audio = {r[0]: int(r[1]) for r in page_rows}

        # Load Audio + Project info
        audios = (
            self.db.query(Audio, Project)
            .join(Project, Project.id == Audio.project_id)
            .filter(Audio.id.in_(audio_ids))
            .all()
        )
        audio_map = {a.id: (a, p) for a, p in audios}

        # Load tất cả annotations cho các audio này, group theo (audio_id, task_type)
        ann_rows = (
            self.db.query(
                Task.audio_id,
                Task.task_type,
                Annotation,
            )
            .join(Annotation, Annotation.task_id == Task.id)
            .filter(Task.audio_id.in_(audio_ids))
            .all()
        )
        # bucket: {(audio_id, task_type): {"all": [Ann], "pending": int, "approved": int, "rejected": int}}
        bucket: dict[tuple[int, str], dict] = {}
        for audio_id, ttype, ann in ann_rows:
            key = (audio_id, ttype)
            slot = bucket.setdefault(key, {"all": [], "pending": 0, "approved": 0, "rejected": 0})
            slot["all"].append(ann)
            if ann.review_status == "pending":
                slot["pending"] += 1
            elif ann.review_status == "approved":
                slot["approved"] += 1
            elif ann.review_status == "rejected":
                slot["rejected"] += 1

        # Số task rows per (audio_id, task_type)
        task_counts = (
            self.db.query(Task.audio_id, Task.task_type, func.count(Task.id))
            .filter(Task.audio_id.in_(audio_ids))
            .group_by(Task.audio_id, Task.task_type)
            .all()
        )
        task_count_map = {(aid, tt): int(c) for aid, tt, c in task_counts}

        items: list[dict] = []
        for audio_id in audio_ids:
            if audio_id not in audio_map:
                continue
            audio, project = audio_map[audio_id]
            type_keys = sorted({tt for (aid, tt) in task_count_map.keys() if aid == audio_id})
            tasks_summary = []
            for tt in type_keys:
                stats = bucket.get((audio_id, tt), {"all": [], "pending": 0, "approved": 0, "rejected": 0})
                anns = stats["all"]
                # Consensus: tỉ lệ signature phổ biến nhất / tổng annotation
                if anns:
                    sig_counts: dict[str, int] = {}
                    for a in anns:
                        sig = AllocationService._answer_signature(a.answer)
                        sig_counts[sig] = sig_counts.get(sig, 0) + 1
                    max_count = max(sig_counts.values())
                    consensus_rate = max_count / len(anns)
                else:
                    consensus_rate = None
                tasks_summary.append({
                    "task_type": tt,
                    "total_tasks": task_count_map.get((audio_id, tt), 0),
                    "annotations_total": len(anns),
                    "annotations_pending": stats["pending"],
                    "annotations_approved": stats["approved"],
                    "annotations_rejected": stats["rejected"],
                    "consensus_rate": consensus_rate,
                })

            items.append({
                "audio_id": audio_id,
                "project_id": project.id,
                "project_name": project.name,
                "filename": audio.original_filename,
                "audio_url": get_storage().presigned_get(audio.minio_key) if audio.mime and audio.mime.startswith("audio/") else None,
                "pending_count": pending_count_by_audio.get(audio_id, 0),
                "task_types": tasks_summary,
            })
        return items, total

    def data_review_detail(self, audio_id: int) -> dict:
        """Drill-down: trả về tất cả task + annotation cho 1 audio, group theo task_type."""
        audio = self.db.query(Audio).filter(Audio.id == audio_id).first()
        if not audio:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Audio không tồn tại")
        project = self.db.query(Project).filter(Project.id == audio.project_id).first()

        # Load tất cả task + annotation cho audio
        tasks = self.db.query(Task).filter(Task.audio_id == audio_id).all()
        task_ids = [t.id for t in tasks]

        ann_user_rows = (
            self.db.query(Annotation, User)
            .join(User, User.id == Annotation.user_id)
            .filter(Annotation.task_id.in_(task_ids))
            .order_by(Annotation.created_at.asc())
            .all()
        ) if task_ids else []

        # group annotation by task_id
        ann_by_task: dict[int, list[tuple[Annotation, User]]] = {}
        for ann, user in ann_user_rows:
            ann_by_task.setdefault(ann.task_id, []).append((ann, user))

        # group task by task_type
        groups: dict[str, list[Task]] = {}
        for t in tasks:
            groups.setdefault(t.task_type, []).append(t)

        out_groups = []
        for ttype, tlist in groups.items():
            task_items = []
            for t in tlist:
                anns = ann_by_task.get(t.id, [])
                task_items.append({
                    "task_id": t.id,
                    "payload": t.payload or {},
                    "is_golden": bool(t.is_golden),
                    "parent_task_id": t.parent_task_id,
                    "annotations": [
                        {
                            "id": a.id,
                            "user_id": u.id,
                            "user_email": u.email,
                            "user_full_name": u.full_name,
                            "answer": a.answer,
                            "review_status": a.review_status,
                            "review_note": a.review_note,
                            "score_awarded": int(a.score_awarded or 0),
                            "low_engagement": bool(a.low_engagement),
                            "is_golden_check": bool(a.is_golden_check),
                            "time_spent_ms": a.time_spent_ms,
                            "audio_listened_sec": a.audio_listened_sec,
                            "audio_play_count": a.audio_play_count,
                            "created_at": a.created_at.isoformat() if a.created_at else None,
                        }
                        for a, u in anns
                    ],
                })
            out_groups.append({
                "task_type": ttype,
                "tasks": task_items,
            })

        return {
            "audio_id": audio.id,
            "project_id": project.id if project else None,
            "project_name": project.name if project else None,
            "filename": audio.original_filename,
            "audio_url": get_storage().presigned_get(audio.minio_key) if audio.mime and audio.mime.startswith("audio/") else None,
            "groups": out_groups,
        }

    def list_for_user(
        self,
        user: User,
        review_status: Optional[str] = None,
        project_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Annotation], int]:
        query = self.db.query(Annotation).filter(Annotation.user_id == user.id)
        if review_status:
            query = query.filter(Annotation.review_status == review_status)
        if project_id:
            query = query.filter(Annotation.project_id == project_id)
        total = query.count()
        items = query.order_by(Annotation.created_at.desc()).offset(offset).limit(limit).all()
        return items, total

    def user_score_summary(self, user: User) -> dict:
        rows = (
            self.db.query(
                Annotation.review_status,
                func.count(Annotation.id).label("count"),
                func.coalesce(func.sum(Annotation.score_awarded), 0).label("score"),
            )
            .filter(Annotation.user_id == user.id)
            .group_by(Annotation.review_status)
            .all()
        )
        out = {
            "score_pending": 0,
            "score_confirmed": 0,
            "score_rejected": 0,
            "count_pending": 0,
            "count_approved": 0,
            "count_rejected": 0,
        }
        for status_, count, score in rows:
            if status_ == "pending":
                out["score_pending"] = int(score)
                out["count_pending"] = int(count)
            elif status_ == "approved":
                out["score_confirmed"] = int(score)
                out["count_approved"] = int(count)
            elif status_ == "rejected":
                out["score_rejected"] = int(score)
                out["count_rejected"] = int(count)

        # Cộng thêm điểm từ approved reports
        report_rows = (
            self.db.query(Report.status, func.count(Report.id), func.coalesce(func.sum(Report.score_awarded), 0))
            .filter(Report.user_id == user.id)
            .group_by(Report.status)
            .all()
        )
        for status_, count, score in report_rows:
            if status_ == "approved":
                out["score_confirmed"] += int(score)
                out["count_approved"] += int(count)
            elif status_ == "rejected":
                # report rejected không tính lỗi (annotator không có ý gian lận khi report)
                pass

        reviewed = out["count_approved"] + out["count_rejected"]
        out["error_rate"] = (out["count_rejected"] / reviewed) if reviewed > 0 else 0.0
        out["count_reviewed"] = reviewed
        out["account_status"] = user.account_status
        return out

    def list_flagged_users(self) -> list[tuple[User, dict]]:
        users = self.db.query(User).filter(User.account_status == "under_review").all()
        return [(u, self.user_score_summary(u)) for u in users]

    def admin_overview(self) -> dict:
        """Stats cho tab Tổng quan của admin."""
        now = utcnow()
        today_start = datetime(now.year, now.month, now.day)
        week_ago = now - timedelta(days=7)

        # Annotators by account_status (chỉ tính role='annotator')
        annotator_rows = (
            self.db.query(
                User.account_status,
                func.count(User.id),
            )
            .filter(User.role == "annotator")
            .group_by(User.account_status)
            .all()
        )
        annotators = {"active": 0, "under_review": 0, "suspended": 0}
        for s, c in annotator_rows:
            if s in annotators:
                annotators[s] = int(c)
        total_annotators = sum(annotators.values())

        # Annotations: tổng + theo review_status + new today/last 7d
        ann_status_rows = (
            self.db.query(
                Annotation.review_status,
                func.count(Annotation.id),
            )
            .group_by(Annotation.review_status)
            .all()
        )
        ann_by_status = {"pending": 0, "approved": 0, "rejected": 0}
        for s, c in ann_status_rows:
            if s in ann_by_status:
                ann_by_status[s] = int(c)
        total_annotations = sum(ann_by_status.values())

        new_today = (
            self.db.query(func.count(Annotation.id))
            .filter(Annotation.created_at >= today_start)
            .scalar()
        ) or 0
        new_last_7d = (
            self.db.query(func.count(Annotation.id))
            .filter(Annotation.created_at >= week_ago)
            .scalar()
        ) or 0

        # Active annotators in last 7d (có submit annotation gần đây)
        active_last_7d = (
            self.db.query(func.count(func.distinct(Annotation.user_id)))
            .filter(Annotation.created_at >= week_ago)
            .scalar()
        ) or 0

        # Top 5 annotators theo điểm chính thức (approved)
        per_user = (
            self.db.query(
                Annotation.user_id.label("uid"),
                func.coalesce(
                    func.sum(case((Annotation.review_status == "approved", Annotation.score_awarded), else_=0)),
                    0,
                ).label("score_confirmed"),
                func.sum(case((Annotation.review_status == "approved", 1), else_=0)).label("count_approved"),
                func.sum(case((Annotation.review_status == "rejected", 1), else_=0)).label("count_rejected"),
            )
            .group_by(Annotation.user_id)
            .subquery()
        )
        top_rows = (
            self.db.query(
                User.id,
                User.full_name,
                per_user.c.score_confirmed,
                per_user.c.count_approved,
                per_user.c.count_rejected,
            )
            .join(per_user, per_user.c.uid == User.id)
            .filter(User.role == "annotator")
            .order_by(desc(per_user.c.score_confirmed), desc(per_user.c.count_approved))
            .limit(5)
            .all()
        )
        top_annotators = []
        for uid, full_name, score, n_appr, n_rej in top_rows:
            reviewed_user = int(n_appr or 0) + int(n_rej or 0)
            accuracy = (int(n_appr or 0) / reviewed_user) if reviewed_user > 0 else 0.0
            top_annotators.append({
                "user_id": int(uid),
                "full_name": full_name,
                "score_confirmed": int(score or 0),
                "count_approved": int(n_appr or 0),
                "count_reviewed": reviewed_user,
                "accuracy": accuracy,
            })

        return {
            "total_annotators": total_annotators,
            "annotators_active": annotators["active"],
            "annotators_under_review": annotators["under_review"],
            "annotators_suspended": annotators["suspended"],
            "annotators_active_last_7d": int(active_last_7d),
            "total_annotations": total_annotations,
            "annotations_pending": ann_by_status["pending"],
            "annotations_approved": ann_by_status["approved"],
            "annotations_rejected": ann_by_status["rejected"],
            "annotations_new_today": int(new_today),
            "annotations_new_last_7d": int(new_last_7d),
            "top_annotators": top_annotators,
        }

    # ---------- mutations ----------
    def review(
        self,
        admin: User,
        annotation_id: int,
        approve: bool,
        note: Optional[str] = None,
    ) -> Annotation:
        ann = self.db.query(Annotation).filter(Annotation.id == annotation_id).first()
        if not ann:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Annotation không tồn tại")
        if ann.review_status != "pending":
            raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Annotation đã '{ann.review_status}'")

        ann.review_status = "approved" if approve else "rejected"
        ann.reviewed_by = admin.id
        ann.reviewed_at = utcnow()
        if note:
            ann.review_note = note[:500]
        if not approve:
            # Rejected → score thực = 0 (clawback)
            ann.score_awarded = 0
        self.db.commit()
        self.db.refresh(ann)

        # Auto-flag chủ annotation nếu error rate cao
        self._check_auto_flag(ann.user_id)
        return ann

    def _check_auto_flag(self, user_id: int) -> None:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user or user.role != "annotator":
            return
        if user.account_status == "suspended":
            return  # đã bị khoá hoàn toàn

        summary = self.user_score_summary(user)
        if summary["count_reviewed"] >= MIN_REVIEWED_FOR_FLAG and summary["error_rate"] >= ERROR_RATE_FLAG_THRESHOLD:
            if user.account_status != "under_review":
                user.account_status = "under_review"
                self.db.commit()
        elif user.account_status == "under_review" and summary["error_rate"] < ERROR_RATE_FLAG_THRESHOLD:
            # Tự động unflag nếu accuracy phục hồi
            user.account_status = "active"
            self.db.commit()

    # ---------- relabel pending ----------
    def _get_pending_owned(self, user: User, annotation_id: int) -> Annotation:
        ann = self.db.query(Annotation).filter(Annotation.id == annotation_id).first()
        if not ann or ann.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Annotation không tồn tại")
        if ann.review_status == "rejected":
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Annotation đã bị từ chối, không thể sửa lại",
            )
        if ann.review_status == "approved":
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Annotation đã được duyệt, không thể sửa lại",
            )
        return ann

    def get_relabel_context(self, user: User, annotation_id: int) -> dict:
        ann = self._get_pending_owned(user, annotation_id)
        audio = self.db.query(Task).filter(Task.id == ann.task_id).first()
        if not audio:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task không tồn tại")
        return {
            "annotation_id": ann.id,
            "audio_url": get_storage().presigned_get(audio.minio_key),
            "audio_filename": audio.original_filename,
            "task_type": ann.task_type,
            "payload": dict(audio.payload or {}),
            "current_answer": dict(ann.answer or {}),
        }

    def update_pending(
        self,
        user: User,
        annotation_id: int,
        new_answer: dict[str, Any],
        time_spent_ms: Optional[int] = None,
        audio_listened_sec: Optional[float] = None,
        audio_play_count: Optional[int] = None,
    ) -> Annotation:
        # Block account đang bị suspended/under_review
        if user.account_status in {"suspended", "under_review"}:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đang được review — không thể sửa annotation",
            )

        ann = self._get_pending_owned(user, annotation_id)

        validator = REQUIRED_ANSWER_BY_TYPE.get(ann.task_type)
        if not validator or not validator(new_answer):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Answer không hợp lệ cho task '{ann.task_type}'",
            )

        # Anti-exploit: KHÔNG recompute score / low_engagement.
        # Lần submit đầu đã quyết định score; relabel chỉ là chỉnh nội dung answer.
        # Behavior signals: cộng dồn (time) và max (listened) thay vì replace
        # — tránh user gửi giá trị fake để xoá flag low_engagement.
        ann.answer = new_answer
        if time_spent_ms is not None:
            ann.time_spent_ms = (ann.time_spent_ms or 0) + time_spent_ms
        if audio_listened_sec is not None:
            ann.audio_listened_sec = max(ann.audio_listened_sec or 0.0, float(audio_listened_sec))
        if audio_play_count is not None:
            ann.audio_play_count = (ann.audio_play_count or 0) + audio_play_count
        # score_awarded + low_engagement giữ nguyên giá trị từ submit đầu.
        self.db.commit()
        self.db.refresh(ann)
        return ann

    def set_account_status(self, admin: User, user_id: int, new_status: str) -> User:
        if new_status not in {"active", "under_review", "suspended"}:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Trạng thái không hợp lệ")
        target = self.db.query(User).filter(User.id == user_id).first()
        if not target:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User không tồn tại")
        target.account_status = new_status
        self.db.commit()
        self.db.refresh(target)
        return target


def get_review_service(db: Session) -> ReviewService:
    return ReviewService(db)
