import { useRef, useState, type ReactNode } from 'react';
import {
  HatchDef, Legend, TableTwin, Tip, TipRow, VIZ, boxIn, hLine, linear, niceTicks, placeLabel, rand, randCompact, textBox, textW, useSvgId, useTip, useWidth,
  type Box, type LegendItem,
} from './core';

/**
 * Waterfall / bridge. Each step floats from where the previous one ended, so
 * the reader sees how a starting amount becomes the result. Colour follows the
 * product grammar (viz.css): money in and a positive result wear the accent,
 * cost steps are the hatched neutral, and only a loss (a negative result or a
 * month that lost money) is red. Totals are anchored at zero. Hairline
 * connectors carry the running level from step to step. Used for the period
 * margin bridge (revenue, minus costs, = net) and for the month-by-month net
 * that builds up to a multi-month result.
 *
 * The plot always fills its container. Value labels are placed by a collision
 * pass: outside the bar end first, then the other end, then inside a tall bar,
 * and dropped to the tooltip and table when none of those is clear of the zero
 * line, the connectors and the other labels by 4px.
 */
/** Drawn over a step with no activity (never "None"). */
const EMPTY_MARK = 'R 0';

export interface WaterfallStep {
  label: string;
  /** For 'delta' the signed change; for 'total' the level itself. */
  value: number;
  kind: 'delta' | 'total';
  /** Extra line in the tooltip and table, e.g. revenue and costs behind a month's net. */
  detail?: ReactNode;
  /** Text shown instead of a bar when a delta step had no activity. */
  emptyText?: string;
  /** 'cost': a decrease that is a cost, drawn as the hatched neutral rather than a loss. */
  tone?: 'cost';
}

export function Waterfall({ steps, height = 240, ariaLabel, labelAll = false, values, caption, valueHeader = 'Change', note }: {
  steps: WaterfallStep[];
  height?: number;
  ariaLabel: string;
  /** Label every step (short bridges). Otherwise totals and extremes only. */
  labelAll?: boolean;
  /**
   * Which bars carry a value label. 'none' when the same figures already sit
   * in a KPI row above the chart: the axis, tooltip and table carry them.
   * Defaults to 'all' with labelAll, otherwise 'auto' (totals and extremes).
   */
  values?: 'all' | 'auto' | 'none';
  caption: string;
  valueHeader?: string;
  /** One line beside the table toggle, e.g. which empty months were left out. */
  note?: ReactNode;
}) {
  const [ref, W] = useWidth<HTMLDivElement>(640);
  const figRef = useRef<HTMLDivElement>(null);
  const { tip, show, hide } = useTip();
  const [active, setActive] = useState<number | null>(null);
  const mode = values ?? (labelAll ? 'all' : 'auto');

  // Running levels.
  let level = 0;
  const geo = steps.map((s) => {
    if (s.kind === 'total') { level = s.value; return { from: 0, to: s.value }; }
    const from = level; level += s.value; return { from, to: level };
  });
  const lo = Math.min(0, ...geo.flatMap((g) => [g.from, g.to]));
  const hi = Math.max(0, ...geo.flatMap((g) => [g.from, g.to]));
  const ticks = niceTicks(lo < 0 ? lo * 1.08 : lo, (hi || 1) * 1.08, 4);
  const axisW = Math.max(...ticks.map((t) => textW(randCompact(t)))) + 10;
  const padT = mode === 'none' ? 10 : 22;
  const band = (W - axisW) / Math.max(1, steps.length);
  // Narrow screens: step labels drop to 11px and two-word labels break onto two lines rather than collide.
  const catPx = band < 72 ? 11 : 12;
  const wrap = steps.some((s) => textW(s.label, catPx) > band - 6);
  const lines = (label: string) => {
    if (!wrap || !label.includes(' ')) return [label];
    // "Dec 2025": month over year; the year shortens to "’25" when even that is wider than the band.
    const my = label.match(/^(\S+) (\d{4})$/);
    if (my) return [my[1], textW(my[2], catPx) > band - 6 ? `’${my[2].slice(2)}` : my[2]];
    const mid = label.length / 2;
    const cut = [...label.matchAll(/ /g)].map((m) => m.index!).sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid))[0];
    return [label.slice(0, cut), label.slice(cut + 1)];
  };
  const padB = wrap ? 42 : 28;
  const y = linear(ticks[0], ticks[ticks.length - 1], height - padB, padT);
  // Bars grow with the band so a short bridge still reads as one chart across the card.
  const bw = Math.max(12, Math.min(64, band * 0.42));
  const cx = (i: number) => axisW + band * i + band / 2;
  const zeroY = y(0);

  // Step (x-axis) labels never collide: on a narrow chart a label is drawn only
  // when it clears the ones already kept by 6px. Totals, the first and the last
  // step always keep theirs; the rest are kept in order, so a crowded month axis
  // reads every other month. A dropped label is still in the tooltip and table.
  const cats = steps.map((s, i) => {
    const ls = lines(s.label);
    const w = Math.max(...ls.map((t) => textW(t, catPx)));
    const x = Math.max(w / 2 + 1, Math.min(W - w / 2 - 1, cx(i)));
    return { lines: ls, x, x0: x - w / 2, x1: x + w / 2 };
  });
  const catKeep = new Set<number>();
  const catPri = steps.map((s, i) => ({ i, p: s.kind === 'total' || i === 0 || i === steps.length - 1 ? 0 : 1 }))
    .sort((a, b) => a.p - b.p || a.i - b.i);
  catPri.forEach(({ i }) => {
    const c = cats[i];
    if ([...catKeep].every((k) => c.x1 + 6 <= cats[k].x0 || c.x0 >= cats[k].x1 + 6)) catKeep.add(i);
  });

  const deltas = steps.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'delta' && s.value !== 0);
  const maxUp = deltas.reduce<number | null>((b, d) => (d.s.value > 0 && (b == null || d.s.value > steps[b].value) ? d.i : b), null);
  const maxDown = deltas.reduce<number | null>((b, d) => (d.s.value < 0 && (b == null || d.s.value < steps[b].value) ? d.i : b), null);
  const wantsLabel = (i: number) => mode === 'all' || (mode === 'auto' && (steps[i].kind === 'total' || i === maxUp || i === maxDown));

  const hatchId = useSvgId('wf-hatch');
  type Role = 'in' | 'cost' | 'loss';
  const roleOf = (s: WaterfallStep, g: { from: number; to: number }): Role =>
    s.kind === 'total' ? (g.to < 0 ? 'loss' : 'in') : s.tone === 'cost' ? 'cost' : s.value >= 0 ? 'in' : 'loss';
  const ROLE_COLOR: Record<Role, string> = { in: VIZ.accent, cost: VIZ.hatch, loss: VIZ.loss };
  const colorOf = (s: WaterfallStep, g: { from: number; to: number }) => ROLE_COLOR[roleOf(s, g)];
  const roles = new Set(steps.map((s, i) => (s.kind === 'delta' && s.value === 0 ? null : roleOf(s, geo[i]))));
  // A key only when costs are hatched: the hatch is the one mark a reader cannot guess.
  const legend: LegendItem[] = roles.has('cost') ? [
    ...(roles.has('in') ? [{ label: 'Money in and profit', color: VIZ.accent, shape: 'rect' as const }] : []),
    { label: 'Costs', shape: 'hatch' as const },
    ...(roles.has('loss') ? [{ label: 'Loss', color: VIZ.loss, shape: 'rect' as const }] : []),
  ] : [];

  // ---- geometry per step
  const bars = steps.map((s, i) => {
    const g = geo[i];
    const y0 = y(g.from);
    const y1 = y(g.to);
    return { i, x: cx(i), y0, y1, top: Math.min(y0, y1), bottom: Math.max(y0, y1), h: Math.abs(y1 - y0), empty: s.kind === 'delta' && s.value === 0 };
  });

  // ---- label collision pass
  const obstacles: Box[] = [hLine(axisW, W, zeroY)];
  // The "R 0" marks of empty steps are text too.
  steps.forEach((s, i) => { if (s.kind === 'delta' && s.value === 0) obstacles.push(textBox(EMPTY_MARK, cx(i), y(geo[i].from) - 8)); });
  bars.forEach((b, i) => {
    if (i < steps.length - 1) obstacles.push(hLine(b.x + bw / 2, cx(i + 1) - bw / 2, b.y1));
  });
  const barBox = (b: typeof bars[number]): Box => ({ x0: b.x - bw / 2, x1: b.x + bw / 2, y0: b.top, y1: b.bottom });
  const bounds: Box = { x0: 0, x1: W, y0: 0, y1: height - padB + 2 };
  type Placed = Record<number, { x: number; y: number; inside: boolean; text: string }>;
  // Labels are placed in story order, so when a narrow chart cannot fit them all the
  // ones that matter win: totals, then the best and worst step, then the rest by size.
  const rank = (i: number) => (steps[i].kind === 'total' ? 0 : i === maxUp || i === maxDown ? 1 : 2);
  const placeAll = (order: typeof bars) => {
    const placed: Placed = {};
    order.forEach((b) => {
      const i = b.i;
      const s = steps[i];
      if (!wantsLabel(i) || b.empty) return;
      const text = `${s.kind === 'delta' && s.value > 0 ? '+' : ''}${randCompact(s.value)}`;
      const tw = textW(text);
      const lx = Math.max(tw / 2 + 1, Math.min(W - tw / 2 - 1, b.x));
      const down = s.kind === 'delta' ? s.value < 0 : geo[i].to < 0;
      // A label wider than its bar would sit on the connector at the bar's end: the second
      // candidate on each side steps 4px further out to clear it. Story labels (totals, best,
      // worst) may also take a row one line further out to clear a neighbour's label.
      const far = rank(i) <= 1;
      type Cand = { x: number; y: number; inside: boolean; near: boolean };
      const above: Cand[] = [{ x: lx, y: b.top - 7, inside: false, near: true }, { x: lx, y: b.top - 11, inside: false, near: true }, ...(far ? [{ x: lx, y: b.top - 29, inside: false, near: false }] : [])];
      const below: Cand[] = [{ x: lx, y: b.bottom + 15, inside: false, near: true }, { x: lx, y: b.bottom + 19, inside: false, near: true }, ...(far ? [{ x: lx, y: b.bottom + 37, inside: false, near: false }] : [])];
      // A label wider than its bar may also sit flush with either bar edge, which on a
      // narrow band keeps it off the neighbouring bar and its label.
      const shift = Math.max(0, tw / 2 - bw / 2);
      const all = down ? [...below, ...above] : [...above, ...below];
      const close = all.filter((c) => c.near);
      const farRow = all.filter((c) => !c.near);
      const nudged = shift > 0 ? close.flatMap((c) => [
        { ...c, x: Math.max(tw / 2 + 1, c.x - shift) }, { ...c, x: Math.min(W - tw / 2 - 1, c.x + shift) },
      ]) : [];
      // Wider than its column: flush with a bar edge first, leaving the neighbour's side free.
      const ordered = tw > band - 4 ? [...nudged, ...close, ...farRow] : [...close, ...nudged, ...farRow];
      const cands = ordered.map((c) => ({ ...c, box: textBox(text, c.x, c.y) }));
      if (b.h >= 22 && bw >= tw + 6 && roleOf(s, geo[i]) !== 'cost') {
        const inY = down ? b.bottom - 7 : b.top + 16;
        cands.push({ x: lx, y: inY, inside: true, near: true, box: textBox(text, lx, inY) });
      }
      const others = [
        ...obstacles,
        ...bars.filter((o) => o.i !== i && o.h >= 1).map(barBox),
        ...Object.values(placed).map((p) => textBox(p.text, p.x, p.y)),
      ];
      // Outside candidates sit beyond the bar's own ends; the inside one sits on it by design.
      const pick = placeLabel(cands, others, bounds, 4);
      if (pick) placed[i] = { x: pick.x, y: pick.y, inside: pick.inside, text };
    });
    return placed;
  };
  const baseOrder = [...bars].sort((a, b) => rank(a.i) - rank(b.i) || Math.abs(steps[b.i].value) - Math.abs(steps[a.i].value));
  const story = (p: Placed) => baseOrder.filter((b) => rank(b.i) <= 1 && p[b.i]).length;
  let placed = placeAll(baseOrder);
  // A story label that lost out: try again with it placed first and keep whichever pass labels more of the story.
  const missed = baseOrder.filter((b) => rank(b.i) <= 1 && wantsLabel(b.i) && !b.empty && !placed[b.i]);
  if (missed.length > 0) {
    const retry = placeAll([...missed, ...baseOrder.filter((b) => !missed.includes(b))]);
    if (story(retry) > story(placed) || (story(retry) === story(placed) && Object.keys(retry).length > Object.keys(placed).length)) placed = retry;
  }

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
      <Legend items={legend} />
      <div ref={ref} onPointerLeave={close}>
        <svg width={W} height={height} role="img" aria-label={ariaLabel}>
          <HatchDef id={hatchId} />
          {/* Hover: a column band behind the step; the other bars keep their full value. */}
          {active != null && <rect className="viz-hover-band" x={axisW + band * active} y={0} width={band} height={height - padB + 4} rx={6} />}
          {ticks.map((t) => (
            <g key={t}>
              {t !== 0 && <line x1={axisW} x2={W} y1={y(t)} y2={y(t)} className="viz-gridline" />}
              <text x={axisW - 8} y={y(t)} dy="0.32em" textAnchor="end">{randCompact(t)}</text>
            </g>
          ))}
          {bars.map((b, i) => {
            const s = steps[i];
            const { x, y0, y1, h } = b;
            const up = geo[i].to >= geo[i].from;
            const r = Math.min(4, h / 2);
            // 4px rounded data end, square where the step starts.
            const d = h < 1 ? '' : up
              ? `M${x - bw / 2},${y0} V${y1 + r} Q${x - bw / 2},${y1} ${x - bw / 2 + r},${y1} H${x + bw / 2 - r} Q${x + bw / 2},${y1} ${x + bw / 2},${y1 + r} V${y0} Z`
              : `M${x - bw / 2},${y0} V${y1 - r} Q${x - bw / 2},${y1} ${x - bw / 2 + r},${y1} H${x + bw / 2 - r} Q${x + bw / 2},${y1} ${x + bw / 2},${y1 - r} V${y0} Z`;
            const next = i < steps.length - 1 ? cx(i + 1) : null;
            const lab = placed[i];
            const catLines = cats[i].lines;
            const catX = cats[i].x;
            return (
              <g key={s.label + i}>
                {next != null && <line x1={x + bw / 2} x2={next - bw / 2} y1={y1} y2={y1} className="viz-connector" />}
                {b.empty ? (
                  <line x1={x - bw / 2} x2={x + bw / 2} y1={y0} y2={y0} stroke="var(--viz-neutral-strong)" strokeWidth={2} />
                ) : h < 1 ? (
                  <line x1={x - bw / 2} x2={x + bw / 2} y1={y0} y2={y0} stroke={colorOf(s, geo[i])} strokeWidth={2} />
                ) : roleOf(s, geo[i]) === 'cost' ? (
                  <path d={d} fill={`url(#${hatchId})`} stroke={VIZ.hatch} strokeWidth={1} />
                ) : (
                  <path d={d} fill={colorOf(s, geo[i])} />
                )}
                {lab && (
                  <text x={lab.x} y={lab.y} textAnchor="middle" className={lab.inside ? 'viz-on-mark' : 'viz-strong viz-halo'}>{lab.text}</text>
                )}
                {b.empty && <text x={x} y={y0 - 8} textAnchor="middle" className="viz-muted">{EMPTY_MARK}</text>}
                {catKeep.has(i) && (
                  <text x={catX} y={height - (catLines.length > 1 ? 22 : 8)} textAnchor="middle" className={s.kind === 'total' ? 'viz-strong' : undefined} style={catPx !== 12 ? { fontSize: catPx } : undefined}>
                    {catLines.map((t, k) => <tspan key={k} x={catX} dy={k === 0 ? 0 : 14}>{t}</tspan>)}
                  </text>
                )}
                {/* Pointer only: the SVG is one labelled image and "Show as table" is the keyboard route to every value. */}
                <rect className="viz-hit" x={x - band / 2} y={0} width={band} height={height} aria-hidden="true"
                  onPointerEnter={(e) => open(i, e.currentTarget)} />
              </g>
            );
          })}
          {/* Zero line last so it sits over bar bases. */}
          <line x1={axisW} x2={W} y1={zeroY} y2={zeroY} className="viz-zero" />
        </svg>
      </div>
      <Tip tip={tip} width={W} />
      <TableTwin
        note={note}
        table={{
          caption,
          columns: [{ label: 'Step' }, { label: valueHeader, numeric: true }, { label: 'Running total', numeric: true }],
          rows: steps.map((s, i) => ({ key: s.label + i, cells: [s.label, s.kind === 'delta' && s.value > 0 ? `+${rand(s.value)}` : rand(s.value), rand(geo[i].to)] })),
        }}
      />
    </div>
  );
}
