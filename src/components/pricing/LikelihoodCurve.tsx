import { linear, useWidth } from "@/components/viz/core";
import "@/components/viz/viz.css";
import type { Choice, CurvePoint } from "./types";

type Box = { x0: number; x1: number; y0: number; y1: number };
const hit = (a: Box, b: Box) => a.x0 < b.x1 + 2 && b.x0 < a.x1 + 2 && a.y0 < b.y1 + 1 && b.y0 < a.y1 + 1;
/** Label width at 11px (generous, so boxes never under-measure). */
const textW = (s: string) => s.length * 6.4 + 2;

/**
 * One job: where the three prices sit on the chance-to-win curve (only inside
 * the range the model has seen). Dots mark the choices (the recommended one
 * filled); a vertical accent line marks the bar price when it isn't one of
 * the three. Labels are placed so none overlaps another.
 */
export function LikelihoodCurve({ curve, range, choices, price, median }: {
  curve: CurvePoint[]; range: [number, number]; choices: Choice[]; price: number | null; median?: number | null;
}) {
  const [ref, w] = useWidth<HTMLDivElement>(300);
  if (curve.length < 2) return null;
  const H = 132, L = 40, R = 8, T = 16, B = 20;
  const x = linear(range[0], range[1], L, w - R);
  const y = linear(0, 100, H - B, T);
  const pts = curve.filter((p) => p.price >= range[0] && p.price <= range[1]);
  if (pts.length < 2) return null;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.price).toFixed(1)},${y(p.pct).toFixed(1)}`).join("");
  const pctAt = (pr: number) => {
    let i = pts.findIndex((p) => p.price >= pr);
    if (i <= 0) i = 1;
    const a = pts[i - 1], b = pts[i];
    const t = b.price === a.price ? 0 : (pr - a.price) / (b.price - a.price);
    return a.pct + (b.pct - a.pct) * Math.max(0, Math.min(1, t));
  };
  const inRange = (pr: number) => pr >= range[0] && pr <= range[1];
  const k = (v: number) => `R ${Math.round(v / 1000)}k`;
  const youX = price != null && inRange(price) ? x(price) : null;
  const medX = median != null && inRange(median) ? x(median) : null;

  // Fixed labels first: the axis ends, "median" and "You" (top edge).
  const placed: Box[] = [];
  const axisY = H - 4;
  const lo = k(range[0]), hi = k(range[1]);
  placed.push({ x0: L, x1: L + textW(lo), y0: axisY - 10, y1: axisY + 2 });
  placed.push({ x0: w - R - textW(hi), x1: w - R, y0: axisY - 10, y1: axisY + 2 });
  let showMedian = false;
  if (medX != null) {
    const b = { x0: medX - textW("median") / 2, x1: medX + textW("median") / 2, y0: axisY - 10, y1: axisY + 2 };
    if (!placed.some((p) => hit(p, b))) { placed.push(b); showMedian = true; }
  }
  let youAnchor: "middle" | "start" | "end" = "middle";
  if (youX != null) {
    const half = textW("You") / 2;
    youAnchor = youX - half < L ? "start" : youX + half > w - R ? "end" : "middle";
    const x0 = youAnchor === "start" ? youX : youAnchor === "end" ? youX - half * 2 : youX - half;
    placed.push({ x0, x1: x0 + half * 2, y0: 0, y1: 12 });
  }
  // Labels keep clear of every dot and of the line itself.
  const inR = [...choices].filter((c) => inRange(c.price)).sort((a, b) => a.price - b.price);
  const obstacles: Box[] = inR.map((c) => { const cx = x(c.price), cy = y(pctAt(c.price)); return { x0: cx - 5, x1: cx + 5, y0: cy - 5, y1: cy + 5 }; });
  for (let px = L; px <= w - R; px += 4) {
    const py = y(pctAt(range[0] + ((px - L) / Math.max(1, w - R - L)) * (range[1] - range[0])));
    obstacles.push({ x0: px - 2, x1: px + 2, y0: py - 1, y1: py + 1 });
  }
  // Choice labels: above the dot when it is below 50%, else below; then the
  // other side, further out, and sideways, until nothing overlaps. Never in
  // the top 14px.
  const dots = inR.map((c) => {
    const cx = x(c.price), cy = y(pctAt(c.price));
    const pct = pctAt(c.price);
    const wdt = textW(c.label);
    const tries: { dy: number; dx: number }[] = [];
    const first = pct < 50 ? -1 : 1;
    for (const dist of [0, 8]) for (const dx of [0, -wdt / 2 - 4, wdt / 2 + 4, -wdt + 4, wdt - 4]) for (const s of [first, -first]) tries.push({ dy: s * (1 + dist), dx });
    let box: Box | null = null, tx = cx, ty = cy;
    for (const t of tries) {
      const extra = Math.abs(t.dy) - 1;
      const ly = t.dy < 0 ? cy - 9 - extra : cy + 17 + extra; // baseline
      const lx = Math.max(L + wdt / 2, Math.min(w - R - wdt / 2, cx + t.dx));
      const b = { x0: lx - wdt / 2, x1: lx + wdt / 2, y0: ly - 10, y1: ly + 2 };
      if (b.y0 < 14 || b.y1 > H - B + 2) continue;
      // Nor over the "You" line itself.
      if (youX != null && b.x0 < youX + 2 && b.x1 > youX - 2) continue;
      if (placed.some((p) => hit(p, b)) || obstacles.some((o) => hit(o, b))) continue;
      box = b; tx = lx; ty = ly; break;
    }
    if (!box) { // last resort: below the dot, clamped
      ty = Math.min(cy + 16, H - B); tx = Math.max(L + wdt / 2, Math.min(w - R - wdt / 2, cx));
      box = { x0: tx - wdt / 2, x1: tx + wdt / 2, y0: ty - 10, y1: ty + 2 };
    }
    placed.push(box);
    return { c, cx, cy, tx, ty };
  });

  return (
    <div ref={ref} className="viz pa-curve">
      <svg width={w} height={H} role="img"
        aria-label={`Chance to win by price. ${dots.map((d) => `${d.c.label} ${Math.round(pctAt(d.c.price))}%`).join(", ")}.`}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line className="viz-gridline" x1={L} x2={w - R} y1={y(v)} y2={y(v)} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className="viz-muted" data-label={`${v}%`}>{v}%</text>
          </g>
        ))}
        <path d={line} fill="none" stroke="var(--chart-series-1)" strokeWidth={1.75} strokeLinejoin="round" />
        {youX != null && (
          <g>
            <line x1={youX} x2={youX} y1={14} y2={y(0)} stroke="var(--accent-primary)" strokeWidth={1.5} />
            <text x={youX} y={10} textAnchor={youAnchor} className="viz-strong" style={{ fontSize: 11 }} data-label="You">You</text>
          </g>
        )}
        {medX != null && (
          <g>
            <line x1={medX} x2={medX} y1={y(0)} y2={y(0) + 4} stroke="var(--text-secondary)" strokeWidth={1.5} />
            {showMedian && <text x={medX} y={axisY} textAnchor="middle" className="viz-muted" data-label="median">median</text>}
          </g>
        )}
        {dots.map(({ c, cx, cy, tx, ty }) => (
          <g key={c.key}>
            <circle cx={cx} cy={cy} r={c.recommended ? 4.5 : 3.5}
              fill={c.recommended ? "var(--text-primary)" : "var(--bg-surface)"} stroke="var(--text-primary)" strokeWidth={1.5} />
            <text x={tx} y={ty} textAnchor="middle" className={c.recommended ? "viz-strong" : undefined} style={{ fontSize: 11 }} data-label={c.label}>{c.label}</text>
          </g>
        ))}
        <text x={L} y={axisY} textAnchor="start" className="viz-muted">{lo}</text>
        <text x={w - R} y={axisY} textAnchor="end" className="viz-muted">{hi}</text>
      </svg>
    </div>
  );
}
