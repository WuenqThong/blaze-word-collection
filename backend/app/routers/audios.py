import csv
import io
import json
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models import Task, User
from app.schemas.audio import (
    AudioAnnotatorItem,
    AudioAnnotatorsResponse,
    AudioListResponse,
    AudioPublic,
    ExternalSyncRequest,
    ExternalSyncResponse,
    PrelabelApplyResponse,
    PrelabelConflictItem,
)
from app.services.audio_service import AudioService, get_audio_service
from app.services.prelabel_parser import parse_prelabel, parse_questions
from app.services.project_service import ProjectService

from .deps import get_current_user, require_role

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])
settings = get_settings()


def _service(db: Session = Depends(get_db)) -> AudioService:
    return get_audio_service(db)


def _project_service(db: Session = Depends(get_db)) -> ProjectService:
    return ProjectService(db)


# ---------- list ----------
@router.get("", response_model=AudioListResponse)
def list_audios(
    project_id: int,
    task_type: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    svc: AudioService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    project = psvc.get_or_404(project_id)
    psvc.assert_member(project, user)
    items, total = svc.list_for_project(project_id, task_type, status_filter, limit, offset)
    counts = svc.annotator_counts([a.id for a in items])
    publics: list[AudioPublic] = []
    for a in items:
        p = AudioPublic.model_validate(a)
        p.annotators_count = counts.get(a.id, 0)
        publics.append(p)
    return AudioListResponse(items=publics, total=total)


# ---------- direct upload ----------
@router.post("/upload", response_model=list[AudioPublic], status_code=status.HTTP_201_CREATED)
async def upload_audios(
    project_id: int,
    files: list[UploadFile] = File(..., description="audio files"),
    task_type: str = Form(...),
    is_golden: bool = Form(default=False),
    payload_json: Optional[str] = Form(default=None, description="JSON object (áp dụng cho mọi file)"),
    user: User = Depends(require_role("admin")),
    svc: AudioService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    if len(files) > settings.max_files_per_upload:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Tối đa {settings.max_files_per_upload} file/lần upload",
        )

    project = psvc.get_or_404(project_id)
    base_payload: dict = {}
    if payload_json:
        try:
            base_payload = json.loads(payload_json)
            if not isinstance(base_payload, dict):
                raise ValueError
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="payload_json phải là JSON object",
            )

    created = []
    for f in files:
        content = await f.read()
        size = len(content)
        if size == 0:
            continue
        from io import BytesIO
        audio = svc.upload_one(
            project=project,
            uploader=user,
            file=BytesIO(content),
            filename=f.filename or "unknown.bin",
            size_bytes=size,
            content_type=f.content_type,
            task_type=task_type,
            payload=dict(base_payload),
            is_golden=is_golden,
        )
        created.append(AudioPublic.model_validate(audio))
    return created


# ---------- apply prelabel CSV/JSONL after upload ----------
@router.post("/prelabel", response_model=PrelabelApplyResponse)
async def apply_prelabel(
    project_id: int,
    task_type: str = Form(...),
    file: UploadFile = File(..., description="CSV/JSONL/JSON metadata file"),
    force: bool = Form(default=False),
    only_filenames: Optional[str] = Form(
        default=None,
        description="JSON list các filename muốn áp dụng (dùng kèm force=true để force-apply riêng các conflict đã chọn).",
    ),
    user: User = Depends(require_role("admin")),
    svc: AudioService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    project = psvc.get_or_404(project_id)
    raw = await file.read()
    try:
        prelabels = parse_prelabel(raw, file.filename or "metadata.csv", task_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    only_set: Optional[set[str]] = None
    if only_filenames:
        try:
            parsed = json.loads(only_filenames)
            if not isinstance(parsed, list):
                raise ValueError
            only_set = {str(x) for x in parsed}
        except (json.JSONDecodeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="only_filenames phải là JSON list các tên file.",
            )

    applied, conflicts, unmatched = svc.apply_prelabels(
        project_id,
        task_type,
        prelabels,
        force=force,
        only_filenames=only_set,
    )
    return PrelabelApplyResponse(
        applied=applied,
        conflicts=[PrelabelConflictItem(**c) for c in conflicts],
        unmatched=len(unmatched),
        unmatched_filenames=unmatched[:50],
    )


# ---------- download prelabel template ----------
_TEMPLATE_HEADERS: dict[tuple[str, bool], list[str]] = {
    ("audio_label", False):  ["filename", "prelabel"],
    ("audio_label", True):   ["filename", "prelabel"],
    ("audio_verify", False): ["filename", "suggested_label"],
    ("audio_verify", True):  ["filename", "suggested_label"],
    ("qa", False):           ["filename", "question", "options"],
    ("qa", True):            ["filename", "question", "options", "answer"],
}

_TEMPLATE_EXAMPLE: dict[tuple[str, bool], list[str]] = {
    ("audio_label", False):  ["foo.wav", "xin chào hôm nay là thứ hai"],
    ("audio_label", True):   ["foo.wav", "xin chào hôm nay là thứ hai"],
    ("audio_verify", False): ["foo.wav", "xin chào"],
    ("audio_verify", True):  ["foo.wav", "xin chào"],
    ("qa", False):           ["foo.wav", "Người nói nam hay nữ?", "Nam|Nữ|Không rõ"],
    ("qa", True):            ["foo.wav", "Người nói nam hay nữ?", "Nam|Nữ|Không rõ", "Nam"],
}

_FORMAT_MIME: dict[str, str] = {
    "csv":   "text/csv; charset=utf-8",
    "tsv":   "text/tab-separated-values; charset=utf-8",
    "jsonl": "application/x-ndjson; charset=utf-8",
    "json":  "application/json; charset=utf-8",
    "xlsx":  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _render_csv(headers: list[str], rows: list[list[str]], delimiter: str) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
    writer.writerow(headers)
    for r in rows:
        writer.writerow(r)
    # Prepend BOM so Excel hiển thị tiếng Việt đúng
    return "﻿".encode("utf-8") + buf.getvalue().encode("utf-8")


def _render_jsonl(headers: list[str], rows: list[list[str]]) -> bytes:
    buf = io.StringIO()
    for r in rows:
        buf.write(json.dumps(dict(zip(headers, r)), ensure_ascii=False))
        buf.write("\n")
    return buf.getvalue().encode("utf-8")


def _render_json(headers: list[str], rows: list[list[str]]) -> bytes:
    data = [dict(zip(headers, r)) for r in rows]
    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


def _render_xlsx(headers: list[str], rows: list[list[str]]) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    wb = Workbook()
    ws = wb.active
    ws.title = "prelabel"
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    for r in rows:
        ws.append(r)
    # Auto width
    for i, h in enumerate(headers, start=1):
        max_len = len(h)
        for r in rows:
            v = str(r[i - 1]) if i - 1 < len(r) else ""
            if len(v) > max_len:
                max_len = len(v)
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = min(max_len + 2, 60)
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


@router.get("/prelabel/template")
def download_prelabel_template(
    project_id: int,
    task_type: str = Query(...),
    is_golden: bool = Query(default=False),
    format: str = Query(default="csv", pattern="^(csv|tsv|jsonl|json|xlsx)$"),
    include_filenames: bool = Query(default=True),
    user: User = Depends(require_role("admin")),
    svc: AudioService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    psvc.get_or_404(project_id)
    key = (task_type, is_golden)
    if key not in _TEMPLATE_HEADERS:
        raise HTTPException(status_code=400, detail="task_type không hợp lệ")
    headers = _TEMPLATE_HEADERS[key]

    rows: list[list[str]] = []
    if include_filenames:
        tasks = (
            svc.db.query(Task)
            .filter(
                Task.project_id == project_id,
                Task.task_type == task_type,
                Task.is_golden == is_golden,
            )
            .order_by(Task.id.asc())
            .all()
        )
        blanks = [""] * (len(headers) - 1)
        for a in tasks:
            rows.append([a.original_filename, *blanks])
    if not rows:
        rows.append(_TEMPLATE_EXAMPLE[key])

    if format in ("csv", "tsv"):
        body = _render_csv(headers, rows, "," if format == "csv" else "\t")
    elif format == "jsonl":
        body = _render_jsonl(headers, rows)
    elif format == "json":
        body = _render_json(headers, rows)
    else:
        body = _render_xlsx(headers, rows)

    suffix = "golden" if is_golden else "dataset"
    filename = f"prelabel_{task_type}_{suffix}_template.{format}"
    return StreamingResponse(
        io.BytesIO(body),
        media_type=_FORMAT_MIME[format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------- QA: tạo từ list câu hỏi text (CSV/Excel/TXT) ----------
@router.post("/qa-questions", response_model=list[AudioPublic], status_code=status.HTTP_201_CREATED)
async def upload_qa_questions(
    project_id: int,
    file: UploadFile = File(..., description="CSV / Excel / TXT chứa câu hỏi"),
    is_golden: bool = Form(default=False),
    user: User = Depends(require_role("admin")),
    svc: AudioService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    project = psvc.get_or_404(project_id)
    raw = await file.read()
    try:
        questions = parse_questions(raw, file.filename or "")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File không có câu hỏi nào")
    items = svc.create_qa_from_questions(project, user, questions=questions, is_golden=is_golden)
    return [AudioPublic.model_validate(a) for a in items]


# ---------- external sync ----------
@router.post("/sync", response_model=ExternalSyncResponse)
def sync_from_external(
    project_id: int,
    payload: ExternalSyncRequest,
    user: User = Depends(require_role("admin")),
    svc: AudioService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    project = psvc.get_or_404(project_id)
    return svc.sync_from_external(project, user, payload)


# ---------- presign + delete ----------
@router.get("/{task_id}/presigned", response_model=dict)
def presign(
    project_id: int,
    task_id: int,
    user: User = Depends(get_current_user),
    svc: AudioService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    project = psvc.get_or_404(project_id)
    psvc.assert_member(project, user)
    audio = svc.get_or_404(task_id)
    if audio.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task không thuộc project")
    return {"url": svc.presign(audio), "ttl_sec": settings.minio_presign_ttl_sec}


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_audio(
    project_id: int,
    task_id: int,
    _: User = Depends(require_role("admin")),
    svc: AudioService = Depends(_service),
):
    audio = svc.get_or_404(task_id)
    if audio.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task không thuộc project")
    svc.delete(audio)
    return None


# ---------- annotators của 1 audio ----------
@router.get("/{task_id}/annotators", response_model=AudioAnnotatorsResponse)
def list_audio_annotators(
    project_id: int,
    task_id: int,
    user: User = Depends(get_current_user),
    svc: AudioService = Depends(_service),
    psvc: ProjectService = Depends(_project_service),
):
    project = psvc.get_or_404(project_id)
    psvc.assert_member(project, user)
    audio = svc.get_or_404(task_id)
    if audio.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task không thuộc project")
    rows = svc.list_annotators(task_id)
    storage = svc.storage
    items: list[AudioAnnotatorItem] = []
    for ann, u in rows:
        answer = ann.answer or {}
        audio_url: Optional[str] = None
        key = answer.get("audio_key") if isinstance(answer, dict) else None
        if isinstance(key, str) and key.strip():
            try:
                audio_url = storage.presigned_get(key)
            except Exception:
                audio_url = None
        items.append(
            AudioAnnotatorItem(
                annotation_id=ann.id,
                user_id=u.id,
                full_name=u.full_name,
                email=u.email,
                answer=answer,
                answer_audio_url=audio_url,
                review_status=ann.review_status,
                score_awarded=ann.score_awarded,
                is_repeat_check=ann.is_repeat_check,
                created_at=ann.created_at,
            )
        )
    return AudioAnnotatorsResponse(task_id=task_id, items=items, total=len(items))


# ---------- patch payload (inline label edit) ----------
@router.patch("/{task_id}", response_model=AudioPublic)
def patch_audio_payload(
    project_id: int,
    task_id: int,
    patch: dict,
    _: User = Depends(require_role("admin")),
    svc: AudioService = Depends(_service),
):
    audio = svc.get_or_404(task_id)
    if audio.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task không thuộc project")
    merged = dict(audio.payload or {})
    for k, v in (patch or {}).items():
        if v is None or v == "":
            merged.pop(k, None)
        else:
            merged[k] = v
    audio.payload = merged
    svc.db.commit()
    svc.db.refresh(audio)
    return AudioPublic.model_validate(audio)
