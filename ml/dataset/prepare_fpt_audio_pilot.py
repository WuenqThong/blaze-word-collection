"""Fetch a small, unapproved FOSD review pack; never create training splits."""
from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
from pathlib import Path
import subprocess
import urllib.parse
import urllib.request
import urllib.error

DATASET = "doof-ferb/fpt_fosd"
SOURCE = "https://data.mendeley.com/datasets/k9sxg2twv4/4"
MIRROR = f"https://huggingface.co/datasets/{DATASET}"
NOTICE = """FPT Open Speech Dataset (FOSD) pilot review subset
Copyright 2018 FPT Corporation
Source record: Duc Chung Tran (2020), Mendeley Data, v4.
DOI: 10.17632/k9sxg2twv4.4
https://data.mendeley.com/datasets/k9sxg2twv4/4
Source page license listing: CC BY 4.0
https://creativecommons.org/licenses/by/4.0/
Download mirror (unofficial): https://huggingface.co/datasets/doof-ferb/fpt_fosd

FPT permission notice reproduced from the source record:
Copyright 2018 FPT Corporation Permission is hereby granted, free of charge, non-exclusive, worldwide, irrevocable, to any person obtaining a copy of this data or software and associated documentation files (the “Data or Software”), to deal in the Data or Software without restriction, including without limitation the rights to use, copy, modify, remix, transform, merge, build upon, publish, distribute and redistribute, sublicense, and/or sell copies of the Data or Software, for any purpose, even commercially, and to permit persons to whom the Data or Software is furnished to do so, subject to the following conditions: The above copyright notice, and this permission notice, and indication of any modification to the Data or Software, shall be included in all copies or substantial portions of the Data or Software.
THE DATA OR SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE DATA OR SOFTWARE OR THE USE OR OTHER DEALINGS IN THE DATA OR SOFTWARE.
Patent and trademark rights are not licensed under this FPT Public License.

Modifications / provenance:
- The unofficial mirror reports removal of '-N' and line breaks from transcripts,
  and exclusion of four audio files with missing transcripts; see saved mirror README.
- This pack selects 30 rows, strips transcript outer whitespace and assigns local IDs.
- MP3 bytes are saved as served by the mirror's dataset viewer; this script does
  not change audio. These are not claimed to be verified byte-identical FPT originals.
- No augmentation or model training performed. Transcript review is pending.
- Regional accent, speaker identity and recording sessions are unverified.
- Do not treat the mirror's existing train designation as a leakage-safe local split.
"""


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "BlazeAudioPilot/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = response.read(8 * 1024 * 1024 + 1)
            break
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
    if len(payload) > 8 * 1024 * 1024:
        raise ValueError("Unexpected response over 8 MiB; stopped bounded pilot download")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.output.resolve()
    root.mkdir(parents=True, exist_ok=False)
    (root / "audio").mkdir()
    (root / "source-snapshots").mkdir()
    (root / "SOURCE_AND_LICENSE.txt").write_text(NOTICE, encoding="utf-8")
    card = fetch(f"https://huggingface.co/datasets/{DATASET}/raw/main/README.md")
    (root / "source-snapshots" / "mirror-README.md").write_bytes(card)
    records = []
    seen_hashes: set[str] = set()
    for offset in (0, 9000, 18000):
        query = urllib.parse.urlencode({"dataset": DATASET, "config": "default",
                                       "split": "train", "offset": offset, "length": 30})
        result = json.loads(fetch("https://datasets-server.huggingface.co/rows?" + query))
        # Expiring signed asset URLs are used only during download, not stored as provenance.
        selected = 0
        for row in result["rows"]:
            text = row["row"]["transcription"].strip()
            if not 8 <= len(text.split()) <= 55 or row.get("truncated_cells"):
                continue
            payload = fetch(row["row"]["audio"][0]["src"])
            digest = hashlib.sha256(payload).hexdigest()
            if digest in seen_hashes:
                continue
            sample_id = f"fpt-pilot-{len(records) + 1:03d}"
            relative = f"audio/{sample_id}.mp3"
            path = root / relative
            path.write_bytes(payload)
            probe = json.loads(subprocess.check_output([
                "ffprobe", "-v", "error", "-show_format", "-show_streams",
                "-of", "json", str(path)], text=True, encoding="utf-8"))
            duration = float(probe["format"]["duration"])
            audio_streams = [s for s in probe["streams"] if s["codec_type"] == "audio"]
            if not audio_streams or not 2 <= duration <= 25:
                path.unlink()  # Only this just-downloaded rejected pilot file.
                continue
            subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"],
                           check=True, capture_output=True)
            seen_hashes.add(digest)
            records.append({
                "sample_id": sample_id, "audio_path": relative,
                "source_transcript": text, "reviewed_transcript": "",
                "review_status": "pending", "reviewer": "", "review_notes": "",
                "source_url": SOURCE, "mirror_url": MIRROR,
                "mirror_split": "train", "mirror_row_index": row["row_idx"],
                "asset_revision": row["row"]["audio"][0]["src"].split("/--/")[1],
                "audio_sha256": digest, "duration_seconds": duration,
                "sample_rate": int(audio_streams[0]["sample_rate"]),
                "channels": audio_streams[0]["channels"],
                "speaker_group": None, "session_group": None,
                "region": None, "synthetic": None,
                "source_group": "fpt-fosd-unresolved-speakers-and-sessions",
                "split": "unassigned", "training_eligible": False,
                "audio_modifications_by_this_script": "none; saved dataset-viewer MP3 asset",
                "transcript_origin": "mirror-provided; not checked by project reviewer",
                "license": "CC-BY-4.0; see FPT permission notice",
            })
            selected += 1
            print(f"Prepared {sample_id}: {duration:.2f}s", flush=True)
            if selected == 10:
                break
        if selected != 10:
            raise RuntimeError(f"Only {selected}/10 qualifying clips at offset {offset}; pack incomplete")

    (root / "manifest.jsonl").write_text(
        "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in records), encoding="utf-8")
    fields = ["sample_id", "audio_path", "source_transcript", "reviewed_transcript",
              "review_status", "reviewer", "review_notes"]
    with (root / "review.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)
    summary = {
        "status": "ready_for_human_review_not_training",
        "clips": len(records), "duration_seconds": round(sum(r["duration_seconds"] for r in records), 3),
        "unique_audio_hashes": len(seen_hashes), "decode_passed": len(records),
        "approved_transcripts": 0, "target_dialect_verified": 0,
        "speaker_groups_verified": 0, "split_created": False, "derivatives_created": 0,
        "pilot_config": {"execution": "local", "language": "Vietnamese_general",
                         "derivatives_per_training_clip": 3,
                         "proposed_variants": ["fan", "room_reverb", "fan_plus_room_reverb"]},
        "limits": ["Not representative of dialect or speaker coverage",
                   "Unknown speaker/session groups block independent train/test splitting",
                   "Human transcript and audible quality review pending",
                   "Mirror card says 100h, original source says about 30h; use original-source figure"],
    }
    (root / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    rows = "\n".join(
        f'<tr><td>{r["sample_id"]}</td><td><audio controls preload="none" src="{r["audio_path"]}"></audio>'
        f'<br>{r["duration_seconds"]:.2f} giây</td><td>{html.escape(r["source_transcript"])}</td></tr>'
        for r in records)
    (root / "listen-and-review.html").write_text(
        '<!doctype html><html lang="vi"><meta charset="utf-8"><title>Duyệt audio pilot FPT</title>'
        '<style>body{font:17px system-ui;max-width:1150px;margin:30px auto;padding:0 20px}'
        'table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:12px;text-align:left}'
        'audio{width:270px}td:first-child{white-space:nowrap}</style>'
        '<h1>30 audio pilot — chờ bạn duyệt</h1>'
        '<p>Nghe từng đoạn và mở <b>review.csv</b> để ghi kết quả. Transcript dưới đây do nguồn cung cấp, '
        'chưa phải nhãn được bạn duyệt. Chưa xác minh giọng Đà Nẵng–Quảng Nam.</p>'
        '<p>Trong CSV: điền reviewed_transcript đúng lời nghe được; review_status là approved, rejected '
        'hoặc needs_review; điền reviewer và review_notes. Giữ pending nếu chưa nghe. '
        'Không đổi lời địa phương thành tiếng phổ thông trong transcript.</p>'
        '<p>Duyệt CSV chưa tự thay manifest hay bật điều kiện training. '
        'ID người nói/phiên thu còn thiếu nên chưa chia train/test.</p>'
        '<table><tr><th>Mẫu</th><th>Nghe</th><th>Transcript nguồn — chưa duyệt</th></tr>' + rows +
        '</table><p>Nguồn: FPT Corporation (2018), Duc Chung Tran, Mendeley Data v4, '
        'DOI 10.17632/k9sxg2twv4.4; mirror doof-ferb/fpt_fosd. '
        'Xem SOURCE_AND_LICENSE.txt trong cùng thư mục.</p></html>', encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
