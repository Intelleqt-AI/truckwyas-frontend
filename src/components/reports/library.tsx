import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight, CalendarRange, FileText, Hourglass, Landmark, Receipt, Route, TrendingUp, Users, type LucideIcon,
} from 'lucide-react';
import { InfoTip } from '@/components/ui/InfoTip';
import { day, isApproved, isIssued, type Ledger, type SourceName } from './data';

export type ReportId = 'pl' | 'sales' | 'cash' | 'debtors' | 'statement' | 'customers' | 'lanes' | 'expenses' | 'vat';

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
  { id: 'pl', group: 'Profit', title: 'Profit and loss', purpose: 'Revenue, costs and profit, month by month.', basis: 'Excl. VAT · cash or invoice basis', icon: TrendingUp, needs: ['invoices', 'payments', 'expenses'], latest: latestMoney },
  { id: 'sales', group: 'Profit', title: 'Sales by month', purpose: 'Invoices issued and collected each month.', basis: 'Issue date · incl. VAT', icon: CalendarRange, needs: ['invoices'], latest: latestInvoice },
  { id: 'cash', group: 'Cash', title: 'Cash movement', purpose: 'Money received and paid out, with a cash book.', basis: 'Payment date · excl. bank balance', icon: ArrowLeftRight, needs: ['invoices', 'payments', 'expenses'], latest: latestMoney },
  { id: 'debtors', group: 'Customers and debtors', title: 'Debtors age analysis', purpose: 'Who owes you, and how overdue.', basis: 'As at a date · by due date', icon: Hourglass, needs: ['invoices', 'payments'], latest: d => maxDate([latestInvoice(d), latestPayment(d)]) },
  { id: 'statement', group: 'Customers and debtors', title: 'Customer statement', purpose: 'One customer’s invoices, payments and balance.', basis: 'Printable · incl. VAT', icon: FileText, needs: ['invoices', 'payments', 'customers'], latest: d => maxDate([latestInvoice(d), latestPayment(d)]) },
  { id: 'customers', group: 'Customers and debtors', title: 'Revenue by customer', purpose: 'Revenue and share for each customer.', basis: 'Issue or payment date', icon: Users, needs: ['invoices', 'payments'], latest: latestInvoice },
  { id: 'lanes', group: 'Customers and debtors', title: 'Revenue by lane', purpose: 'Delivered revenue per route and per km.', basis: 'Delivery date · excl. VAT', icon: Route, needs: ['loads'], latest: d => maxDate(d.loads.map(l => l.delivery_date)) },
  { id: 'expenses', group: 'Costs', title: 'Expense report', purpose: 'Spend by category and vehicle, with the register.', basis: 'Expense date · as captured', icon: Receipt, needs: ['expenses', 'vehicles'], latest: d => maxDate(d.expenses.map(e => e.expense_date)) },
  { id: 'vat', group: 'Tax and accountant', title: 'VAT report', purpose: 'Output VAT by month and by invoice.', basis: 'Invoice or payments basis', icon: Landmark, needs: ['invoices', 'payments'], latest: d => maxDate([latestInvoice(d), latestPayment(d)]) },
];

const GROUPS = ['Profit', 'Cash', 'Customers and debtors', 'Costs', 'Tax and accountant'];

export function ReportLibrary({ d }: { d: Ledger | null }) {
  const [params] = useSearchParams();
  const href = (id: ReportId) => {
    const n = new URLSearchParams(params);
    n.set('report', id);
    return `/finance/reports?${n.toString()}`;
  };
  return (
    <div className="fr-library">
      <div className="fr-library__head">
        <h2 className="fr-head__title">
          Reports
          <InfoTip label="What reports show">
            <span className="fr-info__title">Reports</span>
            <span className="fr-info__line">What happened, reconciled to your invoices, payments and expenses. Every total ties back to the ledgers.</span>
            <span className="fr-info__line">No forecasts or advice here: those are findings in Insights.</span>
          </InfoTip>
        </h2>
        <p className="fr-head__sub">Statements from your invoices, payments and expenses</p>
      </div>
      <div className="fr-cards">
        {GROUPS.flatMap(g => REPORTS.filter(r => r.group === g)).map(r => {
          const Icon = r.icon;
          const latest = d ? r.latest(d) : undefined;
          return (
            <article key={r.id} className="fr-card" aria-labelledby={`fr-c-${r.id}`}>
              <div className="fr-card__top">
                <span className="fr-card__icon" aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
                <span className="fr-card__group">{r.group}</span>
              </div>
              <h3 id={`fr-c-${r.id}`} className="fr-card__title">{r.title}</h3>
              <p className="fr-card__purpose">{r.purpose}</p>
              <p className="fr-card__meta">
                <span>{r.basis}</span>
                <span>{latest ? `Latest entry ${day(latest)}` : d ? 'No entries yet' : '\u00a0'}</span>
              </p>
              <Link className="tw-btn fr-card__btn" to={href(r.id)} aria-label={`View ${r.title.toLowerCase()}`}>View report</Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
