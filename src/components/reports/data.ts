/* Finance reports: data sources, formatting and period maths (read only).

   Every list is loaded in full by following `next` (the API ignores page_size
   and returns 20 rows a page), so report totals reconcile to the ledgers.
   Query keys match the Insights sources so the two share one cache. */

import { useQuery } from '@tanstack/react-query';
import { loadFailed } from '@/components/data/LoadError';
import { fetchData } from '@/lib/Api';
import { fetchAllPages, type Source } from '@/components/insights/findings';
import { formatDate, formatMoney, formatMoneyWhole, formatNumber, formatPercent } from '@/lib/formatters';

// ------------------------------------------------------------------- types

export interface Invoice {
  id: number; invoice_number: string; customer: number | null; customer_name: string;
  status: string; issue_date: string; due_date: string; created_at: string;
  subtotal: string | number; vat_amount: string | number; total_amount: string | number;
  paid_amount: string | number; balance: string | number; paid_at: string | null; load: number | null;
}
export interface Payment {
  id: number; payment_number: string; invoice: number | null; invoice_number?: string; customer: number | null;
  customer_name?: string; amount: string | number; payment_date: string; payment_method?: string; reference_number?: string;
}
export interface Expense {
  id: number; expense_number?: string; category: string; description?: string; amount: string | number;
  expense_date: string; status: string; vehicle: number | null; vendor?: string; created_at: string;
}
export interface Load {
  id: number; load_number: string; customer: number | null; customer_name: string; status: string;
  total_amount: string | number; delivery_date: string | null; distance?: string | number | null;
  pickup_city?: string; delivery_city?: string; pickup_location?: string; delivery_location?: string;
}
export interface Customer { id: number; name: string; company_name?: string; email?: string; phone?: string; address?: string; city?: string; billing_address?: string }
export interface Vehicle { id: number; plate: string; make?: string; model?: string }
export interface Company { company_name?: string; vat_number?: string; registration_number?: string; address?: unknown; contact?: unknown }

const STALE = 5 * 60_000;
const RETRY = { retry: 2, retryDelay: (attempt: number) => 4000 * (attempt + 1) };

function useList<T>(name: string, path: string, enabled = true) {
  return useQuery<Source<T>>({
    queryKey: ['insights-source', name],
    queryFn: () => fetchAllPages<T>(path),
    staleTime: STALE, ...RETRY, enabled,
  });
}

export type SourceName = 'invoices' | 'payments' | 'expenses' | 'loads' | 'customers' | 'vehicles';
const PATHS: Record<SourceName, string> = {
  invoices: 'api/v1/invoices/', payments: 'api/v1/payments/', expenses: 'api/v1/expenses/',
  loads: 'api/v1/loads/', customers: 'api/v1/customers/', vehicles: 'api/v1/vehicles/',
};
const NOUN: Record<SourceName, string> = {
  invoices: 'invoices', payments: 'payments', expenses: 'expenses', loads: 'loads', customers: 'customers', vehicles: 'vehicles',
};

export interface Ledger {
  invoices: Invoice[]; payments: Payment[]; expenses: Expense[]; loads: Load[]; customers: Customer[]; vehicles: Vehicle[];
  /** "first 40 of 52 invoices" style notes when a list could not be loaded in full. */
  partial: string[];
  loadedAt: number;
}

/** Loads the named ledgers in full. Never returns zeros for a failed request:
 *  `error` is set and the caller shows a retry state instead. */
export function useLedger(need: SourceName[]) {
  const q = {
    invoices: useList<Invoice>('invoices', PATHS.invoices, need.includes('invoices')),
    payments: useList<Payment>('payments', PATHS.payments, need.includes('payments')),
    expenses: useList<Expense>('expenses', PATHS.expenses, need.includes('expenses')),
    loads: useList<Load>('loads', PATHS.loads, need.includes('loads')),
    customers: useList<Customer>('customers', PATHS.customers, need.includes('customers')),
    vehicles: useList<Vehicle>('vehicles', PATHS.vehicles, need.includes('vehicles')),
  };
  const used = need.map(n => q[n]);
  // Failing (even while still retrying) with nothing to show counts as an error,
  // so the report says so straight away instead of holding a skeleton.
  const error = used.some(x => loadFailed(x));
  const loading = !error && used.some(x => x.isLoading);
  const retry = () => used.forEach(x => loadFailed(x) && x.refetch());
  if (loading || error || used.some(x => !x.data)) return { loading, error, retry, data: null as Ledger | null };
  const partial = need
    .filter(n => q[n].data && !q[n].data!.complete)
    .map(n => `first ${q[n].data!.rows.length} of ${q[n].data!.count} ${NOUN[n]}`);
  const rows = <T,>(n: SourceName) => ((q[n].data?.rows ?? []) as unknown as T[]);
  const data: Ledger = {
    invoices: rows<Invoice>('invoices'), payments: rows<Payment>('payments'), expenses: rows<Expense>('expenses'),
    loads: rows<Load>('loads'), customers: rows<Customer>('customers'), vehicles: rows<Vehicle>('vehicles'),
    partial,
    loadedAt: Math.max(...used.map(x => x.dataUpdatedAt || 0)),
  };
  return { loading, error, retry, data };
}

export function useCompany() {
  return useQuery<Company>({ queryKey: ['insights-source', 'company'], queryFn: () => fetchData('api/v1/company/profile/'), staleTime: STALE, ...RETRY });
}

// ----------------------------------------------------------------- numbers

export const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** "R 1 234,56"; negatives in brackets, as on a statement: "(R 1 234,56)". */
export const money = (v: number) => {
  const r = round2(v);
  if (r === 0) return formatMoney(0);
  return r < 0 ? `(${formatMoney(-r)})` : formatMoney(r);
};
/** Compact statement money: no currency sign (the table says "in rand"),
 *  optionally whole rands. Negatives in accounting brackets. */
export const moneyBare = (v: number, whole = false) => {
  const r = whole ? Math.round(v) : round2(v);
  // Narrow no-break space between thousands: same grouping, less width.
  const body = formatMoney(Math.abs(r), whole ? 0 : 2).replace(/^R\s?/, '').replace(/[\s\u00a0]/g, '\u202f');
  return r < 0 ? `(${body})` : body;
};
/** Whole rand for tiles: "R 182 053", negatives "−R 4 200". */
export const moneyWhole = (v: number) => formatMoneyWhole(Math.round(v));
export const int = (v: number) => formatNumber(Math.round(v));
/** "14,1%"; '' when there is no value. */
export const pct = (v: number | null, dp = 1) => (v == null || !Number.isFinite(v) ? '' : formatPercent(v, dp));
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ------------------------------------------------------------------- dates

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const ymOf = (iso?: string | null) => (iso ? iso.slice(0, 7) : '');
export const ymNow = () => todayISO().slice(0, 7);
export const addMonths = (ym: string, n: number) => {
  const y = Number(ym.slice(0, 4)); const m = Number(ym.slice(5, 7)) - 1 + n;
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const monthsIn = (from: string, to: string) => {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 60; m = addMonths(m, 1)) out.push(m);
  return out;
};
/** Months to show as columns or rows: the period from its first to its last
 *  month with any entry. Empty months inside that range stay (a real zero);
 *  only the empty lead-in before the first entry and the empty tail after the
 *  last are dropped. With no entries at all the whole period is kept.
 *  Display only: totals are over the full period. */
export const shownMonths = (months: string[], hasEntry: (ym: string) => boolean) => {
  let first = -1; let last = -1;
  months.forEach((m, i) => { if (hasEntry(m)) { if (first < 0) first = i; last = i; } });
  return last < 0 ? months : months.slice(first, last + 1);
};
/** "Oct to Nov 2025", "Dec 2025 to Feb 2026", "Jun 2026". */
const monthSpan = (list: string[]) => {
  const a = list[0]; const b = list[list.length - 1];
  if (a === b) return monthLabel(a);
  return a.slice(0, 4) === b.slice(0, 4) ? `${MONTHS[Number(a.slice(5, 7)) - 1]} to ${monthLabel(b)}` : `${monthLabel(a)} to ${monthLabel(b)}`;
};
/** Why some months of the period are not shown, or null:
 *  "No entries after Jun 2026, so Jul to Sep 2026 are not shown." */
export const trimNote = (all: string[], shown: string[]) => {
  if (!shown.length || shown.length >= all.length) return null;
  const lead = all.slice(0, all.indexOf(shown[0]));
  const tail = all.slice(all.indexOf(shown[shown.length - 1]) + 1);
  const verb = (list: string[]) => (list.length === 1 ? 'is' : 'are');
  if (lead.length && tail.length) return `Only ${monthSpan(shown)} ${shown.length === 1 ? 'has' : 'have'} entries, so ${monthSpan(lead)} and ${monthSpan(tail)} are not shown.`;
  if (lead.length) return `No entries before ${monthLabel(shown[0])}, so ${monthSpan(lead)} ${verb(lead)} not shown.`;
  return `No entries after ${monthLabel(shown[shown.length - 1])}, so ${monthSpan(tail)} ${verb(tail)} not shown.`;
};
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const monthEnd = (ym: string) => {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0);
  return `${ym}-${String(d.getDate()).padStart(2, '0')}`;
};
/** "15 Jun 2026" */
export const day = (iso?: string | null) => (iso ? formatDate(iso.slice(0, 10)) : '');
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b.slice(0, 10)}T00:00:00`).getTime() - new Date(`${a.slice(0, 10)}T00:00:00`).getTime()) / 86_400_000);

// ----------------------------------------------------------------- periods

export type PeriodId = 'this-month' | 'last-month' | 'last-3' | 'last-6' | 'last-12' | 'ytd' | 'custom';
export interface Period { id: PeriodId; from: string; to: string }
export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'last-3', label: '3 months' },
  { id: 'last-6', label: '6 months' },
  { id: 'last-12', label: '12 months' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'custom', label: 'Custom' },
];

export function resolvePeriod(id: PeriodId, customFrom?: string | null, customTo?: string | null): Period {
  const now = ymNow();
  switch (id) {
    case 'this-month': return { id, from: now, to: now };
    case 'last-month': { const m = addMonths(now, -1); return { id, from: m, to: m }; }
    case 'last-3': return { id, from: addMonths(now, -2), to: now };
    case 'last-6': return { id, from: addMonths(now, -5), to: now };
    case 'ytd': return { id, from: `${now.slice(0, 4)}-01`, to: now };
    case 'custom': {
      const ok = (s?: string | null) => !!s && /^\d{4}-\d{2}$/.test(s);
      if (ok(customFrom) && ok(customTo)) {
        const [a, b] = customFrom! <= customTo! ? [customFrom!, customTo!] : [customTo!, customFrom!];
        return { id, from: a, to: monthsIn(a, b).length >= 36 ? addMonths(a, 35) : b };
      }
      return { id: 'last-12', from: addMonths(now, -11), to: now };
    }
    default: return { id: 'last-12', from: addMonths(now, -11), to: now };
  }
}
/** The same number of months immediately before. */
export const priorPeriod = (p: Period) => {
  const n = monthsIn(p.from, p.to).length;
  return { from: addMonths(p.from, -n), to: addMonths(p.from, -1) };
};
export const periodText = (p: { from: string; to: string }) =>
  p.from === p.to ? monthLabel(p.from) : `${monthLabel(p.from)} to ${monthLabel(p.to)}`;
export const inPeriod = (iso: string | null | undefined, p: { from: string; to: string }) => {
  const m = ymOf(iso);
  return !!m && m >= p.from && m <= p.to;
};

// ------------------------------------------------------------ ledger rules

const NOT_ISSUED = new Set(['DRAFT', 'CANCELLED', 'CANCELED', 'VOID']);
const st = (s?: string) => (s || '').toUpperCase();
/** Issued to the customer: not a draft, not cancelled. */
export const isIssued = (i: Invoice) => !NOT_ISSUED.has(st(i.status));
export const isDraft = (i: Invoice) => st(i.status) === 'DRAFT';
/** Owed today: issued, not fully paid, balance above zero. */
export const isOpen = (i: Invoice) => isIssued(i) && st(i.status) !== 'PAID' && num(i.balance) > 0.005;
/** Load statuses that count as delivered work. */
export const DELIVERED = new Set(['DELIVERED', 'INVOICED', 'COMPLETED', 'PAID']);
export const isApproved = (e: Expense) => st(e.status) === 'APPROVED';
export const isPending = (e: Expense) => st(e.status) === 'PENDING';

/** Paid in full: the Invoices page "Paid" filter (status Paid). */
export const isPaid = (i: Pick<Invoice, 'status'>) => st(i.status) === 'PAID';

export interface PaidTiming {
  /** Invoices paid in full (status Paid): the Invoices "Paid" filter count. */
  count: number;
  /** How many of them have both an issue date and a paid date. */
  timed: number;
  /** Average days from issue date to paid date over `timed`; null when none. */
  avgDays: number | null;
}

/** THE "time to get paid" definition, shared by Invoices and Fast Pay so the
 *  count beside it always equals the Invoices "Paid" filter (the backend
 *  stats endpoint misses some paid invoices, e.g. INV-20260615-96400).
 *  Paid = status Paid. Days = issue date to paid_at (never below 0),
 *  averaged over the paid invoices that have both dates. Pass the complete
 *  invoice list (the Reports ledger, or the Invoices page's full list). */
export function paidInvoiceTiming(invoices: Pick<Invoice, 'status' | 'issue_date' | 'paid_at'>[]): PaidTiming {
  const paid = invoices.filter(isPaid);
  const days = paid.flatMap(i => {
    const paidOn = (i.paid_at || '').slice(0, 10);
    if (!i.issue_date || !paidOn) return [];
    return [Math.max(0, daysBetween(i.issue_date, paidOn))];
  });
  return {
    count: paid.length,
    timed: days.length,
    avgDays: days.length ? days.reduce((s, v) => s + v, 0) / days.length : null,
  };
}

/** Share of an invoice's total that is VAT (from the invoice itself, not a rate field). */
export const vatShare = (i?: Invoice) => {
  if (!i) return 0;
  const t = num(i.total_amount);
  return t > 0 ? num(i.vat_amount) / t : 0;
};

export const CATEGORY_LABEL: Record<string, string> = {
  FUEL: 'Fuel', TOLLS: 'Tolls', DRIVER: 'Driver costs', MAINTENANCE: 'Maintenance and repairs',
  INSURANCE: 'Insurance', OVERHEAD: 'Overheads and admin',
};
export const catLabel = (c: string) => CATEGORY_LABEL[st(c)] ?? (c ? c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, ' ') : 'Uncategorised');
/** Transport P&L: costs that move with the work vs fixed running costs. */
export const DIRECT = ['FUEL', 'TOLLS', 'DRIVER', 'MAINTENANCE'];
export const OVERHEADS = ['INSURANCE', 'OVERHEAD'];

export const methodLabel = (m?: string) => {
  const s = st(m);
  if (!s) return 'Payment';
  if (s === 'EFT' || s === 'BANK_TRANSFER') return 'EFT';
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
};

// -------------------------------------------------------------------- lanes

const CITY_ALIAS: Record<string, string> = {
  JHB: 'Johannesburg', JOBURG: 'Johannesburg', CPT: 'Cape Town', DBN: 'Durban', PE: 'Port Elizabeth', GQEBERHA: 'Port Elizabeth',
  PTA: 'Pretoria', BFN: 'Bloemfontein', EL: 'East London', PMB: 'Pietermaritzburg',
};
const cleanCity = (city?: string, location?: string) => {
  const pick = (s?: string) => {
    const t = (s || '').trim();
    if (!t || /^tbd$/i.test(t) || /^tba$/i.test(t)) return '';
    const alias = CITY_ALIAS[t.toUpperCase()];
    if (alias) return alias;
    return t.replace(/\s+(Depot|Warehouse|Harbour|CBD|Port)$/i, '').trim();
  };
  return pick(city) || pick(location);
};
/** "Johannesburg to Durban", or '' when either end is unknown. */
export const laneOf = (l: Load) => {
  const a = cleanCity(l.pickup_city, l.pickup_location);
  const b = cleanCity(l.delivery_city, l.delivery_location);
  return a && b ? `${a} to ${b}` : '';
};

// --------------------------------------------------------------------- csv

export type CsvCell = string | number | null | undefined;
export function downloadCsv(filename: string, lines: CsvCell[][]) {
  const esc = (v: CsvCell) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : v;
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = '﻿' + lines.map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
