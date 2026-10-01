import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Play } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusChip } from '@/components/ui/StatusChip';
import { fetchData } from '@/lib/Api';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import {
  ACCT_KEYS, ACCT_URL, accountingApi, apiMessage, humanise, providerConfig,
  type Connection, type ReconDifference, type ReconScope, type Reconciliation,
} from '@/lib/accounting';
import { AcctCard, ErrorBlock, LoadingBlock, plural, useAccountingPermissions } from './shared';

const SCOPES: { scope: ReconScope; title: string; first: string }[] = [
  { scope: 'INVOICE', title: 'Invoices', first: 'Invoice' },
  { scope: 'CUSTOMER', title: 'Customers', first: 'Customer' },
  { scope: 'MONTH', title: 'Months', first: 'Month' },
];

const FIELD_LABEL: Record<string, string> = {
  total: 'Total',
  vat: 'VAT',
  paid: 'Paid',
  credited: 'Credited',
  status: 'Status',
  open_balance: 'Balance owed',
  sales_excl_vat: 'Sales excl. VAT',
  output_vat: 'Output VAT',
  receipts: 'Money received',
  debtors: 'Debtors',
};

const isMoney = (v: string) => /^-?\d+(\.\d+)?$/.test(String(v).trim());
const showValue = (v: string) => (isMoney(v) ? formatCurrency(v) : humanise(v) || '—');

/** Does TruckWys agree with the books? Per invoice, per customer, per month. */
export function ReconciliationTab({ connection }: { connection: Connection }) {
  const qc = useQueryClient();
  const cfg = providerConfig(connection.provider);
  const { canWrite, writeTitle } = useAccountingPermissions();
  const [running, setRunning] = useState(false);
  const q = useQuery<Reconciliation>({ queryKey: ACCT_KEYS.reconciliation, queryFn: () => fetchData(ACCT_URL.reconciliation), retry: 1 });

  const run = async () => {
    setRunning(true);
    try {
      const res = await accountingApi.runReconciliation();
      qc.setQueryData(ACCT_KEYS.reconciliation, res);
      qc.invalidateQueries({ queryKey: ACCT_KEYS.connection });
      const n = res.run?.difference_count ?? 0;
      if (res.run?.status === 'FAILED') toast.error(res.run.error || "The check couldn't finish. Try again.");
      else toast.success(n === 0 ? `Everything matches ${cfg.short}` : `${plural(n, 'difference')} found`);
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't run the check. Try again."));
    } finally {
      setRunning(false);
    }
  };

  const runButton = (
    <button type="button" className="tw-btn" onClick={run} disabled={!canWrite || running || connection.status !== 'ACTIVE'} title={writeTitle}>
      <Play size={14} aria-hidden="true" />
      {running ? 'Checking…' : 'Run now'}
    </button>
  );

  if (q.isLoading) return <AcctCard title="Reconciliation"><LoadingBlock label="Loading reconciliation" /></AcctCard>;
  if (q.isError || !q.data) return <AcctCard title="Reconciliation"><ErrorBlock message={apiMessage(q.error, "Couldn't load the reconciliation.")} onRetry={() => q.refetch()} /></AcctCard>;

  const { run: last, differences } = q.data;
  const statusChip = last
    ? last.status === 'OK' ? <StatusChip tone="success" label="Matches" size="sm" />
      : last.status === 'DIFFERENCES' ? <StatusChip tone="warning" label="Differences" size="sm" />
        : <StatusChip tone="danger" label="Failed" size="sm" />
    : null;

  return (
    <>
      <AcctCard
        title="Reconciliation"
        description={`Compares TruckWys with ${cfg.short} every night: each invoice, each customer's balance and each month's sales and VAT. Differences under R0.01 are ignored.`}
        actions={runButton}
      >
        {!last ? (
          <p className="acct-section-desc" style={{ margin: 0 }}>No check has run yet. Run one now, or wait for tonight's.</p>
        ) : (
          <>
            <dl className="acct-facts" style={{ margin: 0 }}>
              <div><dt>Last checked</dt><dd>{formatDateTime(last.ran_at)}</dd></div>
              <div><dt>Result</dt><dd>{statusChip}</dd></div>
              <div><dt>Checked</dt><dd>{[
                last.checked.invoices != null && plural(last.checked.invoices, 'invoice'),
                last.checked.customers != null && plural(last.checked.customers, 'customer'),
                last.checked.months != null && plural(last.checked.months, 'month'),
              ].filter(Boolean).join(', ') || '—'}</dd></div>
              <div><dt>Differences</dt><dd>{last.difference_count.toLocaleString('en-ZA')}</dd></div>
            </dl>
            {last.status === 'FAILED' && last.error && <p className="acct-error" role="status" style={{ marginTop: 12 }}>{last.error}</p>}
          </>
        )}
      </AcctCard>

      {last && last.status !== 'FAILED' && (differences.length === 0 ? (
        <section className="acct-empty" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', background: 'var(--bg-surface)', marginBottom: 16 }}>
          <CheckCircle2 size={24} aria-hidden="true" />
          <strong>Everything matches</strong>
          Every invoice, customer balance and monthly VAT figure agrees with {cfg.short}.
        </section>
      ) : SCOPES.map(({ scope, title, first }) => {
        const rows = differences.filter(d => d.scope === scope);
        if (!rows.length) return null;
        return (
          <AcctCard key={scope} title={title} description={plural(rows.length, 'difference')} flush>
            <div className="acct-table-wrap" role="region" aria-label={`${title} differences`} tabIndex={0}>
              <table className="acct-table">
                <thead>
                  <tr>
                    <th>{first}</th>
                    <th>What</th>
                    <th className="num m-hide">TruckWys</th>
                    <th className="num m-hide">{cfg.short}</th>
                    <th className="num">Difference</th>
                    <th><span className="acct-sr">Open in {cfg.short}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(d => <DiffRow key={d.id} d={d} providerName={cfg.short} />)}
                </tbody>
              </table>
            </div>
          </AcctCard>
        );
      }))}
    </>
  );
}

function DiffRow({ d, providerName }: { d: ReconDifference; providerName: string }) {
  const money = isMoney(d.difference);
  const neg = money && parseFloat(d.difference) < 0;
  return (
    <tr>
      <td style={{ minWidth: 140 }}>
        {d.local_url ? <Link className="acct-link" to={d.local_url}>{d.label || d.key}</Link> : (d.label || d.key)}
        {/* Phones: both sides under the label. */}
        <div className="acct-row__sub acct-mobile-only">TruckWys {showValue(d.truckwys)} · {providerName} {showValue(d.provider)}</div>
      </td>
      <td>{FIELD_LABEL[d.field] ?? humanise(d.field)}</td>
      <td className="num m-hide">{showValue(d.truckwys)}</td>
      <td className="num m-hide">{showValue(d.provider)}</td>
      <td className={`num${neg ? ' is-neg' : ''}`}>{money ? formatCurrency(d.difference) : 'Differs'}</td>
      <td>
        {d.provider_url && (
          <a className="acct-link" href={d.provider_url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${d.label || d.key} in ${providerName}`}>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </td>
    </tr>
  );
}
