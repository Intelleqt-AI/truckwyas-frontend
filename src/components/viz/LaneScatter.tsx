import { useRef, useState } from 'react';
import { Legend, TableTwin, Tip, TipRow, VIZ, num0, overlaps, textBox, type Box, linear, localPoint, niceTicks, plural, rand, useTip, useWidth } from './core';

/**
 * "Which lanes are worth it?" Revenue per kilometre (y) against the average
 * length of a trip on the lane (x), because short hauls always earn more per
 * kilometre: a lane is only good or bad relative to lanes of its length.
 * Point area is the lane's total revenue. Lanes with too few trips to trust
 * are hollow and muted; evidenced lanes are solid. A hairline marks the
 * fleet-wide rate so "above the line" means "earns more than your average".
 * Hover finds the nearest lane, so small points never need a precise aim.
 *
 * The y-axis is scaled to the evidence: the evidenced lanes and the average
 * set the range (with headroom), so one thin-data outlier cannot squash the
 * lanes that matter into the bottom of the plot. A thin lane above the range
 * is drawn as a small caret on the top edge at its trip length, unlabelled;
 * its value is in the tooltip and the table. Only evidenced lanes are labelled.
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
  const evidenced = points.filter((p) => !p.thin);
  // Scale to the evidenced lanes and the average; fall back to every lane when none is evidenced.
  const evMax = evidenced.length > 0 ? Math.max(...evidenced.map((p) => p.perKm), overallPerKm ?? 0) : Math.max(...ys, overallPerKm ?? 0);
  const allMax = Math.max(...ys, overallPerKm ?? 0, 1);
  const yt = niceTicks(0, Math.max(Math.min(allMax * 1.1, evMax * 1.35), 1), 4);
  const yTop = yt[yt.length - 1];
  const offScale = points.filter((p) => p.perKm > yTop);
  const yLabel = (v: number) => rand(v, v % 1 === 0 ? 0 : 1);
  const axisW = Math.max(...yt.map((t) => yLabel(t).length)) * 7 + 10;
  const padT = offScale.length > 0 ? 40 : 28;
  const padR = 16;
  const padB = 44;
  const x = linear(0, xt[xt.length - 1], axisW, W - padR);
  const y = linear(0, yTop, height - padB, padT);
  // Off-scale thin lanes sit on a caret row just above the plot's top rule.
  const OFF_Y = padT - 12;
  const py = (p: LanePoint) => (p.perKm > yTop ? OFF_Y : y(p.perKm));
  const maxRev = Math.max(...points.map((p) => p.revenue), 1);
  const r = (v: number) => 4 + Math.sqrt(Math.max(0, v) / maxRev) * 10; // area ∝ revenue, r 4..14

  // Draw big points first so small ones stay on top and hoverable.
  const order = [...points].sort((a, b) => b.revenue - a.revenue);

  // Direct labels: evidenced lanes only, largest revenue first; thin lanes stay unlabelled
  // (tooltip and table). With no evidenced lane at all, the three largest lanes are named.
  const byRev = [...points].sort((a, b) => b.revenue - a.revenue);
  const want = evidenced.length > 0 ? byRev.filter((p) => !p.thin) : byRev.slice(0, 3);
  // The fleet-average rule and its own label are obstacles: lane labels keep 4px clear of both.
  const avgY = overallPerKm != null && overallPerKm > 0 ? y(overallPerKm) : null;
  const avgText = overallPerKm != null ? `Average ${rand(overallPerKm)}/km` : '';
  const avgBox = avgY != null && W >= 520 ? textBox(avgText, W - padR, avgY - 6, 'end') : null;
  // Lane labels may cross the average hairline (they carry a surface halo) but never its text.
  const placed: Box[] = [
    ...(avgBox ? [avgBox] : []),
  ];
  const labels: { p: LanePoint; lx: number; ly: number; anchor: 'start' | 'end' | 'middle' }[] = [];
  for (const p of want) {
    if (labels.some((l) => l.p.id === p.id)) continue;
    const px = x(p.kmPerTrip);
    const pyy = py(p);
    const max = W < 520 ? 18 : 30;
    const text = p.label.length > max ? p.label.slice(0, max - 1) + '…' : p.label;
    const pr = r(p.revenue);
    // Try right of the point, then left, then above and below; each must clear the average rule, other labels and points.
    const tries: { lx: number; ly: number; anchor: 'start' | 'end' | 'middle' }[] = [
      { lx: px + pr + 6, ly: pyy + 4, anchor: 'start' },
      { lx: px - pr - 6, ly: pyy + 4, anchor: 'end' },
      { lx: px, ly: pyy - pr - 6, anchor: 'middle' },
      { lx: px, ly: pyy + pr + 14, anchor: 'middle' },
    ];
    let done = false;
    for (const t of tries) {
      const box = textBox(text, t.lx, t.ly, t.anchor);
      if (box.x0 < 0 || box.x1 > W - padR + 2 || box.y0 < padT - 8 || box.y1 > height - padB) continue;
      const hitsPoint = points.some((q) => { const qr = q.perKm > yTop ? 5 : r(q.revenue); const qx = x(q.kmPerTrip); const qy = py(q); return overlaps(box, { x0: qx - qr, x1: qx + qr, y0: qy - qr, y1: qy + qr }, q.id === p.id ? -1 : 1); });
      if (placed.some((b) => overlaps(box, b, 4)) || hitsPoint) continue;
      placed.push(box);
      labels.push({ p: { ...p, label: text }, lx: t.lx, ly: t.ly, anchor: t.anchor });
      done = true;
      break;
    }
    if (!done) continue;
  }

  const offsetY = () => (figRef.current && svgRef.current ? svgRef.current.getBoundingClientRect().top - figRef.current.getBoundingClientRect().top : 0);
  const openP = (p: LanePoint) => {
    setActive(p.id);
    show(x(p.kmPerTrip), py(p) - (p.perKm > yTop ? 6 : r(p.revenue)) + offsetY(), (
      <>
        <div className="viz-tip__title">{p.label}</div>
        <TipRow color={p.thin ? undefined : VIZ.accent} keyShape={p.thin ? 'ring' : 'line'} value={`${rand(p.perKm)}/km`} label="revenue per km" />
        <div className="viz-tip__note">{plural(p.trips, 'trip')} · {num0(p.kmPerTrip)} km per trip · {rand(p.revenue, 0)} revenue</div>
        {p.thin && <div className="viz-tip__note">Too few trips to judge ({minTrips} needed){p.perKm > yTop ? `; above the ${yLabel(yTop)} scale` : ''}</div>}
      </>
    ));
  };
  const nearest = (px: number, pyy: number) => {
    let best: LanePoint | null = null;
    let bd = 40 * 40;
    for (const p of points) {
      const d = (x(p.kmPerTrip) - px) ** 2 + (py(p) - pyy) ** 2;
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
        <svg ref={svgRef} width={W} height={height} role="img" tabIndex={0} className="viz-focusable"
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
            <text key={`x${t}`} x={x(t)} y={height - padB + 18} textAnchor="middle">{num0(t)}</text>
          ))}
          <text x={W - padR} y={height - 6} textAnchor="end" className="viz-muted">Kilometres per trip</text>
          <text x={0} y={12} className="viz-muted">Revenue per km</text>
          {offScale.length > 0 && (
            <text x={W - padR} y={12} textAnchor="end" className="viz-muted">{`${plural(offScale.length, 'thin lane')} above ${yLabel(yTop)}`}</text>
          )}
          {overallPerKm != null && overallPerKm > 0 && (
            <g>
              <line x1={axisW} x2={W - padR} y1={y(overallPerKm)} y2={y(overallPerKm)} stroke="var(--text-secondary)" strokeWidth={1} shapeRendering="crispEdges" />
              {avgBox && <text x={W - padR} y={y(overallPerKm) - 6} textAnchor="end" className="viz-halo">{avgText}</text>}
            </g>
          )}
          {order.map((p) => {
            const on = active === p.id;
            if (p.perKm > yTop) {
              const cx0 = x(p.kmPerTrip);
              return <path key={p.id} d={`M${cx0 - 5},${OFF_Y + 3} L${cx0},${OFF_Y - 4} L${cx0 + 5},${OFF_Y + 3}`} fill="none" stroke={on ? 'var(--text-primary)' : VIZ.neutralStrong} strokeWidth={on ? 2.5 : 1.5} strokeLinejoin="round" strokeLinecap="round" />;
            }
            return p.thin ? (
              <circle key={p.id} cx={x(p.kmPerTrip)} cy={y(p.perKm)} r={r(p.revenue)} fill="var(--viz-surface)" fillOpacity={0.6} stroke={on ? 'var(--text-primary)' : VIZ.neutralStrong} strokeWidth={on ? 2.5 : 1.25} />
            ) : (
              <circle key={p.id} cx={x(p.kmPerTrip)} cy={y(p.perKm)} r={r(p.revenue)} fill={VIZ.accent} fillOpacity={0.85} stroke={on ? 'var(--text-primary)' : 'var(--viz-surface)'} strokeWidth={2} />
            );
          })}
          {labels.map(({ p, lx, ly, anchor }) => (
            <text key={`l${p.id}`} x={lx} y={ly} textAnchor={anchor} className={p.thin ? 'viz-halo' : 'viz-strong viz-halo'} style={p.thin ? undefined : { fontWeight: 500 }}>{p.label}</text>
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
            cells: [p.label, `${rand(p.perKm)}/km`, num0(p.kmPerTrip), String(p.trips), rand(p.revenue), p.thin ? `Fewer than ${minTrips} trips` : 'Enough to compare'],
          })),
        }}
      />
    </div>
  );
}
