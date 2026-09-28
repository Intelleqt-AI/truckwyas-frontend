import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';
import { CAPITAL_COMING_SOON } from '@/lib/features';
import SectionHeader from '@/components/layout/SectionHeader';
import './capital-prelaunch.css';
import { AgeingStrip } from '@/components/viz';
import { StatusChip } from '@/components/ui/StatusChip';
import InfoTip from '@/components/insights/InfoTip';

/**
 * Fast Pay before launch. There is no funding partner yet, so this view shows
 * no facility, limit, availability, fee or timing. It shows the fleet's own
 * receivables (what Fast Pay would work on) and the invoice checks that would
 * hold invoices back, then explains how the product will work.
 */

// ---- Ageing ---------------------------------------------------------------

interface AgingBucket { bucket_name: string; invoice_count: number; total_amount: number }
interface AgingReport {
  summary: {
    total_outstanding: number;
    total_invoice_count: number;
    customer_count: number;
    dso: number;
  };
  buckets: AgingBucket[];
  customers?: AgingCustomer[];
}
interface AgingCustomer {
  customer_id: number;
  customer_name: string;
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  total_outstanding: number;
  invoice_count: number;
}
const CUSTOMER_FIELDS: Record<string, keyof AgingCustomer> = {
  current: 'current', '1-30': 'days_1_30', '31-60': 'days_31_60', '61-90': 'days_61_90', '90+': 'days_90_plus',
};

// Backend bucket keys (core/services/aging_service.py), in age order.
const BUCKET_LABELS: Record<string, string> = {
  current: 'Not yet due',
  '1-30': '1 to 30 days late',
  '31-60': '31 to 60 days late',
  '61-90': '61 to 90 days late',
  '90+': 'More than 90 days late',
};
const BUCKET_ORDER = ['current', '1-30', '31-60', '61-90', '90+'];

// ---- Eligibility ----------------------------------------------------------

interface IneligibleInvoice {
  id: number;
  invoice_number: string;
  customer: string;
  amount: number;
  reason: string;
  rule: string;
  all_reasons?: string[];
}
interface EligibilityResponse {
  invoices: { id: number; amount?: number; total_amount?: number }[];
  ineligible_invoices: IneligibleInvoice[];
}

/**
 * Only checks that belong to the invoice itself are shown. Facility-dependent
 * results (limit exceeded, score threshold) mean nothing before launch, and
 * "No active facility on file" is true of every invoice, so both are excluded.
 */
const INVOICE_CHECKS: { key: string; label: string; match: (r: string) => boolean }[] = [
  { key: 'pod', label: 'No proof of delivery on file', match: (r) => /proof of delivery/i.test(r) },
  { key: 'age', label: 'Older than 90 days', match: (r) => /^invoice age/i.test(r) },
  { key: 'dispute', label: 'Customer is disputing the invoice', match: (r) => /dispute/i.test(r) },
  { key: 'inactive', label: 'Customer account is not active', match: (r) => /customer account is not active/i.test(r) },
];

function checksFor(inv: IneligibleInvoice): string[] {
  const reasons = inv.all_reasons?.length ? inv.all_reasons : [inv.reason];
  return INVOICE_CHECKS.filter((c) => reasons.some((r) => c.match(r))).map((c) => c.key);
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ---- Shared bits ----------------------------------------------------------

function CardHead({ id, title, description, info, aside }: { id: string; title: string; description?: string; info?: string; aside?: ReactNode }) {
  return (
    <div className="fp-card__head">
      <div className="fp-card__titles">
        <h2 id={id} className="fp-card__title">
          {title}
          {info && <InfoTip label={`How "${title}" is worked out`}><p className="it__title">How this is worked out</p><p>{info}</p></InfoTip>}
        </h2>
        {description && <p className="fp-card__desc">{description}</p>}
      </div>
      {aside && <div className="fp-card__aside">{aside}</div>}
    </div>
  );
}

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="fp-state" role="alert">
      <p>We couldn't load {what}. Nothing is shown rather than a figure that might be wrong.</p>
      <button type="button" className="fp-btn fp-btn--secondary" onClick={onRetry}>Retry loading</button>
    </div>
  );
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="fp-skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <span key={i} style={{ width: `${88 - i * 14}%` }} />)}
    </div>
  );
}

// ---- Panels ---------------------------------------------------------------

function WaitingCash() {
  const headId = useId();
  const [allCustomers, setAllCustomers] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery<AgingReport>({
    queryKey: ['invoice-aging'],
    queryFn: () => fetchData('api/v1/invoices/aging/'),
  });

  let body;
  if (isLoading) body = <Skeleton rows={4} />;
  else if (isError || !data?.summary) body = <LoadError what="your unpaid invoices" onRetry={() => refetch()} />;
  else {
    const { total_outstanding: total, total_invoice_count: count, customer_count: customers, dso } = data.summary;
    const buckets = BUCKET_ORDER.map((key) => {
      const b = data.buckets?.find((x) => x.bucket_name === key);
      return { key, label: BUCKET_LABELS[key], amount: Number(b?.total_amount ?? 0), count: Number(b?.invoice_count ?? 0) };
    });
    const pastDue = buckets.filter((b) => b.key !== 'current').reduce((s, b) => s + b.amount, 0);
    const pastDueCount = buckets.filter((b) => b.key !== 'current').reduce((s, b) => s + b.count, 0);
    const customerRows = (data.customers ?? [])
      .map((c) => ({
        id: String(c.customer_id),
        name: c.customer_name,
        total: Number(c.total_outstanding) || 0,
        count: Number(c.invoice_count) || 0,
        buckets: BUCKET_ORDER.map((key) => ({ key, label: BUCKET_LABELS[key], amount: Number(c[CUSTOMER_FIELDS[key]]) || 0 })),
      }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
    const maxCustomer = Math.max(0, ...customerRows.map((c) => c.total));
    const shownCustomers = allCustomers ? customerRows : customerRows.slice(0, 6);

    if (count === 0 || total <= 0) {
      body = (
        <div className="fp-state">
          <p>Nothing is waiting. Every invoice you have sent is paid, so there is nothing Fast Pay would advance today.</p>
        </div>
      );
    } else {
      body = (
        <div className="fp-outcome">
          <div className="fp-outcome__figure">
            <div className="fp-hero">{formatCurrency(total)}</div>
            <p className="fp-hero__sub">
              owed on {plural(count, 'invoice')} by {plural(customers, 'customer')}
            </p>
            <dl className="fp-facts">
              <div>
                <dt>Past its due date</dt>
                {/* When all of it is late, the figure above already says how much: don't repeat it. */}
                {pastDueCount === count ? (
                  <dd>All of it<span className="fp-muted">{' · '}every invoice is past due</span></dd>
                ) : (
                  <dd>
                    {formatCurrency(pastDue)}
                    <span className="fp-muted">{' · '}{plural(pastDueCount, 'invoice')}, {pct(pastDue, total)}% of the total</span>
                  </dd>
                )}
              </div>
              <div>
                <dt>Average time to get paid</dt>
                {dso > 0 ? (
                  <dd>
                    {Math.round(dso)} days
                    <span className="fp-note">Days sales outstanding, based on invoices issued in the last 90 days.</span>
                  </dd>
                ) : (
                  <dd className="fp-muted fp-dd-text">
                    Not measurable yet. No invoices were issued in the last 90 days.
                  </dd>
                )}
              </div>
            </dl>
          </div>

          <div className="fp-outcome__breakdown">
            <h3 className="fp-subhead">How late it is</h3>
            <AgeingStrip
              buckets={buckets}
              hideEmptyLabels
              ariaLabel={`Unpaid balance by how late it is: ${buckets.filter((b) => b.amount > 0).map((b) => `${b.label} ${formatCurrency(b.amount)}`).join(', ')}`}
            />
          </div>
          {customerRows.length > 0 && (
            <div className="fp-outcome__customers">
              <h3 className="fp-subhead">Who it is waiting on</h3>
              <ul className="fp-rank fp-rank--aged" aria-label="Unpaid balance by customer, shaded by how late it is">
                {shownCustomers.map((c) => (
                  <li key={c.id} className="fp-rank__row">
                    <span className="fp-rank__label">{c.name}</span>
                    <span className="fp-rank__aged">
                      <AgeingStrip buckets={c.buckets} scaleTo={maxCustomer} ariaLabel={`${c.name}: ${formatCurrency(c.total)}, by how late it is`} />
                    </span>
                    <span className="fp-rank__value">{formatCurrency(c.total)}</span>
                    <span className="fp-rank__meta">{plural(c.count, 'invoice')} · {pct(c.total, total)}%</span>
                  </li>
                ))}
              </ul>
              {customerRows.length > 6 && (
                <button type="button" className="fp-btn fp-btn--quiet" onClick={() => setAllCustomers((v) => !v)}>
                  {allCustomers ? 'Show the largest 6' : `Show all ${customerRows.length} customers`}
                </button>
              )}
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <section className="fp-card" aria-labelledby={headId}>
      <CardHead
        id={headId}
        title="How much cash is waiting on your customers"
        description="Unpaid balances on sent invoices, as of today"
        info="Unpaid balances on invoices you have sent, as of today. Lateness is counted from each invoice's due date."
      />
      {body}
    </section>
  );
}

function HoldingBack() {
  const headId = useId();
  const tableId = useId();
  const [showInvoices, setShowInvoices] = useState(false);
  // Same key and query function as the Invoices and Invoice detail pages, so the cache is shared.
  const { data, isLoading, refetch } = useQuery<EligibilityResponse | null>({
    queryKey: ['capital-eligible'],
    queryFn: () => fetchData('api/v1/capital/eligible/').catch(() => null),
  });

  let body;
  let aside: ReactNode = null;
  if (isLoading) body = <Skeleton rows={3} />;
  else if (!data) body = <LoadError what="the invoice checks" onRetry={() => refetch()} />;
  else {
    const ineligible = (data.ineligible_invoices ?? []).filter((i) => i.rule !== 'NO_FACILITY');
    const passed = data.invoices ?? [];
    const checkedCount = ineligible.length + passed.length;

    if (checkedCount === 0) {
      body = (
        <div className="fp-state">
          <p>
            Invoice checks switch on when Fast Pay goes live. Each open invoice will be checked for proof of
            delivery, an age of 90 days or less, and no open dispute. Keeping the signed POD on every booking
            is the one thing you can do now.
          </p>
        </div>
      );
    } else {
      const amountOf = (i: { amount?: number; total_amount?: number }) => Number(i.amount ?? i.total_amount ?? 0);
      const checkedValue = ineligible.reduce((s, i) => s + amountOf(i), 0) + passed.reduce((s, i) => s + amountOf(i), 0);
      const withChecks = ineligible.map((inv) => ({ inv, keys: checksFor(inv) }));
      const rows = INVOICE_CHECKS.map((c) => {
        const hit = withChecks.filter((w) => w.keys.includes(c.key));
        return { ...c, count: hit.length, value: hit.reduce((s, w) => s + amountOf(w.inv), 0) };
      })
        .filter((r) => r.count > 0)
        .sort((a, b) => b.value - a.value);
      const blocked = withChecks.filter((w) => w.keys.length > 0);
      const clear = checkedCount - blocked.length;
      // Bars are the share of checked value, the same percentage the row prints.
      const barScale = Math.max(checkedValue, ...rows.map((r) => r.value), 1);

      // The pass count and the invoice list toggle sit in the card head, beside the title.
      aside = (
        <>
          <p className="fp-muted">
            {clear} of {plural(checkedCount, 'checked invoice')} {clear === 1 ? 'passes' : 'pass'} every invoice check.
          </p>
          {blocked.length > 0 && (
            <button
              type="button"
              className="fp-btn fp-btn--quiet"
              aria-expanded={showInvoices}
              aria-controls={tableId}
              onClick={() => setShowInvoices((v) => !v)}>
              {showInvoices ? 'Hide invoices' : `Show ${plural(blocked.length, 'invoice')}`}
            </button>
          )}
        </>
      );
      body = (
        <>
          {rows.length === 0 ? (
            <div className="fp-state"><p>None of the checked invoices fail an invoice check.</p></div>
          ) : (
            <ul className="fp-rank" aria-label="Checks that invoices fail, by invoice value">
              {rows.map((r) => (
                <li key={r.key} className="fp-rank__row">
                  <span className="fp-rank__label">{r.label}</span>
                  <span className="fp-rank__bar" aria-hidden="true">
                    <span style={{ width: `${(r.value / barScale) * 100}%` }} />
                  </span>
                  <span className="fp-rank__value">{formatCurrency(r.value)}</span>
                  <span className="fp-rank__meta">{r.count} of {checkedCount} · {pct(r.value, checkedValue)}%</span>
                </li>
              ))}
            </ul>
          )}


          {showInvoices && (
            <div className="fp-table-wrap" id={tableId}>
              <table className="fp-table">
                <thead>
                  <tr>
                    <th scope="col">Invoice</th>
                    <th scope="col">Customer</th>
                    <th scope="col" className="num">Amount</th>
                    <th scope="col">What is holding it back</th>
                  </tr>
                </thead>
                <tbody>
                  {blocked.map(({ inv, keys }) => (
                    <tr key={inv.id}>
                      <td><Link className="fp-id" to={`/finance/invoices/${inv.id}`}>{inv.invoice_number}</Link></td>
                      <td>{inv.customer}</td>
                      <td className="num">{formatCurrency(amountOf(inv))}</td>
                      <td className="fp-muted">
                        {INVOICE_CHECKS.filter((c) => keys.includes(c.key)).map((c) => c.label).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      );
    }
  }

  return (
    <section className="fp-card" aria-labelledby={headId}>
      <CardHead
        id={headId}
        title="What would stop your invoices qualifying"
        description="Checks on your latest unpaid invoices, by value"
        aside={aside}
        info="The invoice checks Fast Pay runs, applied to your most recent sent invoices that are not yet paid. Part-paid invoices are not checked, and one invoice can fail more than one check. Each bar is the value that fails the check, as a share of all checked invoice value."
      />
      {body}
    </section>
  );
}

const STEPS = [
  {
    title: 'Pick a delivered invoice',
    body: 'Choose a sent invoice with proof of delivery on file that is no more than 90 days old.',
  },
  {
    title: 'See the numbers first',
    body: 'Before anything is requested you see the fee and the exact amount you would receive.',
  },
  {
    title: 'Get paid, your customer pays later',
    body: 'The money goes to your bank account, and the advance is repaid when your customer settles the invoice.',
  },
];

function HowItWorks() {
  const headId = useId();
  const noteId = useId();
  return (
    <section className="fp-how" aria-labelledby={headId}>
      <h2 id={headId} className="fp-card__title">How Fast Pay will work</h2>
      <ol className="fp-steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="fp-steps__num" aria-hidden="true">{i + 1}</span>
            <div>
              <h3 className="fp-steps__title">{s.title}</h3>
              <p className="fp-steps__body">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="fp-how__action">
        <button type="button" className="fp-btn fp-btn--primary" disabled aria-describedby={noteId}>
          Request early payment
        </button>
        <p id={noteId} className="fp-muted">{CAPITAL_COMING_SOON}</p>
      </div>
    </section>
  );
}

export default function CapitalPrelaunch() {
  useEffect(() => {
    document.title = 'Fast Pay - TruckWys';
  }, []);

  return (
    <div className="fp-page">
      <SectionHeader
        title="Fast Pay"
        titleAdornment={<StatusChip tone="neutral" label="Not live yet" />}
        description="Get paid for delivered loads without waiting for your customers to settle their invoices."
      />
      <div className="fp-stack">
        <WaitingCash />
        <HoldingBack />
        <HowItWorks />
      </div>
    </div>
  );
}
