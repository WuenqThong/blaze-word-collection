"""Engine phân bổ task cho annotator.

Strategy: weighted least-loaded with TTL lock.

- Mỗi user có tối đa 1 active assignment / project tại một thời điểm.
- Task được chọn theo: chưa được user này annotate, còn slot redundancy
  (active+completed < project.redundancy), ưu tiên audio đã có người gán dở
  (gần đủ redundancy → tăng throughput), tie-break random.
- Lock TTL mặc định 10 phút; sweep expired locks trước khi serve task.
"""
import random
from app.core.database import utcnow
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.storage import get_storage
from app.models import Annotation, Assignment, Task, Project, ProjectMember, User
from app.schemas.annotation import SubmitAnnotationRequest

settings = get_settings()

LOCK_TTL_MIN = 10
TASK_POOL_SAMPLE = 20  # số candidate audio xét trước khi pick


REQUIRED_ANSWER_BY_TYPE: dict[str, callable] = {
    "audio_label": lambda a: bool((a or {}).get("text", "").strip()),
    "audio_verify": lambda a: (a or {}).get("verdict") in {"correct", "incorrect"},
    "qa": lambda a: (
        bool((a or {}).get("text", "").strip())
        or bool((a or {}).get("option", "").strip())
        or bool((a or {}).get("audio_key", "").strip())
    ),
}


class AllocationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---------- helpers ----------
    def _sweep_expired(self) -> None:
        now = utcnow()
        expired = (
            self.db.query(Assignment)
            .filter(Assignment.status == "active", Assignment.expires_at < now)
            .all()
        )
        for a in expired:
            a.status = "expired"
            a.released_at = now
        if expired:
            self.db.commit()

    def _assert_can_access(self, project: Project, user: User) -> None:
        if user.role == "admin":
            return
        if project.visibility == "public":
            return
        ok = (
            self.db.query(ProjectMember)
            .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == user.id)
            .first()
        )
        if not ok:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Không thuộc project này")

    def _get_active(self, user: User, project: Project) -> Optional[Assignment]:
        return (
            self.db.query(Assignment)
            .filter(
                Assignment.user_id == user.id,
                Assignment.project_id == project.id,
                Assignment.status == "active",
            )
            .order_by(Assignment.locked_at.desc())
            .first()
        )

    def _user_progress(self, user: User, project: Project) -> dict[str, int]:
        done = (
            self.db.query(func.count(Annotation.id))
            .filter(Annotation.project_id == project.id, Annotation.user_id == user.id)
            .scalar()
            or 0
        )
        total = (
            self.db.query(func.count(Task.id))
            .filter(Task.project_id == project.id, Task.status == "ready")
            .scalar()
            or 0
        )
        return {"done": int(done), "total": int(total)}

    def _user_score(self, user: User, project: Project) -> int:
        return int(
            self.db.query(func.coalesce(func.sum(Annotation.score_awarded), 0))
            .filter(Annotation.project_id == project.id, Annotation.user_id == user.id)
            .scalar()
            or 0
        )

    @staticmethod
    def _answer_signature(answer: Optional[dict]) -> str:
        """Chuẩn hoá answer JSON thành chuỗi để so sánh đồng thuận."""
        if not answer:
            return ""
        for field in ("verdict", "option"):
            v = answer.get(field)
            if isinstance(v, str) and v.strip():
                return f"{field}:{v.strip().lower()}"
        text = answer.get("text")
        if isinstance(text, str) and text.strip():
            return f"text:{text.strip().lower()}"
        return str(sorted((answer or {}).items()))

    def _detect_disagreement(self, task_ids: list[int]) -> set[int]:
        """Trả về set task_id mà các annotation primary có ≥2 signature khác nhau."""
        if not task_ids:
            return set()
        rows = (
            self.db.query(Annotation.task_id, Annotation.answer)
            .filter(
                Annotation.task_id.in_(task_ids),
                Annotation.is_repeat_check == False,  # noqa: E712
            )
            .all()
        )
        by_audio: dict[int, set[str]] = {}
        for task_id, answer in rows:
            sig = self._answer_signature(answer)
            by_audio.setdefault(task_id, set()).add(sig)
        return {aid for aid, sigs in by_audio.items() if len(sigs) > 1}

    # ---------- public API ----------
    def get_global_next(
        self,
        user: User,
        task_type: Optional[str] = None,
    ) -> tuple[Optional[Assignment], Optional[Task], Optional[Project]]:
        """Random một task từ bất cứ project nào user có quyền truy cập."""
        if getattr(user, "account_status", "active") in {"suspended", "under_review"}:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đang được review — tạm thời không thể nhận task mới",
            )

        self._sweep_expired()

        # 1. Resume active assignment của user (project nào không quan trọng)
        # Nhưng nếu user đang lọc theo task_type và active assignment không khớp
        # thì release nó và tìm task mới phù hợp với filter.
        active = (
            self.db.query(Assignment)
            .filter(Assignment.user_id == user.id, Assignment.status == "active")
            .order_by(Assignment.locked_at.desc())
            .first()
        )
        if active:
            audio = self.db.query(Task).filter(Task.id == active.task_id).first()
            project = self.db.query(Project).filter(Project.id == active.project_id).first()
            if audio and project:
                if task_type and audio.task_type != task_type:
                    active.status = "released"
                    active.released_at = utcnow()
                    self.db.commit()
                else:
                    return active, audio, project
            else:
                active.status = "released"
                active.released_at = utcnow()
                self.db.commit()

        # 2. Lấy danh sách project user có quyền + đang active
        if user.role == "admin":
            accessible_projects = self.db.query(Project).filter(Project.status == "active").all()
        else:
            member_ids = {
                row.project_id for row in
                self.db.query(ProjectMember.project_id).filter(ProjectMember.user_id == user.id).all()
            }
            accessible_projects = (
                self.db.query(Project)
                .filter(
                    Project.status == "active",
                    (Project.visibility == "public") | (Project.id.in_(member_ids)),
                )
                .all()
            )

        # 3. Filter project theo task_type nếu có yêu cầu
        if task_type:
            accessible_projects = [p for p in accessible_projects if task_type in (p.task_types or [])]
        random.shuffle(accessible_projects)
        # Khi user chọn "Ngẫu nhiên" (không filter task_type), dùng priority-based
        # selection: ưu tiên audio chưa label → audio bất đồng thuận → còn lại.
        prioritize_random = task_type is None
        for project in accessible_projects:
            assignment, audio = self._try_assign_in(
                project, user, task_type=task_type, prioritize_random=prioritize_random,
            )
            if assignment and audio:
                return assignment, audio, project
        return None, None, None

    def _try_assign_in(
        self,
        project: Project,
        user: User,
        task_type: Optional[str] = None,
        prioritize_random: bool = False,
    ) -> tuple[Optional[Assignment], Optional[Task]]:
        """Pick & lock 1 audio trong project (helper dùng chung).

        Khi `prioritize_random=True` (random/ngẫu nhiên mode), thay vì heuristic
        gần-đủ-redundancy, dùng tiered selection:
            T1. Task chưa có annotation nào (done_n == 0)
            T2. Task đang có bất đồng thuận giữa các annotation hiện có
            T3. Còn lại
        Random trong tier đầu tiên có ứng viên.
        """
        from app.services.audio_service import REQUIRED_BY_TASK_TYPE

        def _ready(audio: Task) -> bool:
            required = REQUIRED_BY_TASK_TYPE.get(audio.task_type, [])
            payload = audio.payload or {}
            return all(payload.get(f) not in (None, "") for f in required)

        allowed_types = [task_type] if task_type else (project.task_types or [])

        # Quay xúc xắc: với xác suất repeat_ratio, thử serve 1 audio user đã annotate
        # để check consistency (vẫn được tính điểm, không tính vào redundancy).
        repeat_ratio = float(getattr(project, "repeat_ratio", 0.0) or 0.0)
        if repeat_ratio > 0 and random.random() < repeat_ratio:
            assignment, audio = self._try_assign_repeat(project, user, allowed_types, _ready)
            if assignment and audio:
                return assignment, audio
            # Không có ứng viên repeat → fallthrough về flow thường

        active_q = (
            self.db.query(Assignment.task_id, func.count(Assignment.id).label("active_n"))
            .filter(Assignment.status == "active")
            .group_by(Assignment.task_id)
            .subquery()
        )
        # Chỉ đếm primary annotations (không phải repeat-check) cho redundancy
        done_q = (
            self.db.query(Annotation.task_id, func.count(Annotation.id).label("done_n"))
            .filter(Annotation.is_repeat_check == False)  # noqa: E712
            .group_by(Annotation.task_id)
            .subquery()
        )
        already_done = (
            self.db.query(Annotation.task_id)
            .filter(Annotation.user_id == user.id, Annotation.project_id == project.id)
            .subquery()
        )
        already_locked_by_me = (
            self.db.query(Assignment.task_id)
            .filter(Assignment.user_id == user.id, Assignment.status.in_(("active", "completed")))
            .subquery()
        )
        rows = (
            self.db.query(Task, func.coalesce(active_q.c.active_n, 0), func.coalesce(done_q.c.done_n, 0))
            .outerjoin(active_q, active_q.c.task_id == Task.id)
            .outerjoin(done_q, done_q.c.task_id == Task.id)
            .filter(
                Task.project_id == project.id,
                Task.status == "ready",
                Task.task_type.in_(allowed_types),
                ~Task.id.in_(self.db.query(already_done.c.task_id)),
                ~Task.id.in_(self.db.query(already_locked_by_me.c.task_id)),
            )
            .all()
        )

        candidates = [
            (a, an, dn) for (a, an, dn) in rows
            if (an + dn) < project.redundancy and _ready(a)
        ]
        if not candidates:
            return None, None

        # Loại trừ derived audio (audio_verify spawn từ audio_label) mà user
        # đã annotate audio gốc — không tự verify label của chính mình.
        parent_ids = {c[0].parent_task_id for c in candidates if c[0].parent_task_id}
        if parent_ids:
            annotated_parents = {
                row[0] for row in
                self.db.query(Annotation.task_id)
                .filter(
                    Annotation.user_id == user.id,
                    Annotation.task_id.in_(parent_ids),
                    Annotation.is_repeat_check == False,  # noqa: E712
                )
                .all()
            }
            if annotated_parents:
                candidates = [
                    c for c in candidates
                    if c[0].parent_task_id is None
                    or c[0].parent_task_id not in annotated_parents
                ]
                if not candidates:
                    return None, None

        if prioritize_random:
            # Tier 1: chưa có annotation primary nào
            untouched = [t for t in candidates if t[2] == 0]
            if untouched:
                pool = untouched[:TASK_POOL_SAMPLE]
            else:
                # Tier 2: đã có ≥2 annotation và bất đồng thuận
                multi_ids = [t[0].id for t in candidates if t[2] >= 2]
                disagree_ids = self._detect_disagreement(multi_ids)
                disagree_pool = [t for t in candidates if t[0].id in disagree_ids]
                if disagree_pool:
                    pool = disagree_pool[:TASK_POOL_SAMPLE]
                else:
                    # Tier 3: random từ tất cả candidates
                    random.shuffle(candidates)
                    pool = candidates[:TASK_POOL_SAMPLE]
            audio, _, _ = random.choice(pool)
        else:
            # Heuristic mặc định (project-specific): ưu tiên gần-đủ-redundancy
            candidates.sort(key=lambda t: (-(t[1] + t[2]), t[0].id))
            pool = candidates[:TASK_POOL_SAMPLE]
            audio, _, _ = random.choice(pool)
        now = utcnow()
        assignment = Assignment(
            task_id=audio.id,
            project_id=project.id,
            user_id=user.id,
            status="active",
            locked_at=now,
            expires_at=now + timedelta(minutes=LOCK_TTL_MIN),
        )
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment, audio

    def _try_assign_repeat(
        self,
        project: Project,
        user: User,
        allowed_types: list[str],
        ready_fn,
    ) -> tuple[Optional[Assignment], Optional[Task]]:
        """Tìm 1 audio user đã có 1 primary annotation, chưa có repeat-check, để re-serve."""
        # Audios user đã annotate (primary) trong project
        primary_task_ids = {
            row[0] for row in
            self.db.query(Annotation.task_id)
            .filter(
                Annotation.user_id == user.id,
                Annotation.project_id == project.id,
                Annotation.is_repeat_check == False,  # noqa: E712
            )
            .all()
        }
        if not primary_task_ids:
            return None, None

        # Loại trừ những audio đã có repeat-check (mỗi audio max 1 repeat / user)
        already_rechecked = {
            row[0] for row in
            self.db.query(Annotation.task_id)
            .filter(
                Annotation.user_id == user.id,
                Annotation.project_id == project.id,
                Annotation.is_repeat_check == True,  # noqa: E712
            )
            .all()
        }
        # Loại trừ audio đang lock active hoặc completed bởi user
        locked_ids = {
            row[0] for row in
            self.db.query(Assignment.task_id)
            .filter(
                Assignment.user_id == user.id,
                Assignment.status.in_(("active", "completed")),
            )
            .all()
        }
        candidate_ids = (primary_task_ids - already_rechecked) - locked_ids
        if not candidate_ids:
            return None, None

        tasks = (
            self.db.query(Task)
            .filter(
                Task.id.in_(candidate_ids),
                Task.status == "ready",
                Task.task_type.in_(allowed_types),
            )
            .all()
        )
        ready_audios = [a for a in tasks if ready_fn(a)]
        if not ready_audios:
            return None, None
        audio = random.choice(ready_audios)
        now = utcnow()
        assignment = Assignment(
            task_id=audio.id,
            project_id=project.id,
            user_id=user.id,
            status="active",
            locked_at=now,
            expires_at=now + timedelta(minutes=LOCK_TTL_MIN),
        )
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment, audio

    def get_or_assign_next(self, user: User, project: Project) -> tuple[Optional[Assignment], Optional[Task]]:
        self._assert_can_access(project, user)
        if getattr(user, "account_status", "active") in {"suspended", "under_review"}:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đang được review — tạm thời không thể nhận task mới",
            )
        if project.status != "active":
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Project chưa active — chưa thể nhận task",
            )

        self._sweep_expired()
        active = self._get_active(user, project)
        if active:
            audio = self.db.query(Task).filter(Task.id == active.task_id).first()
            if audio:
                return active, audio
            active.status = "released"
            active.released_at = utcnow()
            self.db.commit()

        return self._try_assign_in(project, user)

    def submit(
        self,
        user: User,
        assignment_id: int,
        payload: SubmitAnnotationRequest,
    ) -> tuple[Annotation, Task, Project]:
        if getattr(user, "account_status", "active") in {"suspended", "under_review"}:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đang được review — không thể submit annotation",
            )

        a = self.db.query(Assignment).filter(Assignment.id == assignment_id).first()
        if not a or a.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assignment không tồn tại")
        if a.status != "active":
            raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Assignment đã '{a.status}'")
        if a.expires_at < utcnow():
            a.status = "expired"
            a.released_at = utcnow()
            self.db.commit()
            raise HTTPException(status.HTTP_410_GONE, detail="Lock đã hết hạn, hãy nhận task mới")

        audio = self.db.query(Task).filter(Task.id == a.task_id).first()
        project = self.db.query(Project).filter(Project.id == a.project_id).first()
        if not audio or not project:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task/project không tồn tại")

        # Validate answer theo task type
        validator = REQUIRED_ANSWER_BY_TYPE.get(audio.task_type)
        if not validator or not validator(payload.answer):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Answer không hợp lệ cho task '{audio.task_type}'",
            )

        # Behavior signals
        low_engagement = False
        if audio.duration_sec and payload.audio_listened_sec is not None:
            if payload.audio_listened_sec < audio.duration_sec * 0.5:
                low_engagement = True
        if payload.time_spent_ms is not None and payload.time_spent_ms < 2000:
            low_engagement = True

        # Score
        base_score = int((project.scoring or {}).get(audio.task_type, 0))
        score = 0 if low_engagement else base_score

        # Golden: phần golden_correct sẽ làm ở Sprint 4 cùng với accuracy tracking
        is_golden = bool(audio.is_golden)

        # Repeat-check: user đã có primary annotation cho audio này → đây là lần lặp lại
        is_repeat = (
            self.db.query(Annotation.id)
            .filter(
                Annotation.user_id == user.id,
                Annotation.task_id == audio.id,
                Annotation.is_repeat_check == False,  # noqa: E712
            )
            .first()
            is not None
        )

        ann = Annotation(
            assignment_id=a.id,
            task_id=audio.id,
            project_id=project.id,
            user_id=user.id,
            task_type=audio.task_type,
            answer=payload.answer,
            time_spent_ms=payload.time_spent_ms,
            audio_listened_sec=payload.audio_listened_sec,
            audio_play_count=payload.audio_play_count,
            is_golden_check=is_golden,
            is_repeat_check=is_repeat,
            low_engagement=low_engagement,
            score_awarded=score,
        )
        self.db.add(ann)

        a.status = "completed"
        a.released_at = utcnow()
        self.db.commit()
        self.db.refresh(ann)

        # Spawn audio_verify từ một label vừa submit để các annotator khác xác
        # nhận. Chỉ spawn khi: (1) task gốc là audio_label, (2) project có
        # audio_verify trong task_types, (3) đây không phải repeat-check, (4)
        # answer.text non-empty, (5) annotation này không phải verify spawn từ
        # audio đã derive (tránh chuỗi spawn vô hạn).
        if (
            audio.task_type == "audio_label"
            and not is_repeat
            and "audio_verify" in (project.task_types or [])
            and audio.parent_task_id is None
        ):
            text_label = (payload.answer or {}).get("text", "")
            if isinstance(text_label, str) and text_label.strip():
                self._spawn_verify_audio(audio, project, ann, text_label.strip())

        return ann, audio, project

    def _spawn_verify_audio(
        self,
        parent: Task,
        project: Project,
        source_ann: Annotation,
        suggested_label: str,
    ) -> Task:
        """Tạo derived Task task_type=audio_verify dùng chung audio file với parent."""
        derived = Task(
            project_id=project.id,
            audio_id=parent.audio_id,
            task_type="audio_verify",
            payload={"suggested_label": suggested_label},
            is_golden=False,
            status="ready",
            parent_task_id=parent.id,
            source_annotation_id=source_ann.id,
        )
        self.db.add(derived)
        self.db.commit()
        self.db.refresh(derived)
        return derived

    def submit_voice(
        self,
        user: User,
        assignment_id: int,
        audio_bytes: bytes,
        mime: str,
        time_spent_ms: Optional[int] = None,
        audio_listened_sec: Optional[float] = None,
        audio_play_count: Optional[int] = None,
    ) -> tuple[Annotation, Task, Project]:
        """Submit annotation cho qa task — answer là file audio user record."""
        if getattr(user, "account_status", "active") in {"suspended", "under_review"}:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đang được review — không thể submit",
            )

        a = self.db.query(Assignment).filter(Assignment.id == assignment_id).first()
        if not a or a.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assignment không tồn tại")
        if a.status != "active":
            raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Assignment đã '{a.status}'")
        if a.expires_at < utcnow():
            a.status = "expired"
            a.released_at = utcnow()
            self.db.commit()
            raise HTTPException(status.HTTP_410_GONE, detail="Lock đã hết hạn")

        audio = self.db.query(Task).filter(Task.id == a.task_id).first()
        project = self.db.query(Project).filter(Project.id == a.project_id).first()
        if not audio or not project:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task/project không tồn tại")
        if audio.task_type != "qa":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Submit voice chỉ áp dụng cho task qa",
            )
        if not audio_bytes:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Thiếu file audio")
        if len(audio_bytes) > 10 * 1024 * 1024:  # 10MB cap cho recording
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Task quá lớn (>10MB)")

        # Lưu audio vào MinIO
        from io import BytesIO
        ext = "webm" if "webm" in mime else "ogg" if "ogg" in mime else "wav"
        key = f"annotations/{project.id}/{a.id}-{user.id}.{ext}"
        get_storage().put_object(key, BytesIO(audio_bytes), len(audio_bytes), mime or "audio/webm")

        # Behavior signals
        low_engagement = False
        if audio.duration_sec and audio_listened_sec is not None:
            if audio_listened_sec < audio.duration_sec * 0.5:
                low_engagement = True
        if time_spent_ms is not None and time_spent_ms < 2000:
            low_engagement = True

        base_score = int((project.scoring or {}).get("qa", 0))
        score = 0 if low_engagement else base_score

        ann = Annotation(
            assignment_id=a.id,
            task_id=audio.id,
            project_id=project.id,
            user_id=user.id,
            task_type="qa",
            answer={"audio_key": key, "mime": mime, "size_bytes": len(audio_bytes)},
            time_spent_ms=time_spent_ms,
            audio_listened_sec=audio_listened_sec,
            audio_play_count=audio_play_count,
            is_golden_check=bool(audio.is_golden),
            low_engagement=low_engagement,
            score_awarded=score,
        )
        self.db.add(ann)
        a.status = "completed"
        a.released_at = utcnow()
        self.db.commit()
        self.db.refresh(ann)
        return ann, audio, project

    def skip(self, user: User, assignment_id: int) -> None:
        a = self.db.query(Assignment).filter(Assignment.id == assignment_id).first()
        if not a or a.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assignment không tồn tại")
        if a.status != "active":
            return
        a.status = "released"
        a.released_at = utcnow()
        self.db.commit()

    # ---------- response builder ----------
    def build_next_task_response(
        self, user: User, project: Project, assignment: Optional[Assignment], audio: Optional[Task]
    ) -> dict:
        progress = self._user_progress(user, project)
        if not assignment or not audio:
            return {"has_task": False, "progress": progress}

        url = get_storage().presigned_get(audio.minio_key)
        return {
            "has_task": True,
            "assignment_id": assignment.id,
            "task_id": audio.id,
            "task_type": audio.task_type,
            "payload": dict(audio.payload or {}),
            "audio_url": url,
            "audio_filename": audio.original_filename,
            "expires_at": assignment.expires_at,
            "progress": progress,
            "project": {
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "scoring": dict(project.scoring or {}),
                "redundancy": project.redundancy,
            },
        }

    def project_stats(self, user: User, project: Project) -> dict:
        progress = self._user_progress(user, project)
        # Split score theo review_status
        rows = (
            self.db.query(Annotation.review_status, func.coalesce(func.sum(Annotation.score_awarded), 0))
            .filter(Annotation.user_id == user.id, Annotation.project_id == project.id)
            .group_by(Annotation.review_status)
            .all()
        )
        score_pending = score_confirmed = 0
        for status_, total in rows:
            if status_ == "pending":
                score_pending = int(total)
            elif status_ == "approved":
                score_confirmed = int(total)
        return {
            "annotated_count": progress["done"],
            "score_pending": score_pending,
            "score_confirmed": score_confirmed,
        }


def get_allocation_service(db: Session) -> AllocationService:
    return AllocationService(db)
