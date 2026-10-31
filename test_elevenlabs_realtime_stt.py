"""
Test ElevenLabs Realtime Speech-to-Text WebSocket API.

Docs: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
WSS:  wss://api.elevenlabs.io/v1/speech-to-text/realtime

Usage:
    # Default: stream the bundled WAV file (real-time pacing)
    python test_elevenlabs_realtime_stt.py

    # Stream a different WAV file
    python test_elevenlabs_realtime_stt.py --source file --file path/to/audio.wav

    # Stream from microphone (10s)
    python test_elevenlabs_realtime_stt.py --source mic --duration 10

Dependencies:
    pip install websockets sounddevice numpy python-dotenv
"""

import argparse
import asyncio
import base64
import json
import os
import sys
import wave
from pathlib import Path
from urllib.parse import urlencode

import websockets

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

WS_BASE_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime"

DEFAULT_FILE = "/Users/dungdb/Desktop/annotator/086218860_20260425101355.wav"
SUPPORTED_RATES = {8000, 16000, 22050, 24000, 44100, 48000}
MIC_SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2  # 16-bit PCM
CHUNK_MS = 100    # send 100ms chunks


def build_url(model_id: str, language_code: str | None, commit_strategy: str, sample_rate: int) -> str:
    params = {
        "model_id": model_id,
        "audio_format": f"pcm_{sample_rate}",
        "commit_strategy": commit_strategy,
        "include_timestamps": "true",
    }
    if language_code:
        params["language_code"] = language_code
    return f"{WS_BASE_URL}?{urlencode(params)}"


def encode_chunk(pcm_bytes: bytes, sample_rate: int, commit: bool = False) -> str:
    payload = {
        "message_type": "input_audio_chunk",
        "audio_base_64": base64.b64encode(pcm_bytes).decode("ascii"),
        "sample_rate": sample_rate,
        "commit": commit,
    }
    return json.dumps(payload)


async def receiver(ws):
    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                print(f"[raw] {raw}")
                continue

            mtype = msg.get("message_type") or msg.get("type") or msg.get("message")
            if mtype == "session_started":
                print(f"[session] started: {msg}")
            elif mtype == "partial_transcript":
                text = msg.get("text") or msg.get("transcript", "")
                print(f"[partial] {text}", end="\r", flush=True)
            elif mtype in ("committed_transcript", "committed_transcript_with_timestamps"):
                text = msg.get("text") or msg.get("transcript", "")
                print(f"\n[final]   {text}")
            else:
                print(f"\n[msg] {msg}")
    except websockets.ConnectionClosed as e:
        print(f"\n[ws] closed: code={e.code} reason={e.reason}")


async def stream_microphone(ws, duration_s: float):
    import sounddevice as sd
    import numpy as np

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[bytes] = asyncio.Queue()
    chunk_samples = MIC_SAMPLE_RATE * CHUNK_MS // 1000

    def callback(indata, frames, time_info, status):
        if status:
            print(f"[mic] {status}", file=sys.stderr)
        pcm = (indata[:, 0] * 32767).astype(np.int16).tobytes()
        loop.call_soon_threadsafe(queue.put_nowait, pcm)

    print(f"[mic] recording {duration_s}s @ {MIC_SAMPLE_RATE}Hz mono...")
    with sd.InputStream(
        samplerate=MIC_SAMPLE_RATE,
        channels=CHANNELS,
        dtype="float32",
        blocksize=chunk_samples,
        callback=callback,
    ):
        end = loop.time() + duration_s
        while loop.time() < end:
            try:
                pcm = await asyncio.wait_for(queue.get(), timeout=end - loop.time())
            except asyncio.TimeoutError:
                break
            await ws.send(encode_chunk(pcm, MIC_SAMPLE_RATE, commit=False))

    await ws.send(encode_chunk(b"", MIC_SAMPLE_RATE, commit=True))
    print("[mic] sent final commit, waiting for result...")
    await asyncio.sleep(2.0)


async def stream_file(ws, path: str, realtime: bool = True):
    with wave.open(path, "rb") as wf:
        rate = wf.getframerate()
        ch = wf.getnchannels()
        width = wf.getsampwidth()
        n_frames = wf.getnframes()

        if ch != CHANNELS or width != SAMPLE_WIDTH:
            raise ValueError(
                f"WAV must be mono 16-bit PCM. Got {ch}ch, {width*8}-bit."
            )
        if rate not in SUPPORTED_RATES:
            raise ValueError(
                f"WAV sample rate {rate}Hz not supported. Use one of {sorted(SUPPORTED_RATES)}."
            )

        chunk_samples = rate * CHUNK_MS // 1000
        print(f"[file] streaming {path}")
        print(f"[file] format: {rate}Hz mono 16-bit, duration: {n_frames / rate:.2f}s, "
              f"realtime pacing: {realtime}")

        while True:
            data = wf.readframes(chunk_samples)
            if not data:
                break
            await ws.send(encode_chunk(data, rate, commit=False))
            if realtime:
                await asyncio.sleep(CHUNK_MS / 1000)

    await ws.send(encode_chunk(b"", rate, commit=True))
    print("[file] sent final commit, waiting for result...")
    await asyncio.sleep(3.0)
    return rate


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=["mic", "file"], default="file")
    parser.add_argument("--file", default=DEFAULT_FILE,
                        help=f"Path to WAV file (mono 16-bit, supported rates {sorted(SUPPORTED_RATES)})")
    parser.add_argument("--duration", type=float, default=10.0, help="Mic record duration in seconds")
    parser.add_argument("--model", default="scribe_v2_realtime", help="ElevenLabs STT model id")
    parser.add_argument("--language", default=None, help="ISO language code (optional)")
    parser.add_argument("--commit-strategy", default="vad", choices=["manual", "vad"])
    parser.add_argument("--no-realtime", action="store_true",
                        help="Send file as fast as possible instead of pacing at real-time")
    args = parser.parse_args()

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        print("ERROR: set ELEVENLABS_API_KEY env var (or put it in .env)", file=sys.stderr)
        sys.exit(1)

    # Determine sample rate before opening WS so audio_format query param is right.
    if args.source == "file":
        if not Path(args.file).exists():
            print(f"ERROR: file not found: {args.file}", file=sys.stderr)
            sys.exit(1)
        with wave.open(args.file, "rb") as wf:
            sample_rate = wf.getframerate()
    else:
        sample_rate = MIC_SAMPLE_RATE

    url = build_url(args.model, args.language, args.commit_strategy, sample_rate)
    headers = {"xi-api-key": api_key}

    print(f"[ws] connecting to {url}")
    async with websockets.connect(url, additional_headers=headers, max_size=None) as ws:
        recv_task = asyncio.create_task(receiver(ws))
        try:
            if args.source == "mic":
                await stream_microphone(ws, args.duration)
            else:
                await stream_file(ws, args.file, realtime=not args.no_realtime)
        finally:
            recv_task.cancel()
            try:
                await recv_task
            except asyncio.CancelledError:
                pass


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[exit] interrupted")
