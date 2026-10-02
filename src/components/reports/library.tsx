import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight, CalendarRange, ChevronRight, FileText, Hourglass, Landmark, Percent, Receipt, Route, TrendingUp, Users, type LucideIcon,
} from 'lucide-react';
import { InfoTip } from '@/components/ui/InfoTip';
import {
  DELIVERED, day, expenseNet, expenseVat, inPeriod, isApproved, isIssued, isOpen, isRejected, moneyWhole, num, resolvePeriod, revenueByMonth,
  type Ledger, type SourceName,
} from './data';

export type ReportId = 'pl' | 'sales' | 'cash' | 'debtors' | 'statement' | 'customers' | 'lanes' | 'margin' | 'expenses' | 'vat';

export interface ReportDef {
  id: ReportId; group: string; title: string; purpose: string; basis: string; icon: LucideIcon;
  needs: SourceName[];
  /** Date of the newest record behind the report. */
  latest: (d: Ledger) => string | undefined;
}

const maxDate = (xs: (string | null | undefined)[]) => xs.filter(Boolean).map(x => x!.slice(0, 10)).sort().pop();
const latestInvoice = (d: Ledger) => maxDate(d.invoices.filter(isIssued).map(i => i.issue_date));
const latestPayment = (d: Ledger) => maxDate(d.payments.map(p => p.payment_date));
const latestMoney = (d: Ledger) => maxDate([latestPayment(d), maxDate(d.expenses.filter(isApproved).map(e => e.expense_date))]);

export const REPORTS: ReportDef[] = [
  { id: 'pl', group: 'Profit', title: 'Profit and loss', purpose: 'Did you make a profit, month by month?', basis: 'Excl. VAT · cash or accrual', icon: TrendingUp, needs: ['invoices', 'payments', 'expenses', 'creditNotes'], latest: latestMoney },
  { id: 'sales', group: 'Profit', title: 'Sales by month', purpose: 'How much you invoiced each month, less credit notes, and what is paid.', basis: 'Excl. VAT · accrual (invoiced)', icon: CalendarRange, needs: ['invoices', 'creditNotes'], latest: latestInvoice },
  { id: 'cash', group: 'Cash', title: 'Cash movement', purpose: 'What money came in and went out?', basis: 'Payment date · excl. bank balance', icon: ArrowLeftRight, needs: ['invoices', 'payments', 'expenses'], latest: latestMoney },
  { id: 'debtors', group: 'Customers and debtors', title: 'Debtors age analysis', purpose: 'Who owes you, and how late is it?', basis: 'As at a date · by due date', icon: Hourglass, needs: ['invoices', 'payments'], latest: d => maxDate([latestInvoice(d), latestPayment(d)]) },
  { id: 'statement', group: 'Customers and debtors', title: 'Customer statement', purpose: 'What one customer owes, invoice by invoice.', basis: 'Printable · incl. VAT', icon: FileText, needs: ['invoices', 'payments', 'customers', 'creditNotes'], latest: d => maxDate([latestInvoice(d), latestPayment(d)]) },
  { id: 'customers', group: 'Customers and debtors', title: 'Revenue by customer', purpose: 'Which customers bring in the revenue?', basis: 'Excl. VAT · accrual or cash', icon: Users, needs: ['invoices', 'payments', 'creditNotes'], latest: latestInvoice },
  { id: 'lanes', group: 'Customers and debtors', title: 'Revenue by lane', purpose: 'Which routes earn the most, and per km?', basis: 'Load prices · excl. VAT', icon: Route, needs: ['loads'], latest: d => maxDate(d.loads.map(l => l.delivery_date)) },
  { id: 'margin', group: 'Customers and debtors', title: 'Lane margin', purpose: 'What each route really earns after its costs.', basis: 'Excl. VAT · actual vs estimate', icon: Percent, needs: [], latest: () => undefined },
  { id: 'expenses', group: 'Costs', title: 'Expense report', purpose: 'Where the money goes, by category and truck.', basis: 'Expense date · excl. VAT', icon: Receipt, needs: ['expenses', 'vehicles'], latest: d => maxDate(d.expenses.map(e => e.expense_date)) },
  { id: 'vat', group: 'Tax and accountant', title: 'VAT report', purpose: 'Output VAT charged, input VAT paid, and the net.', basis: 'Invoice or payments basis', icon: Landmark, needs: ['invoices', 'payments', 'creditNotes', 'expenses'], latest: d => maxDate([latestInvoice(d), latestPayment(d)]) },
];

const GROUPS = ['Profit', 'Cash', 'Customers and debtors', 'Costs', 'Tax and accountant'];

/** One headline per report over the last 12 months (the reports' default
 *  period), from the same ledger rules the reports use. Kept to sums the
 *  library already has loaded; null when there is nothing to show. */
type KeyFigure = { value: string; caption: string } | null;
const LAST_12 = () => resolvePeriod('last-12');
const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
function keyFigure(id: ReportId, d: Ledger): KeyFigure {
  const p = LAST_12();
  const paid = d.payments.filter(x => inPeriod(x.payment_date, p));
  const issued = d.invoices.filter(i => isIssued(i) && inPeriod(i.issue_date, p));
  // Costs: not rejected (approved and pending), excl. input VAT, as the P&L counts them.
  const costs = sum(d.expenses.filter(e => !isRejected(e) && inPeriod(e.expense_date, p)).map(expenseNet));
  const fig = (v: number, caption: string, whole = true): KeyFigure => ({ value: whole ? moneyWhole(v) : String(v), caption });
  switch (id) {
    case 'pl': {
      if (!paid.length && !costs) return null;
      const rev = revenueByMonth(d, 'cash', p).excl;
      return fig(rev - costs, 'Net profit excl. VAT, cash');
    }
    case 'sales': return issued.length ? fig(revenueByMonth(d, 'accrual', p).excl, 'Revenue excl. VAT, accrual') : null;
    case 'cash': {
      // Cash movement: approved expenses as paid, incl. VAT (the Cash report's rule).
      const out = sum(d.expenses.filter(e => isApproved(e) && inPeriod(e.expense_date, p)).map(e => num(e.amount)));
      return paid.length || out ? fig(sum(paid.map(x => num(x.amount))) - out, 'Net movement') : null;
    }
    case 'debtors': {
      const open = d.invoices.filter(isOpen);
      return open.length ? fig(sum(open.map(i => num(i.balance))), 'Owed to you now') : null;
    }
    case 'statement': {
      const owing = new Set(d.invoices.filter(isOpen).map(i => i.customer ?? i.customer_name)).size;
      return owing ? { value: String(owing), caption: owing === 1 ? 'Customer owes you' : 'Customers owe you' } : null;
    }
    case 'customers': {
      const n = new Set(issued.map(i => i.customer ?? i.customer_name)).size;
      return n ? { value: String(n), caption: n === 1 ? 'Customer invoiced' : 'Customers invoiced' } : null;
    }
    case 'lanes': {
      const done = d.loads.filter(l => DELIVERED.has((l.status || '').toUpperCase()) && inPeriod(l.delivery_date, p));
      return done.length ? fig(sum(done.map(l => num(l.total_amount))), 'Delivered, excl. VAT') : null;
    }
    case 'expenses': return costs ? fig(costs, 'Costs excl. VAT') : null;
    case 'vat': {
      if (!issued.length) return null;
      const output = revenueByMonth(d, 'accrual', p).vat;
      const input = sum(d.expenses.filter(e => !isRejected(e) && inPeriod(e.expense_date, p)).map(expenseVat));
      return fig(output - input, 'Net VAT, output less input');
    }
    default: return null;
  }
}

/** The library: one compact list under the Finance tabs (the tab is the
 *  heading). Each row names the report, says what it answers, and gives its
 *  headline for the last 12 months and the newest entry behind it. */
export function ReportLibrary({ d }: { d: Ledger | null }) {
  const [params] = useSearchParams();
  const href = (id: ReportId) => {
    const n = new URLSearchParams(params);
    n.set('report', id);
    return `/finance/reports?${n.toString()}`;
  };
  const list = GROUPS.flatMap(g => REPORTS.filter(r => r.group === g));
  return (
    <section className="tw-card tw-card--flush fr-lib" aria-label="Reports">
      <div className="fr-lib__head">
        <span>Report</span>
        <span className="fr-lib__col-purpose">What it answers</span>
        <span className="fr-lib__col-fig">
          Last 12 months
          <InfoTip label="About these figures" align="end">
            <span className="fr-info__line">Each figure is the report&rsquo;s headline for its default period, the last 12 months. Open a report to change the period or basis.</span>
            <span className="fr-info__line">Reports say what happened, reconciled to your invoices, payments and expenses. Forecasts are in Insights.</span>
          </InfoTip>
        </span>
        <span className="fr-lib__col-latest">Latest entry</span>
      </div>
      <ul className="fr-lib__list">
        {list.map(r => {
          const latest = d ? r.latest(d) : undefined;
          const k = d ? keyFigure(r.id, d) : null;
          return (
            <li key={r.id}>
              <Link className="fr-lib__row" to={href(r.id)}>
                <span className="fr-lib__name">{r.title}</span>
                <span className="fr-lib__purpose">{r.purpose}</span>
                <span className="fr-lib__fig">
                  {k ? <><span className="fr-lib__value">{k.value}</span><span className="fr-lib__caption">{k.caption}</span></>
                    : d ? <span className="fr-lib__caption">Nothing in the last 12 months</span>
                    : <span className="fr-lib__skel" aria-hidden="true" />}
                </span>
                <span className="fr-lib__latest">{latest ? day(latest) : d ? 'No entries yet' : ''}</span>
                <ChevronRight className="fr-lib__chev" size={16} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
