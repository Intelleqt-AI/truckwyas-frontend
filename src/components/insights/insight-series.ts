/* Series derived client-side from responses the Insights page already loads.
   No new requests. Decimal strings are coerced with Number(). */
import type { AgeBucket, LanePoint, PayRow } from '@/components/viz';

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const DAY = 86_400_000;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysBetween = (a: string | Date, b: string | Date) =>
  Math.round((dayStart(new Date(b)) - dayStart(new Date(a))) / DAY);

// ------------------------------------------------------------------ ageing

export const AGE_BANDS = [
  { key: 'current', label: 'Not yet due', test: (late: number) => late <= 0 },
  { key: '1-30', label: '1 to 30 days late', test: (late: number) => late >= 1 && late <= 30 },
  { key: '31-60', label: '31 to 60 days late', test: (late: number) => late >= 31 && late <= 60 },
  { key: '61-90', label: '61 to 90 days late', test: (late: number) => late >= 61 && late <= 90 },
  { key: '90+', label: 'More than 90 days late', test: (late: number) => late > 90 },
];

interface InvoiceLike { id: number; invoice_number?: string; customer_name: string; balance: unknown; total_amount?: unknown; status: string; due_date?: string; issue_date?: string; paid_at?: string | null }

/** Unpaid balance per lateness band (days past due date, as of today). */
export function ageingBuckets(invoices: InvoiceLike[], now = new Date()): AgeBucket[] {
  const out = AGE_BANDS.map((b) => ({ key: b.key, label: b.label, amount: 0, count: 0 }));
  invoices.forEach((inv) => {
    if (inv.status === 'PAID' || num(inv.balance) <= 0 || !inv.due_date) return;
    const late = daysBetween(inv.due_date, now);
    const i = AGE_BANDS.findIndex((b) => b.test(late));
    if (i >= 0) { out[i].amount += num(inv.balance); out[i].count += 1; }
  });
  return out;
}

/** The same bands per customer, for the segmented bars in the ranked list. */
export function ageingByCustomer(invoices: InvoiceLike[], now = new Date()): Map<string, AgeBucket[]> {
  const map = new Map<string, InvoiceLike[]>();
  invoices.forEach((inv) => { const a = map.get(inv.customer_name) || []; a.push(inv); map.set(inv.customer_name, a); });
  const res = new Map<string, AgeBucket[]>();
  map.forEach((list, name) => res.set(name, ageingBuckets(list, now)));
  return res;
}

// ------------------------------------------------------------ days to pay

/**
 * One row per customer. Drafts are left out (their clock has not started).
 * Paid invoices: days from issue to payment. Unpaid: days from issue to today.
 * Row terms are the customer's most common terms (due date minus issue date).
 */
export function paymentRows(invoices: InvoiceLike[], now = new Date()): { rows: PayRow[]; paid: number; open: number; drafts: number } {
  const by = new Map<string, PayRow & { termsList: number[] }>();
  let paid = 0; let open = 0; let drafts = 0;
  invoices.forEach((inv) => {
    if (inv.status === 'DRAFT') { drafts += 1; return; }
    if (!inv.issue_date) return;
    const isPaid = inv.status === 'PAID' && !!inv.paid_at;
    const isOpen = !isPaid && num(inv.balance) > 0 && inv.status !== 'CANCELLED';
    if (!isPaid && !isOpen) return;
    const days = Math.max(0, daysBetween(inv.issue_date, isPaid ? inv.paid_at! : now));
    const terms = inv.due_date ? Math.max(0, daysBetween(inv.issue_date, inv.due_date)) : null;
    const row = by.get(inv.customer_name) || { id: inv.customer_name, label: inv.customer_name, terms: null, marks: [], termsList: [] };
    row.marks.push({ id: String(inv.id), ref: inv.invoice_number || `Invoice ${inv.id}`, days, open: isOpen, amount: num(isOpen ? inv.balance : inv.total_amount), terms });
    if (terms != null) row.termsList.push(terms);
    by.set(inv.customer_name, row);
    if (isPaid) paid += 1; else open += 1;
  });
  const rows = [...by.values()].map(({ termsList, ...r }) => {
    const counts = new Map<number, number>();
    termsList.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
    const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
    return { ...r, terms: mode };
  });
  // Worst first: the furthest any invoice went past its own terms.
  const overshoot = (r: PayRow) => Math.max(...r.marks.map((m) => m.days - (m.terms ?? r.terms ?? m.days)));
  rows.sort((a, b) => overshoot(b) - overshoot(a) || a.label.localeCompare(b.label));
  return { rows, paid, open, drafts };
}

// ------------------------------------------------------------------ lanes

interface LoadLike { pickup_city?: string; delivery_city?: string; total_amount?: unknown; distance?: unknown }

/** Lanes with a recorded distance: revenue per km against km per trip. */
export function lanePoints(loads: LoadLike[], minTrips: number): { points: LanePoint[]; overall: number | null; noDistance: number } {
  const m = new Map<string, { trips: number; rev: number; km: number }>();
  const lanesSeen = new Set<string>();
  loads.forEach((l) => {
    if (!l.pickup_city || !l.delivery_city) return;
    const key = `${l.pickup_city} to ${l.delivery_city}`;
    lanesSeen.add(key);
    const km = num(l.distance);
    if (km <= 0) return;
    const e = m.get(key) || { trips: 0, rev: 0, km: 0 };
    m.set(key, { trips: e.trips + 1, rev: e.rev + num(l.total_amount), km: e.km + km });
  });
  const points: LanePoint[] = [...m.entries()].filter(([, d]) => d.rev > 0).map(([label, d]) => ({
    id: label, label, trips: d.trips, revenue: d.rev, kmPerTrip: d.km / d.trips, perKm: d.rev / d.km, thin: d.trips < minTrips,
  }));
  const totRev = points.reduce((s, p) => s + p.revenue, 0);
  const totKm = points.reduce((s, p) => s + p.kmPerTrip * p.trips, 0);
  return { points, overall: totKm > 0 ? totRev / totKm : null, noDistance: lanesSeen.size - points.length };
}
