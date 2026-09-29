import { formatDate, formatDays, formatMoneyWhole, normaliseFigures, sentenceCaseLabel, toDate } from '@/lib/formatters';
import { staleLabel, staleLoads, staleWork } from '@/lib/staleWork';
import { localDateISO, saDaysBetween } from '@/lib/dates';

/**
 * Home "Needs you": turn a backend signal into a clean row.
 * The signal API returns prose ("Tiger Brands Ltd owes R 20,505.65. Due
 * 2026-06-05. Chase now."); known patterns are parsed into structured parts
 * and formatted with the house formatters. Anything unrecognised is shown
 * as-is after safe normalisation (en-ZA figures, dates, sentence case).
 */
export interface SignalRow {
  kind: 'invoice' | 'fleet' | 'other';
  title: string;
  detail: string;
  /** Money figure shown right-aligned on the row (never wrapped into the title). */
  amount?: string;
  /** Longer detail for the tooltip (invoice, due date, lateness). */
  detailTitle?: string;
  actionLabel: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  CHASE: 'Chase',
  ASSIGN: 'Assign',
  VIEW: 'View',
  REVIEW: 'Review',
  APPROVE: 'Review',
};

const IMPERATIVE_TAIL = /\s*(Chase now|Assign now|Review now|Act now)\.?\s*$/i;

// South African calendar days, the Debtors report's count (src/lib/dates.ts).
const daysSince = (d: Date) => saDaysBetween(localDateISO(d)) ?? 0;

export function presentSignal(s: { title?: string; body?: string; action?: string; category?: string }, loads: any[] = []): SignalRow {
  const rawTitle = String(s.title || '').replace(/\s+—\s+/g, ': ');
  const rawBody = String(s.body || '').replace(IMPERATIVE_TAIL, '').trim();
  const actionLabel = ACTION_LABELS[String(s.action || '').toUpperCase()] ?? null;

  // "Invoice Overdue — INV-…" / "<customer> owes R 20,505.65. Due 2026-06-05."
  const owes = /^(.+?)\s+owes\s+R\s?([\d,]+(?:\.\d+)?)\.?\s*(?:Due\s+(\d{4}-\d{2}-\d{2}))?/i.exec(rawBody);
  const invNo = /\b(INV-[\w-]+)/.exec(rawTitle)?.[1];
  if (owes) {
    const amount = Number(owes[2].replace(/,/g, ''));
    const due = toDate(owes[3]);
    const late = due ? daysSince(due) : null;
    // Short detail (one line in the side column): lateness first, then the invoice.
    const when = late != null && late > 0 ? `${formatDays(late)} late` : due ? `due ${formatDate(due)}` : null;
    const parts = [when, invNo].filter(Boolean);
    return {
      kind: 'invoice',
      title: owes[1],
      amount: Number.isFinite(amount) ? formatMoneyWhole(amount) : normaliseFigures(`R ${owes[2]}`),
      detail: parts.join(' · ').replace(/^./, (c) => c.toUpperCase()),
      detailTitle: [invNo, due ? `due ${formatDate(due)}` : null, when && late != null && late > 0 ? when : null].filter(Boolean).join(', '),
      actionLabel,
    };
  }

  // "N Loads In Transit": the backend adds "All tracking normally", which it
  // does not check. Drop the claim and say how many are past their delivery
  // date, from the same loads the page already has.
  if (/loads?\s+in\s+transit/i.test(rawTitle)) {
    const today = new Date();
    const moving = loads.filter((l) => l?.status === 'IN_TRANSIT');
    const late = moving.filter((l) => (toDate(l.delivery_date)?.getTime() ?? Infinity) < today.getTime()).length;
    const body = rawBody.replace(/\s*All tracking normally\.?/i, '').trim();
    // The count comes from the same loads as the Orders tab's In transit, and
    // is said once: "4 loads in transit" + "All past the delivery date".
    const n = moving.length;
    const title = n > 0 ? `${n} ${n === 1 ? 'load' : 'loads'} in transit` : sentenceCaseLabel(normaliseFigures(rawTitle));
    const detail = late > 0
      ? (late === n ? (n === 1 ? 'Past the delivery date' : 'All past the delivery date') : `${late} of them past the delivery date`)
      : normaliseFigures(body);
    return { kind: 'fleet', title, detail, actionLabel };
  }

  const fleet = /fleet|vehicle|driver|truck/i.test(`${s.category || ''} ${rawTitle}`);
  return {
    kind: fleet ? 'fleet' : /invoice|payment|cash/i.test(`${s.category || ''} ${rawTitle}`) ? 'invoice' : 'other',
    title: sentenceCaseLabel(normaliseFigures(rawTitle)),
    detail: rawBody && rawBody !== rawTitle ? normaliseFigures(rawBody) : '',
    actionLabel,
  };
}

/** True for the backend's "N loads in transit" signal, which Home replaces with the stale-work row. */
export const isInTransitSignal = (s: { title?: string }) => /loads?\s+in\s+transit/i.test(String(s?.title || ''));

const STATUS_WORDS: Record<string, string> = { IN_TRANSIT: 'in transit', LOADING: 'loading', ASSIGNED: 'assigned', PENDING: 'pending' };

/**
 * Home's stale-work row (R6): the same loads Orders, Findings and the fleet
 * pages flag (src/lib/staleWork.ts), so the counts agree everywhere.
 * "11 loads not closed" · "Oldest since 2 Jan 2026 (270 days)" (status mix in the tooltip).
 */
export function staleSignal(loads: any[], today: Date = new Date()): (SignalRow & { actionUrl: string }) | null {
  const stale = staleLoads(loads, today);
  if (stale.length === 0) return null;
  const n = stale.length;
  const by = new Map<string, number>();
  stale.forEach((l) => { const k = String(l?.status || '').toUpperCase(); by.set(k, (by.get(k) || 0) + 1); });
  const mix = ['IN_TRANSIT', 'LOADING', 'ASSIGNED', 'PENDING'].filter((k) => by.get(k)).map((k) => `${by.get(k)} ${STATUS_WORDS[k]}`).join(', ');
  const oldest = staleLabel(staleWork(stale[0], today)!);
  return {
    kind: 'fleet',
    title: `${n} ${n === 1 ? 'load' : 'loads'} not closed`,
    // One line in the side column; the mix of statuses is in the tooltip.
    detail: n === 1 ? `Open ${oldest.text}` : `Oldest ${oldest.text}`,
    detailTitle: `Open loads past their delivery date or open more than 30 days: ${mix}. The oldest has been open ${oldest.text}.`,
    actionLabel: 'Review',
    actionUrl: '/bookings/orders',
  };
}
