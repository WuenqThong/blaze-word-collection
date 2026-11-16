"""Local frozen-model inference on a reviewed pilot; not held-out model evaluation."""
from __future__ import annotations

import argparse
import collections
import hashlib
import html
import json
from pathlib import Path
import time
import unicodedata
import wave

import numpy as np
import torch
import transformers
from transformers import WhisperForConditionalGeneration, WhisperProcessor


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFC", text).lower()
    return " ".join("".join(" " if unicodedata.category(c).startswith("P") else c for c in text).split())


def edit_distance(reference, hypothesis) -> int:
    prev = list(range(len(hypothesis) + 1))
    for i, a in enumerate(reference, 1):
        curr = [i]
        for j, b in enumerate(hypothesis, 1):
            curr.append(min(curr[-1] + 1, prev[j] + 1, prev[j - 1] + (a != b)))
        prev = curr
    return prev[-1]


def run(dataset: Path, model_path: Path, output: Path) -> dict:
    dataset, model_path = dataset.resolve(), model_path.resolve()
    rows = [json.loads(s) for s in (dataset / "approved-pilot.jsonl").read_text(encoding="utf-8").splitlines()]
    if not rows:
        raise ValueError("No approved pilot records")
    for row in rows:
        path = (dataset / row["audio_path"]).resolve()
        if dataset not in path.parents or hashlib.sha256(path.read_bytes()).hexdigest() != row["audio_sha256"]:
            raise ValueError("Invalid/changed audio")
        if row["record_type"] != "normalized_parent" and row.get("human_review_status") != "approved":
            raise ValueError("Unapproved derivative")
        if not row.get("transcript"):
            raise ValueError("Missing approved transcript")
    metadata = json.loads((model_path / "download-manifest.json").read_text(encoding="utf-8"))
    for name, expected in metadata["files"].items():
        if hashlib.sha256((model_path / name).read_bytes()).hexdigest() != expected:
            raise ValueError("Changed model file: " + name)
    output.mkdir(parents=True, exist_ok=False)
    (output / "status.json").write_text('{"status":"in_progress"}', encoding="utf-8")
    load_start = time.perf_counter()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch.manual_seed(0)
    processor = WhisperProcessor.from_pretrained(str(model_path), local_files_only=True)
    model = WhisperForConditionalGeneration.from_pretrained(str(model_path), local_files_only=True,
                                                           dtype=torch.float32, attn_implementation="eager")
    model = model.to(device).eval()
    model_load_seconds = time.perf_counter() - load_start
    if device == "cuda":
        torch.cuda.reset_peak_memory_stats()
    predictions = []
    with (output / "predictions.jsonl").open("w", encoding="utf-8") as stream:
        for index, row in enumerate(rows, 1):
            with wave.open(str(dataset / row["audio_path"]), "rb") as source:
                if (source.getframerate(), source.getnchannels(), source.getsampwidth()) != (16000, 1, 2):
                    raise ValueError("Unexpected audio format")
                audio = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2").astype(np.float32) / 32768
            if len(audio) > 30 * 16000:
                raise ValueError("This pilot runner handles clips up to 30 seconds")
            start = time.perf_counter()
            inputs = processor(audio, sampling_rate=16000, return_tensors="pt", return_attention_mask=True)
            with torch.inference_mode():
                ids = model.generate(input_features=inputs.input_features.to(device),
                                     attention_mask=inputs.attention_mask.to(device),
                                     language="vi", task="transcribe", max_new_tokens=256,
                                     do_sample=False, num_beams=1, return_timestamps=False)
            if device == "cuda":
                torch.cuda.synchronize()
            seconds = time.perf_counter() - start
            prediction = processor.batch_decode(ids, skip_special_tokens=True)[0].strip()
            reference = row["transcript"]
            ref, hyp = normalize(reference), normalize(prediction)
            words, hyp_words = ref.split(), hyp.split()
            chars, hyp_chars = ref.replace(" ", ""), hyp.replace(" ", "")
            word_errors, char_errors = edit_distance(words, hyp_words), edit_distance(chars, hyp_chars)
            result = {"sample_id": row["sample_id"], "parent_audio_id": row.get("parent_audio_id", row["sample_id"]),
                      "condition": row.get("effect", "original"), "reference": reference,
                      "prediction": prediction, "reference_normalized": ref, "prediction_normalized": hyp,
                      "word_errors": word_errors, "reference_words": len(words),
                      "character_errors": char_errors, "reference_characters": len(chars),
                      "wer": word_errors / len(words), "cer": char_errors / len(chars),
                      "audio_seconds": len(audio) / 16000, "inference_seconds": seconds,
                      "audio_path": row["audio_path"], "audio_sha256": row["audio_sha256"]}
            stream.write(json.dumps(result, ensure_ascii=False) + "\n")
            stream.flush()
            predictions.append(result)
            print(f"Recognized {index}/{len(rows)}: {row['sample_id']}", flush=True)
    grouped = collections.defaultdict(list)
    for row in predictions:
        grouped[row["condition"]].append(row)
    scores = {}
    for condition, group in grouped.items():
        scores[condition] = {"clips": len(group),
                             "wer": sum(r["word_errors"] for r in group) / sum(r["reference_words"] for r in group),
                             "cer": sum(r["character_errors"] for r in group) / sum(r["reference_characters"] for r in group),
                             "audio_seconds": sum(r["audio_seconds"] for r in group),
                             "inference_seconds": sum(r["inference_seconds"] for r in group)}
    summary = {"phase": 5, "status": "local_inference_diagnostic_complete_not_independent_benchmark",
               "model_id": metadata["model_id"], "revision": metadata["revision"], "license": metadata["license"],
               "device": device, "gpu": torch.cuda.get_device_name(0) if device == "cuda" else None,
               "torch": torch.__version__, "transformers": transformers.__version__,
               "model_load_seconds": model_load_seconds,
               "peak_cuda_allocated_bytes": torch.cuda.max_memory_allocated() if device == "cuda" else None,
               "records": len(predictions), "conditions": scores, "training_performed": False,
               "audio_sent_to_remote_service": False, "dataset": str(dataset),
               "scoring": "NFC, lowercase, replace Unicode punctuation with spaces, collapse whitespace. WER uses whitespace-separated tokens; CER excludes spaces. Micro-averaged within each condition.",
               "limitations": ["Same 30 utterances recur across conditions; 120 files are not 120 independent samples",
                               "No held-out speaker/session split; pretrained-model training overlap unknown",
                               "Small general-Vietnamese pilot, not regional accent validation",
                               "No fine-tuning; cannot conclude augmentation improves training"]}
    (output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    score_rows = "".join(f'<tr><td>{html.escape(k)}</td><td>{v["clips"]}</td><td>{v["wer"]:.1%}</td><td>{v["cer"]:.1%}</td></tr>' for k, v in scores.items())
    details = "".join(f'<tr><td>{html.escape(r["sample_id"])}</td><td>{html.escape(r["reference"])}</td><td>{html.escape(r["prediction"])}</td><td>{r["wer"]:.1%}</td></tr>' for r in predictions)
    (output / "results.html").write_text('<!doctype html><html lang="vi"><meta charset="utf-8"><title>Kết quả nhận dạng pilot</title>'
        '<style>body{font:17px system-ui;margin:30px}table{border-collapse:collapse;width:100%;margin-bottom:25px}td,th{border:1px solid #bbb;padding:10px;text-align:left}</style>'
        '<h1>PhoWhisper-tiny — kết quả nhận dạng thử</h1><p>Chạy model có sẵn trên máy, chưa huấn luyện thêm. Cùng 30 nội dung được so sánh ở bốn điều kiện âm thanh. Đây là chẩn đoán pilot, không phải benchmark độc lập hoặc bằng chứng training tốt hơn.</p>'
        '<p>WER: tỷ lệ lỗi token cách nhau bằng khoảng trắng; CER: tỷ lệ lỗi ký tự. Càng thấp càng tốt; WER có thể vượt 100% nếu model chèn nhiều từ. Bỏ dấu câu và chữ hoa khi tính, giữ dấu tiếng Việt.</p>'
        '<table><tr><th>Điều kiện</th><th>Số đoạn</th><th>WER</th><th>CER</th></tr>' + score_rows + '</table>'
        '<h2>Đối chiếu từng file</h2><table><tr><th>Mẫu</th><th>Đáp án đã duyệt</th><th>Model nhận dạng</th><th>WER</th></tr>'
        + details + '</table></html>', encoding="utf-8")
    (output / "status.json").write_text(json.dumps({"status": summary["status"]}), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=True), flush=True)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    run(args.dataset, args.model, args.output)
