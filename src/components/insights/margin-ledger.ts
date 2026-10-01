/* Insights Margin on the Reports ledger.

   The Margin tab used to read the backend finance endpoint (paid invoices incl.
   VAT by payment date, a 6-month monthly trend). The Profit and loss report
   works from the full ledgers instead, and the two disagreed. This module
   repeats the P&L's default basis exactly, so for the same months the Margin
   tab and the P&L print the same numbers:

     revenue  = payments received in the month, less each invoice's VAT share,
                overpayment excluded (cash basis, excl. VAT; reports/data.ts
                `revenueEntries(d, 'cash')`, the backend's cash definition)
     costs    = every expense that is not rejected (approved and pending), by
                expense date, net of its input VAT: the backend's definition
     net      = revenue - costs
     pending  = the part of costs still awaiting approval (informational)

   Periods are whole calendar months, resolved by the same resolvePeriod(). */

import {
  expenseNet, inPeriod, isApproved, isPending, monthsIn, revenueEntries, ymOf,
  type Ledger, type Period,
} from '@/components/reports/data';

export interface MarginMonth { ym: string; revenue: number; costs: number; pending: number; net: number }
export interface MarginResult {
  revenue: number; vat: number; costs: number; pending: number; pendingCount: number; net: number;
  /** Net margin as % of revenue; null when there is no revenue. */
  pct: number | null;
  /** Every month of the period, in order (zeros included). */
  months: MarginMonth[];
  paymentCount: number;
}

export function marginFromLedger(d: Pick<Ledger, 'invoices' | 'payments' | 'expenses'>, period: Period): MarginResult {
  const all = monthsIn(period.from, period.to);
  const by = new Map<string, MarginMonth>(all.map(ym => [ym, { ym, revenue: 0, costs: 0, pending: 0, net: 0 }]));
  let revenue = 0; let vat = 0; let costs = 0; let pending = 0; let pendingCount = 0; let paymentCount = 0;

  revenueEntries(d, 'cash', period).forEach(p => {
    const m = by.get(ymOf(p.date));
    if (m) m.revenue += p.excl;
    revenue += p.excl; vat += p.vat; paymentCount += 1;
  });
  d.expenses.filter(e => inPeriod(e.expense_date, period)).forEach(e => {
    const m = by.get(ymOf(e.expense_date));
    const net = expenseNet(e);
    if (!isApproved(e) && !isPending(e)) return; // rejected: never a cost
    costs += net; if (m) m.costs += net;
    if (isPending(e)) { pending += net; pendingCount += 1; if (m) m.pending += net; }
  });
  const months = all.map(ym => { const m = by.get(ym)!; return { ...m, net: m.revenue - m.costs }; });
  const net = revenue - costs;
  return { revenue, vat, costs, pending, pendingCount, net, pct: revenue > 0 ? (net / revenue) * 100 : null, months, paymentCount };
}

/** Months to chart: leading and trailing months with no entry are trimmed; inner empty months stay (a real zero). */
export function chartMonths(months: MarginMonth[]) {
  const has = (m: MarginMonth) => Math.abs(m.revenue) > 0.005 || Math.abs(m.costs) > 0.005;
  const first = months.findIndex(has);
  if (first < 0) return { shown: [] as MarginMonth[], before: [] as string[], after: [] as string[] };
  let last = months.length - 1;
  while (last > first && !has(months[last])) last -= 1;
  return {
    shown: months.slice(first, last + 1),
    before: months.slice(0, first).map(m => m.ym),
    after: months.slice(last + 1).map(m => m.ym),
  };
}
