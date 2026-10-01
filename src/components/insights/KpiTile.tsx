import './insight-card.css';
import type { ReactNode } from 'react';

/* KPI tile: label, value, change versus a NAMED previous period, optional note.
   Only pass `delta` when the data genuinely supports a comparison. When the
   value is not meaningful (no activity, not measured) pass `empty` instead of a
   big zero: it renders as a short explanation in the value slot. */

export interface KpiDelta {
  /** Signed change, already calculated by the API. */
  value: number;
  /** Rendered change, e.g. "+8.2%". */
  text: string;
  /** Named comparison, e.g. "vs the previous 28 days". */
  against: string;
  /** Whether an increase is good (revenue) or bad (costs). Default true. */
  upIsGood?: boolean;
}

export default function KpiTile({
  label,
  value,
  empty,
  delta,
  note,
  tone,
}: {
  label: string;
  value?: string;
  empty?: ReactNode;
  delta?: KpiDelta | null;
  note?: ReactNode;
  tone?: 'danger';
}) {
  const good = delta ? (delta.value === 0 ? null : (delta.value > 0) === (delta.upIsGood ?? true)) : null;
  return (
    <div className="ic-kpi">
      <dt className="ic-kpi__label">{label}</dt>
      {empty ? (
        <dd className="ic-kpi__empty">{empty}</dd>
      ) : (
        <dd className={`ic-kpi__value${tone ? ` ic-kpi__value--${tone}` : ''}`}>{value}</dd>
      )}
      {delta && (
        <dd className="ic-kpi__delta">
          <span className={good == null ? '' : good ? 'ic-text--success' : 'ic-text--danger'}>
            {delta.value > 0 ? 'Up' : delta.value < 0 ? 'Down' : 'Level'} {delta.text}
          </span>{' '}
          {delta.against}
        </dd>
      )}
      {note && <dd className="ic-kpi__note">{note}</dd>}
    </div>
  );
}
