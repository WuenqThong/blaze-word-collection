"""Sinh kho câu hỏi Dataset1 cho game 10 câu.

Cách dùng (từ thư mục frontend, dùng venv backend vì đã có openpyxl):
  1. Tải Google Sheet "Dataset1" dạng .xlsx (File > Download > .xlsx).
  2. ../backend/.venv/Scripts/python.exe scripts/build-dataset1-bank.py <đường-dẫn.xlsx>

Kết quả: src/features/demo/dataset1Bank.ts (file sinh tự động, không sửa tay).

Phân tầng:
  - SOURCED (dùng cho Q1–Q2, có chấm điểm): tab 01, "Câu minh họa/kiểm thử",
    vùng mục tiêu QN–ĐN, nguồn xác nhận từ/nghĩa thuộc Luận án, Bài nghiên cứu,
    Tư liệu văn hóa hoặc Báo/trang tin, không nằm trong nhóm trùng và không có
    ghi chú chất lượng. Đây là mục đã đối chiếu nguồn, KHÔNG phải gold do người
    bản địa/chuyên gia duyệt (cột "Trạng thái duyệt" vẫn là "Chưa duyệt bản địa").
  - UNVERIFIED (dùng cho Q3–Q10, câu mở để người chơi xác nhận/sửa): phần còn
    lại của vùng mục tiêu trong tab 01 (kho trực tuyến, câu theo khuôn tra cứu,
    nguồn trực tuyến khác, mục trùng/có ghi chú) và toàn bộ tab 05 "Cần xác minh
    thêm". Tab 06 (ngữ âm) cần audio nên chưa đưa vào game chữ.
"""
import json
import random
import re
import sys
from pathlib import Path

import openpyxl

SHEET_URL = "https://docs.google.com/spreadsheets/d/1s9ydC5lWltZ-lZYigUHbceVj7SgyZamlDw6seZbAaWk/edit"
MAIN = "01 · Dataset tổng hợp"
VERIFY = "05 · Cần xác minh thêm"
STRONG_SOURCES = {"Luận án", "Bài nghiên cứu", "Tư liệu văn hóa", "Báo/trang tin"}
OUT = Path(__file__).resolve().parent.parent / "src" / "features" / "demo" / "dataset1Bank.ts"


def clean(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def key(s):
    return re.sub(r"[.!?,;:]+$", "", clean(s).lower())


def first_url(v):
    m = re.search(r"https?://\S+", str(v or ""))
    return m.group(0) if m else SHEET_URL


def variants(meaning):
    parts = [clean(p) for p in re.split(r"[/;,]", meaning)]
    return [p for p in parts if p and len(p) <= 40]


def rows(ws):
    data = list(ws.iter_rows(values_only=True))
    head = [clean(h) for h in data[0]]
    return [dict(zip(head, r)) for r in data[1:] if r and r[0]]


def blank(standard, answers):
    low = standard.lower()
    for a in answers:
        i = low.find(a.lower())
        if i >= 0 and low.count(a.lower()) == 1:
            return standard[:i] + "___" + standard[i + len(a):], standard[i:i + len(a)]
    return None, None


def main(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    main_rows = [r for r in rows(wb[MAIN]) if clean(r.get("Vai trò dữ liệu")) == "Mục tiêu chính"]
    sourced, unverified = [], []
    for r in main_rows:
        item = {
            "id": clean(r["ID"]), "word": clean(r["Từ địa phương"]), "meaning": clean(r["Nghĩa"]),
            "sentence": clean(r["Câu kiểm thử"]), "standard": clean(r["Tiếng Việt phổ thông"]),
            "url": first_url(r.get("Nguồn xác nhận từ/nghĩa") or r.get("Nguồn")),
            "sourceType": clean(r["Loại nguồn"]), "sheet": MAIN,
        }
        if not item["word"] or not item["meaning"]:
            continue
        strong = (clean(r["Loại mẫu"]) == "Câu minh họa/kiểm thử" and item["sourceType"] in STRONG_SOURCES
                  and not clean(r.get("Nhóm trùng cần rà")) and not clean(r.get("Ghi chú chất lượng")))
        if strong:
            sourced.append(item)
        else:
            item["natural"] = clean(r["Loại mẫu"]) == "Câu minh họa/kiểm thử"
            item["note"] = clean(r.get("Ghi chú chất lượng"))
            unverified.append(item)
    candidates = [{
        "id": clean(r["ID"]), "word": clean(r["Ứng viên / nhóm từ"]), "meaning": clean(r["Loại nghĩa cần kiểm tra"]),
        "sentence": "", "standard": "", "url": first_url(r.get("Nguồn đầu mối")), "sourceType": "Ứng viên cần xác minh",
        "sheet": VERIFY, "natural": False, "note": clean(r.get("Việc cần kiểm chứng")),
    } for r in rows(wb[VERIFY]) if clean(r.get("Ứng viên / nhóm từ"))]

    rng = random.Random(20261110)
    # Q1/Q2 có đáp án: trắc nghiệm (Q1) và điền từ (Q2).
    meanings = sorted({it["meaning"] for it in sourced if len(it["meaning"]) <= 40})
    choice, fill = [], []
    for it in sourced:
        word = key(re.sub(r"\s*\(.*?\)", "", it["word"]))
        acc = [a for a in variants(it["meaning"]) if key(a) != word and len(a) > 1]
        if not acc or len(it["meaning"]) > 60:
            continue
        template, hit = blank(it["standard"], acc)
        if template and len(fill) <= len(choice):
            fill.append({**it, "accepted": [hit] + [a for a in acc if key(a) != key(hit)], "blank": template})
            continue
        pool = [m for m in meanings if key(m) != key(it["meaning"]) and not any(key(a) in key(m) or key(m) in key(a) for a in acc)]
        rng.shuffle(pool)
        picked = []
        for m in pool:
            if all(key(m) != key(p) for p in picked):
                picked.append(m)
            if len(picked) == 3:
                break
        if len(picked) == 3:
            choice.append({**it, "accepted": [it["meaning"]], "distractors": picked})
    rng.shuffle(choice)
    rng.shuffle(fill)

    natural = [u for u in unverified if u["natural"]]
    lexeme = [u for u in unverified if not u["natural"]]
    rng.shuffle(natural)
    rng.shuffle(lexeme)
    exam_count = max(-(-len(lexeme) // 5), -(-len(natural) // 2))
    exams = []
    for n in range(exam_count):
        lx = [lexeme[(n * 5 + k) % len(lexeme)]["id"] for k in range(5)]
        nt = [natural[(n * 2 + k) % len(natural)]["id"] for k in range(2)]
        cand = candidates[n % len(candidates)]["id"]
        exams.append({
            "sourced": [choice[n % len(choice)]["id"], fill[n % len(fill)]["id"]],
            # Q3, Q4, Q5, Q6, Q7, Q8, Q9, Q10
            "unverified": [lx[0], lx[1], lx[2], nt[0], nt[1], cand, lx[3], lx[4]],
        })

    urls = sorted({it["url"] for it in sourced + unverified + candidates})

    def pack(items, fields):
        out = []
        for it in items:
            row = {k: it[k] for k in fields if k in it and it[k] not in ("", None, False)}
            row["url"] = urls.index(it["url"])
            if it["sheet"] == VERIFY:
                row["candidate"] = True
            out.append(row)
        return out

    base = ["id", "word", "meaning", "sentence", "standard", "sourceType"]
    payload = {
        "urls": urls,
        "sourced": pack(choice, base + ["accepted", "distractors"]) + pack(fill, base + ["accepted", "blank"]),
        "unverified": pack(unverified + candidates, base + ["natural", "note"]),
        "exams": exams,
    }
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(
        "// File sinh tự động bởi frontend/scripts/build-dataset1-bank.py từ Google Sheet Dataset1.\n"
        "// Không sửa tay; chạy lại script khi dataset thay đổi.\n"
        "import type { BankData } from \"./dataset1BankTypes\";\n"
        f"export const dataset1Bank: BankData = {body};\n",
        encoding="utf-8",
    )
    print(f"sourced: {len(sourced)} rows -> {len(choice)} choice + {len(fill)} fill")
    print(f"unverified: {len(unverified)} rows ({len(natural)} natural, {len(lexeme)} lexeme) + {len(candidates)} candidates")
    print(f"exams: {len(exams)} -> {OUT}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1])
