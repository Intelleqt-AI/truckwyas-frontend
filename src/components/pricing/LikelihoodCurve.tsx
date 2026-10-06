import { formatCompact } from "@/lib/formatters";
import { linear, useWidth } from "@/components/viz/core";
import "@/components/viz/viz.css";
import type { Choice, CurvePoint } from "./types";

/**
 * Price → likelihood of acceptance, read from the model's own curve (only
 * inside the range it has seen). The accent wash under it is expected profit
 * (margin × likelihood), scaled to its own peak, so the reader sees where the
 * trade-off is best. Dots mark the three choices; the accent line is the
 * price in the bar.
 */
export function LikelihoodCurve({ curve, range, choices, price }: {
  curve: CurvePoint[]; range: [number, number]; choices: Choice[]; price: number | null;
}) {
  const [ref, w] = useWidth<HTMLDivElement>(300);
  if (curve.length < 2) return null;
  const H = 132, L = 34, R = 8, T = 10, B = 22;
  const x = linear(range[0], range[1], L, w - R);
  const y = linear(0, 100, H - B, T);
  const pts = curve.filter((p) => p.price >= range[0] && p.price <= range[1]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.price).toFixed(1)},${y(p.pct).toFixed(1)}`).join("");
  const ep = pts.map((p) => p.expectedProfit ?? null);
  const epMax = Math.max(0, ...ep.filter((v): v is number => v != null));
  const epArea = epMax > 0
    ? `M${x(pts[0].price).toFixed(1)},${y(0)}` +
      pts.map((p) => `L${x(p.price).toFixed(1)},${y(Math.max(0, (p.expectedProfit ?? 0) / epMax) * 100 * 0.9).toFixed(1)}`).join("") +
      `L${x(pts[pts.length - 1].price).toFixed(1)},${y(0)}Z`
    : null;
  const peak = epMax > 0 ? pts[ep.indexOf(epMax)] : null;
  const pctAt = (pr: number) => {
    let i = pts.findIndex((p) => p.price >= pr);
    if (i <= 0) i = 1;
    const a = pts[i - 1], b = pts[i];
    const t = b.price === a.price ? 0 : (pr - a.price) / (b.price - a.price);
    return a.pct + (b.pct - a.pct) * Math.max(0, Math.min(1, t));
  };
  const inRange = (pr: number) => pr >= range[0] && pr <= range[1];

  return (
    <div ref={ref} className="viz pa-curve">
      <svg width={w} height={H} role="img" aria-label="Likelihood of acceptance by price, with expected profit shaded. The same figures are listed below.">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line className="viz-gridline" x1={L} x2={w - R} y1={y(v)} y2={y(v)} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className="viz-muted">{v}%</text>
          </g>
        ))}
        {epArea && <path d={epArea} fill="var(--accent-dim)" stroke="none" />}
        {peak && <line x1={x(peak.price)} x2={x(peak.price)} y1={y(0)} y2={y(90)} stroke="var(--viz-accent)" strokeOpacity={0.35} strokeDasharray="2 3" />}
        <path d={line} fill="none" stroke="var(--text-secondary)" strokeWidth={1.75} strokeLinejoin="round" />
        {price != null && inRange(price) && (
          <line x1={x(price)} x2={x(price)} y1={T - 4} y2={y(0)} stroke="var(--viz-accent)" strokeWidth={2} />
        )}
        {choices.filter((c) => inRange(c.price)).map((c) => (
          <circle key={c.key} cx={x(c.price)} cy={y(pctAt(c.price))} r={c.recommended ? 4.5 : 3.5}
            fill={c.recommended ? "var(--text-primary)" : "var(--bg-surface)"} stroke="var(--text-primary)" strokeWidth={1.5} />
        ))}
        <text x={L} y={H - 4} textAnchor="start" className="viz-muted">{formatCompact(range[0])}</text>
        <text x={w - R} y={H - 4} textAnchor="end" className="viz-muted">{formatCompact(range[1])}</text>
      </svg>
    </div>
  );
}
