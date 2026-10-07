import { formatMoneyWhole } from "@/lib/formatters";
import { HatchDef, linear, useSvgId, useWidth } from "@/components/viz/core";
import "@/components/viz/viz.css";
import type { Market } from "./types";

/**
 * The lane's market range as one horizontal bar: the middle half of quotes
 * (p25 to p75) as a band, the median as a tick, your cost floor below the
 * bar and the price in the bar above it. An estimate tier is hatched (never
 * a solid "market" band), so it can't be mistaken for real quotes.
 */
export function MarketRange({ market, floor, price }: { market: Market; floor: number | null; price: number | null }) {
  const [ref, w] = useWidth<HTMLDivElement>(300);
  const hatchId = useSvgId("pa-hatch");
  const { p25, median, p75 } = market;
  if (p25 == null || median == null || p75 == null) return null;

  const values = [p25, p75, median, ...(floor != null ? [floor] : []), ...(price != null ? [price] : [])];
  const lo = Math.min(...values), hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.08, hi * 0.02);
  const PADX = 6;
  const x = linear(lo - pad, hi + pad, PADX, w - PADX);
  const H = 76, barY = 28, barH = 14;
  const clampText = (cx: number, label: string) => {
    const half = label.length * 3.5 + 2;
    return Math.max(half, Math.min(w - half, cx));
  };
  const youLabel = price != null ? `You ${formatMoneyWhole(price)}` : null;
  // Floor label is pinned to its tick; when "You" is within ~24 px of it,
  // the You label steps sideways so the two never collide.
  const close = floor != null && price != null && Math.abs(x(price) - x(floor)) < 24;
  const youX = !youLabel ? 0 : close ? clampText(x(price!) + (x(price!) >= x(floor!) ? 1 : -1) * (youLabel.length * 3.5), youLabel) : clampText(x(price!), youLabel);
  const floorLabel = floor != null ? `Floor ${formatMoneyWhole(floor)}` : null;

  return (
    <div ref={ref} className="viz pa-range">
      <svg width={w} height={H} role="img"
        aria-label={`Market range ${formatMoneyWhole(p25)} to ${formatMoneyWhole(p75)}, median ${formatMoneyWhole(median)}${floor != null ? `, your cost floor ${formatMoneyWhole(floor)}` : ""}${price ? `, your price ${formatMoneyWhole(price)}` : ""}.`}>
        {market.isEstimate && <HatchDef id={hatchId} />}
        {/* track */}
        <rect x={PADX} y={barY + barH / 2 - 1} width={w - PADX * 2} height={2} rx={1} fill="var(--viz-track)" />
        {/* middle half */}
        <rect x={x(p25)} y={barY} width={Math.max(2, x(p75) - x(p25))} height={barH} rx={3}
          fill={market.isEstimate ? `url(#${hatchId})` : "var(--pa-band)"}
          stroke={market.isEstimate ? "var(--viz-hatch)" : "var(--pa-band-edge)"} strokeWidth={1}
          strokeDasharray={market.isEstimate ? "3 2" : undefined} />
        {/* median */}
        <line x1={x(median)} x2={x(median)} y1={barY - 3} y2={barY + barH + 3} stroke="var(--text-secondary)" strokeWidth={2} />
        {/* floor: below the bar */}
        {floor != null && (
          <g>
            <line x1={x(floor)} x2={x(floor)} y1={barY} y2={barY + barH + 10} stroke="var(--text-primary)" strokeWidth={1.5} strokeDasharray="2 2" />
            <text x={clampText(x(floor), floorLabel!)} y={barY + barH + 24} textAnchor="middle" className="viz-muted">{floorLabel}</text>
          </g>
        )}
        {/* your price: above the bar */}
        {youLabel && (
          <g>
            <line x1={x(price!)} x2={x(price!)} y1={barY - 8} y2={barY + barH} stroke="var(--viz-accent)" strokeWidth={2} />
            <circle cx={x(price!)} cy={barY - 9} r={3.5} fill="var(--viz-accent)" />
            <text x={youX} y={barY - 17} textAnchor="middle" className="viz-strong">{youLabel}</text>
          </g>
        )}
      </svg>
    </div>
  );
}
