import { useRef } from 'react';
import { Legend, TableTwin, Tip, TipRow, VIZ, linear, localPoint, niceTicks, rand, randCompact, useTip, useWidth } from './core';

/**
 * "Will I run short of cash?" One rand axis. Weekly money expected in rises
 * from the zero line, money expected out hangs below it, and the running
 * position (the sum of every week so far, starting from today at zero) is the
 * line the reader follows. Weeks where the running position is below zero are
 * shaded and named. The zero line is the strongest rule on the chart.
 *
 * The running position does NOT include the bank balance; callers must say so.
 */
export interface RunwayWeek { label: string; in: number; out: number }

export function CashRunway({ weeks, height = 260 }: { weeks: RunwayWeek[]; height?: number }) {
  const [ref, W] = useWidth<HTMLDivElement>(720);
  const svgRef = useRef<SVGSVGElement>(null);
  const figRef = useRef<HTMLDivElement>(null);
  const { tip, show, hide } = useTip();

  let run = 0;
  const rows = weeks.map((w) => { run += w.in - w.out; return { ...w, net: w.in - w.out, pos: run }; });
  const lo = Math.min(0, ...rows.map((r) => -r.out), ...rows.map((r) => r.pos));
  const hi = Math.max(0, ...rows.map((r) => r.in), ...rows.map((r) => r.pos));
  const ticks = niceTicks(lo, hi || 1, 4);
  const axisW = Math.max(...ticks.map((t) => randCompact(t).length)) * 7 + 8;
  const padT = 24;
  const padB = 28;
  const padR = 8;
  const y = linear(ticks[0], ticks[ticks.length - 1], height - padB, padT);
  const n = rows.length;
  const band = (W - axisW - padR) / Math.max(1, n);
  const bw = Math.min(20, band * 0.42);
  const cx = (i: number) => axisW + band * i + band / 2;
  // Line: today (left edge, position 0), then each week's end position at the week's centre.
  const pts = [`${axisW},${y(0)}`, ...rows.map((r, i) => `${cx(i)},${y(r.pos)}`)];
  const short = rows.map((r) => r.pos < 0);
  const shortCount = short.filter(Boolean).length;
  const firstShort = short.indexOf(true);
  const lowest = rows.reduce((m, r, i) => (r.pos < rows[m].pos ? i : m), 0);
  const last = n - 1;
  const labelEvery = band < 48 ? Math.ceil(48 / band) : 1;

  const idxAt = (px: number) => Math.max(0, Math.min(last, Math.floor((px - axisW) / band)));
  const tipAt = (i: number) => {
    const r = rows[i];
    show(cx(i), Math.min(y(r.pos), y(Math.max(r.in, 0))) + (figRef.current && svgRef.current ? svgRef.current.getBoundingClientRect().top - figRef.current.getBoundingClientRect().top : 0), (
      <>
        <div className="viz-tip__title">Week of {r.label}</div>
        <TipRow color={VIZ.neutralStrong} value={rand(r.in)} label="expected in" />
        <TipRow color={VIZ.warm} value={rand(r.out)} label="expected out" />
        <TipRow color={VIZ.accent} value={rand(r.pos)} label="running position" />
        {r.pos < 0 && <div className="viz-tip__note">Short: costs so far exceed receipts by {rand(-r.pos)}</div>}
      </>
    ));
  };
  const hoverIdx = tip ? idxAt(tip.x) : null;

  if (n === 0) return null;
  return (
    <div className="viz" ref={figRef}>
      <Legend items={[
        { label: 'Running position', color: VIZ.accent, shape: 'line' },
        { label: 'Expected in', color: VIZ.neutral, shape: 'rect' },
        { label: 'Expected out', color: VIZ.warm, shape: 'rect' },
        ...(shortCount > 0 ? [{ label: 'Short of cash', shape: 'wash' as const }] : []),
      ]} />
      <div ref={ref} onPointerLeave={hide}>
        <svg ref={svgRef} width={W} height={height} role="img" tabIndex={0}
          aria-label={`Expected cash by week for ${n} weeks. ${shortCount > 0 ? `The running position drops below zero in ${shortCount} of ${n} weeks, first in the week of ${rows[firstShort].label}.` : 'The running position stays at or above zero every week.'} It ends at ${rand(rows[last].pos)}.`}
          style={{ outline: 'none' }}
          onPointerMove={(e) => tipAt(idxAt(localPoint(svgRef.current!, e).x))}
          onFocus={() => tipAt(0)} onBlur={hide}
          onKeyDown={(e) => {
            const i = hoverIdx ?? 0;
            if (e.key === 'ArrowRight') { e.preventDefault(); tipAt(Math.min(last, i + 1)); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); tipAt(Math.max(0, i - 1)); }
            if (e.key === 'Escape') hide();
          }}>
          {/* Shortfall weeks: a warm wash the full plot height, named once. */}
          {rows.map((r, i) => r.pos < 0 && (
            <rect key={`s${i}`} x={axisW + band * i} y={padT} width={band} height={height - padT - padB} fill="var(--viz-wash-warm)" />
          ))}
          {firstShort >= 0 && <text x={axisW + band * firstShort + 4} y={padT - 8} className="viz-strong viz-halo">Short of cash</text>}
          {ticks.map((t) => (
            <g key={t}>
              {t !== 0 && <line x1={axisW} x2={W - padR} y1={y(t)} y2={y(t)} className="viz-gridline" />}
              <text x={axisW - 8} y={y(t)} dy="0.32em" textAnchor="end">{randCompact(t)}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const x = cx(i) - bw / 2;
            const rr = Math.min(4, bw / 2);
            const hIn = y(0) - y(r.in);
            const hOut = y(-r.out) - y(0);
            const dim = hoverIdx != null && hoverIdx !== i;
            return (
              <g key={r.label + i} opacity={dim ? 0.5 : 1}>
                {hIn >= 1 && <path d={`M${x},${y(0) - 1} V${y(r.in) + Math.min(rr, hIn / 2)} Q${x},${y(r.in)} ${x + rr},${y(r.in)} H${x + bw - rr} Q${x + bw},${y(r.in)} ${x + bw},${y(r.in) + Math.min(rr, hIn / 2)} V${y(0) - 1} Z`} fill={VIZ.neutral} />}
                {hOut >= 1 && <path d={`M${x},${y(0) + 1} V${y(-r.out) - Math.min(rr, hOut / 2)} Q${x},${y(-r.out)} ${x + rr},${y(-r.out)} H${x + bw - rr} Q${x + bw},${y(-r.out)} ${x + bw},${y(-r.out) - Math.min(rr, hOut / 2)} V${y(0) + 1} Z`} fill={VIZ.warm} />}
                {i % labelEvery === 0 && <text x={cx(i)} y={height - 8} textAnchor="middle">{r.label}</text>}
              </g>
            );
          })}
          <line x1={axisW} x2={W - padR} y1={y(0)} y2={y(0)} className="viz-zero" />
          <polyline points={pts.join(' ')} fill="none" stroke={VIZ.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={axisW} cy={y(0)} r={3} fill={VIZ.accent} />
          <text x={axisW + 2} y={y(0) - 10} className="viz-muted">Today</text>
          {hoverIdx != null && <line x1={cx(hoverIdx)} x2={cx(hoverIdx)} y1={padT} y2={height - padB} className="viz-cross" />}
          {rows.map((r, i) => (i === last || i === lowest && r.pos < 0 || hoverIdx === i) && (
            <circle key={`p${i}`} cx={cx(i)} cy={y(r.pos)} r={4} fill={VIZ.accent} stroke="var(--viz-surface)" strokeWidth={2} />
          ))}
          {/* Direct labels: where it ends, and the low point if it goes short. */}
          <text x={Math.min(cx(last), W - padR)} y={y(rows[last].pos) - 10} textAnchor="end" className="viz-strong viz-halo">{randCompact(rows[last].pos)}</text>
          {rows[lowest].pos < 0 && lowest !== last && (
            <text x={cx(lowest)} y={y(rows[lowest].pos) + 18} textAnchor="middle" className="viz-strong viz-halo">{randCompact(rows[lowest].pos)}</text>
          )}
        </svg>
      </div>
      <Tip tip={tip} width={W} />
      <TableTwin
        table={{
          caption: 'Expected cash by week, with the running position from today',
          columns: [{ label: 'Week of' }, { label: 'Expected in', numeric: true }, { label: 'Expected out', numeric: true }, { label: 'Net', numeric: true }, { label: 'Running position', numeric: true }],
          rows: rows.map((r, i) => ({ key: r.label + i, cells: [r.label, rand(r.in), rand(r.out), rand(r.net), rand(r.pos)] })),
        }}
      />
    </div>
  );
}
