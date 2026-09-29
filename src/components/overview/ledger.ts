import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchAllPages } from '@/components/insights/findings';
import {
  inPeriod, isApproved, isOpen, isPending, monthsIn, num, priorPeriod, resolvePeriod, shownMonths, todayISO, trimNote,
  vatShare, ymOf, type Ledger, type Period,
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
 *   revenueExcl   = P&L revenue, cash basis, excl. VAT (same period)
 *   margin        = P&L net margin, cash basis: (revenueExcl - approved costs) / revenueExcl
 *   owed, pastDue = Debtors report "Owed to you now" (open balances), past due by due date
 *   months        = P&L monthly revenue (excl. VAT, cash) and approved costs
 */
export interface HomeMoney {
  period: Period;
  received: number;
  receivedPrior: number | null;
  receipts: number;
  revenueExcl: number;
  costs: number;
  margin: number | null;
  marginPrior: number | null;
  /** Expenses still pending in the period (not deducted), as on the Margin tab. */
  pending: number;
  pendingCount: number;
  owed: number;
  pastDue: number;
  openInvoices: number;
  months: { ym: string; revenue: number; costs: number }[];
  trimmed: string | null;
  partial: string[];
}

function revenueOf(d: Ledger, r: { from: string; to: string }) {
  const invById = new Map(d.invoices.map((i) => [i.id, i]));
  const paid = d.payments.filter((p) => inPeriod(p.payment_date, r));
  let incl = 0; let excl = 0;
  const byMonth = new Map<string, number>();
  paid.forEach((p) => {
    const amt = num(p.amount);
    const ex = amt * (1 - vatShare(p.invoice != null ? invById.get(p.invoice) : undefined));
    incl += amt; excl += ex;
    const m = ymOf(p.payment_date);
    byMonth.set(m, (byMonth.get(m) || 0) + ex);
  });
  return { incl, excl, count: paid.length, byMonth };
}

function costsOf(d: Ledger, r: { from: string; to: string }) {
  const byMonth = new Map<string, number>();
  let total = 0;
  d.expenses.filter((e) => isApproved(e) && inPeriod(e.expense_date, r)).forEach((e) => {
    const a = num(e.amount);
    total += a;
    const m = ymOf(e.expense_date);
    byMonth.set(m, (byMonth.get(m) || 0) + a);
  });
  return { total, byMonth };
}

export function computeHomeMoney(d: Ledger): HomeMoney {
  const period = resolvePeriod('last-12');
  const prior = priorPeriod(period);
  const now = revenueOf(d, period);
  const before = revenueOf(d, prior);
  const c = costsOf(d, period);
  const cPrior = costsOf(d, prior);
  const margin = now.excl > 0.005 ? ((now.excl - c.total) / now.excl) * 100 : null;
  const marginPrior = before.excl > 0.005 ? ((before.excl - cPrior.total) / before.excl) * 100 : null;

  let pending = 0; let pendingCount = 0;
  d.expenses.filter((e) => isPending(e) && inPeriod(e.expense_date, period)).forEach((e) => { pending += num(e.amount); pendingCount += 1; });

  const today = todayISO();
  const open = d.invoices.filter(isOpen);
  const owed = open.reduce((s, i) => s + num(i.balance), 0);
  const pastDue = open.filter((i) => !!i.due_date && i.due_date.slice(0, 10) < today).reduce((s, i) => s + num(i.balance), 0);

  const all = monthsIn(period.from, period.to);
  const shown = shownMonths(all, (m) => now.byMonth.has(m) || c.byMonth.has(m));
  return {
    period,
    received: now.incl,
    receivedPrior: before.count > 0 ? before.incl : null,
    receipts: now.count,
    revenueExcl: now.excl,
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
] as const;

/**
 * Home's ledger: invoices, payments, expenses and loads in full, on the same
 * query keys and fetcher as Reports and Insights (one shared cache). Unlike
 * the reports' hook, a request that is still being retried (a 429 while the
 * page's other requests land) keeps the skeleton; only a final failure is an
 * error, so Home does not flash "couldn't load" on a transient throttle.
 */
export function useHomeLedger() {
  const qs = useQueries({
    queries: HOME_SOURCES.map(([name, path]) => ({
      queryKey: ['insights-source', name],
      queryFn: () => fetchAllPages<any>(path),
      staleTime: STALE,
      ...RETRY,
    })),
  });
  const error = qs.some((q) => q.isError && !q.data && !q.isFetching);
  const loading = !error && qs.some((q) => !q.data);
  const retry = () => qs.forEach((q) => { if (!q.data) q.refetch(); });
  const dataUpdatedAt = Math.max(0, ...qs.map((q) => q.dataUpdatedAt || 0));
  const data: Ledger | null = useMemo(() => {
    if (qs.some((q) => !q.data)) return null;
    const [inv, pay, exp, lds] = qs.map((q) => q.data!);
    const partial = HOME_SOURCES
      .map(([name], i) => ({ name, d: qs[i].data! }))
      .filter((x) => !x.d.complete)
      .map((x) => `first ${x.d.rows.length} of ${x.d.count} ${x.name}`);
    return {
      invoices: inv.rows, payments: pay.rows, expenses: exp.rows, loads: lds.rows, customers: [], vehicles: [],
      partial, loadedAt: dataUpdatedAt,
    } as Ledger;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt, qs.every((q) => !!q.data)]);
  const money = useMemo(() => (data ? computeHomeMoney(data) : null), [data]);
  return { loading, error, retry, data, money };
}

/** Every quote (all pages), shared with Insights' quotes source. */
export function useAllQuotes() {
  return useQuery({
    queryKey: ['insights-source', 'quotes'],
    queryFn: () => fetchAllPages<any>('api/v1/quotes/'),
    staleTime: STALE,
    ...RETRY,
  });
}

/** Every vehicle (all pages), shared with Insights' vehicles source: Home's idle row. */
export function useAllVehicles() {
  return useQuery({
    queryKey: ['insights-source', 'vehicles'],
    queryFn: () => fetchAllPages<any>('api/v1/vehicles/'),
    staleTime: STALE,
    ...RETRY,
  });
}
