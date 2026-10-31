import { useEffect, useState } from "react";

interface ScoreBurstProps {
  /** Bumps every time you want to trigger a new burst. */
  trigger: number;
  /** Số điểm hiển thị trong burst (vd: 8). */
  points: number;
  /** Combo count (1 = no combo). Burst sẽ to/rực rỡ hơn theo combo. */
  combo?: number;
}

/**
 * Game-style "+N điểm" floating animation với combo multiplier.
 */
export function ScoreBurst({ trigger, points, combo = 1 }: ScoreBurstProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 1700);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!active) return null;

  // Combo tier xác định style: 1=gold, 2-3=orange, 4-6=pink, 7+=violet
  const tier = combo >= 7 ? "epic" : combo >= 4 ? "hot" : combo >= 2 ? "warm" : "base";
  const showMultiplier = combo >= 2;
  const particleCount = Math.min(8 + (combo - 1) * 2, 20);
  const particles = Array.from({ length: particleCount }, (_, i) => i);

  return (
    <div className="score-burst-overlay" aria-hidden="true">
      <div className={`score-burst-stage tier-${tier}`} key={trigger}>
        {showMultiplier && (
          <div className={`score-burst-combo combo-${tier}`}>
            <span className="score-burst-combo-x">×</span>
            <span className="score-burst-combo-num">{combo}</span>
            {combo >= 5 && <span className="score-burst-combo-label">STREAK!</span>}
          </div>
        )}
        <div className="score-burst-main">
          <i className="bi bi-stars score-burst-star"></i>
          <span className="score-burst-text">+{points}</span>
          <span className="score-burst-suffix">điểm</span>
        </div>
        {particles.map((i) => (
          <span
            key={i}
            className="score-burst-particle"
            style={{ ["--p-angle" as string]: `${(360 / particles.length) * i}deg` }}
          />
        ))}
      </div>
    </div>
  );
}
