"""Business logic cho module RolePlay (terminology cuối):

- Project (kind=collect): chứa agent_endpoint + default_language.
- Scenario: 1 use_case slug + name + instructions + limits.
- Task: 1 lần annotator try (recording + report + rating).
"""
from typing import BinaryIO, Optional
from uuid import uuid4

import httpx
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.core.storage import StorageService
from app.models import Project, RolePlayScenario, RolePlayTask, RolePlayTestCase, User
from app.schemas.roleplay import ScenarioCreate, ScenarioUpdate, TestCaseCreate, TestCaseUpdate


_RECORDING_MAX_MB = 200
_ALLOWED_MIME_PREFIXES = ("audio/", "video/webm")


USE_CASE_LABELS: dict[str, dict[str, str]] = {
    "ha_scenario": {
        "name": "Khảo sát hài lòng",
        "description": "Thu thập đánh giá khách hàng (1-7 điểm) sau khi KTV xử lý xong, kiểm tra hotline.",
        "instructions": (
            "Đóng vai khách hàng đã được KTV xử lý sự cố. Trả lời các câu hỏi của agent về:\n"
            "1. Đồng ý tham gia khảo sát\n"
            "2. Trạng thái Internet hiện tại\n"
            "3. KTV đã đến chưa, mặc đồng phục không\n"
            "4. Điểm hài lòng (1-7)\n"
            "5. Có biết hotline không"
        ),
    },
    "technical_issue_scenario": {
        "name": "Sự cố kỹ thuật",
        "description": "Khảo sát khi khách báo sự cố — phân loại vấn đề, theo dõi tái phát, KTV đã xử lý.",
        "instructions": (
            "Đóng vai khách hàng đang gặp/đã gặp sự cố Internet. Mô tả:\n"
            "- KTV đã đến xử lý chưa\n"
            "- Loại sự cố (mất mạng, chậm, mất kết nối định kỳ)\n"
            "- Sự cố lặp lại hay mới"
        ),
    },
    "connection_scenario": {
        "name": "Lắp đặt mới",
        "description": "Đánh giá chất lượng kết nối mới, thái độ KTV lắp đặt, nghiệm thu TAM + hotline.",
        "instructions": (
            "Đóng vai khách hàng vừa lắp Internet. Đánh giá:\n"
            "- Tốc độ Internet (đạt/chưa đạt nhu cầu)\n"
            "- Thái độ KTV lắp đặt\n"
            "- Đã ký TAM (biên bản nghiệm thu) chưa, có biết hotline không"
        ),
    },
    "wifi_survey_scenario": {
        "name": "Khảo sát Wifi",
        "description": "Khảo sát sự cố Wifi gặp phải, kiểm tra phản ánh hotline, đánh giá dịch vụ.",
        "instructions": (
            "Đóng vai khách dùng Wifi. Mô tả:\n"
            "- Vấn đề kết nối Wifi (yếu, mất, chậm)\n"
            "- Đã gọi hotline phản ánh chưa\n"
            "- Mức độ hài lòng dịch vụ"
        ),
    },
}


def _label_for(use_case_id: str) -> tuple[str, str, str]:
    meta = USE_CASE_LABELS.get(use_case_id)
    if meta:
        return meta["name"], meta["description"], meta.get("instructions", "")
    nice = use_case_id.replace("_scenario", "").replace("_", " ").title()
    return nice or use_case_id, f"Use case {use_case_id} (chưa có mô tả).", ""


def _fetch_agent_use_cases(agent_endpoint: str) -> list[dict]:
    url = f"{agent_endpoint.rstrip('/')}/v1/use-cases"
    try:
        with httpx.Client(timeout=10) as client:
            r = client.get(url)
    except httpx.RequestError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"Không kết nối được agent: {e}")
    if r.status_code != 200:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"Agent trả {r.status_code} cho /v1/use-cases")
    try:
        data = r.json()
        raw = data.get("use_cases") or []
    except Exception:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Agent trả response không phải JSON hợp lệ")

    out: list[dict] = []
    for uc in raw:
        if not isinstance(uc, dict) or not uc.get("id"):
            continue
        name, desc, instructions = _label_for(uc["id"])
        out.append({"use_case": uc["id"], "name": name, "description": desc, "instructions": instructions})
    return out


class RolePlayService:
    def __init__(self, db: Session, storage: StorageService) -> None:
        self.db = db
        self.storage = storage

    # ============ Project agent config ============
    def assert_collect_project(self, project: Project) -> None:
        if getattr(project, "kind", "annotate") != "collect":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Role-play chỉ tạo được trong project loại 'thu thập'",
            )

    # ============ Scenario ============
    def list_scenarios_for_project(
        self, project_id: int, *, only_active: bool = False
    ) -> list[RolePlayScenario]:
        q = self.db.query(RolePlayScenario).filter(RolePlayScenario.project_id == project_id)
        if only_active:
            q = q.filter(RolePlayScenario.is_active.is_(True))
        return q.order_by(RolePlayScenario.created_at.desc()).all()

    def list_scenarios_for_user(self, user: User) -> list[RolePlayScenario]:
        from app.models import ProjectMember

        q = (
            self.db.query(RolePlayScenario)
            .join(Project, Project.id == RolePlayScenario.project_id)
            .filter(
                RolePlayScenario.is_active.is_(True),
                Project.kind == "collect",
            )
        )
        if user.role != "admin":
            member_ids = {
                row.project_id
                for row in self.db.query(ProjectMember.project_id)
                .filter(ProjectMember.user_id == user.id)
                .all()
            }
            q = q.filter((Project.visibility == "public") | (Project.id.in_(member_ids)))
        return q.order_by(RolePlayScenario.created_at.desc()).all()

    def get_scenario_or_404(self, scenario_id: int) -> RolePlayScenario:
        s = self.db.query(RolePlayScenario).filter(RolePlayScenario.id == scenario_id).first()
        if not s:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Scenario không tồn tại")
        return s

    def create_scenario(
        self,
        creator: User,
        project: Project,
        payload: ScenarioCreate,
    ) -> RolePlayScenario:
        self.assert_collect_project(project)
        if not project.agent_endpoint:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Project chưa cấu hình agent. Vào tab Cấu hình để set agent_endpoint trước.",
            )
        scenario = RolePlayScenario(
            project_id=project.id,
            use_case=payload.use_case.strip(),
            name=payload.name.strip(),
            description=(payload.description or "").strip() or None,
            instructions=(payload.instructions or "").strip() or None,
            max_tasks_per_user=payload.max_tasks_per_user,
            max_duration_sec=payload.max_duration_sec,
            is_active=payload.is_active,
            created_by=creator.id,
        )
        self.db.add(scenario)
        self.db.commit()
        self.db.refresh(scenario)
        return scenario

    def update_scenario(self, scenario: RolePlayScenario, payload: ScenarioUpdate) -> RolePlayScenario:
        data = payload.model_dump(exclude_unset=True)
        for k, v in data.items():
            if isinstance(v, str):
                stripped = v.strip()
                v = stripped or None if k in ("description", "instructions") else stripped
            setattr(scenario, k, v)
        self.db.commit()
        self.db.refresh(scenario)
        return scenario

    def delete_scenario(self, scenario: RolePlayScenario) -> None:
        self.db.delete(scenario)
        self.db.commit()

    def import_scenarios_from_agent(
        self,
        creator: User,
        project: Project,
        *,
        overwrite: bool,
    ) -> tuple[list[RolePlayScenario], int]:
        self.assert_collect_project(project)
        if not project.agent_endpoint:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Project chưa cấu hình agent_endpoint",
            )
        use_cases = _fetch_agent_use_cases(project.agent_endpoint)
        if not use_cases:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Agent không expose use_case nào")

        existing = {
            s.use_case: s
            for s in self.db.query(RolePlayScenario)
            .filter(RolePlayScenario.project_id == project.id)
            .all()
        }
        result: list[RolePlayScenario] = []
        skipped = 0
        for spec in use_cases:
            existing_s = existing.get(spec["use_case"])
            if existing_s:
                if not overwrite:
                    skipped += 1
                    continue
                existing_s.name = spec["name"]
                existing_s.description = spec["description"]
                if not existing_s.instructions:
                    existing_s.instructions = spec.get("instructions") or None
                existing_s.is_active = True
                result.append(existing_s)
                continue
            s = RolePlayScenario(
                project_id=project.id,
                use_case=spec["use_case"],
                name=spec["name"],
                description=spec["description"],
                instructions=spec.get("instructions") or None,
                max_tasks_per_user=0,
                max_duration_sec=0,
                is_active=True,
                created_by=creator.id,
            )
            self.db.add(s)
            result.append(s)
        self.db.commit()
        for s in result:
            self.db.refresh(s)
        return result, skipped

    # ============ TestCase ============
    def list_test_cases(self, scenario_id: int, *, only_active: bool = False) -> list[RolePlayTestCase]:
        q = self.db.query(RolePlayTestCase).filter(RolePlayTestCase.scenario_id == scenario_id)
        if only_active:
            q = q.filter(RolePlayTestCase.is_active.is_(True))
        return q.order_by(RolePlayTestCase.created_at.asc()).all()

    def test_case_counts(self, scenario_ids: list[int]) -> dict[int, int]:
        if not scenario_ids:
            return {}
        rows = (
            self.db.query(RolePlayTestCase.scenario_id, func.count(RolePlayTestCase.id))
            .filter(RolePlayTestCase.scenario_id.in_(scenario_ids), RolePlayTestCase.is_active.is_(True))
            .group_by(RolePlayTestCase.scenario_id)
            .all()
        )
        return {sid: int(cnt) for sid, cnt in rows}

    def get_test_case_or_404(self, test_case_id: int) -> RolePlayTestCase:
        tc = self.db.query(RolePlayTestCase).filter(RolePlayTestCase.id == test_case_id).first()
        if not tc:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Test case không tồn tại")
        return tc

    def create_test_case(self, scenario: RolePlayScenario, payload: TestCaseCreate) -> RolePlayTestCase:
        tc = RolePlayTestCase(
            scenario_id=scenario.id,
            name=payload.name.strip(),
            description=(payload.description or "").strip() or None,
            instructions=(payload.instructions or "").strip() or None,
            expected_outcome=(payload.expected_outcome or "").strip() or None,
            is_active=payload.is_active,
        )
        self.db.add(tc)
        self.db.commit()
        self.db.refresh(tc)
        return tc

    def update_test_case(self, tc: RolePlayTestCase, payload: TestCaseUpdate) -> RolePlayTestCase:
        data = payload.model_dump(exclude_unset=True)
        for k, v in data.items():
            if isinstance(v, str):
                stripped = v.strip()
                v = stripped or None if k in ("description", "instructions", "expected_outcome") else stripped
            setattr(tc, k, v)
        self.db.commit()
        self.db.refresh(tc)
        return tc

    def delete_test_case(self, tc: RolePlayTestCase) -> None:
        self.db.delete(tc)
        self.db.commit()

    # ============ Task counts ============
    def task_count_done(self, *, scenario_id: int, user_id: int) -> int:
        return (
            self.db.query(func.count(RolePlayTask.id))
            .filter(
                RolePlayTask.scenario_id == scenario_id,
                RolePlayTask.user_id == user_id,
                RolePlayTask.status == "ended",
            )
            .scalar()
            or 0
        )

    def task_counts_for_user(self, user_id: int) -> dict[int, int]:
        rows = (
            self.db.query(RolePlayTask.scenario_id, func.count(RolePlayTask.id))
            .filter(RolePlayTask.user_id == user_id, RolePlayTask.status == "ended")
            .group_by(RolePlayTask.scenario_id)
            .all()
        )
        return {sid: int(cnt) for sid, cnt in rows}

    # ============ Task (= session) ============
    def start_task(
        self,
        user: User,
        scenario_id: int,
        test_case_id: Optional[int] = None,
    ) -> RolePlayTask:
        scenario = self.get_scenario_or_404(scenario_id)
        if not scenario.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Scenario đã bị tắt")
        if scenario.max_tasks_per_user > 0:
            done = self.task_count_done(scenario_id=scenario.id, user_id=user.id)
            if done >= scenario.max_tasks_per_user:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    detail=f"Bạn đã đạt giới hạn {scenario.max_tasks_per_user} lượt cho scenario này",
                )

        # Validate test_case thuộc scenario này (nếu cung cấp)
        if test_case_id is not None:
            tc = self.get_test_case_or_404(test_case_id)
            if tc.scenario_id != scenario.id:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="Test case không thuộc scenario này",
                )

        stale = (
            self.db.query(RolePlayTask)
            .filter(
                RolePlayTask.user_id == user.id,
                RolePlayTask.scenario_id == scenario.id,
                RolePlayTask.status.in_(("pending", "running")),
            )
            .all()
        )
        for t in stale:
            t.status = "failed"
            t.ended_at = utcnow()
            t.error_message = "Replaced by new task"

        task = RolePlayTask(
            scenario_id=scenario.id,
            test_case_id=test_case_id,
            user_id=user.id,
            status="running",
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_task_or_404(self, task_id: int) -> RolePlayTask:
        t = self.db.query(RolePlayTask).filter(RolePlayTask.id == task_id).first()
        if not t:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task không tồn tại")
        return t

    def end_task(
        self,
        task: RolePlayTask,
        user: User,
        *,
        client_id: Optional[str] = None,
        error: Optional[str] = None,
    ) -> RolePlayTask:
        if task.user_id != user.id and user.role != "admin":
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Không phải task của bạn")
        if task.status in ("ended", "failed"):
            return task
        task.status = "failed" if error else "ended"
        task.ended_at = utcnow()
        task.duration_sec = max(0, int((task.ended_at - task.started_at).total_seconds()))
        if client_id:
            task.client_id = client_id
        if error:
            task.error_message = error[:1000]
        self.db.commit()
        self.db.refresh(task)
        return task

    def upload_recording(
        self,
        task: RolePlayTask,
        user: User,
        *,
        file: BinaryIO,
        size_bytes: int,
        content_type: Optional[str],
    ) -> RolePlayTask:
        if task.user_id != user.id and user.role != "admin":
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Không phải task của bạn")
        if size_bytes <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="File rỗng")
        if size_bytes > _RECORDING_MAX_MB * 1024 * 1024:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Recording vượt giới hạn {_RECORDING_MAX_MB} MB",
            )
        mime = content_type or "audio/webm"
        if not mime.startswith(_ALLOWED_MIME_PREFIXES):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"MIME '{mime}' không hỗ trợ")

        ext = "webm"
        if "ogg" in mime: ext = "ogg"
        elif "mp4" in mime or "m4a" in mime: ext = "m4a"
        elif "wav" in mime: ext = "wav"
        elif "mpeg" in mime: ext = "mp3"

        key = f"roleplay/{task.scenario_id}/{task.user_id}/{task.id}-{uuid4().hex}.{ext}"
        self.storage.put_object(key, file, size_bytes, mime)

        task.recording_minio_key = key
        task.recording_mime = mime
        task.recording_size_bytes = size_bytes
        self.db.commit()
        self.db.refresh(task)
        return task

    def list_my_tasks(self, user: User, limit: int = 50, offset: int = 0) -> tuple[list[RolePlayTask], int]:
        q = self.db.query(RolePlayTask).filter(RolePlayTask.user_id == user.id)
        total = q.count()
        items = q.order_by(RolePlayTask.started_at.desc()).offset(offset).limit(limit).all()
        return items, total

    def list_all_tasks(
        self,
        *,
        project_id: Optional[int] = None,
        scenario_id: Optional[int] = None,
        user_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[RolePlayTask], int]:
        q = self.db.query(RolePlayTask)
        if project_id is not None:
            q = q.join(RolePlayScenario, RolePlayScenario.id == RolePlayTask.scenario_id).filter(
                RolePlayScenario.project_id == project_id
            )
        if scenario_id is not None:
            q = q.filter(RolePlayTask.scenario_id == scenario_id)
        if user_id is not None:
            q = q.filter(RolePlayTask.user_id == user_id)
        if status_filter:
            q = q.filter(RolePlayTask.status == status_filter)
        total = q.count()
        items = q.order_by(RolePlayTask.started_at.desc()).offset(offset).limit(limit).all()
        return items, total

    def task_recording_url(self, task: RolePlayTask) -> Optional[str]:
        if not task.recording_minio_key:
            return None
        return self.storage.presigned_get(task.recording_minio_key)

    def set_client_id(self, task: RolePlayTask, client_id: str) -> None:
        if task.client_id != client_id:
            task.client_id = client_id
            self.db.commit()

    def set_agent_session_id(self, task: RolePlayTask, agent_session_id: str) -> None:
        if task.agent_session_id != agent_session_id:
            task.agent_session_id = agent_session_id
            self.db.commit()

    def set_report_data(self, task: RolePlayTask, report_data: dict) -> None:
        task.report_data = report_data
        self.db.commit()

    def submit_report_rating(
        self,
        task: RolePlayTask,
        user: User,
        *,
        rating: int,
        note: Optional[str],
    ) -> RolePlayTask:
        if task.user_id != user.id and user.role != "admin":
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Không phải task của bạn")
        task.report_rating = rating
        task.report_note = (note or "").strip() or None
        task.report_submitted_at = utcnow()
        self.db.commit()
        self.db.refresh(task)
        return task


def get_roleplay_service(db: Session) -> RolePlayService:
    from app.core.storage import get_storage
    return RolePlayService(db, get_storage())
