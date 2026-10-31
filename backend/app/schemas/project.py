from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

TaskTypeLiteral = Literal["audio_label", "audio_verify", "qa"]
StatusLiteral = Literal["draft", "active", "closed"]
VisibilityLiteral = Literal["private", "public"]
KindLiteral = Literal["annotate", "collect"]

DEFAULT_SCORING = {"audio_label": 10, "audio_verify": 5, "qa": 8}


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    kind: KindLiteral = "annotate"
    task_types: list[TaskTypeLiteral] = Field(default_factory=list)
    scoring: dict[str, int] = Field(default_factory=lambda: dict(DEFAULT_SCORING))
    redundancy: int = Field(default=3, ge=1, le=10)
    golden_ratio: float = Field(default=0.1, ge=0.0, le=1.0)
    repeat_ratio: float = Field(default=0.0, ge=0.0, le=0.5)
    visibility: VisibilityLiteral = "private"
    # Cho kind=collect: agent endpoint (URL) + default language.
    agent_endpoint: Optional[str] = Field(default=None, max_length=512)
    default_language: Optional[str] = Field(default=None, max_length=16)

    @field_validator("task_types")
    @classmethod
    def task_types_unique(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("Loại task bị trùng")
        return v


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    task_types: Optional[list[TaskTypeLiteral]] = None
    scoring: Optional[dict[str, int]] = None
    redundancy: Optional[int] = Field(default=None, ge=1, le=10)
    golden_ratio: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    repeat_ratio: Optional[float] = Field(default=None, ge=0.0, le=0.5)
    status: Optional[StatusLiteral] = None
    visibility: Optional[VisibilityLiteral] = None
    agent_endpoint: Optional[str] = Field(default=None, max_length=512)
    default_language: Optional[str] = Field(default=None, max_length=16)
    # `kind` không cho đổi sau khi tạo — tránh project annotate có dataset rồi
    # bị đổi thành collect và mất ý nghĩa.

    @field_validator("task_types")
    @classmethod
    def task_types_unique(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return v
        if len(set(v)) != len(v):
            raise ValueError("Loại task bị trùng")
        return v


class ProjectPublic(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    owner_id: int
    kind: str = "annotate"
    task_types: list[str]
    scoring: dict[str, int]
    redundancy: int
    golden_ratio: float
    repeat_ratio: float = 0.0
    status: str
    visibility: str
    member_count: int = 0
    # Cho project kind=collect (role-play). Null nếu chưa cấu hình.
    agent_endpoint: Optional[str] = None
    default_language: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectMemberAdd(BaseModel):
    user_id: int
    role: Literal["member", "manager"] = "member"


class ProjectMemberPublic(BaseModel):
    user_id: int
    email: str
    full_name: str
    role: str
    joined_at: datetime


# === Report ===
class AudioReportItem(BaseModel):
    task_id: int
    filename: str
    task_type: str
    is_golden: bool
    num_annotations: int
    num_required: int
    progress: Literal["not_started", "in_progress", "completed"]
    consensus: Optional[float] = None
    distinct_answers: int
    latest_at: Optional[datetime] = None


class ProjectReportSummary(BaseModel):
    total_items: int
    not_started: int
    in_progress: int
    completed: int
    redundancy: int


class ProjectReport(BaseModel):
    summary: ProjectReportSummary
    items: list[AudioReportItem]
