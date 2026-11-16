"""Quality-check the full augmentation batch and package a review-only pilot."""
from __future__ import annotations

import argparse
import collections
from datetime import datetime, timezone
import hashlib
import html
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import wave
import zipfile

import numpy as np


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot(root: Path) -> dict:
    return {p.relative_to(root).as_posix(): digest(p) for p in root.rglob("*") if p.is_file()}


def metrics(path: Path) -> tuple[dict, np.ndarray]:
    subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"],
                   check=True, capture_output=True)
    with wave.open(str(path), "rb") as sound:
        if (sound.getframerate(), sound.getnchannels(), sound.getsampwidth()) != (16000, 1, 2):
            raise ValueError("wrong_audio_format")
        data = np.frombuffer(sound.readframes(sound.getnframes()), dtype="<i2")
    if not len(data):
        raise ValueError("empty_audio")
    signal = data.astype(np.float64) / 32768
    rms = float(np.sqrt(np.mean(signal ** 2)))
    return {"duration_seconds": len(data) / 16000, "frames": len(data),
            "peak_dbfs": float(20 * np.log10(max(np.max(np.abs(signal)), 1e-12))),
            "rms_dbfs": float(20 * np.log10(max(rms, 1e-12))),
            "full_scale_samples": int(np.sum((data == -32768) | (data == 32767)))}, data


def build(source: Path, output: Path) -> dict:
    source, output = source.resolve(), output.resolve()
    if source == output or source in output.parents or output in source.parents:
        raise ValueError("Output must be separate from source")
    before = snapshot(source)
    rows = [json.loads(s) for s in (source / "manifest.jsonl").read_text(encoding="utf-8").splitlines()]
    source_summary = json.loads((source / "summary.json").read_text(encoding="utf-8"))
    phase2 = Path(source_summary["source_pack"])
    phase2_before = snapshot(phase2)
    parents = [json.loads(s) for s in (phase2 / "manifest.jsonl").read_text(encoding="utf-8").splitlines()]
    by_parent = {r["sample_id"]: r for r in parents}
    counts = collections.Counter(r["parent_audio_id"] for r in rows)
    if len(rows) != 90 or len(set(r["sample_id"] for r in rows)) != 90 or len(by_parent) != 30:
        raise ValueError("Expected 30 unique parents and 90 unique derivatives")
    if set(counts) != set(by_parent) or set(counts.values()) != {3}:
        raise ValueError("Unexpected parent coverage")
    for parent_id in by_parent:
        if {r["effect"] for r in rows if r["parent_audio_id"] == parent_id} != {"fan", "room_reverb", "fan_plus_room_reverb"}:
            raise ValueError("Missing or duplicate effect")
    script = source / "provenance" / "augment_audio_pilot.py"
    spec = importlib.util.spec_from_file_location("frozen_augmenter", script)
    augmenter = importlib.util.module_from_spec(spec)
    previous_bytecode_setting = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(augmenter)
    finally:
        sys.dont_write_bytecode = previous_bytecode_setting
    if json.loads((source / "config.json").read_text(encoding="utf-8")) != augmenter.CONFIG:
        raise ValueError("Frozen generation code and configuration differ")
    output.mkdir(parents=True, exist_ok=False)
    (output / "status.json").write_text('{"status":"in_progress"}', encoding="utf-8")
    for directory in ("audio", "parents", "components"):
        shutil.copytree(source / directory, output / directory)
    (output / "raw-mp3").mkdir()
    (output / "provenance").mkdir()
    for name in ("manifest.jsonl", "summary.json", "verification.json"):
        shutil.copy2(source / name, output / "provenance" / ("phase3-" + name))
    shutil.copytree(source / "provenance", output / "provenance" / "phase3")
    shutil.copytree(phase2 / "provenance", output / "provenance" / "phase2-source-review")
    for name in ("config.json", "SOURCE_AND_LICENSE.txt"):
        shutil.copy2(source / name, output / name)
    audit, manifest, ui = [], [], []
    known_hashes = {}
    for parent in parents:
        pid = parent["sample_id"]
        path = output / "parents" / (pid + ".wav")
        if digest(path) != parent["audio_sha256"]:
            raise ValueError("Parent hash mismatch")
        values, _ = metrics(path)
        raw_source = phase2 / parent["original_audio_path"]
        if digest(raw_source) != parent["source_audio_sha256"]:
            raise ValueError("Raw MP3 hash mismatch")
        raw_rel = "raw-mp3/" + raw_source.name
        shutil.copy2(raw_source, output / raw_rel)
        record = {**parent, "audio_path": f"parents/{pid}.wav", "original_audio_path": raw_rel,
                  "record_type": "normalized_parent", "human_review_status": "approved_original_by_project_owner",
                  "technical_status": "accepted", "training_eligible": False, "split": "unassigned"}
        manifest.append(record)
        audit.append({"sample_id": pid, "technical_status": "accepted", **values, "reasons": []})
        known_hashes[digest(path)] = pid
    for row in rows:
        reasons, warnings = [], []
        path = output / row["audio_path"]
        try:
            actual_hash = digest(path)
            if actual_hash != row["audio_sha256"]:
                reasons.append("hash_mismatch")
            values, samples = metrics(path)
            if values["full_scale_samples"]:
                reasons.append("clipped_pcm_samples")
            if values["rms_dbfs"] < -45:
                warnings.append("low_level_listen_required")
            if actual_hash in known_hashes:
                reasons.append("duplicate_audio_bytes:" + known_hashes[actual_hash])
            known_hashes[actual_hash] = row["sample_id"]
            parent_path = output / row["parent_audio_path"]
            if digest(parent_path) != row["parent_audio_sha256"]:
                reasons.append("parent_hash_mismatch")
            for component in row["components"].values():
                if digest(output / component["path"]) != component["sha256"]:
                    reasons.append("component_hash_mismatch")
            clean = augmenter.read_wav(parent_path)
            rendered, parameters, noise, impulse = augmenter.render(clean, row["effect"], row["parameters"]["seed"])
            if not np.array_equal(samples, np.rint(rendered * 32768).astype("<i2")):
                reasons.append("cannot_reproduce_audio")
            if len(samples) < len(clean) or len(samples) != row["parameters"]["output_frames"]:
                reasons.append("unexpected_duration_or_truncation")
            if "actual_component_snr_db" in parameters and abs(parameters["actual_component_snr_db"] - 20) > 0.01:
                reasons.append("snr_mismatch")
        except (ValueError, OSError, subprocess.CalledProcessError) as error:
            values = {}
            reasons.append(type(error).__name__ + ":" + str(error)[:150])
        status = "rejected" if reasons else "needs_review" if warnings else "accepted"
        record = {**row, "record_type": "augmented_candidate", "technical_status": status,
                  "technical_reasons": reasons, "quality_warnings": warnings,
                  "human_review_status": "pending", "review_status": "pending",
                  "training_eligible": False, "split": "unassigned",
                  "training_blockers": ["derivative_audibility_review_pending", "speaker_and_session_groups_unverified", "independent_split_not_created"]}
        manifest.append(record)
        audit.append({"sample_id": row["sample_id"], "technical_status": status,
                      **values, "reasons": reasons, "warnings": warnings})
        ui.append({"sample_id": row["sample_id"], "parent_audio_id": row["parent_audio_id"],
                   "audio_path": row["audio_path"], "parent_audio_path": row["parent_audio_path"],
                   "audio_sha256": row["audio_sha256"], "effect": row["effect"],
                   "text": row["transcript_candidate"], "technical_status": status,
                   "technical_notes": "; ".join(reasons + warnings)})
    (output / "manifest.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in manifest), encoding="utf-8")
    (output / "quality-checks.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in audit), encoding="utf-8")
    template = Path(__file__).with_name("audio_quality_review.html").read_text(encoding="utf-8")
    embedded = json.dumps(ui, ensure_ascii=False).replace("<", "\\u003c")
    (output / "review-quality.html").write_text(template.replace("__ROWS_JSON__", embedded), encoding="utf-8")
    if before != snapshot(source) or phase2_before != snapshot(phase2):
        raise ValueError("Source dataset changed during packaging")
    derivatives_audit = [r for r in audit if r["sample_id"] not in by_parent]
    summary = {"phase": 4, "status": "technical_review_and_candidate_package_ready_human_review_pending",
               "created_at_utc": datetime.now(timezone.utc).isoformat(),
               "normalized_parents": 30, "raw_mp3_preserved": 30, "augmented_candidates": 90,
               "technical_results_derivatives": dict(collections.Counter(r["technical_status"] for r in derivatives_audit)),
               "human_approved_derivatives": 0, "human_pending_derivatives": 90,
               "training_eligible_records": 0, "split_created": False, "source_packs_unchanged": True,
               "source_pack": str(source), "package_type": "review_candidate_not_training_release",
               "limitations": ["Human review of every derivative is pending", "Speaker/session grouping is unknown", "No independent evaluation split", "No verified Da Nang or Quang Nam accents", "Dataset permission is recorded; no individual consent records invented"]}
    (output / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    with (output / "SOURCE_AND_LICENSE.txt").open("a", encoding="utf-8") as stream:
        stream.write("\nPhase 4: packaged unchanged raw MP3, normalized parent WAV and augmented candidate WAV; technical QC added. Individual derivative listening review remains pending. Not a training release.\n")
    (output / "status.json").write_text(json.dumps({"status": summary["status"]}), encoding="utf-8")
    checksums = snapshot(output)
    (output / "checksums.json").write_text(json.dumps(checksums, indent=2), encoding="utf-8")
    archive = output.with_name(output.name + ".zip")
    with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED) as pack:
        for path in output.rglob("*"):
            if path.is_file():
                pack.write(path, path.relative_to(output).as_posix())
    with zipfile.ZipFile(archive) as pack:
        if pack.testzip() is not None:
            raise ValueError("ZIP integrity check failed")
        for name, expected in checksums.items():
            if hashlib.sha256(pack.read(name)).hexdigest() != expected:
                raise ValueError("ZIP file hash differs: " + name)
    archive.with_suffix(".zip.sha256").write_text(digest(archive) + "  " + archive.name + "\n", encoding="utf-8")
    print(json.dumps(summary), flush=True)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build(args.source, args.output)
