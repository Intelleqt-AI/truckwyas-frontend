import './findings.css';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import FindingCard from './FindingCard';
import InfoTip from './InfoTip';
import { KpiRow, KpiTile } from '@/components/ui/KpiTile';
import {
  computeFindings, fetchAllPages, plural, randWhole, summarise,
  type CashflowRec, type CompanyRec, type ExpenseRec, type FindingInputs, type FuelRec,
  type InvoiceRec, type LoadRec, type PaymentRec, type QuoteRec, type Source,
} from './findings';

/* Insights home: a ranked feed of findings (docs/product/review/01-MONEY.md
   section 5). Reads only: every request is a GET on an existing endpoint,
   lists are loaded in full by following `next`. Sources are cached for five
   minutes and shared with the other Insights tabs by query key. */

const STALE = 5 * 60_000;
/** Backs off on failures such as the API's per-user rate limit (429). */
export const RETRY = { retry: 2, retryDelay: (attempt: number) => 4000 * (attempt + 1) };
export const sourceKey = (name: string) => ['insights-source', name] as const;

/** Full list for an entity, shared across tabs. */
export function useAllRows<T>(name: string, path: string, enabled = true) {
  return useQuery<Source<T>>({
    queryKey: sourceKey(name),
    queryFn: () => fetchAllPages<T>(path),
    staleTime: STALE,
    ...RETRY,
    enabled,
  });
}

export default function FindingsFeed() {
  const invoices = useAllRows<InvoiceRec>('invoices', 'api/v1/invoices/');
  const payments = useAllRows<PaymentRec>('payments', 'api/v1/payments/');
  const expenses = useAllRows<ExpenseRec>('expenses', 'api/v1/expenses/');
  const loads = useAllRows<LoadRec>('loads', 'api/v1/loads/');
  const quotes = useAllRows<QuoteRec>('quotes', 'api/v1/quotes/');
  const fuel = useQuery<FuelRec>({ queryKey: sourceKey('fuel'), queryFn: () => fetchData('api/v1/fuel-prices/current/'), staleTime: STALE, ...RETRY });
  const company = useQuery<CompanyRec>({ queryKey: sourceKey('company'), queryFn: () => fetchData('api/v1/company/profile/'), staleTime: STALE, ...RETRY });
  const cashflow = useQuery<CashflowRec>({ queryKey: sourceKey('cashflow'), queryFn: () => fetchData('api/v1/dashboard/cashflow/'), staleTime: STALE, ...RETRY });

  const all = [invoices, payments, expenses, loads, quotes, fuel, company, cashflow];
  const loading = all.some(q => q.isLoading);

  const result = useMemo(() => {
    if (!invoices.data) return null;
    const input: FindingInputs = {
      invoices: invoices.data,
      payments: payments.data ?? null,
      expenses: expenses.data ?? null,
      loads: loads.data ?? null,
      quotes: quotes.data ?? null,
      fuel: fuel.data ?? null,
      company: company.data ?? null,
      cashflow: cashflow.data ?? null,
    };
    const findings = computeFindings(input);
    return { input, findings, summary: summarise(findings, input) };
  }, [invoices.data, payments.data, expenses.data, loads.data, quotes.data, fuel.data, company.data, cashflow.data]);

  if (loading) return <FeedSkeleton />;

  if (invoices.isError || !result) {
    return (
      <div className="ff-state" role="alert">
        <p>Your records did not load.</p>
        <button type="button" className="ff-state__action" onClick={() => all.forEach(q => q.isError && q.refetch())}>Try again</button>
      </div>
    );
  }

  const { findings, summary, input } = result;
  const main = findings.filter(f => f.confidence !== 'low');
  const checking = findings.filter(f => f.confidence === 'low');
  const unavailable = [
    expenses.isError || payments.isError ? 'costs' : null,
    loads.isError ? 'loads' : null,
    quotes.isError || fuel.isError ? 'quotes' : null,
    cashflow.isError ? 'the cash forecast' : null,
  ].filter(Boolean) as string[];
  const hasRecords = input.invoices.rows.length + (input.loads?.rows.length ?? 0) + (input.expenses?.rows.length ?? 0) > 0;

  if (!hasRecords) {
    return (
      <div className="ff-state">
        <p>Findings appear once you invoice your first load.</p>
        <Link className="ff-state__action" to="/finance/invoices/new">Create an invoice</Link>
      </div>
    );
  }

  const scaleTo = Math.max(0, ...findings.map(f => f.amount));
  const high = main.filter(f => f.severity === 'high').length;

  return (
    <div className="ff">
      {main.length > 0 && (
        <KpiRow className="ff-summary">
          <KpiTile
            emphasis
            aria-label="Cash held up"
            label="Cash held up"
            aside={(
              <InfoTip tone="inverse" label="How cash held up is calculated">
                <p className="it__title">Cash held up</p>
                <p>Money you have earned but not collected, across the findings below: unsent drafts, open balances and loads with a vehicle that were left open. Pending loads were never picked up, so they are not counted. Each invoice and load is counted once, even if it is in two findings. Costs and estimates are not included.</p>
              </InfoTip>
            )}
            figure={randWhole(summary.cash)}
            note={[summary.invoiceCount ? plural(summary.invoiceCount, 'invoice') : null, summary.loadCount ? plural(summary.loadCount, 'load') : null].filter(Boolean).join(', ')}
          />
          <KpiTile label="Findings" figure={main.length} note={high > 0 ? `${high} high severity` : 'None high severity'} />
          <KpiTile label="Customers involved" figure={summary.customerCount} note="in cash findings" />
          <KpiTile
            label="Overdue chased"
            figure={<>{summary.reminded}<span className="ff-tile__of"> of {summary.overdueCount}</span></>}
            note={summary.reminded === 0 && summary.overdueCount > 0 ? 'No reminder recorded' : 'With a reminder recorded'}
          />
        </KpiRow>
      )}

      <div className="ff-feed-head">
        <h2 className="ff-feed-title">Ranked by value</h2>
        <InfoTip label="How findings are ranked">
          <p className="it__title">How findings are ranked</p>
          <p>Largest rand value first. Each finding needs at least R 1 000 and a clear trigger in your records. Measured values come straight from records; estimated ones use the formula shown on the card. Findings can share an invoice, so card values are not added together.</p>
        </InfoTip>
      </div>

      {main.length === 0 ? (
        <div className="ff-state">
          <p>Nothing needs you. Every invoice is sent, chased and on time.</p>
          <Link className="ff-state__action" to="/finance/invoices">See invoices</Link>
        </div>
      ) : (
        <div className="ff-list">
          {main.map(f => <FindingCard key={f.id} finding={f} scaleTo={scaleTo} />)}
        </div>
      )}

      {checking.length > 0 && (
        <details className="ff-checking">
          <summary>
            <span>Worth checking</span>
            <span className="ff-checking__count">{checking.length}</span>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="ff-checking__chev"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </summary>
          <div className="ff-list">
            {checking.map(f => <FindingCard key={f.id} finding={f} scaleTo={scaleTo} />)}
          </div>
        </details>
      )}

      {unavailable.length > 0 && (
        <p className="ff-partial">Could not check {unavailable.join(' or ')} right now. Those findings may be missing.</p>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="ff" aria-busy="true" aria-label="Loading findings">
      <div className="tw-kpi-row ff-summary">
        {[0, 1, 2, 3].map(i => <div key={i} className="tw-kpi ff-skel" />)}
      </div>
      <div className="ff-list">
        {[0, 1, 2].map(i => <div key={i} className="fc ff-skel ff-skel--card" />)}
      </div>
    </div>
  );
}
