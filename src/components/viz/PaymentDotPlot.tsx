import { useRef, useState } from 'react';
import { Legend, TableTwin, Tip, TipRow, VIZ, linear, niceTicks, plural, rand, useTip, useWidth } from './core';

/**
 * "Which customers pay late?" One row per customer, one mark per invoice, on
 * a shared axis of days since the invoice was issued. The customer's payment
 * terms are a tick on the row with a light band from issue to terms: marks
 * inside the band were on time. Paid invoices are filled dots at the day they
 * were paid. Unpaid invoices are hollow rings at today's age with a trail back
 * to their terms, because the wait is still growing.
 */
/** terms: this invoice's own terms in days, when it differs from the row's usual terms. */
export interface PayMark { id: string; ref: string; days: number; open: boolean; amount: number; terms?: number | null }
export interface PayRow { id: string; label: string; terms: number | null; marks: PayMark[] }

export function PaymentDotPlot({ rows, maxRows = 10 }: { rows: PayRow[]; maxRows?: number }) {
  const [ref, W] = useWidth<HTMLDivElement>(720);
  const figRef = useRef<HTMLDivElement>(null);
  const { tip, show, hide } = useTip();
  const [activeMark, setActiveMark] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const stacked = W < 520; // phone: label above each track
  const labelW = stacked ? 0 : Math.min(180, Math.round(W * 0.26));
  const padR = 16;
  const rowH = stacked ? 48 : 36;
  const trackY = stacked ? 32 : rowH / 2;
  const axisH = 28;
  const maxDays = Math.max(30, ...rows.flatMap((r) => [r.terms ?? 0, ...r.marks.map((m) => m.days)]));
  const ticks = niceTicks(0, maxDays, stacked ? 3 : 6);
  const x = linear(0, ticks[ticks.length - 1], labelW + 6, W - padR);
  const visible = showAll ? rows : rows.slice(0, maxRows);
  const H = axisH + visible.length * rowH + 4;

  const open = (r: PayRow, m: PayMark, cx: number, cy: number) => {
    setActiveMark(m.id);
    const terms = m.terms ?? r.terms;
    const late = terms != null ? m.days - terms : null;
    show(cx, cy - 6, (
      <>
        <div className="viz-tip__title">{m.ref} · {r.label}</div>
        <TipRow color={m.open ? undefined : VIZ.accent} keyShape={m.open ? 'ring' : 'line'} value={plural(m.days, 'day')} label={m.open ? 'unpaid so far' : 'to pay'} />
        <div className="viz-tip__note">
          {terms == null ? 'No payment terms recorded' : late! > 0 ? `${plural(late!, 'day')} past its ${terms}-day terms` : `Within its ${terms}-day terms`}
          {' · '}{rand(m.amount)}
        </div>
      </>
    ));
  };
  const close = () => { setActiveMark(null); hide(); };

  return (
    <div className="viz" ref={figRef}>
      <Legend items={[
        { label: 'Paid (days to pay)', color: VIZ.accent, shape: 'dot' },
        { label: 'Unpaid (days so far)', color: VIZ.neutralStrong, shape: 'ring' },
        { label: 'Payment terms', color: 'var(--text-secondary)', shape: 'line' },
      ]} />
      <div ref={ref} onPointerLeave={close}>
        <svg width={W} height={H} role="img" aria-label={`Days to pay per invoice for ${plural(rows.length, 'customer')}, against each customer's payment terms. Use the table for every value.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={axisH - 6} y2={H} className="viz-gridline" />
              <text x={t === 0 ? x(t) - 4 : x(t)} y={12} textAnchor={t === 0 ? 'start' : t === ticks[ticks.length - 1] ? 'end' : 'middle'}>{t === 0 ? 'Issued' : `${t}d`}</text>
            </g>
          ))}
          {visible.map((r, ri) => {
            const top = axisH + ri * rowH;
            const cy = top + trackY;
            const worst = Math.max(...r.marks.map((m) => m.days));
            return (
              <g key={r.id}>
                {ri > 0 && <line x1={0} x2={W} y1={top} y2={top} stroke="var(--border-row)" shapeRendering="crispEdges" />}
                {stacked ? (
                  <text x={0} y={top + 16} className="viz-strong" style={{ fontWeight: 500 }}>{r.label.length > 38 ? r.label.slice(0, 37) + '…' : r.label}</text>
                ) : (
                  <text x={0} y={cy} dy="0.32em" style={{ fill: 'var(--text-primary)', fontSize: 13 }}>{r.label.length > 24 ? r.label.slice(0, 23) + '…' : r.label}</text>
                )}
                {r.terms != null && (
                  <>
                    {/* Context band (issue to terms); the terms tick carries the value at 3:1+. */}
                    <rect className="viz-context-band" x={x(0)} y={cy - 7} width={Math.max(0, x(r.terms) - x(0))} height={14} rx={3} fill="var(--viz-track)" />
                    <line x1={x(r.terms)} x2={x(r.terms)} y1={cy - 9} y2={cy + 9} stroke="var(--text-secondary)" strokeWidth={2} />
                  </>
                )}
                {/* Unpaid trail: from terms (or issue) to today's age. */}
                {r.marks.filter((m) => m.open).map((m) => (
                  <line key={`t${m.id}`} x1={x(Math.min(m.days, r.terms ?? 0))} x2={x(m.days) - 5} y1={cy} y2={cy} stroke="var(--viz-neutral)" strokeWidth={2} />
                ))}
                {r.marks.map((m) => {
                  const mx = x(m.days);
                  return (
                    <g key={m.id}>
                      {activeMark === m.id && <circle cx={mx} cy={cy} r={9} fill="none" stroke="var(--text-primary)" strokeWidth={1.5} />}
                      {m.open
                        ? <circle cx={mx} cy={cy} r={5} fill="var(--viz-surface)" stroke={VIZ.neutralStrong} strokeWidth={2} />
                        : <circle cx={mx} cy={cy} r={5} fill={VIZ.accent} stroke="var(--viz-surface)" strokeWidth={2} />}
                      <circle className="viz-hit" cx={mx} cy={cy} r={12} tabIndex={0}
                        aria-label={`${r.label}, ${m.ref}: ${m.open ? `unpaid for ${plural(m.days, 'day')}` : `paid after ${plural(m.days, 'day')}`}${r.terms != null ? `, terms ${r.terms} days` : ''}`}
                        onPointerEnter={() => open(r, m, mx, cy + (figRef.current && ref.current ? ref.current.getBoundingClientRect().top - figRef.current.getBoundingClientRect().top : 0))}
                        onFocus={() => open(r, m, mx, cy + (figRef.current && ref.current ? ref.current.getBoundingClientRect().top - figRef.current.getBoundingClientRect().top : 0))}
                        onBlur={close} />
                    </g>
                  );
                })}
                {!stacked && r.terms != null && worst > r.terms && (
                  <text x={Math.min(x(worst) + 10, W - padR)} y={cy} dy="0.32em" textAnchor={x(worst) + 60 > W ? 'end' : 'start'} className="viz-muted" style={{ display: x(worst) + 60 > W ? 'none' : undefined }}>
                    +{worst - r.terms}d
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <Tip tip={tip} width={W} />
      {rows.length > maxRows && (
        <button type="button" className="viz-table-toggle" onClick={() => setShowAll((s) => !s)}>
          {showAll ? `Show the first ${maxRows}` : `Show all ${rows.length} customers`}
        </button>
      )}
      <TableTwin
        table={{
          caption: 'Days to pay per invoice, against payment terms',
          columns: [{ label: 'Customer' }, { label: 'Invoice' }, { label: 'Status' }, { label: 'Days', numeric: true }, { label: 'Terms', numeric: true }, { label: 'Amount', numeric: true }],
          rows: rows.flatMap((r) => r.marks.map((m) => ({
            key: m.id,
            cells: [r.label, m.ref, m.open ? 'Unpaid' : 'Paid', String(m.days), (m.terms ?? r.terms) != null ? `${m.terms ?? r.terms} days` : '—', rand(m.amount)],
          }))),
        }}
      />
    </div>
  );
}
