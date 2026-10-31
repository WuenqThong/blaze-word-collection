from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

TaskType = Literal["audio_label", "audio_verify", "qa"]


class AudioPublic(BaseModel):
    id: int
    project_id: int
    original_filename: str
    mime: Optional[str] = None
    size_bytes: Optional[int] = None
    duration_sec: Optional[int] = None
    task_type: TaskType
    payload: dict[str, Any] = {}
    is_golden: bool = False
    status: str
    error_message: Optional[str] = None
    uploaded_at: datetime
    annotators_count: int = 0

    model_config = {"from_attributes": True}


class AudioListResponse(BaseModel):
    items: list[AudioPublic]
    total: int


class AudioAnnotatorItem(BaseModel):
    annotation_id: int
    user_id: int
    full_name: str
    email: str
    answer: dict[str, Any] = {}
    answer_audio_url: Optional[str] = None
    review_status: str
    score_awarded: int
    is_repeat_check: bool = False
    created_at: datetime


class AudioAnnotatorsResponse(BaseModel):
    task_id: int
    items: list[AudioAnnotatorItem]
    total: int


class ExternalSyncRequest(BaseModel):
    endpoint: str = Field(min_length=1, description="Ví dụ: s3.amazonaws.com hoặc 1.2.3.4:9000")
    access_key: str
    secret_key: str
    secure: bool = False
    bucket: str
    prefix: str = ""
    task_type: TaskType
    is_golden: bool = False
    limit: int = Field(default=200, ge=1, le=2000)
    # Nếu prelabel có → áp dụng cho mọi file (mặc định không có).
    # Frontend sẽ thường gọi sync trước (chỉ tạo audio rỗng prelabel),
    # rồi upload riêng metadata CSV qua endpoint /audios/prelabel-csv.
    prelabel_default: Optional[dict[str, Any]] = None


class ExternalSyncResponse(BaseModel):
    imported: int
    skipped: int
    errors: list[str] = []


class PrelabelConflictItem(BaseModel):
    task_id: int
    filename: str
    current: dict[str, Any]
    new: dict[str, Any]


class PrelabelApplyResponse(BaseModel):
    applied: int
    conflicts: list[PrelabelConflictItem] = []
    unmatched: int
    unmatched_filenames: list[str] = []
