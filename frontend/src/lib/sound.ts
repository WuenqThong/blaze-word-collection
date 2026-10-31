/**
 * Lightweight game SFX — Web Audio API. Không cần asset file âm thanh.
 *
 * Mỗi lần gọi tạo một AudioContext ngắn hạn để không giữ resource.
 */

type AudioCtxCtor = typeof AudioContext;

function getCtx(): AudioContext | null {
  try {
    const W = window as unknown as { AudioContext?: AudioCtxCtor; webkitAudioContext?: AudioCtxCtor };
    const Ctor = W.AudioContext ?? W.webkitAudioContext;
    if (!Ctor) return null;
    return new Ctor();
  } catch {
    return null;
  }
}

/** Coin/score sound. Pitch tăng theo `combo` để cảm giác leo điểm. */
export function playCoinSound(combo = 1): void {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Base C5; mỗi combo nâng thêm 1 nửa cung, cap 12 semitones (1 quãng tám)
  const semitones = Math.min(Math.max(combo - 1, 0), 12);
  const baseFreq = 523.25 * Math.pow(2, semitones / 12);
  // Hai note xếp chồng (perfect fifth) để âm dày
  const freqs = [baseFreq, baseFreq * 1.5];

  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(f, now + i * 0.04);
    osc.frequency.exponentialRampToValueAtTime(f * 1.06, now + i * 0.04 + 0.04);
    gain.gain.setValueAtTime(0, now + i * 0.04);
    gain.gain.linearRampToValueAtTime(0.18, now + i * 0.04 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.04);
    osc.stop(now + i * 0.04 + 0.4);
  });

  // Auto-close ctx sau khi note tắt
  setTimeout(() => ctx.close().catch(() => {}), 600);
}

/** Tiếng "milestone" cho combo lớn (5+, 10+...) — chord ascending. */
export function playMilestoneSound(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  // C major arpeggio: C5 E5 G5 C6
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const t = now + i * 0.07;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(f, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  });
  setTimeout(() => ctx.close().catch(() => {}), 800);
}
