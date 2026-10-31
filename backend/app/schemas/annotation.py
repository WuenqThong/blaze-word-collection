from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

TaskType = Literal["audio_label", "audio_verify", "qa"]


class NextTaskProject(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    scoring: dict[str, int] = {}
    redundancy: int = 1


class NextTaskResponse(BaseModel):
    """Response khi annotator request task tiếp theo."""
    has_task: bool
    assignment_id: Optional[int] = None
    task_id: Optional[int] = None
    task_type: Optional[TaskType] = None
    payload: dict[str, Any] = {}
    audio_url: Optional[str] = None  # presigned URL ngắn hạn
    audio_filename: Optional[str] = None
    expires_at: Optional[datetime] = None
    progress: dict[str, int] = {}  # {done, total} trong project cho user này
    project: Optional[NextTaskProject] = None


class SubmitAnnotationRequest(BaseModel):
    answer: dict[str, Any]
    time_spent_ms: Optional[int] = Field(default=None, ge=0)
    audio_listened_sec: Optional[float] = Field(default=None, ge=0)
    audio_play_count: Optional[int] = Field(default=None, ge=0)


class AnnotationPublic(BaseModel):
    id: int
    task_id: int
    project_id: int
    task_type: TaskType
    answer: dict[str, Any]
    score_awarded: int
    is_golden_check: bool = False
    golden_correct: Optional[bool] = None
    low_engagement: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class SubmitAnnotationResponse(BaseModel):
    annotation: AnnotationPublic
    score_total: int
    annotated_count: int


class ProjectStatsResponse(BaseModel):
    annotated_count: int
    score_pending: int
    score_confirmed: int = 0  # placeholder cho hold period sau
