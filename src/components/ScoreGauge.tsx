"use client";

export default function ScoreGauge({
  score,
  label = "Readiness",
  size = 132,
}: {
  score: number;
  label?: string;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = c * pct;

  const color =
    score >= 80 ? "var(--accent3)" : score >= 60 ? "var(--accent)" : score >= 40 ? "#FFC53D" : "var(--warn)";

  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 0.9s ease, stroke 0.4s" }}
        />
      </svg>
      <div className="gauge-num">
        <b style={{ color }}>{score}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}
