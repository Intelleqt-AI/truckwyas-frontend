import { useRef, useState } from 'react';
import { TableTwin, Tip, TipRow, VIZ, plural, useTip, useWidth } from './core';

/**
 * "Is the fleet working?" One row per truck, one cell per day: a filled cell
 * means the truck had a load between pickup and delivery that day. Reading
 * across a row shows a truck's rhythm; reading down a column shows how many
 * trucks were out that day. Rows are sorted busiest first and each ends with
 * its count of working days, so the reader never has to count cells.
 */
export interface ActivityRow { id: string; label: string; days: number[]; href?: string }

export function ActivityStrip({ rows, dayLabels, maxRows = 12 }: { rows: ActivityRow[]; dayLabels: string[]; maxRows?: number }) {
  const [ref, W] = useWidth<HTMLDivElement>(600);
  const figRef = useRef<HTMLDivElement>(null);
  const { tip, show, hide } = useTip();
  const [active, setActive] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const n = dayLabels.length;
  const labelW = Math.min(112, Math.round(W * 0.28));
  const countW = 44;
  const gap = 2;
  const cell = Math.max(6, Math.min(18, Math.floor((W - labelW - countW - gap * n) / n)));
  const rowH = Math.max(cell + 6, 22);
  const headH = 20;
  const visible = showAll ? rows : rows.slice(0, maxRows);
  const H = headH + visible.length * rowH;
  const x = (d: number) => labelW + d * (cell + gap);
  const gridW = n * (cell + gap) - gap;

  const open = (r: ActivityRow, d: number, cx: number, cy: number) => {
    setActive(`${r.id}:${d}`);
    show(cx, cy, (
      <>
        <div className="viz-tip__title">{r.label} · {dayLabels[d]}</div>
        <TipRow color={r.days[d] > 0 ? VIZ.accent : undefined} keyShape={r.days[d] > 0 ? 'line' : 'none'} value={r.days[d] > 0 ? plural(r.days[d], 'load') : 'No load'} label="on the road" />
      </>
    ));
  };
  const close = () => { setActive(null); hide(); };
  const off = () => (figRef.current && ref.current ? ref.current.getBoundingClientRect().top - figRef.current.getBoundingClientRect().top : 0);

  return (
    <div className="viz" ref={figRef}>
      <div ref={ref} onPointerLeave={close}>
        <svg width={W} height={H} role="img" aria-label={`Days with a load for ${plural(rows.length, 'truck')} over the last ${n} days. Use the table for every value.`}>
          {[0, 7, 14, 21].filter((d) => d < n && x(d) + 48 < labelW + gridW - 40).map((d) => (
            <text key={d} x={x(d)} y={12}>{dayLabels[d]}</text>
          ))}
          <text x={labelW + gridW} y={12} textAnchor="end" className="viz-strong">Today</text>
          {visible.map((r, ri) => {
            const cy = headH + ri * rowH + (rowH - cell) / 2;
            const worked = r.days.filter((v) => v > 0).length;
            return (
              <g key={r.id}>
                <text x={0} y={cy + cell / 2} dy="0.32em" style={{ fill: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {r.label.length > 14 ? r.label.slice(0, 13) + '…' : r.label}
                </text>
                {r.days.map((v, d) => (
                  <rect key={d} x={x(d)} y={cy} width={cell} height={cell} rx={Math.min(3, cell / 4)}
                    fill={v > 0 ? VIZ.accent : 'var(--viz-track)'}
                    opacity={active && active !== `${r.id}:${d}` && active.startsWith(`${r.id}:`) ? 0.7 : 1}
                    stroke={active === `${r.id}:${d}` ? 'var(--text-primary)' : 'none'} strokeWidth={1.5}
                    onPointerEnter={() => open(r, d, x(d) + cell / 2, cy + off())} />
                ))}
                <text x={W} y={cy + cell / 2} dy="0.32em" textAnchor="end" className={worked > 0 ? 'viz-strong' : 'viz-muted'}>{worked}d</text>
              </g>
            );
          })}
        </svg>
      </div>
      <Tip tip={tip} width={W} />
      {rows.length > maxRows && (
        <button type="button" className="viz-table-toggle" onClick={() => setShowAll((s) => !s)}>
          {showAll ? `Show the busiest ${maxRows}` : `Show all ${rows.length} trucks`}
        </button>
      )}
      <TableTwin
        table={{
          caption: `Days with a load per truck, last ${n} days`,
          columns: [{ label: 'Truck' }, { label: 'Days with a load', numeric: true }],
          rows: rows.map((r) => ({ key: r.id, cells: [r.label, `${r.days.filter((v) => v > 0).length} of ${n}`] })),
        }}
      />
    </div>
  );
}
