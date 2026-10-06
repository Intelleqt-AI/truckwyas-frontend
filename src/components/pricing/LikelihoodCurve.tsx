import { linear, useWidth } from "@/components/viz/core";
import "@/components/viz/viz.css";
import type { Choice, CurvePoint } from "./types";

/**
 * Price → chance to win, read from the model's own curve (only inside the
 * range it has seen). Dots mark the three choices; the accent line is the
 * price in the bar; a tick on the axis marks the lane median. Expected profit
 * is stated once in words (the reasons), not drawn on an unlabelled scale.
 */
export function LikelihoodCurve({ curve, range, choices, price, median }: {
  curve: CurvePoint[]; range: [number, number]; choices: Choice[]; price: number | null; median?: number | null;
}) {
  const [ref, w] = useWidth<HTMLDivElement>(300);
  if (curve.length < 2) return null;
  const H = 140, L = 42, R = 10, T = 18, B = 24;
  const x = linear(range[0], range[1], L, w - R);
  const y = linear(0, 100, H - B, T);
  const pts = curve.filter((p) => p.price >= range[0] && p.price <= range[1]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.price).toFixed(1)},${y(p.pct).toFixed(1)}`).join("");
  const pctAt = (pr: number) => {
    let i = pts.findIndex((p) => p.price >= pr);
    if (i <= 0) i = 1;
    const a = pts[i - 1], b = pts[i];
    const t = b.price === a.price ? 0 : (pr - a.price) / (b.price - a.price);
    return a.pct + (b.pct - a.pct) * Math.max(0, Math.min(1, t));
  };
  const inRange = (pr: number) => pr >= range[0] && pr <= range[1];
  const youX = price != null && inRange(price) ? x(price) : null;
  const k = (v: number) => `R ${Math.round(v / 1000)}k`;
  const medX = median != null && inRange(median) ? x(median) : null;
  // Axis labels never overlap: the median tick label only shows with room.
  const medLabel = medX != null && medX - L > 34 && w - R - medX > 34;

  return (
    <div ref={ref} className="viz pa-curve">
      <svg width={w} height={H} role="img" aria-label="Chance to win by price. The same figures are listed below.">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line className="viz-gridline" x1={L} x2={w - R} y1={y(v)} y2={y(v)} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className="viz-muted">{v}%</text>
          </g>
        ))}
        <path d={line} fill="none" stroke="var(--text-secondary)" strokeWidth={1.75} strokeLinejoin="round" />
        {youX != null && (
          <line x1={youX} x2={youX} y1={T - 6} y2={y(0)} stroke="var(--viz-accent)" strokeWidth={2} />
        )}
        {(() => {
          // Labels never collide: with the your-price line (stepped aside) or
          // with a neighbouring choice (the second one goes under its dot).
          let prevRight = -Infinity, prevAbove = false;
          return [...choices].filter((c) => inRange(c.price)).sort((a, b) => a.price - b.price).map((c) => {
            const cx = x(c.price), cy = y(pctAt(c.price));
            const half = c.label.length * 3.2 + 2;
            const near = youX != null && Math.abs(cx - youX) < 6 + half;
            const dx = !near ? 0 : cx >= youX! ? 6 : -6;
            const anchor = !near ? "middle" : cx >= youX! ? "start" : "end";
            const left = anchor === "middle" ? cx - half : anchor === "start" ? cx + dx : cx + dx - half * 2;
            const above = !(prevAbove && left < prevRight + 4);
            if (above) prevRight = left + half * 2;
            prevAbove = above;
            return (
              <g key={c.key}>
                <circle cx={cx} cy={cy} r={c.recommended ? 4.5 : 3.5}
                  fill={c.recommended ? "var(--text-primary)" : "var(--bg-surface)"} stroke="var(--text-primary)" strokeWidth={1.5} />
                <text x={cx + dx} y={above ? cy - 9 : cy + 17} textAnchor={anchor} className={c.recommended ? "viz-strong" : undefined} style={{ fontSize: 11 }}>{c.label}</text>
              </g>
            );
          });
        })()}
        {medX != null && (
          <g>
            <line x1={medX} x2={medX} y1={y(0)} y2={y(0) + 5} stroke="var(--text-secondary)" strokeWidth={1.5} />
            {medLabel && <text x={medX} y={H - 4} textAnchor="middle" className="viz-muted">median</text>}
          </g>
        )}
        <text x={L} y={H - 4} textAnchor="start" className="viz-muted">{k(range[0])}</text>
        <text x={w - R} y={H - 4} textAnchor="end" className="viz-muted">{k(range[1])}</text>
      </svg>
    </div>
  );
}
