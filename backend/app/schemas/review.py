from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class AnnotationItem(BaseModel):
    id: int
    project_id: int
    task_id: int
    task_type: str
    answer: dict[str, Any]
    score_awarded: int
    review_status: Literal["pending", "approved", "rejected"]
    review_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    is_golden_check: bool = False
    low_engagement: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class AnnotationListResponse(BaseModel):
    items: list[AnnotationItem]
    total: int


class ReviewRequest(BaseModel):
    approve: bool
    note: Optional[str] = Field(default=None, max_length=500)


class UserScoreSummary(BaseModel):
    score_pending: int
    score_confirmed: int
    score_rejected: int
    count_pending: int
    count_approved: int
    count_rejected: int
    count_reviewed: int
    error_rate: float
    account_status: str


class FlaggedUserItem(BaseModel):
    user_id: int
    email: str
    full_name: str
    account_status: str
    error_rate: float
    count_reviewed: int
    count_approved: int
    count_rejected: int
    score_confirmed: int


class AccountStatusUpdate(BaseModel):
    status: Literal["active", "under_review", "suspended"]


class TopAnnotator(BaseModel):
    user_id: int
    full_name: str
    score_confirmed: int
    count_approved: int
    count_reviewed: int
    accuracy: float


class AdminOverview(BaseModel):
    total_annotators: int
    annotators_active: int
    annotators_under_review: int
    annotators_suspended: int
    annotators_active_last_7d: int
    total_annotations: int
    annotations_pending: int
    annotations_approved: int
    annotations_rejected: int
    annotations_new_today: int
    annotations_new_last_7d: int
    top_annotators: list[TopAnnotator]


class RelabelContext(BaseModel):
    annotation_id: int
    audio_url: str
    audio_filename: str
    task_type: Literal["audio_label", "audio_verify", "qa"]
    payload: dict[str, Any]
    current_answer: dict[str, Any]


class RelabelRequest(BaseModel):
    answer: dict[str, Any]
    time_spent_ms: Optional[int] = Field(default=None, ge=0)
    audio_listened_sec: Optional[float] = Field(default=None, ge=0)
    audio_play_count: Optional[int] = Field(default=None, ge=0)


# ----- Data-centric review (admin) -----

class TaskTypeStats(BaseModel):
    task_type: str
    total_tasks: int
    annotations_total: int
    annotations_pending: int
    annotations_approved: int
    annotations_rejected: int
    consensus_rate: Optional[float] = None  # 0..1; None nếu chưa có annotation


class DataReviewItem(BaseModel):
    audio_id: int
    project_id: int
    project_name: str
    filename: str
    audio_url: Optional[str] = None
    pending_count: int
    task_types: list[TaskTypeStats]


class DataReviewListResponse(BaseModel):
    items: list[DataReviewItem]
    total: int


class DataReviewAnnotation(BaseModel):
    id: int
    user_id: int
    user_email: str
    user_full_name: str
    answer: dict[str, Any]
    review_status: str
    review_note: Optional[str] = None
    score_awarded: int
    low_engagement: bool
    is_golden_check: bool
    time_spent_ms: Optional[int] = None
    audio_listened_sec: Optional[float] = None
    audio_play_count: Optional[int] = None
    created_at: Optional[str] = None


class DataReviewTaskItem(BaseModel):
    task_id: int
    payload: dict[str, Any]
    is_golden: bool
    parent_task_id: Optional[int] = None
    annotations: list[DataReviewAnnotation]


class DataReviewGroup(BaseModel):
    task_type: str
    tasks: list[DataReviewTaskItem]


class DataReviewDetail(BaseModel):
    audio_id: int
    project_id: Optional[int]
    project_name: Optional[str]
    filename: str
    audio_url: Optional[str] = None
    groups: list[DataReviewGroup]
