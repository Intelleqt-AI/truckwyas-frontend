import { useRef, useState } from 'react';
import { Tip, TipRow, TableTwin, localPoint, niceTicks, randCompact, useTip, useWidth, VIZ } from '@/components/viz/core';
import { plural, randWhole, type MonthPoint } from './parts';

/**
 * Monthly revenue bars for one truck or driver. One series in the accent;
 * months with no loads show only the baseline (a real zero, not a gap).
 * Hover or arrow keys snap to a month; the table twin carries every value.
 */
export function MonthlyBars({ data: all, caption, height = 150 }: { data: MonthPoint[]; caption: string; height?: number }) {
  const [ref, W] = useWidth<HTMLDivElement>(640);
  // Trailing months with no loads are trimmed (R5); the note says since when.
  let last = all.length - 1;
  while (last > 0 && !all[last].loads) last -= 1;
  const data = all.slice(0, last + 1);
  const trimmed = all.length - data.length;
  const svgRef = useRef<SVGSVGElement>(null);
  const { tip, show, hide } = useTip();
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.revenue), 0);
  const ticks = niceTicks(0, max || 1, 3);
  const top = ticks[ticks.length - 1] || 1;
  const padL = 44;
  const padB = 22;
  const padT = 6;
  const H = height;
  const plotH = H - padB - padT;
  const n = data.length;
  const step = (W - padL) / n;
  const bw = Math.max(4, Math.min(28, step * 0.56));
  const y = (v: number) => padT + (1 - v / top) * plotH;
  const cx = (i: number) => padL + i * step + step / 2;

  const showAt = (i: number) => {
    setActive(i);
    const d = data[i];
    show(cx(i), y(d.revenue), (
      <>
        <div className="viz-tip__title">{d.label}</div>
        <TipRow keyShape="none" value={d.revenue ? randWhole(d.revenue) : 'R 0'} label={d.loads ? plural(d.loads, 'load') : 'No loads'} />
      </>
    ));
  };
  const clear = () => { setActive(null); hide(); };
  const nearest = (px: number) => Math.max(0, Math.min(n - 1, Math.floor((px - padL) / step)));

  return (
    <>
      <div className="viz fd-bars" ref={ref} onPointerLeave={clear}>
        <svg
          ref={svgRef}
          width={W}
          height={H}
          role="img"
          aria-label={`${caption}. ${data.filter((d) => d.revenue).map((d) => `${d.label} ${randWhole(d.revenue)}`).join(', ') || 'No revenue in this period'}.`}
          tabIndex={0}
          onFocus={() => showAt(n - 1)}
          onBlur={clear}
          onKeyDown={(e) => {
            const i = active ?? n - 1;
            if (e.key === 'ArrowLeft') { e.preventDefault(); showAt(Math.max(0, i - 1)); }
            if (e.key === 'ArrowRight') { e.preventDefault(); showAt(Math.min(n - 1, i + 1)); }
            if (e.key === 'Escape') clear();
          }}
          onPointerMove={(e) => showAt(nearest(localPoint(svgRef.current!, e).x))}
          style={{ outline: 'none' }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-baseline' : 'viz-gridline'} />
              <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end">{t === 0 ? '0' : randCompact(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            if (!d.revenue) return null;
            const yt = y(d.revenue);
            return (
              <rect
                key={d.key}
                x={cx(i) - bw / 2}
                y={yt}
                width={bw}
                height={Math.max(1, y(0) - yt)}
                rx={Math.min(3, bw / 2)}
                fill={active === i ? VIZ.accent : VIZ.neutralStrong}
              />
            );
          })}
          {active != null && <rect x={cx(active) - step / 2} y={padT} width={step} height={plotH} fill="var(--text-primary)" opacity={0.04} pointerEvents="none" />}
          {data.map((d, i) => (step < 30 && i % 2 === 1 && i !== n - 1) ? null : (
            <text key={d.key} x={cx(i)} y={H - 4} textAnchor="middle">{d.short}</text>
          ))}
        </svg>
        <Tip tip={tip} width={W} />
      </div>
      {trimmed > 0 && <p className="fd-bars__note">No delivered loads since {data[data.length - 1].label}</p>}
      <TableTwin
        table={{
          caption,
          columns: [{ label: 'Month' }, { label: 'Loads', numeric: true }, { label: 'Revenue', numeric: true }],
          rows: data.map((d) => ({ key: d.key, cells: [d.label, d.loads, d.revenue ? randWhole(d.revenue) : 'R 0'] })),
        }}
      />
    </>
  );
}
