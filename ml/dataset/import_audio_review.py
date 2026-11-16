"""Import explicit listening decisions into a new, reviewed local pilot package."""
from __future__ import annotations

import argparse
import collections
from datetime import datetime, timezone
import hashlib
import html
import json
from pathlib import Path
import shutil
import zipfile


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate(rows: list, document: dict) -> dict:
    if document.get("schema") != "audio-quality-review-v1":
        raise ValueError("Unsupported review schema")
    candidates = {r["sample_id"]: r for r in rows if r["record_type"] == "augmented_candidate"}
    reviews = document.get("records", [])
    ids = [r.get("sample_id") for r in reviews]
    if len(ids) != len(set(ids)) or set(ids) != set(candidates):
        raise ValueError("Review IDs must match all derivatives exactly, with no duplicates")
    for review in reviews:
        row = candidates[review["sample_id"]]
        if review.get("audio_sha256") != row["audio_sha256"]:
            raise ValueError("Review refers to different audio: " + row["sample_id"])
        status = review.get("status")
        if status not in {"pending", "approved", "rejected", "needs_review"}:
            raise ValueError("Unknown review status")
        if status != "pending":
            if not isinstance(review.get("reviewer"), str) or not review["reviewer"].strip():
                raise ValueError("Missing reviewer")
            stamp = datetime.fromisoformat(review.get("reviewed_at", "").replace("Z", "+00:00"))
            if stamp.tzinfo is None:
                raise ValueError("Review timestamp must specify timezone")
        if status in {"rejected", "needs_review"} and not review.get("notes", "").strip():
            raise ValueError("Missing rejection/review reason")
        if status == "approved" and row["technical_status"] == "rejected":
            raise ValueError("Cannot approve technically rejected audio")
    return {r["sample_id"]: r for r in reviews}


def run(source: Path, review_file: Path, output: Path) -> dict:
    source, output = source.resolve(), output.resolve()
    if source == output or source in output.parents or output in source.parents:
        raise ValueError("New package must be separate from source")
    checks = json.loads((source / "checksums.json").read_text(encoding="utf-8"))
    for name, expected in checks.items():
        path = (source / name).resolve()
        if source not in path.parents or digest(path) != expected:
            raise ValueError("Source package checksum mismatch: " + name)
    rows = [json.loads(s) for s in (source / "manifest.jsonl").read_text(encoding="utf-8").splitlines()]
    review_bytes = review_file.read_bytes()
    document = json.loads(review_bytes.decode("utf-8-sig"))
    reviews = validate(rows, document)
    # Validate every audio against the manifest too, including preserved originals.
    for row in rows:
        for field, hash_field in (("audio_path", "audio_sha256"), ("original_audio_path", "source_audio_sha256")):
            if field not in row:
                continue
            path = (source / row[field]).resolve()
            if source not in path.parents or digest(path) != row[hash_field]:
                raise ValueError("Changed audio: " + row["sample_id"])
    shutil.copytree(source, output)
    shutil.copy2(source / "manifest.jsonl", output / "provenance" / "before-human-review-manifest.jsonl")
    shutil.copy2(source / "summary.json", output / "provenance" / "before-human-review-summary.json")
    shutil.copy2(source / "review-quality.html", output / "provenance" / "before-human-review-ui.html")
    (output / "provenance" / "human-review-export.json").write_bytes(review_bytes)
    shutil.copy2(Path(__file__), output / "provenance" / "import_audio_review.py")
    for row in rows:
        if row["sample_id"] not in reviews:
            continue
        decision = reviews[row["sample_id"]]
        row.update(human_review_status=decision["status"], review_status=decision["status"],
                   reviewer=decision["reviewer"], reviewed_at_utc=decision["reviewed_at"],
                   review_notes=decision["notes"], review_method="explicit_exported_user_decision",
                   record_type="augmented_reviewed", training_eligible=False, split="unassigned")
        row["training_blockers"] = ["speaker_and_session_groups_unverified", "independent_split_not_created"]
        if decision["status"] == "approved":
            row["transcript"] = row["transcript_candidate"]
            row["transcript_status"] = "inherited_transcript_approved_after_audibility_review"
            row["quality_status"] = "technical_and_human_review_passed"
        else:
            row["training_blockers"].append("human_review_not_approved")
        row["reviewed_pilot_eligible"] = decision["status"] == "approved" and row["technical_status"] != "rejected"
    (output / "manifest.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    approved = [r for r in rows if r.get("reviewed_pilot_eligible") or r["record_type"] == "normalized_parent"]
    (output / "approved-pilot.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in approved), encoding="utf-8")
    counts = collections.Counter(r["status"] for r in reviews.values())
    complete = counts["pending"] == 0 and counts["needs_review"] == 0
    summary = json.loads((source / "summary.json").read_text(encoding="utf-8"))
    summary.update(status="listening_review_complete_local_pilot_packaged" if complete else "partial_listening_review_imported",
                   phase4_listening_review_complete=complete, review_imported_at_utc=datetime.now(timezone.utc).isoformat(),
                   human_review_results=dict(counts), human_approved_derivatives=counts["approved"],
                   human_pending_derivatives=counts["pending"], approved_pilot_records=len(approved),
                   review_export_sha256=hashlib.sha256(review_bytes).hexdigest(),
                   package_type="human_reviewed_local_pilot_not_training_release", next_phase="Phase 5: local ASR inference smoke test; independent benchmark remains blocked")
    summary["limitations"] = [s for s in summary["limitations"] if s != "Human review of every derivative is pending"]
    (output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    (output / "status.json").write_text(json.dumps({"status": summary["status"]}), encoding="utf-8")
    receipt = {"review_file": str(review_file.resolve()), "review_export_sha256": summary["review_export_sha256"],
               "records_validated": len(reviews), "results": dict(counts), "source_pack": str(source),
               "reviewers": sorted({r["reviewer"] for r in reviews.values()}),
               "scope": "Audibility and transcript decisions only; no speaker grouping or independent split inferred"}
    (output / "review-import-receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    cards = []
    for row in rows:
        if row["sample_id"] in reviews:
            decision = reviews[row["sample_id"]]
            cards.append(f'<tr><td>{html.escape(row["sample_id"])}</td><td>{html.escape(decision["status"])}</td>'
                         f'<td>{html.escape(decision["reviewer"])}</td><td><audio controls preload="none" src="{html.escape(row["audio_path"], quote=True)}"></audio></td>'
                         f'<td>{html.escape(row["transcript_candidate"])}</td></tr>')
    (output / "review-quality.html").write_text(
        '<!doctype html><html lang="vi"><meta charset="utf-8"><title>Dataset pilot đã duyệt</title>'
        '<style>body{font:17px system-ui;margin:28px}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:10px}audio{width:260px}</style>'
        f'<h1>Kết quả duyệt pilot</h1><p>Giữ: {counts["approved"]}; loại: {counts["rejected"]}; cần xem lại: {counts["needs_review"]}; chưa duyệt: {counts["pending"]}.</p>'
        '<p>Đã nhập quyết định từ JSON và đối chiếu ID/hash audio. Đây là bộ pilot local đã duyệt, chưa phải release huấn luyện. Chưa chia train/test do thiếu nhóm người nói/phiên thu.</p>'
        '<table><tr><th>Mẫu</th><th>Kết quả</th><th>Người duyệt</th><th>Nghe</th><th>Transcript</th></tr>'
        + "".join(cards) + '</table></html>', encoding="utf-8")
    with (output / "SOURCE_AND_LICENSE.txt").open("a", encoding="utf-8") as stream:
        stream.write("\nHuman review imported from exact JSON export; see review-import-receipt.json. Audio bytes unchanged. No training eligibility, speaker identity, region, or independent evaluation split inferred.\n")
    checks = {p.relative_to(output).as_posix(): digest(p) for p in output.rglob("*") if p.is_file() and p != output / "checksums.json"}
    (output / "checksums.json").write_text(json.dumps(checks, indent=2), encoding="utf-8")
    archive = output.with_name(output.name + ".zip")
    with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED) as pack:
        for path in output.rglob("*"):
            if path.is_file():
                pack.write(path, path.relative_to(output).as_posix())
    with zipfile.ZipFile(archive) as pack:
        if pack.testzip() is not None:
            raise ValueError("ZIP integrity check failed")
        for name, expected in checks.items():
            if hashlib.sha256(pack.read(name)).hexdigest() != expected:
                raise ValueError("ZIP checksum mismatch")
    archive.with_suffix(".zip.sha256").write_text(digest(archive) + "  " + archive.name + "\n", encoding="utf-8")
    for name, expected in json.loads((source / "checksums.json").read_text(encoding="utf-8")).items():
        if digest(source / name) != expected:
            raise ValueError("Source changed during import")
    print(json.dumps(summary, ensure_ascii=True))
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--review", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    run(args.source, args.review, args.output)
