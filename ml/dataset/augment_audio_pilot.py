"""Generate a reproducible indoor audio preview. Output labels require listening review."""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import html
import json
from pathlib import Path
import shutil
import wave

import numpy as np

RATE = 16000
VARIANTS = ("fan", "room_reverb", "fan_plus_room_reverb")
CONFIG = {
    "version": "indoor-algorithmic-v2-stronger-room", "sample_rate": RATE, "base_seed": 20261111,
    "fan": {"type": "algorithmic_fan_like_noise_not_real_recording", "snr_db": 20.0,
            "harmonics_hz": [100, 200, 300], "noise_lowpass_hz": 1100,
            "modulation_hz": 4.0, "snr_reference": "whole_clip_rms_including_pauses"},
    "room_reverb": {"type": "algorithmic_rir_not_measured_room", "nominal_decay_rt60_seconds": 0.65,
                    "tail_seconds": 1.1, "wet_gain": 1.0,
                    "early_reflections_ms": [21, 37, 61, 89],
                    "early_reflection_gains": [0.5, -0.4, 0.3, 0.22],
                    "diffuse_l2_norm": 0.6},
    "combined_order": "room_reverb_then_add_fan",
    "peak_ceiling": 0.98, "trim": False, "denoise": False,
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as source:
        if (source.getframerate(), source.getnchannels(), source.getsampwidth()) != (RATE, 1, 2):
            raise ValueError(f"Expected mono 16 kHz PCM16: {path}")
        data = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2").astype(np.float64) / 32768
    if not len(data) or not np.all(np.isfinite(data)) or rms(data) < 1e-7:
        raise ValueError("Empty, nonfinite or near-silent source")
    return data


def rms(data: np.ndarray) -> float:
    return float(np.sqrt(np.mean(data * data)))


def seed_for(sample_id: str, variant: str) -> int:
    return int.from_bytes(hashlib.sha256(f'{CONFIG["base_seed"]}:{sample_id}:{variant}'.encode()).digest()[:8], "little")


def fan_noise(size: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    white = rng.normal(size=size)
    spectrum = np.fft.rfft(white)
    freq = np.fft.rfftfreq(size, 1 / RATE)
    shape = (1 - np.exp(-((freq / 35) ** 2))) / np.sqrt(1 + (freq / CONFIG["fan"]["noise_lowpass_hz"]) ** 4)
    broad = np.fft.irfft(spectrum * shape, n=size)
    broad /= max(rms(broad), 1e-12)
    times = np.arange(size) / RATE
    tone = np.zeros(size)
    for index, hz in enumerate(CONFIG["fan"]["harmonics_hz"], 1):
        tone += np.sin(2 * np.pi * hz * times + rng.uniform(0, 2 * np.pi)) / index
    tone /= max(rms(tone), 1e-12)
    modulation = 1 + 0.12 * np.sin(2 * np.pi * CONFIG["fan"]["modulation_hz"] * times)
    return (0.90 * broad + 0.10 * tone) * modulation


def room_ir(seed: int) -> np.ndarray:
    params = CONFIG["room_reverb"]
    size = int(params["tail_seconds"] * RATE)
    times = np.arange(size) / RATE
    rng = np.random.default_rng(seed)
    diffuse = rng.normal(size=size) * np.exp(-np.log(1000) * times / params["nominal_decay_rt60_seconds"])
    diffuse[:int(0.012 * RATE)] = 0
    diffuse *= params["diffuse_l2_norm"] / max(float(np.linalg.norm(diffuse)), 1e-12)
    for ms, gain in zip(params["early_reflections_ms"], params["early_reflection_gains"]):
        diffuse[round(ms * RATE / 1000)] += gain
    return diffuse


def render(clean: np.ndarray, variant: str, seed: int) -> tuple[np.ndarray, dict, np.ndarray, np.ndarray | None]:
    speech = clean.copy()
    impulse = None
    params = {"seed": seed, "variant": variant}
    if variant in ("room_reverb", "fan_plus_room_reverb"):
        impulse = room_ir(seed)
        size = len(clean) + len(impulse) - 1
        fft_size = 1 << (size - 1).bit_length()
        wet = np.fft.irfft(np.fft.rfft(clean, fft_size) * np.fft.rfft(impulse, fft_size), fft_size)[:size]
        speech = np.pad(clean, (0, size - len(clean))) + CONFIG["room_reverb"]["wet_gain"] * wet
        params["reverb_tail_preserved_seconds"] = (size - len(clean)) / RATE
        params["wet_to_dry_energy_db"] = float(10 * np.log10(
            np.sum((CONFIG["room_reverb"]["wet_gain"] * wet) ** 2) / np.sum(clean ** 2)))
    noise = np.zeros(len(speech))
    if variant in ("fan", "fan_plus_room_reverb"):
        noise = fan_noise(len(speech), seed)
        noise *= rms(speech) / (10 ** (CONFIG["fan"]["snr_db"] / 20) * rms(noise))
        params["actual_component_snr_db"] = 20 * np.log10(rms(speech) / rms(noise))
    mixed = speech + noise
    peak = float(np.max(np.abs(mixed)))
    gain = min(1.0, CONFIG["peak_ceiling"] / max(peak, 1e-12))
    output = mixed * gain
    if not np.all(np.isfinite(output)) or len(output) < len(clean):
        raise ValueError("Nonfinite output or speech truncated")
    params.update(global_peak_guard_gain=gain, peak_before_guard=peak,
                  duration_seconds=len(output) / RATE, parent_speech_frames=len(clean), output_frames=len(output))
    return output, params, noise * gain, impulse


def write_wav(path: Path, data: np.ndarray) -> None:
    pcm = np.rint(data * 32768)
    if np.max(pcm) > 32767 or np.min(pcm) < -32768:
        raise ValueError("Refusing clipped PCM conversion")
    with wave.open(str(path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(RATE)
        target.writeframes(pcm.astype("<i2").tobytes())


def run(source: Path, output: Path, approval: Path | None = None) -> dict:
    source, output = source.resolve(), output.resolve()
    if source == output or source in output.parents or output in source.parents:
        raise ValueError("Output must be separate from input")
    all_rows = [json.loads(s) for s in (source / "manifest.jsonl").read_text(encoding="utf-8").splitlines()]
    approved = None
    if approval is not None:
        approved = json.loads(approval.read_text(encoding="utf-8"))
        approved_config_path = Path(approved["preview_pack"]) / "config.json"
        if (approved.get("status") != "effect_configuration_approved"
                or approved.get("config_sha256") != digest(approved_config_path)
                or json.loads(approved_config_path.read_text(encoding="utf-8")) != CONFIG):
            raise ValueError("Full batch requires approval of the exact current effect configuration")
    # Preview samples are not claimed to be independent speakers.
    wanted = [r["sample_id"] for r in all_rows] if approved else ["fpt-pilot-001", "fpt-pilot-009", "fpt-pilot-013"]
    if len(wanted) != len(set(wanted)) or not wanted:
        raise ValueError("Empty or duplicate source sample IDs")
    by_id = {r["sample_id"]: r for r in all_rows}
    parents = [by_id[s] for s in wanted]
    snapshot = {p.relative_to(source).as_posix(): digest(p) for p in source.rglob("*") if p.is_file()}
    for parent in parents:
        path = (source / parent["audio_path"]).resolve()
        if source not in path.parents or digest(path) != parent["audio_sha256"]:
            raise ValueError("Unsafe path or changed parent audio")
        if not parent.get("augmentation_eligible") or parent["review_status"] != "approved" or not parent.get("transcript"):
            raise ValueError("Parent audio/transcript is not approved for augmentation")
    output.mkdir(parents=True, exist_ok=False)
    for directory in ("parents", "audio", "components", "provenance"):
        (output / directory).mkdir()
    (output / "status.json").write_text('{"status":"in_progress"}', encoding="utf-8")
    for name in ("manifest.jsonl", "summary.json", "SOURCE_AND_LICENSE.txt"):
        shutil.copy2(source / name, output / "provenance" / name)
    if approval is not None:
        shutil.copy2(approval, output / "provenance" / "effect-approval.json")
    (output / "config.json").write_text(json.dumps(CONFIG, indent=2), encoding="utf-8")
    shutil.copy2(Path(__file__), output / "provenance" / "augment_audio_pilot.py")
    config_hash = digest(output / "config.json")
    records, sections = [], []
    for parent in parents:
        parent_rel = f'parents/{parent["sample_id"]}.wav'
        shutil.copy2(source / parent["audio_path"], output / parent_rel)
        clean = read_wav(output / parent_rel)
        players = [f'<td>Gốc<br><audio controls preload="none" src="{parent_rel}"></audio></td>']
        for variant in VARIANTS:
            child_id = parent["sample_id"] + "-" + variant
            seed = seed_for(parent["sample_id"], variant)
            rendered, parameters, noise, impulse = render(clean, variant, seed)
            relative = f"audio/{child_id}.wav"
            write_wav(output / relative, rendered)
            decoded = read_wav(output / relative)
            assert len(decoded) == len(rendered) and float(np.max(np.abs(decoded))) < 1
            components = {}
            if variant != "room_reverb":
                noise_rel = f"components/{child_id}-fan.npy"
                np.save(output / noise_rel, noise, allow_pickle=False)
                components["added_noise"] = {"path": noise_rel, "sha256": digest(output / noise_rel)}
            if impulse is not None:
                ir_rel = f"components/{child_id}-rir.npy"
                np.save(output / ir_rel, impulse, allow_pickle=False)
                components["wet_impulse_response"] = {"path": ir_rel, "sha256": digest(output / ir_rel)}
            records.append({
                "sample_id": child_id, "parent_audio_id": parent["sample_id"],
                "audio_path": relative, "parent_audio_path": parent_rel,
                "parent_audio_sha256": parent["audio_sha256"], "audio_sha256": digest(output / relative),
                "transcript_candidate": parent["transcript"],
                "transcript_status": "inherited_candidate_pending_audibility_review",
                "parent_review_status": "approved", "review_status": "pending", "reviewer": "",
                "training_eligible": False, "split": "unassigned",
                "source_group": parent["source_group"], "speaker_group": parent.get("speaker_group"),
                "session_group": parent.get("session_group"), "region": parent.get("region"),
                "source_url": parent["source_url"], "mirror_url": parent["mirror_url"],
                "source_audio_sha256": parent["source_audio_sha256"],
                "source_rights": parent["rights_basis"],
                "synthetic_acoustic_effects": True, "synthetic_speech_generated": False,
                "parent_speech_synthetic_status": parent.get("synthetic"),
                "effect": variant, "parameters": parameters, "components": components,
                "config_sha256": config_hash, "script_sha256": digest(Path(__file__)),
                "numpy_version": np.__version__, "sample_rate": RATE, "channels": 1,
                "full_scale_sample_count": int(np.sum(np.abs(decoded) >= 1)),
                "quality_status": "technical_checks_passed_listening_pending",
            })
            players.append(f'<td>{variant}<br><audio controls preload="none" src="{relative}"></audio></td>')
            print(f"Created {child_id}", flush=True)
        sections.append(f'<h2>{parent["sample_id"]}</h2><p>{html.escape(parent["transcript"])}</p><table><tr>' + "".join(players) + '</tr></table>')
    after = {p.relative_to(source).as_posix(): digest(p) for p in source.rglob("*") if p.is_file()}
    if snapshot != after:
        raise ValueError("Source pack changed during generation")
    (output / "manifest.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in records), encoding="utf-8")
    with (output / "review.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        fields = ["sample_id", "parent_audio_id", "effect", "transcript_candidate", "review_status", "reviewer", "review_notes"]
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)
    (output / "listen-preview.html").write_text(
        '<!doctype html><html lang="vi"><meta charset="utf-8"><title>Phase 3 — nghe thử hiệu ứng</title>'
        '<style>body{font:17px system-ui;margin:28px}table{width:100%;border-collapse:collapse}'
        'td{border:1px solid #bbb;padding:12px}audio{width:100%;min-width:190px}h2{margin-top:35px}'
        '@media(max-width:900px){table,tr,td{display:block}}</style>'
        f'<h1>Phase 3 — {len(records)} bản phái sinh từ {len(parents)} audio</h1><p>Tiếng quạt và vang đều được tạo bằng thuật toán, '
        'chưa được xác thực tương đương môi trường thực. Quạt ở SNR 20 dB tính theo RMS toàn đoạn; '
        f'vang có tham số suy giảm danh nghĩa {CONFIG["room_reverb"]["nominal_decay_rt60_seconds"]} giây, '
        f'hệ số âm phản xạ {CONFIG["room_reverb"]["wet_gain"]}. Giữ toàn bộ lời và đuôi vang.</p>'
        '<p>Nghe gốc và ba bản bên cạnh. Cho biết quạt/vang đang nhẹ, vừa hay quá mạnh; '
        'kiểm tra còn nghe đúng toàn bộ lời. Các bản mới đang chờ duyệt, chưa dùng train. '
        + ('Cấu hình đã được bạn chốt; các file mới chờ duyệt chất lượng ở Phase 4.</p>' if approved
           else 'Chờ bạn chốt mức tác động trước khi tạo đủ 90 bản.</p>') + "".join(sections) +
        '<p>Tiếng Việt nói chung; chưa xác minh giọng Đà Nẵng–Quảng Nam. Nguồn/quyền: SOURCE_AND_LICENSE.txt.</p></html>', encoding="utf-8")
    (output / "SOURCE_AND_LICENSE.txt").write_text(
        (source / "SOURCE_AND_LICENSE.txt").read_text(encoding="utf-8") +
        f'\nPhase 3 modifications: {len(records)} algorithmically augmented files from {len(parents)} normalized parents; '
        'fan-like noise, synthetic room impulse response, or both. Full parameters, seed and lineage '
        'are saved. No external noise recording, TTS, model training or splitting was used. '
        'These augmented outputs and inherited transcript candidates await individual quality review.\n', encoding="utf-8")
    summary = {"phase": 3, "status": "generation_complete_awaiting_phase4_quality_review" if approved else "preview_ready_awaiting_user_effect_review",
               "created_at_utc": datetime.now(timezone.utc).isoformat(),
               "parent_clips": len(parents), "derivative_clips": len(records), "variants_per_parent": 3,
               "technical_checks_passed": len(records), "approved_derivatives": 0, "training_eligible": 0,
               "source_pack_unchanged": True, "split_created": False,
               "full_batch_created": approved is not None, "effect_configuration_approved": approved is not None,
               "planned_full_batch_derivatives": len(all_rows) * 3,
               "config_sha256": config_hash, "source_pack": str(source),
               "review_request": "Review generated files for audibility in Phase 4." if approved else "Confirm or adjust fan/reverb strength and full speech audibility before full batch."}
    (output / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (output / "status.json").write_text(json.dumps({"status": summary["status"]}), encoding="utf-8")
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--approval", type=Path, help="Exact effect-config approval receipt enables full batch")
    args = parser.parse_args()
    print(json.dumps(run(args.source, args.output, args.approval)))
