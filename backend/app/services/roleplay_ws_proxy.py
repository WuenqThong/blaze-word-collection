"""WebSocket proxy: client ↔ annotator ↔ agent.

Đồng thời ghi cả 2 chiều PCM thành WAV stereo (mic = left, agent = right) lưu
vào MinIO khi session đóng. Mic frame có thể đến không đồng bộ với agent
frame; ta merge theo trục thời gian: mỗi chunk được gắn `recv_ts` để align
khi ghép.

Đơn giản hoá v1: gộp tất cả mic chunk sequentially → mono left, agent chunk
sequentially → mono right. Bỏ qua jitter alignment chính xác — chấp nhận
chậm/nhanh nhỏ giữa 2 kênh. Annotator nghe lại để verify, không cần
millisecond-perfect sync.
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import struct
import wave
from datetime import datetime
from typing import Optional
from urllib.parse import urlencode, urlparse

import websockets
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from websockets.exceptions import ConnectionClosed

from app.core.storage import get_storage
from app.models import Project, RolePlayScenario, RolePlayTask, User
from app.services.roleplay_service import RolePlayService

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16000
SAMPLE_WIDTH = 2  # 16-bit PCM


def _build_agent_url(
    project: Project,
    scenario: RolePlayScenario,
    client_id: str,
    language: str,
    mode: str,
) -> str:
    """Build URL WS agent. Agent endpoint nằm trên project."""
    if not project.agent_endpoint:
        raise ValueError("Project chưa cấu hình agent_endpoint")
    base = project.agent_endpoint.rstrip("/")
    parsed = urlparse(base)
    scheme = "wss" if parsed.scheme == "https" else "ws"
    netloc = parsed.netloc or parsed.path
    qs_params: dict[str, str] = {
        "client_id": client_id,
        "language": language or project.default_language or "vi",
    }
    if scenario.use_case:
        qs_params["use_case"] = scenario.use_case
    if mode == "portal":
        qs_params["mode"] = "portal"
    return f"{scheme}://{netloc}/v1/voice-bot/ws?{urlencode(qs_params)}"


def _silence(num_samples: int) -> bytes:
    """num_samples × 2 bytes của zero (PCM16)."""
    return b"\x00\x00" * num_samples


def _build_stereo_wav(mic_pcm: bytes, agent_pcm: bytes) -> bytes:
    """Ghép mic + agent thành 1 WAV stereo. Pad ngắn hơn bằng silence."""
    target_len = max(len(mic_pcm), len(agent_pcm))
    # Đảm bảo length chia hết cho 2 (PCM16)
    target_len = (target_len // 2) * 2
    mic_padded = mic_pcm[:target_len].ljust(target_len, b"\x00")
    agent_padded = agent_pcm[:target_len].ljust(target_len, b"\x00")

    # Interleave: L0, R0, L1, R1, ...
    sample_count = target_len // 2
    interleaved = bytearray(target_len * 2)
    for i in range(sample_count):
        # mic (L)
        interleaved[i * 4] = mic_padded[i * 2]
        interleaved[i * 4 + 1] = mic_padded[i * 2 + 1]
        # agent (R)
        interleaved[i * 4 + 2] = agent_padded[i * 2]
        interleaved[i * 4 + 3] = agent_padded[i * 2 + 1]

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(SAMPLE_WIDTH)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(bytes(interleaved))
    return buf.getvalue()


async def proxy_session(
    websocket: WebSocket,
    db: Session,
    task: RolePlayTask,
    user: User,
    *,
    client_id: str,
    language: str,
    mode: str,
) -> None:
    """Bidirectional proxy giữa browser WS ↔ agent WS, đồng thời record."""
    svc = RolePlayService(db, get_storage())
    scenario = svc.get_scenario_or_404(task.scenario_id)
    project = db.query(Project).filter(Project.id == scenario.project_id).first()
    if not project:
        await websocket.close(code=1011, reason="Project not found")
        return
    agent_url = _build_agent_url(project, scenario, client_id, language, mode)
    logger.info("[roleplay-ws] task=%s connecting agent: %s", task.id, agent_url)

    # Persist client_id để DELETE close có thể cleanup
    svc.set_client_id(task, client_id)

    # Buffer ghi PCM
    mic_chunks: list[bytes] = []
    agent_chunks: list[bytes] = []

    try:
        async with websockets.connect(agent_url, max_size=None) as agent_ws:
            logger.info("[roleplay-ws] task=%s agent connected", task.id)

            async def client_to_agent() -> None:
                """Forward mic frames + JSON events từ browser → agent."""
                try:
                    while True:
                        msg = await websocket.receive()
                        msg_type = msg.get("type")
                        if msg_type == "websocket.disconnect":
                            return
                        if "bytes" in msg and msg["bytes"] is not None:
                            data: bytes = msg["bytes"]
                            mic_chunks.append(data)
                            await agent_ws.send(data)
                        elif "text" in msg and msg["text"] is not None:
                            await agent_ws.send(msg["text"])
                except WebSocketDisconnect:
                    pass
                except Exception as e:  # noqa: BLE001
                    logger.warning("[roleplay-ws] client→agent error: %s", e)

            async def agent_to_client() -> None:
                """Forward audio + events từ agent → browser.

                Agent (OpenAI Realtime style) gửi audio qua text events
                `response.audio.delta` với field `delta` = base64 PCM16. Ta
                vẫn forward nguyên text cho client decode + play, đồng thời
                decode tại đây để ghi vào agent channel của recording.
                """
                try:
                    async for raw in agent_ws:
                        if isinstance(raw, (bytes, bytearray)):
                            data = bytes(raw)
                            agent_chunks.append(data)
                            await websocket.send_bytes(data)
                            continue
                        # text frame
                        await websocket.send_text(raw)
                        try:
                            obj = json.loads(raw)
                            t = obj.get("type")
                            if t == "response.audio.delta":
                                delta = obj.get("delta")
                                if isinstance(delta, str) and delta:
                                    pcm = base64.b64decode(delta)
                                    if pcm:
                                        agent_chunks.append(pcm)
                            elif t == "session.created":
                                sid = obj.get("session_id")
                                if isinstance(sid, str) and sid:
                                    svc.set_agent_session_id(task, sid)
                            elif t == "conversation.item.completed":
                                # Agent emit report (survey responses) ở đây.
                                report = obj.get("report")
                                if isinstance(report, dict) and report:
                                    svc.set_report_data(task, report)
                        except (ValueError, TypeError):
                            pass
                except ConnectionClosed:
                    pass
                except Exception as e:  # noqa: BLE001
                    logger.warning("[roleplay-ws] agent→client error: %s", e)

            # Chạy 2 chiều song song; ai đóng trước → cancel chiều còn lại
            tasks = [
                asyncio.create_task(client_to_agent()),
                asyncio.create_task(agent_to_client()),
            ]
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for t in pending:
                t.cancel()
            for t in pending:
                try:
                    await t
                except (asyncio.CancelledError, Exception):
                    pass

    except websockets.exceptions.InvalidStatusCode as e:
        logger.error("[roleplay-ws] agent rejected connect: %s", e)
        try:
            await websocket.close(code=1011, reason=f"Agent rejected: {e}")
        except Exception:
            pass
    except Exception as e:  # noqa: BLE001
        logger.exception("[roleplay-ws] proxy error: %s", e)
        try:
            await websocket.close(code=1011, reason="Proxy error")
        except Exception:
            pass

    # Save recording
    mic_total = b"".join(mic_chunks)
    agent_total = b"".join(agent_chunks)
    total_bytes = len(mic_total) + len(agent_total)
    logger.info(
        "[roleplay-ws] task=%s recording: mic=%d agent=%d bytes",
        task.id, len(mic_total), len(agent_total),
    )

    if total_bytes > 0:
        try:
            wav_data = _build_stereo_wav(mic_total, agent_total)
            buf = io.BytesIO(wav_data)
            svc.upload_recording(
                task,
                user,
                file=buf,
                size_bytes=len(wav_data),
                content_type="audio/wav",
            )
        except Exception as e:  # noqa: BLE001
            logger.exception("[roleplay-ws] save recording failed: %s", e)

    # Mark task ended
    try:
        svc.end_task(task, user, client_id=client_id)
    except Exception as e:  # noqa: BLE001
        logger.warning("[roleplay-ws] end_task failed: %s", e)
