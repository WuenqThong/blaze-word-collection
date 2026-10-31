from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ------- Project agent config (used in collect kind) -------

class ProjectAgentConfig(BaseModel):
    """Agent config nằm trên Project — share cho tất cả scenarios."""
    agent_endpoint: Optional[str] = None
    default_language: str = "vi"


# ------- Scenario (kịch bản = 1 use_case) -------

class ScenarioCreate(BaseModel):
    use_case: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    instructions: Optional[str] = Field(default=None, max_length=4000)
    max_tasks_per_user: int = Field(default=0, ge=0)
    max_duration_sec: int = Field(default=0, ge=0)
    is_active: bool = True


class ScenarioUpdate(BaseModel):
    use_case: Optional[str] = Field(default=None, min_length=1, max_length=64)
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    instructions: Optional[str] = Field(default=None, max_length=4000)
    max_tasks_per_user: Optional[int] = Field(default=None, ge=0)
    max_duration_sec: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None


class ScenarioPublic(BaseModel):
    id: int
    project_id: int
    use_case: str
    name: str
    description: Optional[str]
    instructions: Optional[str] = None
    language: str  # inherit từ project
    max_tasks_per_user: int
    max_duration_sec: int
    is_active: bool
    tasks_done: int = 0
    project_name: Optional[str] = None
    test_case_count: int = 0  # số test_case active dưới scenario này

    model_config = {"from_attributes": True}


class ImportFromAgentRequest(BaseModel):
    overwrite: bool = False


class ImportFromAgentResponse(BaseModel):
    imported: int
    skipped: int
    items: list[ScenarioPublic]


# ------- TestCase (trường hợp giả định) -------

class TestCaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    instructions: Optional[str] = Field(default=None, max_length=4000)
    expected_outcome: Optional[str] = Field(default=None, max_length=2000)
    is_active: bool = True


class TestCaseUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    instructions: Optional[str] = Field(default=None, max_length=4000)
    expected_outcome: Optional[str] = Field(default=None, max_length=2000)
    is_active: Optional[bool] = None


class TestCasePublic(BaseModel):
    id: int
    scenario_id: int
    name: str
    description: Optional[str]
    instructions: Optional[str]
    expected_outcome: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}


# ------- Task (= phiên annotator try) -------

class TaskStartRequest(BaseModel):
    scenario_id: int
    test_case_id: Optional[int] = None


class TaskStartResponse(BaseModel):
    task_id: int
    scenario_id: int
    test_case_id: Optional[int] = None
    test_case_name: Optional[str] = None
    use_case: Optional[str] = None
    language: str
    max_duration_sec: int
    instructions: Optional[str] = None
    expected_outcome: Optional[str] = None


class TaskEndRequest(BaseModel):
    client_id: Optional[str] = None
    error: Optional[str] = None


class TaskPublic(BaseModel):
    id: int
    scenario_id: int
    scenario_name: str
    test_case_id: Optional[int] = None
    test_case_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    user_id: int
    user_email: Optional[str] = None
    user_full_name: Optional[str] = None
    status: str
    client_id: Optional[str]
    agent_session_id: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime]
    duration_sec: Optional[int]
    has_recording: bool
    has_report: bool = False
    report_data: Optional[Any] = None
    report_rating: Optional[int] = None
    report_note: Optional[str] = None
    report_submitted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    items: list[TaskPublic]
    total: int


class ReportSubmitRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    note: Optional[str] = Field(default=None, max_length=2000)
