import { useRef, useState, type ReactNode } from 'react';
import { TableTwin, Tip, TipRow, VIZ, boxIn, linear, niceTicks, rand, randCompact, useTip, useWidth } from './core';

/**
 * Waterfall / bridge. Each step floats from where the previous one ended, so
 * the reader sees how a starting amount becomes the result. Increases wear the
 * accent, decreases the warm pole, totals are anchored at zero. Hairline
 * connectors carry the running level from step to step. Used for the period
 * margin bridge (revenue, minus costs, = net) and for the month-by-month net
 * that builds up to a multi-month result.
 */
export interface WaterfallStep {
  label: string;
  /** For 'delta' the signed change; for 'total' the level itself. */
  value: number;
  kind: 'delta' | 'total';
  /** Extra line in the tooltip and table, e.g. revenue and costs behind a month's net. */
  detail?: ReactNode;
  /** Text shown instead of a bar when a delta step had no activity. */
  emptyText?: string;
}

export function Waterfall({ steps, height = 240, ariaLabel, labelAll = false, caption, valueHeader = 'Change', maxWidth }: {
  steps: WaterfallStep[];
  height?: number;
  ariaLabel: string;
  /** Label every step (short bridges). Otherwise totals and extremes only. */
  labelAll?: boolean;
  caption: string;
  valueHeader?: string;
  /** Cap the plot width so a short bridge does not stretch into thin, distant bars. */
  maxWidth?: number;
}) {
  const [ref, W] = useWidth<HTMLDivElement>(640);
  const figRef = useRef<HTMLDivElement>(null);
  const { tip, show, hide } = useTip();
  const [active, setActive] = useState<number | null>(null);

  // Running levels.
  let level = 0;
  const geo = steps.map((s) => {
    if (s.kind === 'total') { level = s.value; return { from: 0, to: s.value }; }
    const from = level; level += s.value; return { from, to: level };
  });
  const lo = Math.min(0, ...geo.flatMap((g) => [g.from, g.to]));
  const hi = Math.max(0, ...geo.flatMap((g) => [g.from, g.to]));
  const ticks = niceTicks(lo < 0 ? lo * 1.08 : lo, (hi || 1) * 1.08, 4);
  const axisW = Math.max(...ticks.map((t) => randCompact(t).length)) * 7 + 8;
  const padT = 22;
  const bandW = (W - axisW) / Math.max(1, steps.length);
  // Narrow screens: break two-word labels onto two lines rather than let them collide.
  const wrap = steps.some((s) => s.label.length * 6.8 > bandW - 6);
  const lines = (label: string) => {
    if (!wrap || !label.includes(' ')) return [label];
    const mid = label.length / 2;
    const cut = [...label.matchAll(/ /g)].map((m) => m.index!).sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid))[0];
    return [label.slice(0, cut), label.slice(cut + 1)];
  };
  const padB = wrap ? 42 : 28;
  const y = linear(ticks[0], ticks[ticks.length - 1], height - padB, padT);
  const band = bandW;
  const bw = Math.min(24, band * 0.5);
  const cx = (i: number) => axisW + band * i + band / 2;

  const deltas = steps.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'delta' && s.value !== 0);
  const maxUp = deltas.reduce<number | null>((b, d) => (d.s.value > 0 && (b == null || d.s.value > steps[b].value) ? d.i : b), null);
  const maxDown = deltas.reduce<number | null>((b, d) => (d.s.value < 0 && (b == null || d.s.value < steps[b].value) ? d.i : b), null);
  const isLabelled = (i: number) => labelAll || steps[i].kind === 'total' || i === maxUp || i === maxDown;

  const colorOf = (s: WaterfallStep, g: { from: number; to: number }) =>
    s.kind === 'total' ? (g.to < 0 ? VIZ.warm : VIZ.accent) : s.value >= 0 ? VIZ.accent : VIZ.warm;

  const open = (i: number, el: Element) => {
    const s = steps[i];
    const g = geo[i];
    setActive(i);
    const b = boxIn(figRef.current!, el);
    show(b.x, b.y + Math.min(y(g.from), y(g.to)), (
      <>
        <div className="viz-tip__title">{s.label}</div>
        {s.kind === 'delta' && s.value === 0 && s.emptyText ? <div>{s.emptyText}</div> : (
          <TipRow color={colorOf(s, g)} value={s.kind === 'delta' && s.value > 0 ? `+${rand(s.value)}` : rand(s.value)} label={s.kind === 'total' ? 'result' : 'change'} />
        )}
        {s.detail && <div className="viz-tip__note">{s.detail}</div>}
        {s.kind === 'delta' && <div className="viz-tip__note">Running total {rand(g.to)}</div>}
      </>
    ));
  };
  const close = () => { setActive(null); hide(); };

  return (
    <div className="viz" ref={figRef}>
      <div ref={ref} onPointerLeave={close} style={maxWidth ? { maxWidth } : undefined}>
        <svg width={W} height={height} role="img" aria-label={ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={axisW} x2={W} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-zero' : 'viz-gridline'} />
              <text x={axisW - 8} y={y(t)} dy="0.32em" textAnchor="end">{randCompact(t)}</text>
            </g>
          ))}
          {steps.map((s, i) => {
            const g = geo[i];
            const x = cx(i);
            const y0 = y(g.from);
            const y1 = y(g.to);
            const topY = Math.min(y0, y1);
            const h = Math.abs(y1 - y0);
            const up = g.to >= g.from;
            const r = Math.min(4, h / 2);
            // 4px rounded data end, square where the step starts.
            const d = h < 1 ? '' : up
              ? `M${x - bw / 2},${y0} V${y1 + r} Q${x - bw / 2},${y1} ${x - bw / 2 + r},${y1} H${x + bw / 2 - r} Q${x + bw / 2},${y1} ${x + bw / 2},${y1 + r} V${y0} Z`
              : `M${x - bw / 2},${y0} V${y1 - r} Q${x - bw / 2},${y1} ${x - bw / 2 + r},${y1} H${x + bw / 2 - r} Q${x + bw / 2},${y1} ${x + bw / 2},${y1 - r} V${y0} Z`;
            const next = i < steps.length - 1 ? cx(i + 1) : null;
            const empty = s.kind === 'delta' && s.value === 0;
            const dim = active != null && active !== i;
            const labelY = s.value < 0 || g.to < 0 ? Math.max(y0, y1) + 16 : topY - 8;
            return (
              <g key={s.label + i}>
                {next != null && <line x1={x + bw / 2} x2={next - bw / 2} y1={y1} y2={y1} stroke="var(--viz-axis)" strokeWidth={1} shapeRendering="crispEdges" />}
                <g opacity={dim ? 0.45 : 1}>
                  {empty ? (
                    <line x1={x - bw / 2} x2={x + bw / 2} y1={y0} y2={y0} stroke="var(--viz-neutral-strong)" strokeWidth={2} />
                  ) : h < 1 ? (
                    <line x1={x - bw / 2} x2={x + bw / 2} y1={y0} y2={y0} stroke={colorOf(s, g)} strokeWidth={2} />
                  ) : (
                    <path d={d} fill={colorOf(s, g)} />
                  )}
                  {isLabelled(i) && !empty && (
                    <text x={x} y={labelY} textAnchor="middle" className="viz-strong viz-halo">
                      {s.kind === 'delta' && s.value > 0 ? '+' : ''}{randCompact(s.value)}
                    </text>
                  )}
                  {empty && <text x={x} y={y0 - 8} textAnchor="middle" className="viz-muted">None</text>}
                </g>
                <text x={x} y={height - (lines(s.label).length > 1 ? 22 : 8)} textAnchor="middle" className={s.kind === 'total' ? 'viz-strong' : undefined}>
                  {lines(s.label).map((t, k) => <tspan key={k} x={x} dy={k === 0 ? 0 : 14}>{t}</tspan>)}
                </text>
                <rect className="viz-hit" x={x - band / 2} y={0} width={band} height={height} tabIndex={0}
                  aria-label={`${s.label}: ${empty && s.emptyText ? s.emptyText : rand(s.value)}`}
                  onPointerEnter={(e) => open(i, e.currentTarget)} onFocus={(e) => open(i, e.currentTarget)} onBlur={close} />
              </g>
            );
          })}
        </svg>
      </div>
      <Tip tip={tip} width={W} />
      <TableTwin
        table={{
          caption,
          columns: [{ label: 'Step' }, { label: valueHeader, numeric: true }, { label: 'Running total', numeric: true }],
          rows: steps.map((s, i) => ({ key: s.label + i, cells: [s.label, s.kind === 'delta' && s.value > 0 ? `+${rand(s.value)}` : rand(s.value), rand(geo[i].to)] })),
        }}
      />
    </div>
  );
}
