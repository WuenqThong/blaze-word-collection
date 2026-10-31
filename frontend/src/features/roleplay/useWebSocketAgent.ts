import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../api/client";

interface Options {
  onEvent?: (data: any) => void;
  onConnectionStateChange?: (state: "connecting" | "open" | "closed" | "error") => void;
  /** Agent emit `session.closed` → tự động kết thúc phiên ở phía client. */
  onAgentClosed?: () => void;
  /** Agent emit `conversation.item.completed.report` → trả về report agent thu thập. */
  onReport?: (report: Record<string, any>) => void;
  /** Agent state: idle | listening | thinking | speaking — dùng để vẽ UI mic. */
  onAgentState?: (state: string) => void;
}

interface ConnectArgs {
  taskId: number;
  language?: string;
  /** "ai" hoặc "portal". */
  mode?: "ai" | "portal";
}

interface ConnectResult {
  clientId: string;
}

const TARGET_SR = 16000;
const PROCESSOR_BUFFER = 4096;

/** Linear interpolation resample. */
function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.round(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const idx = Math.floor(srcIdx);
    const frac = srcIdx - idx;
    out[i] = idx + 1 < input.length ? input[idx] * (1 - frac) + input[idx + 1] * frac : input[idx];
  }
  return out;
}

function float32ToPCM16(f32: Float32Array): Int16Array {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function pcm16ToFloat32(pcm: Int16Array): Float32Array {
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    out[i] = pcm[i] / (pcm[i] < 0 ? 0x8000 : 0x7fff);
  }
  return out;
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const len = bin.length;
  const buf = new ArrayBuffer(len);
  const view = new Uint8Array(buf);
  for (let i = 0; i < len; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

/**
 * WebSocket transport tới agent qua proxy của annotator backend.
 *
 * - Mic: capture native rate → resample 16kHz → PCM16 → WS binary frame
 * - Agent voice: WS binary frame (PCM16 16kHz) → AudioContext queue playback
 * - Events: text frame JSON
 */
export function useWebSocketAgent({ onEvent, onConnectionStateChange, onAgentClosed, onReport, onAgentState }: Options = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const taskIdRef = useRef<number | null>(null);
  const clientIdRef = useRef<string>("");

  // Mic chain
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);

  // Playback chain
  const playCtxRef = useRef<AudioContext | null>(null);
  const playCursorRef = useRef<number>(0);
  /** Tất cả AudioBufferSourceNode đang queue/đang phát — track để stop khi interrupt. */
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const [isConnected, setIsConnected] = useState(false);

  const onEventRef = useRef(onEvent);
  const onCSCRef = useRef(onConnectionStateChange);
  const onAgentClosedRef = useRef(onAgentClosed);
  const onReportRef = useRef(onReport);
  const onAgentStateRef = useRef(onAgentState);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { onCSCRef.current = onConnectionStateChange; }, [onConnectionStateChange]);
  useEffect(() => { onAgentClosedRef.current = onAgentClosed; }, [onAgentClosed]);
  useEffect(() => { onReportRef.current = onReport; }, [onReport]);
  useEffect(() => { onAgentStateRef.current = onAgentState; }, [onAgentState]);

  const cleanup = useCallback(() => {
    if (procRef.current) {
      try { procRef.current.onaudioprocess = null; procRef.current.disconnect(); } catch { /* ignore */ }
      procRef.current = null;
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch { /* ignore */ }
      sourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current) {
      try { micCtxRef.current.close(); } catch { /* ignore */ }
      micCtxRef.current = null;
    }
    for (const src of scheduledSourcesRef.current) {
      try { src.stop(); } catch { /* ignore */ }
      try { src.disconnect(); } catch { /* ignore */ }
    }
    scheduledSourcesRef.current.clear();
    if (playCtxRef.current) {
      try { playCtxRef.current.close(); } catch { /* ignore */ }
      playCtxRef.current = null;
    }
    playCursorRef.current = 0;
  }, []);

  /** Schedule 1 chunk audio. Detect:
   *  - RIFF (WAV) hoặc OggS (Opus) header → decodeAudioData
   *  - Raw PCM16 16kHz mono nếu không có header
   *  Pattern lấy từ examples AudioManager.processAudioFromArrayBuffer. */
  const playPCM = useCallback(async (buf: ArrayBuffer) => {
    const ctx = playCtxRef.current;
    if (!ctx) {
      console.warn("[roleplay] playback ctx chưa init khi nhận audio");
      return;
    }
    if (buf.byteLength === 0) return;

    const header = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
    const isRiff = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;
    const isOgg = header[0] === 0x4f && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53;

    let audioBuf: AudioBuffer;
    if (isRiff || isOgg) {
      try {
        audioBuf = await ctx.decodeAudioData(buf.slice(0));
      } catch (err) {
        console.warn("[roleplay] decodeAudioData failed", err);
        return;
      }
    } else {
      // Raw PCM 16-bit mono 16kHz
      const i16 = new Int16Array(buf);
      const f32 = pcm16ToFloat32(i16);
      audioBuf = ctx.createBuffer(1, f32.length, TARGET_SR);
      audioBuf.getChannelData(0).set(f32);
    }

    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(ctx.destination);
    const start = Math.max(playCursorRef.current, ctx.currentTime);
    src.start(start);
    playCursorRef.current = start + audioBuf.duration;
    scheduledSourcesRef.current.add(src);
    src.onended = () => {
      scheduledSourcesRef.current.delete(src);
      try { src.disconnect(); } catch { /* ignore */ }
    };
  }, []);

  /** Stop hết source đang queue/đang phát + reset cursor. Gọi khi interrupt. */
  const stopPlayback = useCallback(() => {
    const ctx = playCtxRef.current;
    for (const src of Array.from(scheduledSourcesRef.current)) {
      try { src.stop(); } catch { /* already ended */ }
      try { src.disconnect(); } catch { /* ignore */ }
    }
    scheduledSourcesRef.current.clear();
    if (ctx) {
      playCursorRef.current = ctx.currentTime;
    }
  }, []);

  const setupMic = useCallback(async (ws: WebSocket) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, autoGainControl: true, noiseSuppression: true },
    });
    micStreamRef.current = stream;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    micCtxRef.current = ctx;
    const nativeRate = ctx.sampleRate;
    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;
    const proc = ctx.createScriptProcessor(PROCESSOR_BUFFER, 1, 1);
    procRef.current = proc;
    proc.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const resampled = resample(input, nativeRate, TARGET_SR);
      const pcm16 = float32ToPCM16(resampled);
      try {
        // Copy vào ArrayBuffer mới — pcm16.buffer có thể là SharedArrayBuffer
        // tuỳ environment (bị TS chặn). Cách đơn giản: send Int16Array slice.
        const out = new ArrayBuffer(pcm16.byteLength);
        new Int16Array(out).set(pcm16);
        ws.send(out);
      } catch { /* ignore */ }
    };
    source.connect(proc);
    proc.connect(ctx.destination);
  }, []);

  const connect = useCallback(async ({ taskId, language = "vi", mode = "ai" }: ConnectArgs): Promise<ConnectResult> => {
    cleanup();
    taskIdRef.current = taskId;
    const clientId = Math.random().toString(36).substring(2, 18);
    clientIdRef.current = clientId;

    // Tạo AudioContext NGAY trong user gesture chain (click → start → connect)
    // để browser không block autoplay. Resume nếu suspended.
    const playCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (playCtx.state === "suspended") {
      try { await playCtx.resume(); } catch { /* ignore */ }
    }
    playCtxRef.current = playCtx;
    playCursorRef.current = playCtx.currentTime;
    console.log(`[roleplay] playback ctx rate=${playCtx.sampleRate}Hz state=${playCtx.state}`);

    onCSCRef.current?.("connecting");
    const base = (apiClient.defaults.baseURL || "http://127.0.0.1:8765/api").replace(/\/$/, "");
    const wsBase = base.replace(/^https?/, (p) => (p === "https" ? "wss" : "ws"));
    const url = `${wsBase}/roleplay/tasks/${taskId}/ws?client_id=${encodeURIComponent(clientId)}&language=${encodeURIComponent(language)}&mode=${encodeURIComponent(mode)}`;

    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    return new Promise<ConnectResult>((resolve, reject) => {
      ws.onopen = async () => {
        try {
          await setupMic(ws);
          setIsConnected(true);
          onCSCRef.current?.("open");
          // Trigger agent bắt đầu hội thoại (gửi greeting + bật STT).
          // Không gửi event này → agent đứng im, không bắn audio/event nào.
          try {
            ws.send(JSON.stringify({ event_type: "conversation.start", data: {} }));
          } catch (err) {
            console.warn("[roleplay] send conversation.start failed", err);
          }
          resolve({ clientId });
        } catch (err) {
          reject(err);
          ws.close();
        }
      };

      ws.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) {
          console.debug(`[roleplay] ⬇ audio ${e.data.byteLength}B`);
          playPCM(e.data);
          return;
        }
        if (e.data instanceof Blob) {
          console.debug(`[roleplay] ⬇ audio (blob) ${e.data.size}B`);
          e.data.arrayBuffer().then((ab) => playPCM(ab)).catch(() => {});
          return;
        }
        if (typeof e.data === "string") {
          const text = e.data.trim();
          const handle = (parsed: any) => {
            const t = parsed.type || parsed.event_type;
            // Agent (OpenAI Realtime style) gửi audio qua `response.audio.delta`
            // với field `delta` là base64 PCM16 16kHz mono.
            if (t === "response.audio.delta" && typeof parsed.delta === "string") {
              try {
                const ab = base64ToArrayBuffer(parsed.delta);
                playPCM(ab);
              } catch (err) {
                console.warn("[roleplay] decode audio.delta failed", err);
              }
              return;
            }
            // Interrupt / barge-in: agent yêu cầu client ngừng phát audio
            // ngay (user đã nói cắt ngang, hoặc giảm echo cho STT).
            if (
              t === "response.cancelled" ||
              t === "response.audio.clear" ||
              t === "stop_audio" ||
              t === "clear_audio"
            ) {
              console.debug("[roleplay] ✋ interrupt", t);
              stopPlayback();
            }
            // Agent state — UI cần biết để vẽ animation
            if (t === "state" && typeof parsed.agent_state === "string") {
              onAgentStateRef.current?.(parsed.agent_state);
            }
            // Report agent thu thập (event conversation.item.completed.report)
            if (t === "conversation.item.completed" && parsed.report) {
              onReportRef.current?.(parsed.report);
            }
            // Agent kết thúc session
            if (t === "session.closed") {
              console.debug("[roleplay] 🔚 session.closed");
              onAgentClosedRef.current?.();
            }
            console.debug("[roleplay] ⬇ event", t, parsed);
            onEventRef.current?.(parsed);
          };
          if (text.startsWith("{")) {
            try {
              handle(JSON.parse(text));
              return;
            } catch { /* not JSON */ }
          }
          for (const line of text.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                handle(JSON.parse(line.substring(6)));
              } catch { /* ignore */ }
            }
          }
        }
      };

      ws.onerror = () => {
        onCSCRef.current?.("error");
        reject(new Error("WebSocket error"));
      };

      ws.onclose = () => {
        setIsConnected(false);
        onCSCRef.current?.("closed");
      };
    });
  }, [cleanup, playPCM, setupMic]);

  const disconnect = useCallback(async () => {
    if (wsRef.current) {
      try { wsRef.current.close(1000, "client_disconnect"); } catch { /* ignore */ }
      wsRef.current = null;
    }
    cleanup();
    taskIdRef.current = null;
    setIsConnected(false);
  }, [cleanup]);

  const sendEvent = useCallback((eventType: string, data?: any) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event_type: eventType, data: data ?? {} }));
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    connect,
    disconnect,
    sendEvent,
    isConnected,
    clientId: clientIdRef,
  };
}
