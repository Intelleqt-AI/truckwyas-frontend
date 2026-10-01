import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchAllPages } from '@/components/insights/findings';
import { isLiveConnected } from '@/lib/liveData';
import {
  expenseNet, inPeriod, isOpen, isPending, isRejected, monthsIn, num, priorPeriod, resolvePeriod, revenueByMonth, shownMonths, todayISO, trimNote,
  ymOf, type Ledger, type Period, type RevenueBasis,
} from '@/components/reports/data';

/**
 * Home money figures, from the SAME ledger and rules the Reports use
 * (src/components/reports/data.ts), so Home, Reports and Insights agree.
 *
 * The backend finance endpoint (dashboard/finance/) is not used for money:
 * it misses paid invoices (e.g. INV-20260615-96400, R 23 000 paid 16 Jun),
 * so its "revenue" disagrees with the Cash and P&L reports.
 *
 *   received      = Cash report "Money in" for the last 12 months (incl. VAT)
 *   revenueExcl   = P&L revenue excl. VAT on the chosen basis (same period):
 *                   accrual = issued invoices less credit notes; cash = received
 *   margin        = P&L net margin on that basis: (revenueExcl - approved costs) / revenueExcl
 *   costs         = every expense not rejected (approved and pending), net of input VAT;
 *                   `pending` is the part of it still awaiting approval (information only)
 *   owed, pastDue = Debtors report "Owed to you now" (open balances), past due by due date
 *   months        = P&L monthly revenue (excl. VAT, cash) and approved costs
 */
export interface HomeMoney {
  period: Period;
  basis: RevenueBasis;
  revenuePrior: number | null;
  received: number;
  receivedPrior: number | null;
  receipts: number;
  revenueExcl: number;
  costs: number;
  margin: number | null;
  marginPrior: number | null;
  /** The part of `costs` still awaiting approval (already deducted). */
  pending: number;
  pendingCount: number;
  owed: number;
  pastDue: number;
  openInvoices: number;
  months: { ym: string; revenue: number; costs: number }[];
  trimmed: string | null;
  partial: string[];
}

function receivedOf(d: Ledger, r: { from: string; to: string }) {
  const paid = d.payments.filter((p) => inPeriod(p.payment_date, r));
  return { incl: paid.reduce((s2, p) => s2 + num(p.amount), 0), count: paid.length };
}

function costsOf(d: Ledger, r: { from: string; to: string }) {
  const byMonth = new Map<string, number>();
  let total = 0;
  d.expenses.filter((e) => !isRejected(e) && inPeriod(e.expense_date, r)).forEach((e) => {
    const a = expenseNet(e);
    total += a;
    const m = ymOf(e.expense_date);
    byMonth.set(m, (byMonth.get(m) || 0) + a);
  });
  return { total, byMonth };
}

export function computeHomeMoney(d: Ledger, basis: RevenueBasis = 'cash'): HomeMoney {
  const period = resolvePeriod('last-12');
  const prior = priorPeriod(period);
  const now = revenueByMonth(d, basis, period);
  const before = revenueByMonth(d, basis, prior);
  const got = receivedOf(d, period);
  const gotBefore = receivedOf(d, prior);
  const c = costsOf(d, period);
  const cPrior = costsOf(d, prior);
  const margin = now.excl > 0.005 ? ((now.excl - c.total) / now.excl) * 100 : null;
  const marginPrior = before.excl > 0.005 ? ((before.excl - cPrior.total) / before.excl) * 100 : null;

  let pending = 0; let pendingCount = 0;
  d.expenses.filter((e) => isPending(e) && inPeriod(e.expense_date, period)).forEach((e) => { pending += expenseNet(e); pendingCount += 1; });

  const today = todayISO();
  const open = d.invoices.filter(isOpen);
  const owed = open.reduce((s, i) => s + num(i.balance), 0);
  const pastDue = open.filter((i) => !!i.due_date && i.due_date.slice(0, 10) < today).reduce((s, i) => s + num(i.balance), 0);

  const all = monthsIn(period.from, period.to);
  const shown = shownMonths(all, (m) => now.byMonth.has(m) || c.byMonth.has(m));
  return {
    period,
    basis,
    received: got.incl,
    receivedPrior: gotBefore.count > 0 ? gotBefore.incl : null,
    receipts: got.count,
    revenueExcl: now.excl,
    revenuePrior: before.entries.length > 0 ? before.excl : null,
    costs: c.total,
    margin,
    marginPrior,
    pending,
    pendingCount,
    owed,
    pastDue,
    openInvoices: open.length,
    months: shown.map((ym) => ({ ym, revenue: now.byMonth.get(ym) || 0, costs: c.byMonth.get(ym) || 0 })),
    trimmed: trimNote(all, shown),
    partial: d.partial,
  };
}

const STALE = 5 * 60_000;
const RETRY = { retry: 3, retryDelay: (attempt: number) => 2000 * (attempt + 1) };
const HOME_SOURCES = [
  ['invoices', 'api/v1/invoices/'],
  ['payments', 'api/v1/payments/'],
  ['expenses', 'api/v1/expenses/'],
  ['loads', 'api/v1/loads/'],
  ['creditNotes', 'api/v1/credit-notes/'],
] as const;

/** Home is kept current by live updates over the WebSocket (lib/liveData:
 *  every save marks the affected ledgers stale and they refetch at once).
 *  Only while that socket is down does Home fall back to refetching every
 *  5 minutes and on returning to the tab. Per-observer options: Reports and
 *  Insights reading the same keys keep their own behaviour. */
export const HOME_LIVE = {
  refetchInterval: () => (isLiveConnected() ? false : STALE),
  refetchOnWindowFocus: () => !isLiveConnected(),
} as const;

/**
 * Home's ledger: invoices, payments, expenses and loads in full, on the same
 * query keys and fetcher as Reports and Insights (one shared cache). Unlike
 * the reports' hook, a request that is still being retried (a 429 while the
 * page's other requests land) keeps the skeleton; only a final failure is an
 * error, so Home does not flash "couldn't load" on a transient throttle.
 */
export function useHomeLedger(basis: RevenueBasis = 'cash') {
  const qs = useQueries({
    queries: HOME_SOURCES.map(([name, path]) => ({
      queryKey: ['insights-source', name],
      // Credit notes only refine accrual revenue: if they fail to load, Home
      // still shows its figures (and says the list is partial).
      queryFn: name === 'creditNotes'
        ? () => fetchAllPages<Record<string, unknown>>(path).catch(() => ({ rows: [] as Record<string, unknown>[], count: 0, complete: false }))
        : () => fetchAllPages<any>(path),
      staleTime: STALE,
      ...RETRY,
      ...HOME_LIVE,
    })),
  });
  const error = qs.some((q) => q.isError && !q.data && !q.isFetching);
  const loading = !error && qs.some((q) => !q.data);
  const retry = () => qs.forEach((q) => { if (!q.data) q.refetch(); });
  const dataUpdatedAt = Math.max(0, ...qs.map((q) => q.dataUpdatedAt || 0));
  // Freshness for Home's "out of date" notice: the OLDEST ledger, and whether
  // a refresh failed while older figures stay on screen.
  const oldestUpdatedAt = qs.every((q) => q.dataUpdatedAt) ? Math.min(...qs.map((q) => q.dataUpdatedAt)) : 0;
  const refreshFailed = qs.some((q) => q.isRefetchError);
  const fetching = qs.some((q) => q.isFetching);
  const data: Ledger | null = useMemo(() => {
    if (qs.some((q) => !q.data)) return null;
    const [inv, pay, exp, lds, cns] = qs.map((q) => q.data!);
    const partial = HOME_SOURCES
      .map(([name], i) => ({ name, d: qs[i].data! }))
      .filter((x) => !x.d.complete)
      .map((x) => (x.name === 'creditNotes' && x.d.count === 0
        ? 'invoices without credit notes (credit notes couldn’t load)'
        : `first ${x.d.rows.length} of ${x.d.count} ${x.name === 'creditNotes' ? 'credit notes' : x.name}`));
    return {
      invoices: inv.rows, payments: pay.rows, expenses: exp.rows, loads: lds.rows, customers: [], vehicles: [], creditNotes: cns.rows,
      partial, loadedAt: dataUpdatedAt,
    } as Ledger;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt, qs.every((q) => !!q.data)]);
  const money = useMemo(() => (data ? computeHomeMoney(data, basis) : null), [data, basis]);
  return { loading, error, retry, data, money, oldestUpdatedAt, refreshFailed, fetching };
}

/** Every quote (all pages), shared with Insights' quotes source. */
export function useAllQuotes() {
  return useQuery({
    queryKey: ['insights-source', 'quotes'],
    queryFn: () => fetchAllPages<any>('api/v1/quotes/'),
    staleTime: STALE,
    ...RETRY,
    ...HOME_LIVE,
  });
}

/** Every vehicle (all pages), shared with Insights' vehicles source: Home's idle row. */
export function useAllVehicles() {
  return useQuery({
    queryKey: ['insights-source', 'vehicles'],
    queryFn: () => fetchAllPages<any>('api/v1/vehicles/'),
    staleTime: STALE,
    ...RETRY,
    ...HOME_LIVE,
  });
}
