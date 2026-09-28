import { useRef, useState } from 'react';
import { Legend, TableTwin, Tip, TipRow, VIZ, boxIn, linear, niceTicks, rand, randCompact, useTip, useWidth } from './core';

/**
 * "Did revenue cover costs?" per period, as a dumbbell: one dot for revenue,
 * one for costs, on a single rand axis. The connector IS the net result: its
 * length is the margin and its colour says which way it went (accent when
 * revenue covered costs, warm when it did not). Periods with no revenue and
 * no costs say so instead of drawing a zero.
 */
export interface CoverPoint { label: string; revenue: number; costs: number; isCurrent?: boolean }

export function CoverDumbbell({ periods, height = 220, periodNoun = 'month', revenueLabel = 'Revenue', costsLabel = 'Costs' }: {
  periods: CoverPoint[];
  height?: number;
  periodNoun?: string;
  revenueLabel?: string;
  costsLabel?: string;
}) {
  const [ref, W] = useWidth<HTMLDivElement>(640);
  const { tip, show, hide } = useTip();
  const [active, setActive] = useState<number | null>(null);
  const figRef = useRef<HTMLDivElement>(null);

  const max = Math.max(0, ...periods.flatMap((p) => [p.revenue, p.costs]));
  const ticks = niceTicks(0, (max || 1) * 1.08, 3);
  const top = ticks[ticks.length - 1];
  const axisW = Math.max(...ticks.map((t) => randCompact(t).length)) * 7 + 8;
  const padT = 22; // room for the direct label above the highest dot
  const padB = 28; // x-axis labels
  const plotH = height - padT - padB;
  const y = linear(0, top, padT + plotH, padT);
  const band = (W - axisW) / Math.max(1, periods.length);
  const cx = (i: number) => axisW + band * i + band / 2;

  const net = periods.map((p) => p.revenue - p.costs);
  const active6 = periods.filter((p) => p.revenue > 0 || p.costs > 0);
  const covered = periods.filter((p) => (p.revenue > 0 || p.costs > 0) && p.revenue >= p.costs).length;
  const totalNet = net.reduce((s, v) => s + v, 0);
  // Direct labels: the current period, plus the best and worst net if different.
  const withData = periods.map((p, i) => ({ i, has: p.revenue > 0 || p.costs > 0 })).filter((d) => d.has).map((d) => d.i);
  const best = withData.reduce<number | null>((b, i) => (b == null || net[i] > net[b] ? i : b), null);
  const worst = withData.reduce<number | null>((b, i) => (b == null || net[i] < net[b] ? i : b), null);
  const labelled = new Set<number>([periods.length - 1, best ?? -1, worst ?? -1].filter((i) => i >= 0 && withData.includes(i)));

  const tipFor = (i: number) => {
    const p = periods[i];
    const n = net[i];
    return (
      <>
        <div className="viz-tip__title">{p.label}</div>
        {p.revenue === 0 && p.costs === 0 ? (
          <div>No {revenueLabel.toLowerCase()} and no {costsLabel.toLowerCase()} recorded</div>
        ) : (
          <>
            <TipRow color={VIZ.accent} value={rand(p.revenue)} label={revenueLabel} />
            <TipRow color={VIZ.neutralStrong} value={rand(p.costs)} label={costsLabel} />
            <div className="viz-tip__note">{n >= 0 ? `Covered, ${rand(n)} left over` : `Short by ${rand(-n)}`}</div>
          </>
        )}
      </>
    );
  };
  const open = (i: number, el: Element) => {
    setActive(i);
    const b = boxIn(figRef.current!, el);
    show(b.x, b.y + padT + 8, tipFor(i));
  };
  const close = () => { setActive(null); hide(); };

  return (
    <div className="viz" ref={figRef}>
      <Legend items={[
        { label: revenueLabel, color: VIZ.accent, shape: 'dot' },
        { label: costsLabel, color: VIZ.neutralStrong, shape: 'dot' },
        { label: 'Covered', color: VIZ.accent, shape: 'line' },
        { label: 'Not covered', color: VIZ.warm, shape: 'line' },
      ]} />
      <div ref={ref} onPointerLeave={close}>
        <svg width={W} height={height} role="img" aria-label={`${revenueLabel} against ${costsLabel.toLowerCase()} per ${periodNoun}. Covered in ${covered} of ${active6.length} ${periodNoun}s with activity.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={axisW} x2={W} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-baseline' : 'viz-gridline'} />
              <text x={axisW - 8} y={y(t)} dy="0.32em" textAnchor="end">{randCompact(t)}</text>
            </g>
          ))}
          {periods.map((p, i) => {
            const has = p.revenue > 0 || p.costs > 0;
            const ok = p.revenue >= p.costs;
            const yr = y(p.revenue);
            const yc = y(p.costs);
            const x = cx(i);
            const dim = active != null && active !== i;
            return (
              <g key={p.label + i} opacity={dim ? 0.45 : 1}>
                {active === i && <rect x={x - band / 2 + 2} y={padT - 18} width={band - 4} height={plotH + 18} rx={6} fill="var(--viz-wash-accent)" />}
                {has ? (
                  <>
                    {Math.abs(yr - yc) > 0.5 && <line x1={x} x2={x} y1={yr} y2={yc} stroke={ok ? VIZ.accent : VIZ.warm} strokeWidth={4} strokeLinecap="round" />}
                    <circle cx={x} cy={yc} r={6} fill={VIZ.neutralStrong} stroke="var(--viz-surface)" strokeWidth={2} />
                    <circle cx={x} cy={yr} r={6} fill={VIZ.accent} stroke="var(--viz-surface)" strokeWidth={2} />
                    {labelled.has(i) && (
                      <text x={x} y={Math.min(yr, yc) - 10} textAnchor="middle" className="viz-strong viz-halo">
                        {net[i] >= 0 ? '+' : ''}{randCompact(net[i])}
                      </text>
                    )}
                  </>
                ) : (
                  <text x={x} y={y(0) - 8} textAnchor="middle" className="viz-muted">None</text>
                )}
                <text x={x} y={height - 8} textAnchor="middle" className={p.isCurrent ? 'viz-strong' : undefined}>{p.label}</text>
                <rect className="viz-hit" x={x - band / 2} y={0} width={band} height={height} tabIndex={0}
                  aria-label={`${p.label}: ${has ? `${revenueLabel} ${rand(p.revenue)}, ${costsLabel.toLowerCase()} ${rand(p.costs)}, net ${rand(net[i])}` : 'nothing recorded'}`}
                  onPointerEnter={(e) => open(i, e.currentTarget)} onFocus={(e) => open(i, e.currentTarget)} onBlur={close} />
              </g>
            );
          })}
        </svg>
      </div>
      <Tip tip={tip} width={W} />
      <TableTwin
        note={active6.length === 0 ? `Nothing recorded in these ${periodNoun}s.` : <>Covered in <strong style={{ color: 'var(--text-primary)' }}>{covered} of {active6.length}</strong> {periodNoun}s with activity. Net over all {periods.length}: <strong style={{ color: 'var(--text-primary)' }}>{rand(totalNet)}</strong>.</>}
        table={{
          caption: `${revenueLabel}, ${costsLabel.toLowerCase()} and net per ${periodNoun}`,
          columns: [{ label: periodNoun[0].toUpperCase() + periodNoun.slice(1) }, { label: revenueLabel, numeric: true }, { label: costsLabel, numeric: true }, { label: 'Net', numeric: true }],
          rows: periods.map((p, i) => ({ key: p.label + i, cells: [p.label, rand(p.revenue), rand(p.costs), rand(net[i])] })),
        }}
      />
    </div>
  );
}
