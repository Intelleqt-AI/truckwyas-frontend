/**
 * Small shared pieces for Fast Pay screens: chips, reasons, the offer
 * breakdown, the timeline and bars. They only format server values.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { formatCurrency, formatDate, formatDateTime, formatPercent, MISSING } from '@/lib/formatters';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { wholeRand } from '@/components/finance/FinTile';
import type { AdvanceStatus, Decision, Offer, Reason, TimelineEntry } from '@/lib/capital/types';
import './fastpay.css';

export const money = (v: number | null | undefined) => (v == null || Number.isNaN(Number(v)) ? MISSING : formatCurrency(v));
/** Tile figure: whole rands, cents in the title (DESIGN-PRINCIPLES §10.3). */
export const TileMoney = ({ v }: { v: number | null | undefined }) =>
  v == null ? <>{MISSING}</> : <span title={formatCurrency(v)}>{wholeRand(v)}</span>;
export const wholeMoney = (v: number | null | undefined) => (v == null ? MISSING : wholeRand(v));
export const day = (d: string | null | undefined) => (d ? formatDate(d) : MISSING);
export const dayTime = (d: string | null | undefined) => (d ? formatDateTime(d) : MISSING);
export const pct = (v: number | null | undefined, decimals = 1) => (v == null ? MISSING : formatPercent(v, decimals));

const DECISION: Record<Decision, { tone: StatusTone; label: string }> = {
  FUND: { tone: 'success', label: 'Fund' },
  PART_FUND: { tone: 'info', label: 'Part now, rest queued' },
  QUEUE: { tone: 'neutral', label: 'Queued' },
  REFER: { tone: 'warning', label: 'Needs review' },
  DECLINE: { tone: 'danger', label: 'Not eligible' },
};

export const decisionLabel = (d: Decision) => DECISION[d]?.label ?? d;

export function DecisionChip({ decision, size = 'sm' }: { decision: Decision; size?: 'sm' | 'md' }) {
  const m = DECISION[decision] ?? { tone: 'neutral' as StatusTone, label: decision };
  return <StatusChip tone={m.tone} label={m.label} size={size} />;
}

const ADVANCE_TONE: Record<AdvanceStatus, StatusTone> = {
  ELIGIBLE: 'neutral',
  QUEUED: 'neutral',
  REQUESTED: 'info',
  SCORING: 'info',
  APPROVED: 'info',
  DISBURSED: 'success',
  SETTLED: 'success',
  DENIED: 'danger',
  CANCELLED: 'neutral',
  BOUGHT_BACK: 'warning',
  WRITTEN_OFF: 'danger',
};

/** The server's status label, toned by status. */
export function AdvanceChip({ status, label, size = 'sm' }: { status: AdvanceStatus; label: string; size?: 'sm' | 'md' }) {
  return <StatusChip tone={ADVANCE_TONE[status] ?? 'neutral'} label={label || status} size={size} />;
}

export const LIVE_STATUSES: AdvanceStatus[] = ['QUEUED', 'REQUESTED', 'SCORING', 'APPROVED', 'DISBURSED'];

export function ReasonList({ reasons, compact, codes }: { reasons: Reason[]; compact?: boolean; codes?: boolean }) {
  if (!reasons?.length) return null;
  return (
    <ul className={`cap-reasons${compact ? ' cap-reasons--compact' : ''}`}>
      {reasons.map((r, i) => (
        <li key={`${r.code}-${i}`}>
          <span className="cap-reasons__dir" data-dir={r.direction} aria-label={r.direction === '+' ? 'Helps' : r.direction === '-' ? 'Holds back' : 'Needs attention'}>
            {r.direction === '-' ? '−' : r.direction}
          </span>
          <span>{r.text}{codes && <span className="cap-reasons__code">{r.code}</span>}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * What the transporter gets from one offer, in order: now, the cost, later.
 * VAT is shown on the platform-fee part only, as the server computes it.
 */
export function OfferBreakdown({ offer }: { offer: Offer }) {
  const hasFee = offer.fee_amount > 0 || offer.fee_vat_amount > 0;
  return (
    <dl className="fin-dl cap-breakdown">
      <div className="fin-dl__row">
        <dt>Invoice balance</dt>
        <dd>{money(offer.invoice_balance)}</dd>
      </div>
      <div className="fin-dl__row">
        <dt>Advance now<small>{pct(offer.advance_rate_pct)} of the balance{offer.queued_amount > 0 ? ', within your available line' : ''}</small></dt>
        <dd>{money(offer.fundable_amount)}</dd>
      </div>
      {hasFee && (
        <div className="fin-dl__row">
          <dt>Fee<small>{pct(offer.fee_pct, 2)} of the advance, excl. VAT</small></dt>
          <dd>−{money(offer.fee_amount)}</dd>
        </div>
      )}
      {offer.fee_vat_amount > 0 && (
        <div className="fin-dl__row">
          <dt>VAT on the platform fee</dt>
          <dd>−{money(offer.fee_vat_amount)}</dd>
        </div>
      )}
      <div className="fin-dl__row is-payout is-total">
        <dt>You receive now</dt>
        <dd>{money(offer.net_payout)}</dd>
      </div>
      {offer.queued_amount > 0 && (
        <div className="fin-dl__row">
          <dt>Queued for later<small>Advanced when the line has room</small></dt>
          <dd>{money(offer.queued_amount)}</dd>
        </div>
      )}
      <div className="fin-dl__row">
        <dt>Holdback<small>Paid to you when your customer pays, less any deductions</small></dt>
        <dd>{money(offer.holdback_amount)}</dd>
      </div>
      <div className="fin-dl__row">
        <dt>Expected customer payment</dt>
        <dd>{day(offer.expected_payment_date)}</dd>
      </div>
    </dl>
  );
}

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (!entries?.length) return <p className="fin-note">No updates yet.</p>;
  return (
    <ol className="cap-timeline">
      {entries.map((t, i) => (
        <li key={`${t.at}-${i}`}>
          <span className="cap-timeline__dot" aria-hidden="true" />
          <div>
            <div className="cap-timeline__label">{t.label}</div>
            <div className="cap-timeline__at">{dayTime(t.at)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Exposure against a cap: fill = used share, a 2px mark where the cap sits when the bar's scale is larger. */
export function CapBar({ value, cap, scale, tone, large, label }: {
  value: number; cap?: number | null; scale?: number; tone?: 'accent' | 'warn' | 'bad'; large?: boolean; label?: string;
}) {
  const max = Math.max(scale ?? 0, cap ?? 0, value, 1);
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  const capAt = cap && scale && scale > cap ? (cap / max) * 100 : null;
  const auto = !tone && cap ? (value > cap ? 'bad' : value > cap * 0.85 ? 'warn' : undefined) : tone;
  return (
    <span className={`cap-bar${large ? ' cap-bar--lg' : ''}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span className={`cap-bar__fill${auto ? ` is-${auto}` : ''}`} style={{ width: `${w}%` }} />
      {capAt != null && <span className="cap-bar__cap" style={{ left: `calc(${capAt}% - 1px)` }} />}
    </span>
  );
}

/** Right-hand detail panel for the desk. Escape closes; focus stays inside. */
export function Drawer({ title, sub, onClose, children, busy }: {
  title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(ref, true);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, busy]);
  return (
    <div className="cap-drawer-backdrop fin-page" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={ref} className="cap-drawer" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="cap-drawer__head">
          <div style={{ minWidth: 0 }}>
            <h2 id={id} className="cap-drawer__title">{title}</h2>
            {sub && <p className="cap-drawer__sub">{sub}</p>}
          </div>
          <button type="button" className="fin-dialog__close" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Card-shaped skeleton for content that is still loading (the head is already drawn). */
export function SkelCard({ height = 160, label }: { height?: number; label?: string }) {
  return <span className="fin-skel" style={{ height, display: 'block' }} aria-busy="true" aria-label={label ?? 'Loading'} />;
}
