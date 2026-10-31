from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    WebSocket,
    status,
)
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal, get_db
from app.core.security import decode_token
from app.models import Project, RolePlayScenario, RolePlayTask, RolePlayTestCase, User
from app.schemas.roleplay import (
    ImportFromAgentRequest,
    ImportFromAgentResponse,
    ReportSubmitRequest,
    ScenarioCreate,
    ScenarioPublic,
    ScenarioUpdate,
    TaskEndRequest,
    TaskListResponse,
    TaskPublic,
    TaskStartRequest,
    TaskStartResponse,
    TestCaseCreate,
    TestCasePublic,
    TestCaseUpdate,
)
from app.services.project_service import ProjectService
from app.services.roleplay_service import RolePlayService, get_roleplay_service

from .deps import get_current_user, require_role

router = APIRouter(prefix="/roleplay", tags=["roleplay"])
project_router = APIRouter(prefix="/projects/{project_id}/roleplay", tags=["roleplay"])


def _service(db: Session = Depends(get_db)) -> RolePlayService:
    return get_roleplay_service(db)


def _project_service(db: Session = Depends(get_db)) -> ProjectService:
    return ProjectService(db)


def _scenario_public(
    s: RolePlayScenario,
    *,
    language: str = "vi",
    tasks_done: int = 0,
    project_name: Optional[str] = None,
    test_case_count: int = 0,
) -> ScenarioPublic:
    return ScenarioPublic(
        id=s.id,
        project_id=s.project_id,
        use_case=s.use_case,
        name=s.name,
        description=s.description,
        instructions=s.instructions,
        language=language,
        max_tasks_per_user=s.max_tasks_per_user,
        max_duration_sec=s.max_duration_sec,
        is_active=s.is_active,
        tasks_done=tasks_done,
        project_name=project_name,
        test_case_count=test_case_count,
    )


def _test_case_public(tc: RolePlayTestCase) -> TestCasePublic:
    return TestCasePublic(
        id=tc.id,
        scenario_id=tc.scenario_id,
        name=tc.name,
        description=tc.description,
        instructions=tc.instructions,
        expected_outcome=tc.expected_outcome,
        is_active=tc.is_active,
    )


def _task_public(t: RolePlayTask) -> TaskPublic:
    user = t.__dict__.get("_user_cache")
    return TaskPublic(
        id=t.id,
        scenario_id=t.scenario_id,
        scenario_name=getattr(t, "_scenario_name_cache", "") or "",
        test_case_id=t.test_case_id,
        test_case_name=getattr(t, "_test_case_name_cache", None),
        project_id=getattr(t, "_project_id_cache", None),
        project_name=getattr(t, "_project_name_cache", None),
        user_id=t.user_id,
        user_email=getattr(user, "email", None) if user else None,
        user_full_name=getattr(user, "full_name", None) if user else None,
        status=t.status,
        client_id=t.client_id,
        agent_session_id=t.agent_session_id,
        started_at=t.started_at,
        ended_at=t.ended_at,
        duration_sec=t.duration_sec,
        has_recording=bool(t.recording_minio_key),
        has_report=bool(t.report_data),
        report_data=t.report_data,
        report_rating=t.report_rating,
        report_note=t.report_note,
        report_submitted_at=t.report_submitted_at,
    )


# ============================================================
# Per-project scenarios — admin CRUD + member view
# ============================================================
@project_router.get("/scenarios", response_model=list[ScenarioPublic])
def list_project_scenarios(
    project_id: int,
    user: User = Depends(get_current_user),
    svc: RolePlayService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    project = psvc.get_or_404(project_id)
    psvc.assert_member(project, user)
    only_active = user.role != "admin"
    scenarios = svc.list_scenarios_for_project(project_id, only_active=only_active)
    counts = svc.task_counts_for_user(user.id)
    tc_counts = svc.test_case_counts([s.id for s in scenarios])
    lang = project.default_language or "vi"
    return [
        _scenario_public(
            s, language=lang, tasks_done=counts.get(s.id, 0),
            project_name=project.name, test_case_count=tc_counts.get(s.id, 0),
        )
        for s in scenarios
    ]


@project_router.post(
    "/scenarios",
    response_model=ScenarioPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_project_scenario(
    project_id: int,
    payload: ScenarioCreate,
    user: User = Depends(require_role("admin")),
    svc: RolePlayService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    project = psvc.get_or_404(project_id)
    s = svc.create_scenario(user, project, payload)
    return _scenario_public(s, language=project.default_language or "vi", project_name=project.name)


@project_router.patch("/scenarios/{scenario_id}", response_model=ScenarioPublic)
def update_project_scenario(
    project_id: int,
    scenario_id: int,
    payload: ScenarioUpdate,
    _: User = Depends(require_role("admin")),
    svc: RolePlayService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    s = svc.get_scenario_or_404(scenario_id)
    if s.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Scenario không thuộc project")
    project = psvc.get_or_404(project_id)
    s = svc.update_scenario(s, payload)
    return _scenario_public(s, language=project.default_language or "vi", project_name=project.name)


@project_router.delete("/scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_scenario(
    project_id: int,
    scenario_id: int,
    _: User = Depends(require_role("admin")),
    svc: RolePlayService = Depends(_service),
):
    s = svc.get_scenario_or_404(scenario_id)
    if s.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Scenario không thuộc project")
    svc.delete_scenario(s)
    return None


@project_router.get("/agent-use-cases")
def list_agent_use_cases(
    project_id: int,
    _: User = Depends(require_role("admin")),
    psvc: ProjectService = Depends(_project_service),
):
    """Live fetch use_cases agent server hỗ trợ + đánh dấu cái nào đã được
    import vào project (để hiển thị checklist trong drawer)."""
    project = psvc.get_or_404(project_id)
    if not project.agent_endpoint:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Project chưa cấu hình agent_endpoint",
        )
    from app.services.roleplay_service import _fetch_agent_use_cases

    items = _fetch_agent_use_cases(project.agent_endpoint)
    # Lookup imported use_cases trong project
    from sqlalchemy import select
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        existing = {
            s.use_case
            for s in db.query(RolePlayScenario)
            .filter(RolePlayScenario.project_id == project_id)
            .all()
        }
    finally:
        db.close()

    return [
        {
            "use_case": it["use_case"],
            "name": it["name"],
            "description": it["description"],
            "instructions": it["instructions"],
            "imported": it["use_case"] in existing,
        }
        for it in items
    ]


@project_router.post(
    "/scenarios/import-from-agent",
    response_model=ImportFromAgentResponse,
)
def import_scenarios_from_agent(
    project_id: int,
    payload: ImportFromAgentRequest,
    user: User = Depends(require_role("admin")),
    svc: RolePlayService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    project = psvc.get_or_404(project_id)
    items, skipped = svc.import_scenarios_from_agent(user, project, overwrite=payload.overwrite)
    return ImportFromAgentResponse(
        imported=len(items),
        skipped=skipped,
        items=[
            _scenario_public(s, language=project.default_language or "vi", project_name=project.name)
            for s in items
        ],
    )


# ============================================================
# TestCases under a scenario
# ============================================================
@project_router.get(
    "/scenarios/{scenario_id}/test-cases",
    response_model=list[TestCasePublic],
)
def list_scenario_test_cases(
    project_id: int,
    scenario_id: int,
    user: User = Depends(get_current_user),
    svc: RolePlayService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    project = psvc.get_or_404(project_id)
    psvc.assert_member(project, user)
    scenario = svc.get_scenario_or_404(scenario_id)
    if scenario.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Scenario không thuộc project")
    only_active = user.role != "admin"
    items = svc.list_test_cases(scenario_id, only_active=only_active)
    return [_test_case_public(tc) for tc in items]


@project_router.post(
    "/scenarios/{scenario_id}/test-cases",
    response_model=TestCasePublic,
    status_code=status.HTTP_201_CREATED,
)
def create_test_case(
    project_id: int,
    scenario_id: int,
    payload: TestCaseCreate,
    _: User = Depends(require_role("admin")),
    svc: RolePlayService = Depends(_service),
):
    scenario = svc.get_scenario_or_404(scenario_id)
    if scenario.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Scenario không thuộc project")
    return _test_case_public(svc.create_test_case(scenario, payload))


@project_router.patch(
    "/scenarios/{scenario_id}/test-cases/{test_case_id}",
    response_model=TestCasePublic,
)
def update_test_case(
    project_id: int,
    scenario_id: int,
    test_case_id: int,
    payload: TestCaseUpdate,
    _: User = Depends(require_role("admin")),
    svc: RolePlayService = Depends(_service),
):
    scenario = svc.get_scenario_or_404(scenario_id)
    if scenario.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Scenario không thuộc project")
    tc = svc.get_test_case_or_404(test_case_id)
    if tc.scenario_id != scenario_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Test case không thuộc scenario")
    return _test_case_public(svc.update_test_case(tc, payload))


@project_router.delete(
    "/scenarios/{scenario_id}/test-cases/{test_case_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_test_case(
    project_id: int,
    scenario_id: int,
    test_case_id: int,
    _: User = Depends(require_role("admin")),
    svc: RolePlayService = Depends(_service),
):
    scenario = svc.get_scenario_or_404(scenario_id)
    if scenario.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Scenario không thuộc project")
    tc = svc.get_test_case_or_404(test_case_id)
    if tc.scenario_id != scenario_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Test case không thuộc scenario")
    svc.delete_test_case(tc)
    return None


# Cross-project endpoint: list test cases of a scenario (for annotator picker)
@router.get("/scenarios/{scenario_id}/test-cases", response_model=list[TestCasePublic])
def list_scenario_test_cases_for_me(
    scenario_id: int,
    user: User = Depends(get_current_user),
    svc: RolePlayService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    scenario = svc.get_scenario_or_404(scenario_id)
    project = psvc.get_or_404(scenario.project_id)
    psvc.assert_member(project, user)
    items = svc.list_test_cases(scenario_id, only_active=True)
    return [_test_case_public(tc) for tc in items]


@project_router.get("/tasks", response_model=TaskListResponse)
def list_project_tasks(
    project_id: int,
    scenario_id: Optional[int] = Query(default=None),
    user_id: Optional[int] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_role("admin")),
    svc: RolePlayService = Depends(_service),
    db: Session = Depends(get_db),
):
    items, total = svc.list_all_tasks(
        project_id=project_id,
        scenario_id=scenario_id,
        user_id=user_id,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )
    project = db.query(Project).filter(Project.id == project_id).first()
    sc_ids = {t.scenario_id for t in items}
    scenarios = {s.id: s for s in db.query(RolePlayScenario).filter(RolePlayScenario.id.in_(sc_ids)).all()}
    user_ids = {t.user_id for t in items}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    publics: list[TaskPublic] = []
    for t in items:
        sc = scenarios.get(t.scenario_id)
        setattr(t, "_scenario_name_cache", sc.name if sc else "")
        setattr(t, "_project_id_cache", project_id)
        setattr(t, "_project_name_cache", project.name if project else None)
        setattr(t, "_user_cache", users.get(t.user_id))
        publics.append(_task_public(t))
    return TaskListResponse(items=publics, total=total)


# ============================================================
# Cross-project user view
# ============================================================
@router.get("/scenarios", response_model=list[ScenarioPublic])
def list_scenarios_for_me(
    user: User = Depends(get_current_user),
    svc: RolePlayService = Depends(_service),
    db: Session = Depends(get_db),
):
    scenarios = svc.list_scenarios_for_user(user)
    counts = svc.task_counts_for_user(user.id)
    tc_counts = svc.test_case_counts([s.id for s in scenarios])
    proj_ids = {s.project_id for s in scenarios}
    projects = {p.id: p for p in db.query(Project).filter(Project.id.in_(proj_ids)).all()}
    out: list[ScenarioPublic] = []
    for s in scenarios:
        p = projects.get(s.project_id)
        out.append(_scenario_public(
            s,
            language=(p.default_language if p else None) or "vi",
            tasks_done=counts.get(s.id, 0),
            project_name=p.name if p else None,
            test_case_count=tc_counts.get(s.id, 0),
        ))
    return out


@router.get("/scenarios/{scenario_id}", response_model=ScenarioPublic)
def get_scenario(
    scenario_id: int,
    user: User = Depends(get_current_user),
    svc: RolePlayService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
    db: Session = Depends(get_db),
):
    s = svc.get_scenario_or_404(scenario_id)
    if not s.is_active and user.role != "admin":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Scenario không tồn tại")
    project = psvc.get_or_404(s.project_id)
    psvc.assert_member(project, user)
    done = svc.task_count_done(scenario_id=s.id, user_id=user.id)
    tc_counts = svc.test_case_counts([s.id])
    return _scenario_public(
        s,
        language=project.default_language or "vi",
        tasks_done=done,
        project_name=project.name,
        test_case_count=tc_counts.get(s.id, 0),
    )


# ============================================================
# Tasks (annotator's session)
# ============================================================
@router.post("/tasks", response_model=TaskStartResponse, status_code=status.HTTP_201_CREATED)
def start_task(
    payload: TaskStartRequest,
    user: User = Depends(get_current_user),
    svc: RolePlayService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    scenario = svc.get_scenario_or_404(payload.scenario_id)
    project = psvc.get_or_404(scenario.project_id)
    psvc.assert_member(project, user)

    task = svc.start_task(user, scenario.id, payload.test_case_id)

    # Resolve instructions: test_case override > scenario default
    test_case = svc.get_test_case_or_404(task.test_case_id) if task.test_case_id else None
    instructions = (test_case.instructions if test_case and test_case.instructions else scenario.instructions)

    return TaskStartResponse(
        task_id=task.id,
        scenario_id=scenario.id,
        test_case_id=test_case.id if test_case else None,
        test_case_name=test_case.name if test_case else None,
        use_case=scenario.use_case,
        language=project.default_language or "vi",
        max_duration_sec=scenario.max_duration_sec,
        instructions=instructions,
        expected_outcome=test_case.expected_outcome if test_case else None,
    )


@router.post("/tasks/{task_id}/end", response_model=TaskPublic)
def end_task(
    task_id: int,
    payload: TaskEndRequest,
    user: User = Depends(get_current_user),
    svc: RolePlayService = Depends(_service),
    db: Session = Depends(get_db),
):
    task = svc.get_task_or_404(task_id)
    task = svc.end_task(task, user, client_id=payload.client_id, error=payload.error)
    scenario = svc.get_scenario_or_404(task.scenario_id)
    project = db.query(Project).filter(Project.id == scenario.project_id).first()
    setattr(task, "_scenario_name_cache", scenario.name)
    setattr(task, "_project_id_cache", project.id if project else None)
    setattr(task, "_project_name_cache", project.name if project else None)
    setattr(task, "_user_cache", db.query(User).filter(User.id == task.user_id).first())
    return _task_public(task)


# ============================================================
# WebSocket proxy
# ============================================================
@router.websocket("/tasks/{task_id}/ws")
async def proxy_ws(
    websocket: WebSocket,
    task_id: int,
    client_id: str = Query(...),
    language: str = Query(default="vi"),
    mode: str = Query(default="ai"),
):
    settings = get_settings()
    token = websocket.cookies.get(settings.cookie_name)
    if not token:
        await websocket.close(code=4401, reason="Unauthorized")
        return
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=4401, reason="Invalid token")
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == int(payload["sub"])).first()
        if not user:
            await websocket.close(code=4401, reason="User not found")
            return

        task = db.query(RolePlayTask).filter(RolePlayTask.id == task_id).first()
        if not task:
            await websocket.close(code=4404, reason="Task not found")
            return
        if task.user_id != user.id and user.role != "admin":
            await websocket.close(code=4403, reason="Forbidden")
            return

        await websocket.accept()
        from app.services.roleplay_ws_proxy import proxy_session
        await proxy_session(
            websocket, db, task, user,
            client_id=client_id, language=language, mode=mode,
        )
    finally:
        db.close()


@router.post("/tasks/{task_id}/recording", response_model=TaskPublic)
async def upload_recording(
    task_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    svc: RolePlayService = Depends(_service),
    db: Session = Depends(get_db),
):
    task = svc.get_task_or_404(task_id)
    raw = await file.read()
    import io
    buf = io.BytesIO(raw)
    task = svc.upload_recording(task, user, file=buf, size_bytes=len(raw), content_type=file.content_type)
    scenario = svc.get_scenario_or_404(task.scenario_id)
    project = db.query(Project).filter(Project.id == scenario.project_id).first()
    setattr(task, "_scenario_name_cache", scenario.name)
    setattr(task, "_project_id_cache", project.id if project else None)
    setattr(task, "_project_name_cache", project.name if project else None)
    setattr(task, "_user_cache", db.query(User).filter(User.id == task.user_id).first())
    return _task_public(task)


@router.get("/tasks/me", response_model=TaskListResponse)
def list_my_tasks(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    svc: RolePlayService = Depends(_service),
    db: Session = Depends(get_db),
):
    items, total = svc.list_my_tasks(user, limit=limit, offset=offset)
    sc_ids = {t.scenario_id for t in items}
    scenarios = {s.id: s for s in db.query(RolePlayScenario).filter(RolePlayScenario.id.in_(sc_ids)).all()}
    proj_ids = {s.project_id for s in scenarios.values()}
    projects = {p.id: p for p in db.query(Project).filter(Project.id.in_(proj_ids)).all()}

    publics: list[TaskPublic] = []
    for t in items:
        sc = scenarios.get(t.scenario_id)
        proj = projects.get(sc.project_id) if sc else None
        setattr(t, "_scenario_name_cache", sc.name if sc else "")
        setattr(t, "_project_id_cache", proj.id if proj else None)
        setattr(t, "_project_name_cache", proj.name if proj else None)
        setattr(t, "_user_cache", user)
        publics.append(_task_public(t))
    return TaskListResponse(items=publics, total=total)


@router.get("/tasks/{task_id}/recording-url")
def get_recording_url(
    task_id: int,
    user: User = Depends(get_current_user),
    svc: RolePlayService = Depends(_service),
):
    task = svc.get_task_or_404(task_id)
    if task.user_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Không phải task của bạn")
    url = svc.task_recording_url(task)
    if not url:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Chưa có recording")
    return {"url": url}


@router.post("/tasks/{task_id}/report", response_model=TaskPublic)
def submit_report_rating(
    task_id: int,
    payload: ReportSubmitRequest,
    user: User = Depends(get_current_user),
    svc: RolePlayService = Depends(_service),
    db: Session = Depends(get_db),
):
    task = svc.get_task_or_404(task_id)
    task = svc.submit_report_rating(task, user, rating=payload.rating, note=payload.note)
    scenario = svc.get_scenario_or_404(task.scenario_id)
    project = db.query(Project).filter(Project.id == scenario.project_id).first()
    setattr(task, "_scenario_name_cache", scenario.name)
    setattr(task, "_project_id_cache", project.id if project else None)
    setattr(task, "_project_name_cache", project.name if project else None)
    setattr(task, "_user_cache", db.query(User).filter(User.id == task.user_id).first())
    return _task_public(task)
