"""Parse CSV/JSONL/Excel prelabel theo task type.

Mỗi dòng tối thiểu có `filename`. Trường còn lại tuỳ task_type:

- audio_label  : prelabel
- audio_verify : suggested_label
- qa           : question, options? (JSON list), answer? (golden ground truth)
"""
import csv
import io
import json
from typing import Any, Iterable


REQUIRED_BY_TASK_TYPE: dict[str, list[str]] = {
    "audio_label": [],                  # prelabel optional
    "audio_verify": ["suggested_label"],
    "qa": ["question"],
}

OPTIONAL_BY_TASK_TYPE: dict[str, list[str]] = {
    "audio_label": ["prelabel"],
    "audio_verify": [],
    "qa": ["options", "answer"],
}


def _normalize_row(task_type: str, row: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    if not row:
        return None
    filename = (row.get("filename") or row.get("file") or row.get("name") or "").strip()
    if not filename:
        return None

    payload: dict[str, Any] = {}
    for f in REQUIRED_BY_TASK_TYPE.get(task_type, []):
        if f not in row or row[f] in (None, ""):
            raise ValueError(f"Dòng '{filename}' thiếu cột bắt buộc '{f}' cho task '{task_type}'")
        payload[f] = row[f]

    for f in OPTIONAL_BY_TASK_TYPE.get(task_type, []):
        if f in row and row[f] not in (None, ""):
            value = row[f]
            if f == "options" and isinstance(value, str):
                # CSV: "A|B|C" hoặc JSON list
                stripped = value.strip()
                if stripped.startswith("["):
                    try:
                        value = json.loads(stripped)
                    except json.JSONDecodeError:
                        value = [s.strip() for s in stripped.strip("[]").split(",") if s.strip()]
                else:
                    value = [s.strip() for s in stripped.split("|") if s.strip()]
            payload[f] = value

    return filename, payload


def _parse_xlsx(content: bytes) -> Iterable[dict[str, Any]]:
    """Parse Excel: dòng đầu là header, các dòng sau là data."""
    try:
        from openpyxl import load_workbook
    except ImportError:
        raise ValueError("Thiếu thư viện openpyxl để đọc Excel — cài đặt: pip install openpyxl")
    wb = load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    ws = wb.active
    if ws is None:
        return []
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header = next(rows_iter)
    except StopIteration:
        return []
    headers = [(str(h).strip() if h is not None else "") for h in header]
    out_rows: list[dict[str, Any]] = []
    for row in rows_iter:
        if not row or all(c is None for c in row):
            continue
        d: dict[str, Any] = {}
        for i, val in enumerate(row):
            if i >= len(headers) or not headers[i]:
                continue
            if val is None:
                continue
            d[headers[i]] = val if not isinstance(val, str) else val.strip()
        if d:
            out_rows.append(d)
    return out_rows


def parse_questions(content: bytes, filename: str) -> list[str]:
    """Parse 1 file thành list câu hỏi.

    Hỗ trợ:
    - CSV/Excel: cột `question` (có header). Nếu không có header `question`, lấy cột đầu.
    - TXT: mỗi dòng = 1 câu hỏi.
    """
    name = filename.lower()
    questions: list[str] = []

    if name.endswith(".xlsx") or name.endswith(".xlsm"):
        rows = list(_parse_xlsx(content))
        for row in rows:
            q = row.get("question") or row.get("Question") or row.get("câu hỏi") or row.get("Câu hỏi")
            if q is None and row:
                q = next(iter(row.values()))
            q = (str(q or "")).strip()
            if q:
                questions.append(q)
    elif name.endswith(".txt"):
        text = content.decode("utf-8-sig", errors="replace")
        for line in text.splitlines():
            stripped = line.strip()
            if stripped:
                questions.append(stripped)
    elif name.endswith(".csv") or name.endswith(".tsv"):
        text = content.decode("utf-8-sig", errors="replace")
        delimiter = "\t" if name.endswith(".tsv") else ","
        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
        cols = reader.fieldnames or []
        col = "question" if "question" in cols else (cols[0] if cols else None)
        if not col:
            raise ValueError("File CSV/TSV không có cột nào")
        for row in reader:
            q = (row.get(col) or "").strip()
            if q:
                questions.append(q)
    else:
        raise ValueError(f"Định dạng không hỗ trợ — chỉ chấp nhận CSV / Excel (.xlsx) / TXT")

    return questions


def parse_prelabel(content: bytes, filename: str, task_type: str) -> dict[str, dict[str, Any]]:
    """Trả về map {filename → payload} sau khi parse + validate.

    Hỗ trợ: CSV / TSV / JSONL / NDJSON / JSON (list) / XLSX (Excel).
    """
    name = filename.lower()

    rows: Iterable[dict[str, Any]]
    if name.endswith(".xlsx") or name.endswith(".xlsm"):
        rows = _parse_xlsx(content)
    else:
        text = content.decode("utf-8-sig", errors="replace")
        if name.endswith(".jsonl") or name.endswith(".ndjson"):
            rows = (json.loads(line) for line in text.splitlines() if line.strip())
        elif name.endswith(".json"):
            loaded = json.loads(text)
            if not isinstance(loaded, list):
                raise ValueError("File JSON phải là một list các object")
            rows = loaded
        else:
            # CSV / TSV (default)
            delimiter = "\t" if name.endswith(".tsv") else ","
            rows = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        result = _normalize_row(task_type, row)
        if result:
            fname, payload = result
            out[fname] = payload
    return out
