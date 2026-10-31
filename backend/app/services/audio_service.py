"""Business logic cho module Task."""
import io
import mimetypes
import uuid
from typing import Any, BinaryIO, Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.storage import ExternalSyncClient, StorageService
from app.models import Annotation, Audio, Task, Project, User
from app.schemas.audio import ExternalSyncRequest, ExternalSyncResponse

settings = get_settings()


REQUIRED_BY_TASK_TYPE: dict[str, list[str]] = {
    "audio_label": [],
    "audio_verify": ["suggested_label"],
    "qa": ["question"],
}

ALLOWED_AUDIO_MIME = {
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
    "audio/flac", "audio/ogg", "audio/webm", "audio/mp4", "audio/m4a",
    "audio/aac", "audio/x-m4a",
}


def _validate_payload(task_type: str, payload: dict[str, Any]) -> None:
    for f in REQUIRED_BY_TASK_TYPE.get(task_type, []):
        if f not in payload or payload[f] in (None, ""):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Task '{task_type}' yêu cầu trường '{f}' trong payload",
            )


class AudioService:
    def __init__(self, db: Session, storage: StorageService) -> None:
        self.db = db
        self.storage = storage

    # ---------- queries ----------
    def list_for_project(
        self,
        project_id: int,
        task_type: Optional[str] = None,
        status_filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Task], int]:
        query = self.db.query(Task).filter(Task.project_id == project_id)
        if task_type:
            query = query.filter(Task.task_type == task_type)
        if status_filter:
            query = query.filter(Task.status == status_filter)
        total = query.count()
        items = (
            query.order_by(Task.created_at.desc()).offset(offset).limit(limit).all()
        )
        return items, total

    def get_or_404(self, task_id: int) -> Task:
        a = self.db.query(Task).filter(Task.id == task_id).first()
        if not a:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Không tìm thấy audio")
        return a

    def annotator_counts(self, task_ids: list[int]) -> dict[int, int]:
        """Trả về số annotator distinct cho mỗi task_id (chỉ tính submission đầu, bỏ repeat-check)."""
        if not task_ids:
            return {}
        rows = (
            self.db.query(
                Annotation.task_id,
                func.count(func.distinct(Annotation.user_id)),
            )
            .filter(
                Annotation.task_id.in_(task_ids),
                Annotation.is_repeat_check.is_(False),
            )
            .group_by(Annotation.task_id)
            .all()
        )
        return {task_id: int(count) for task_id, count in rows}

    def list_annotators(self, task_id: int) -> list[tuple[Annotation, User]]:
        """Trả về danh sách (annotation, user) cho 1 audio, bỏ qua repeat-check."""
        rows = (
            self.db.query(Annotation, User)
            .join(User, User.id == Annotation.user_id)
            .filter(
                Annotation.task_id == task_id,
                Annotation.is_repeat_check.is_(False),
            )
            .order_by(Annotation.created_at.desc())
            .all()
        )
        return rows

    # ---------- mutations ----------
    def upload_one(
        self,
        project: Project,
        uploader: User,
        *,
        file: BinaryIO,
        filename: str,
        size_bytes: int,
        content_type: Optional[str],
        task_type: str,
        payload: dict[str, Any],
        is_golden: bool = False,
    ) -> Task:
        if task_type not in (project.task_types or []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Task type '{task_type}' chưa được bật cho project này. Hãy bật ở tab Task.",
            )
        if size_bytes > settings.max_audio_size_mb * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File vượt giới hạn {settings.max_audio_size_mb} MB",
            )
        mime = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
        if not mime.startswith("audio/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"MIME '{mime}' không phải audio",
            )
        # Không validate payload tại upload — payload sẽ được áp dụng qua CSV ở bước Prelabel.
        # Allocation service sẽ tự bỏ qua audio thiếu required field khi serve cho annotator.

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
        key = f"projects/{project.id}/{uuid.uuid4().hex}.{ext}"
        self.storage.put_object(key, file, size_bytes, mime)

        # 1. File metadata → Audio
        audio = Audio(
            project_id=project.id,
            minio_key=key,
            original_filename=filename,
            mime=mime,
            size_bytes=size_bytes,
            status="ready",
            uploaded_by=uploader.id,
        )
        self.db.add(audio)
        self.db.flush()
        # 2. Task wrapping that file
        task = Task(
            project_id=project.id,
            audio_id=audio.id,
            task_type=task_type,
            payload=payload or {},
            is_golden=is_golden,
            status="ready",
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def create_qa_from_questions(
        self,
        project: Project,
        uploader: User,
        *,
        questions: list[str],
        is_golden: bool = False,
    ) -> list[Task]:
        """Tạo các Task item dạng text-only QA (không có file âm thanh).

        Mỗi câu hỏi → 1 Task row với mime=text/plain, payload={question}.
        """
        if "qa" not in (project.task_types or []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task type 'qa' chưa được bật cho project này.",
            )
        created: list[Task] = []
        for q in questions:
            q = q.strip()
            if not q:
                continue
            key = f"text-qa/{uuid.uuid4().hex}"
            audio = Audio(
                project_id=project.id,
                minio_key=key,
                original_filename=q[:80] or "qa-question",
                mime="text/plain",
                size_bytes=len(q.encode("utf-8")),
                status="ready",
                uploaded_by=uploader.id,
            )
            self.db.add(audio)
            self.db.flush()
            task = Task(
                project_id=project.id,
                audio_id=audio.id,
                task_type="qa",
                payload={"question": q},
                is_golden=is_golden,
                status="ready",
            )
            self.db.add(task)
            created.append(task)
        self.db.commit()
        for t in created:
            self.db.refresh(t)
        return created

    def apply_prelabels(
        self,
        project_id: int,
        task_type: str,
        prelabels: dict[str, dict[str, Any]],
        *,
        force: bool = False,
        only_filenames: Optional[set[str]] = None,
    ) -> tuple[int, list[dict[str, Any]], list[str]]:
        """Match prelabel theo original_filename.

        - Khi `force=False`: chỉ apply cho rows chưa có giá trị ở các key sắp ghi.
          Rows nào đã có giá trị (conflict) sẽ KHÔNG bị thay đổi và được trả về
          danh sách `conflicts`.
        - Khi `force=True`: ghi đè bất chấp giá trị cũ.
        - Khi `only_filenames` được set, chỉ xử lý các filename trong tập đó
          (dùng để force-apply riêng các conflict mà user đã tick).

        Returns: (applied_count, conflicts, unmatched_filenames)
        """
        if not prelabels:
            return 0, [], []
        tasks = (
            self.db.query(Task)
            .filter(Task.project_id == project_id, Task.task_type == task_type)
            .all()
        )
        applied = 0
        conflicts: list[dict[str, Any]] = []
        unmatched_keys = set(prelabels.keys())
        for a in tasks:
            key = a.original_filename
            if key not in prelabels:
                continue
            unmatched_keys.discard(key)
            if only_filenames is not None and key not in only_filenames:
                continue
            new_values = prelabels[key]
            current = dict(a.payload or {})
            overlap = {
                k: current.get(k)
                for k, v in new_values.items()
                if current.get(k) not in (None, "", []) and current.get(k) != v
            }
            if overlap and not force:
                conflicts.append({
                    "task_id": a.id,
                    "filename": key,
                    "current": overlap,
                    "new": {k: new_values[k] for k in overlap.keys()},
                })
                continue
            merged = current
            merged.update(new_values)
            a.payload = merged
            applied += 1
        self.db.commit()
        return applied, conflicts, sorted(unmatched_keys)

    def delete(self, task: Task) -> None:
        audio_id = task.audio_id
        audio = self.db.query(Audio).filter(Audio.id == audio_id).first()
        self.db.delete(task)
        self.db.commit()
        # Audio bị xoá (và file MinIO) chỉ khi không còn Task nào trỏ tới
        # (1 file có thể được tham chiếu bởi label gốc + nhiều verify spawn).
        still_used = (
            self.db.query(Task).filter(Task.audio_id == audio_id).first() is not None
        )
        if not still_used and audio:
            self.storage.remove_object(audio.minio_key)
            self.db.delete(audio)
            self.db.commit()

    def presign(self, task: Task) -> str:
        return self.storage.presigned_get(task.audio.minio_key) if task.audio else ""

    # ---------- external sync ----------
    def sync_from_external(
        self,
        project: Project,
        uploader: User,
        payload: ExternalSyncRequest,
    ) -> ExternalSyncResponse:
        if payload.task_type not in (project.task_types or []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Task type '{payload.task_type}' chưa được bật cho project",
            )
        limit = min(payload.limit, settings.max_files_per_sync)

        try:
            ext = ExternalSyncClient(
                endpoint=payload.endpoint,
                access_key=payload.access_key,
                secret_key=payload.secret_key,
                secure=payload.secure,
            )
            objects = ext.list_objects(payload.bucket, payload.prefix, limit=limit)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Không kết nối được nguồn: {e}",
            )

        imported = skipped = 0
        errors: list[str] = []
        prelabel = payload.prelabel_default or {}

        for obj in objects:
            key: str = obj["key"]
            filename = key.rsplit("/", 1)[-1]
            mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            if not mime.startswith("audio/"):
                skipped += 1
                continue
            try:
                buf = io.BytesIO()
                for chunk in ext.stream_object(payload.bucket, key):
                    buf.write(chunk)
                buf.seek(0)
                size = buf.getbuffer().nbytes
                self.upload_one(
                    project=project,
                    uploader=uploader,
                    file=buf,
                    filename=filename,
                    size_bytes=size,
                    content_type=mime,
                    task_type=payload.task_type,
                    payload=dict(prelabel),
                    is_golden=payload.is_golden,
                )
                imported += 1
            except HTTPException as e:
                errors.append(f"{filename}: {e.detail}")
            except Exception as e:  # noqa: BLE001
                errors.append(f"{filename}: {e}")

        return ExternalSyncResponse(imported=imported, skipped=skipped, errors=errors[:50])


def get_audio_service(db: Session) -> AudioService:
    from app.core.storage import get_storage
    return AudioService(db, get_storage())
