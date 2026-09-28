import { useRef, useState } from 'react';
import { Legend, TableTwin, Tip, TipRow, VIZ, linear, localPoint, niceTicks, plural, rand, useTip, useWidth } from './core';

/**
 * "Which lanes are worth it?" Revenue per kilometre (y) against the average
 * length of a trip on the lane (x), because short hauls always earn more per
 * kilometre: a lane is only good or bad relative to lanes of its length.
 * Point area is the lane's total revenue. Lanes with too few trips to trust
 * are hollow and muted; evidenced lanes are solid. A hairline marks the
 * fleet-wide rate so "above the line" means "earns more than your average".
 * Hover finds the nearest lane, so small points never need a precise aim.
 */
export interface LanePoint { id: string; label: string; kmPerTrip: number; perKm: number; revenue: number; trips: number; thin: boolean }

export function LaneScatter({ points, overallPerKm, minTrips, height = 320 }: {
  points: LanePoint[];
  /** Total revenue / total km over every plotted lane. */
  overallPerKm: number | null;
  minTrips: number;
  height?: number;
}) {
  const [ref, W] = useWidth<HTMLDivElement>(720);
  const svgRef = useRef<SVGSVGElement>(null);
  const figRef = useRef<HTMLDivElement>(null);
  const { tip, show, hide } = useTip();
  const [active, setActive] = useState<string | null>(null);

  const xs = points.map((p) => p.kmPerTrip);
  const ys = points.map((p) => p.perKm);
  const xt = niceTicks(0, Math.max(...xs, 100) * 1.05, W < 520 ? 3 : 5);
  const yt = niceTicks(0, Math.max(...ys, overallPerKm ?? 0, 1) * 1.1, 4);
  const yLabel = (v: number) => `R ${v % 1 === 0 ? v : v.toFixed(1).replace('.', ',')}`;
  const axisW = Math.max(...yt.map((t) => yLabel(t).length)) * 7 + 10;
  const padT = 28;
  const padR = 16;
  const padB = 44;
  const x = linear(0, xt[xt.length - 1], axisW, W - padR);
  const y = linear(0, yt[yt.length - 1], height - padB, padT);
  const maxRev = Math.max(...points.map((p) => p.revenue), 1);
  const r = (v: number) => 4 + Math.sqrt(Math.max(0, v) / maxRev) * 10; // area ∝ revenue, r 4..14

  // Draw big points first so small ones stay on top and hoverable.
  const order = [...points].sort((a, b) => b.revenue - a.revenue);

  // Direct labels: evidenced lanes first, then the highest and lowest rate; skip any that would collide.
  const byRate = [...points].sort((a, b) => b.perKm - a.perKm);
  const byRev = [...points].sort((a, b) => b.revenue - a.revenue);
  const want = [...points.filter((p) => !p.thin), byRate[0], byRate[byRate.length - 1], ...byRev].filter(Boolean);
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const labels: { p: LanePoint; lx: number; ly: number; anchor: 'start' | 'end' }[] = [];
  for (const p of want) {
    if (labels.some((l) => l.p.id === p.id)) continue;
    const px = x(p.kmPerTrip);
    const py = y(p.perKm);
    const max = W < 520 ? 18 : 30;
    const text = p.label.length > max ? p.label.slice(0, max - 1) + '…' : p.label;
    const tw = text.length * 6.4;
    const right = px + r(p.revenue) + 6 + tw < W - padR;
    const lx = right ? px + r(p.revenue) + 6 : px - r(p.revenue) - 6;
    const box = { x0: right ? lx : lx - tw, x1: right ? lx + tw : lx, y0: py - 8, y1: py + 8 };
    const hitsPoint = points.some((q) => q.id !== p.id && Math.abs(x(q.kmPerTrip) - (box.x0 + box.x1) / 2) < tw / 2 + r(q.revenue) && Math.abs(y(q.perKm) - py) < 8 + r(q.revenue));
    if (placed.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1) || hitsPoint) continue;
    placed.push(box);
    labels.push({ p: { ...p, label: text }, lx, ly: py, anchor: right ? 'start' : 'end' });
  }

  const offsetY = () => (figRef.current && svgRef.current ? svgRef.current.getBoundingClientRect().top - figRef.current.getBoundingClientRect().top : 0);
  const openP = (p: LanePoint) => {
    setActive(p.id);
    show(x(p.kmPerTrip), y(p.perKm) - r(p.revenue) + offsetY(), (
      <>
        <div className="viz-tip__title">{p.label}</div>
        <TipRow color={p.thin ? undefined : VIZ.accent} keyShape={p.thin ? 'ring' : 'line'} value={`${rand(p.perKm)}/km`} label="revenue per km" />
        <div className="viz-tip__note">{plural(p.trips, 'trip')} · {Math.round(p.kmPerTrip).toLocaleString('en-ZA')} km per trip · {rand(p.revenue, 0)} revenue</div>
        {p.thin && <div className="viz-tip__note">Too few trips to judge ({minTrips} needed)</div>}
      </>
    ));
  };
  const nearest = (px: number, py: number) => {
    let best: LanePoint | null = null;
    let bd = 40 * 40;
    for (const p of points) {
      const d = (x(p.kmPerTrip) - px) ** 2 + (y(p.perKm) - py) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  const close = () => { setActive(null); hide(); };
  const kbOrder = [...points].sort((a, b) => a.kmPerTrip - b.kmPerTrip);

  return (
    <div className="viz" ref={figRef}>
      <Legend items={[
        { label: `${minTrips}+ trips`, color: VIZ.accent, shape: 'dot' },
        { label: `Fewer than ${minTrips} trips`, color: VIZ.neutralStrong, shape: 'ring' },
        ...(overallPerKm ? [{ label: `Your average, ${rand(overallPerKm)}/km`, color: 'var(--text-secondary)', shape: 'line' as const }] : []),
      ]} />
      <div ref={ref} onPointerLeave={close}>
        <svg ref={svgRef} width={W} height={height} role="img" tabIndex={0} style={{ outline: 'none' }}
          aria-label={`Revenue per kilometre against kilometres per trip for ${plural(points.length, 'lane')}. Point size is total revenue. Use the table for every value.`}
          onPointerMove={(e) => { const pt = localPoint(svgRef.current!, e); const p = nearest(pt.x, pt.y); if (p) openP(p); else close(); }}
          onFocus={() => kbOrder[0] && openP(kbOrder[0])} onBlur={close}
          onKeyDown={(e) => {
            const i = kbOrder.findIndex((p) => p.id === active);
            if (e.key === 'ArrowRight') { e.preventDefault(); openP(kbOrder[Math.min(kbOrder.length - 1, i + 1)]); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); openP(kbOrder[Math.max(0, i - 1)]); }
            if (e.key === 'Escape') close();
          }}>
          {yt.map((t) => (
            <g key={`y${t}`}>
              <line x1={axisW} x2={W - padR} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-baseline' : 'viz-gridline'} />
              <text x={axisW - 8} y={y(t)} dy="0.32em" textAnchor="end">{yLabel(t)}</text>
            </g>
          ))}
          {xt.map((t) => (
            <text key={`x${t}`} x={x(t)} y={height - padB + 18} textAnchor="middle">{t.toLocaleString('en-ZA')}</text>
          ))}
          <text x={W - padR} y={height - 6} textAnchor="end" className="viz-muted">Kilometres per trip</text>
          <text x={0} y={12} className="viz-muted">Revenue per km</text>
          {overallPerKm != null && overallPerKm > 0 && (
            <g>
              <line x1={axisW} x2={W - padR} y1={y(overallPerKm)} y2={y(overallPerKm)} stroke="var(--text-secondary)" strokeWidth={1} shapeRendering="crispEdges" />
              {W >= 520 && <text x={W - padR} y={y(overallPerKm) - 6} textAnchor="end" className="viz-halo">Average {rand(overallPerKm)}/km</text>}
            </g>
          )}
          {order.map((p) => {
            const dim = active != null && active !== p.id;
            return p.thin ? (
              <circle key={p.id} cx={x(p.kmPerTrip)} cy={y(p.perKm)} r={r(p.revenue)} fill="var(--viz-surface)" fillOpacity={0.6} stroke={VIZ.neutralStrong} strokeWidth={active === p.id ? 2.5 : 1.5} opacity={dim ? 0.5 : 1} />
            ) : (
              <circle key={p.id} cx={x(p.kmPerTrip)} cy={y(p.perKm)} r={r(p.revenue)} fill={VIZ.accent} fillOpacity={0.85} stroke="var(--viz-surface)" strokeWidth={2} opacity={dim ? 0.5 : 1} />
            );
          })}
          {labels.map(({ p, lx, ly, anchor }) => (
            <text key={`l${p.id}`} x={lx} y={ly} dy="0.32em" textAnchor={anchor} className={p.thin ? 'viz-halo' : 'viz-strong viz-halo'} style={p.thin ? undefined : { fontWeight: 500 }}>{p.label}</text>
          ))}
        </svg>
      </div>
      <Tip tip={tip} width={W} />
      <TableTwin
        table={{
          caption: 'Lanes: revenue per kilometre, trip length and trips',
          columns: [{ label: 'Lane' }, { label: 'Revenue per km', numeric: true }, { label: 'Km per trip', numeric: true }, { label: 'Trips', numeric: true }, { label: 'Revenue', numeric: true }, { label: 'Evidence' }],
          rows: [...points].sort((a, b) => b.perKm - a.perKm).map((p) => ({
            key: p.id,
            cells: [p.label, `${rand(p.perKm)}/km`, Math.round(p.kmPerTrip).toLocaleString('en-ZA'), String(p.trips), rand(p.revenue), p.thin ? `Fewer than ${minTrips} trips` : 'Enough to compare'],
          })),
        }}
      />
    </div>
  );
}
