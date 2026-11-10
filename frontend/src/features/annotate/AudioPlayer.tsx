import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

export interface AudioPlayerHandle {
  getListenedSec: () => number;
  getPlayCount: () => number;
}

interface AudioPlayerProps {
  src: string;
  onPlay?: () => void;
}

const SPEED_CYCLE = [1, 1.25, 1.5, 0.75];

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  { src, onPlay }, ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const lastTimeRef = useRef(0);
  const accumulatedRef = useRef(0);
  const playCountRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    getListenedSec: () => Math.round(accumulatedRef.current * 10) / 10,
    getPlayCount: () => playCountRef.current,
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    accumulatedRef.current = 0;
    playCountRef.current = 0;
    lastTimeRef.current = 0;
    setReady(false);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: src,
      height: 72,
      waveColor: "#cbd5e1",
      progressColor: "#2563eb",
      cursorColor: "#1d4ed8",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      backend: "MediaElement",
    });
    wsRef.current = ws;

    ws.on("ready", () => setReady(true));
    ws.on("timeupdate", (t) => {
      if (playing && t > lastTimeRef.current) accumulatedRef.current += t - lastTimeRef.current;
      lastTimeRef.current = t;
    });
    ws.on("play", () => {
      setPlaying(true);
      playCountRef.current += 1;
      onPlay?.();
    });
    ws.on("pause", () => setPlaying(false));
    ws.on("finish", () => setPlaying(false));

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const togglePlay = () => wsRef.current?.playPause();

  const cycleSpeed = () => {
    const next = SPEED_CYCLE[(SPEED_CYCLE.indexOf(speed) + 1) % SPEED_CYCLE.length];
    setSpeed(next);
    wsRef.current?.setPlaybackRate(next, true);
  };

  return (
    <>
      <div ref={containerRef} className="audio-wave" />
      <div className="audio-controls">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!ready}
          className="audio-play-btn"
          title={playing ? "Tạm dừng (Space)" : "Phát (Space)"}
        >
          <i className={`bi ${playing ? "bi-pause-fill" : "bi-play-fill"}`}></i>
        </button>
        <button
          type="button"
          onClick={cycleSpeed}
          disabled={!ready}
          className="audio-speed-btn"
          title="Tốc độ phát"
        >
          {speed}x
        </button>
      </div>
    </>
  );
});
