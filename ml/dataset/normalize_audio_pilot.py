"""Prepare approved audio for an augmentation pilot without inventing group labels."""
from __future__ import annotations

import argparse
import array
from datetime import datetime, timezone
import hashlib
import html
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import unicodedata
import wave


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalize_text(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).split())


def pcm_stats(path: Path) -> dict:
    with wave.open(str(path), "rb") as sound:
        channels, width, rate, count = (sound.getnchannels(), sound.getsampwidth(),
                                        sound.getframerate(), sound.getnframes())
        samples = array.array("h", sound.readframes(count))
    if sys.byteorder != "little":
        samples.byteswap()
    if not samples or (channels, width, rate) != (1, 2, 16000):
        raise ValueError(f"Unexpected PCM format: {path}")
    rms = math.sqrt(sum(v * v for v in samples) / len(samples)) / 32768
    clipping = sum(v >= 32767 or v <= -32768 for v in samples) / len(samples)
    return {"sample_rate": rate, "channels": channels, "sample_width_bytes": width,
            "frames": count, "duration_seconds": count / rate,
            "peak": max(abs(v) for v in samples) / 32768,
            "rms_dbfs": 20 * math.log10(max(rms, 1e-12)),
            "full_scale_sample_fraction": clipping}


def prepare(source: Path, output: Path) -> dict:
    source = source.resolve()
    output = output.resolve()
    if output == source or source in output.parents or output in source.parents:
        raise ValueError("Output must be separate from the source pack")
    rows = [json.loads(line) for line in (source / "manifest.jsonl").read_text(encoding="utf-8").splitlines()]
    receipt = json.loads((source / "review-approval.json").read_text(encoding="utf-8"))
    ids = [row["sample_id"] for row in rows]
    if not rows or len(ids) != len(set(ids)) or set(ids) != set(receipt["sample_ids"]):
        raise ValueError("Approval receipt and manifest sample IDs do not match")
    for row in rows:
        path = (source / row["audio_path"]).resolve()
        if source not in path.parents:
            raise ValueError("Audio path escapes source pack")
        if row["review_status"] != "approved" or not row.get("reviewed_transcript", "").strip():
            raise ValueError(f"Missing approved transcript: {row['sample_id']}")
        if sha256(path) != row["audio_sha256"]:
            raise ValueError(f"Source audio changed: {row['sample_id']}")
    initial = {p.name: sha256(p) for p in source.iterdir() if p.is_file()}
    output.mkdir(parents=True, exist_ok=False)
    (output / "originals").mkdir()
    (output / "normalized").mkdir()
    (output / "provenance").mkdir()
    (output / "status.json").write_text('{"status":"in_progress"}', encoding="utf-8")
    for name in ("manifest.jsonl", "review.csv", "review-approval.json", "SOURCE_AND_LICENSE.txt", "summary.json"):
        shutil.copy2(source / name, output / "provenance" / name)
    ffmpeg_version = subprocess.check_output(["ffmpeg", "-version"], encoding="utf-8").splitlines()[0]
    prepared = []
    warnings = []
    for row in rows:
        source_audio = source / row["audio_path"]
        original_rel = "originals/" + source_audio.name
        normalized_rel = f"normalized/{row['sample_id']}.wav"
        original = output / original_rel
        normalized = output / normalized_rel
        shutil.copy2(source_audio, original)
        command = ["ffmpeg", "-nostdin", "-v", "error", "-n", "-i", str(original),
                   "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(normalized)]
        subprocess.run(command, check=True, capture_output=True)
        stats = pcm_stats(normalized)
        if abs(stats["duration_seconds"] - row["duration_seconds"]) > 0.15:
            raise ValueError(f"Unexpected duration change for {row['sample_id']}")
        flags = []
        if stats["rms_dbfs"] < -60:
            flags.append("very_low_level_needs_listening")
        if stats["full_scale_sample_fraction"] > 0.001:
            flags.append("full_scale_samples_needs_listening")
        if flags:
            warnings.append({"sample_id": row["sample_id"], "flags": flags})
        text = normalize_text(row["reviewed_transcript"])
        if not text:
            raise ValueError("Empty normalized transcript")
        prepared.append({
            **row, "audio_path": normalized_rel, "original_audio_path": original_rel,
            "source_pack": str(source), "source_audio_sha256": row["audio_sha256"],
            "audio_sha256": sha256(normalized), "source_transcript": row["source_transcript"],
            "reviewed_transcript_before_normalization": row["reviewed_transcript"],
            "transcript": text, "transcript_normalization": "Unicode NFC; collapse whitespace only",
            "audio_transform": {"operation": "decode_and_resample", "sample_rate": 16000,
                                "channels": 1, "encoding": "PCM signed 16-bit little-endian",
                                "trim": False, "denoise": False, "gain_adjustment": False},
            **stats, "quality_flags": flags,
            "augmentation_eligible": not flags, "training_eligible": False,
            "split": "unassigned", "speaker_group": row.get("speaker_group"),
            "session_group": row.get("session_group"),
            "training_blockers": ["speaker_and_session_groups_unverified", "independent_split_not_created"],
            "individual_consent_record": None,
            "rights_basis": "Published FPT dataset permission and CC-BY-4.0 listing; see provenance notice",
        })
        print(f"Normalized {row['sample_id']}", flush=True)
    for row in prepared:
        if sha256(source / next(r["audio_path"] for r in rows if r["sample_id"] == row["sample_id"])) != row["source_audio_sha256"]:
            raise ValueError("Source audio changed during run")
        if sha256(output / row["original_audio_path"]) != row["source_audio_sha256"]:
            raise ValueError("Original copy hash mismatch")
    if initial != {p.name: sha256(p) for p in source.iterdir() if p.is_file()}:
        raise ValueError("Source pack metadata changed during run")
    (output / "manifest.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in prepared), encoding="utf-8")
    cards = "".join(
        f'<tr><td>{r["sample_id"]}</td><td><audio controls preload="none" src="{r["original_audio_path"]}"></audio></td>'
        f'<td><audio controls preload="none" src="{r["audio_path"]}"></audio></td><td>{html.escape(r["transcript"])}</td></tr>'
        for r in prepared)
    (output / "listen-normalized.html").write_text(
        '<!doctype html><html lang="vi"><meta charset="utf-8"><title>Audio Phase 2</title>'
        '<style>body{font:16px system-ui;margin:25px}table{border-collapse:collapse;width:100%}'
        'td,th{border:1px solid #bbb;padding:10px;text-align:left}audio{width:250px}</style>'
        '<h1>Phase 2 — audio đã chuẩn hóa</h1><p>30 mẫu tiếng Việt nói chung; transcript đã được chủ dự án xác nhận duyệt. '
        'WAV mono 16 kHz, giữ toàn bộ lời; chưa tạo hiệu ứng, chưa train, chưa chia train/test.</p>'
        '<table><tr><th>Mẫu</th><th>MP3 nguồn</th><th>WAV chuẩn hóa</th><th>Transcript</th></tr>'
        + cards + '</table></html>', encoding="utf-8")
    (output / "SOURCE_AND_LICENSE.txt").write_text(
        (source / "SOURCE_AND_LICENSE.txt").read_text(encoding="utf-8")
        + "\nPhase 2 modifications: copied originals unchanged; decoded/resampled to mono 16 kHz PCM16 WAV; "
          "normalized reviewed transcripts to Unicode NFC and collapsed whitespace. No augmentation, "
          "trimming, noise suppression, training, or dataset splitting.\n", encoding="utf-8")
    report = {"phase": 2, "status": "complete_for_general_vietnamese_technical_pilot" if not warnings else "needs_audio_review",
              "created_at_utc": datetime.now(timezone.utc).isoformat(), "source_pack": str(source),
              "originals_preserved": len(prepared), "normalized_clips": len(prepared),
              "approved_transcripts": len(prepared), "duration_seconds": round(sum(r["duration_seconds"] for r in prepared), 3),
              "augmentation_eligible": sum(r["augmentation_eligible"] for r in prepared),
              "warnings": warnings, "source_pack_unchanged": True, "training_eligible": 0,
              "split_created": False, "derivatives_created": 0,
              "missing_metadata": ["speaker IDs", "recording session IDs", "verified regional accent", "individual consent records (published dataset license is recorded separately)"],
              "next_phase": "Phase 3: build indoor fan, room reverb and fan-plus-reverb augmentation",
              "ffmpeg_version": ffmpeg_version, "script_sha256": sha256(Path(__file__))}
    (output / "summary.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (output / "status.json").write_text(json.dumps({"status": report["status"]}), encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(prepare(args.source, args.output), ensure_ascii=True))
