import { useEffect, useRef, useState } from "react";
import { Button } from "react-bootstrap";

interface VoiceRecordCardProps {
  audioUrl: string;
  question: string;
  submitting: boolean;
  onSubmit: (blob: Blob, signals: { time_spent_ms: number; audio_listened_sec: number; audio_play_count: number }) => void;
  scoreHint?: string;
}

type RecState = "idle" | "recording" | "recorded";

export function VoiceRecordCard({ audioUrl, question, submitting, onSubmit, scoreHint }: VoiceRecordCardProps) {
  const promptAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const playCountRef = useRef(0);
  const listenedRef = useRef(0);
  const lastTimeRef = useRef(0);

  const [state, setState] = useState<RecState>("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [promptPlaying, setPromptPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on src change
  useEffect(() => {
    setState("idle");
    setRecordedBlob(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setDuration(0);
    playCountRef.current = 0;
    listenedRef.current = 0;
    startedAtRef.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
  }, [recordedUrl]);

  // Recording timer
  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setDuration((d) => d + 0.1), 100);
    return () => clearInterval(t);
  }, [state]);

  const startRecord = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        setRecordedUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        setState("recorded");
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setState("recording");
      setDuration(0);
    } catch {
      setError("Không truy cập được microphone — vui lòng cho phép quyền mic.");
    }
  };

  const stopRecord = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const reRecord = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    setState("idle");
  };

  const togglePromptPlay = () => {
    const a = promptAudioRef.current;
    if (!a) return;
    if (a.paused) {
      // Replay từ đầu nếu audio đã chạy hết
      if (a.ended || (a.duration && a.currentTime >= a.duration - 0.05)) {
        a.currentTime = 0;
        lastTimeRef.current = 0;
      }
      void a.play();
    } else {
      a.pause();
    }
  };

  const togglePreviewPlay = () => {
    const a = previewAudioRef.current;
    if (!a) return;
    if (a.paused) {
      if (a.ended || (a.duration && a.currentTime >= a.duration - 0.05)) {
        a.currentTime = 0;
      }
      void a.play();
    } else {
      a.pause();
    }
  };

  const handleSubmit = () => {
    if (!recordedBlob) return;
    onSubmit(recordedBlob, {
      time_spent_ms: Date.now() - startedAtRef.current,
      audio_listened_sec: Math.round(listenedRef.current * 10) / 10,
      audio_play_count: playCountRef.current,
    });
  };

  const fmtSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="verify-shell">
      <audio
        ref={promptAudioRef}
        src={audioUrl}
        onPlay={() => { setPromptPlaying(true); playCountRef.current += 1; }}
        onPause={() => setPromptPlaying(false)}
        onEnded={() => setPromptPlaying(false)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          if (promptPlaying && t > lastTimeRef.current) listenedRef.current += t - lastTimeRef.current;
          lastTimeRef.current = t;
        }}
        preload="metadata"
      />
      <audio
        ref={previewAudioRef}
        src={recordedUrl ?? undefined}
        onPlay={() => setPreviewPlaying(true)}
        onPause={() => setPreviewPlaying(false)}
        onEnded={() => setPreviewPlaying(false)}
      />

      <div className="verify-card-large">
        {scoreHint && (
          <div className="play-card-points">
            <i className="bi bi-stars"></i>{scoreHint}
          </div>
        )}
        <div className="verify-prompt">{question}</div>
      </div>

      <div className="verify-actions-row">
        {audioUrl && <Button variant="outline-primary" onClick={togglePromptPlay} aria-label={promptPlaying ? "Tạm dừng âm thanh mẫu" : "Nghe âm thanh mẫu"}>
          <i className={`bi bi-${promptPlaying ? "pause" : "play"}`} aria-hidden="true" />{promptPlaying ? "Tạm dừng" : "Nghe mẫu"}
        </Button>}
        {state === "idle" && (
          <button
            type="button"
            onClick={startRecord}
            className="verify-play-btn voice-rec-btn"
            title="Ghi âm câu trả lời"
            disabled={submitting}
          >
            <i className="bi bi-mic-fill"></i>
          </button>
        )}
        {state === "recording" && (
          <button
            type="button"
            onClick={stopRecord}
            className="verify-play-btn voice-rec-btn voice-rec-btn-active"
            title="Dừng ghi"
          >
            <i className="bi bi-stop-fill"></i>
          </button>
        )}
        {state === "recorded" && (
          <>
            <button
              type="button"
              onClick={reRecord}
              className="verify-action verify-action-no"
              title="Ghi lại"
              disabled={submitting}
            >
              <i className="bi bi-arrow-counterclockwise"></i>
              <span>Ghi lại</span>
            </button>
            <button
              type="button"
              onClick={togglePreviewPlay}
              className="verify-play-btn"
              title={previewPlaying ? "Tạm dừng" : "Nghe lại"}
            >
              <i className={`bi ${previewPlaying ? "bi-pause-fill" : "bi-play-fill"}`}></i>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="verify-action verify-action-yes"
              title="Gửi câu trả lời"
              disabled={submitting || !recordedBlob}
            >
              <i className="bi bi-send"></i>
              <span>{submitting ? "Đang gửi..." : "Gửi"}</span>
            </button>
          </>
        )}
      </div>

      {state === "recording" && (
        <div className="voice-rec-status">
          <span className="voice-rec-dot"></span>
          Đang ghi · {fmtSec(duration)}
        </div>
      )}

      {error && (
        <div className="alert alert-danger py-2 mb-0" style={{ maxWidth: 500 }}>
          {error}
        </div>
      )}
    </div>
  );
}
