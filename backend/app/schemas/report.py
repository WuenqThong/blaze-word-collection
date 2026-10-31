from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

ReportReason = Literal["corrupt", "inaudible", "wrong_label", "offensive", "other"]


class ReportRequest(BaseModel):
    reason: ReportReason
    description: Optional[str] = Field(default=None, max_length=1000)


class ReportPublic(BaseModel):
    id: int
    user_id: int
    user_full_name: Optional[str] = None
    user_email: Optional[str] = None
    project_id: int
    task_id: int
    audio_filename: Optional[str] = None
    reason: str
    description: Optional[str] = None
    status: Literal["pending", "approved", "rejected"]
    score_awarded: int
    admin_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime


class ReportListResponse(BaseModel):
    items: list[ReportPublic]
    total: int


class ReportReviewRequest(BaseModel):
    approve: bool
    note: Optional[str] = Field(default=None, max_length=500)
