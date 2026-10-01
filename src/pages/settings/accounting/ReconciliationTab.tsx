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
import { settingsCardStyle } from '../settingsUi';

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
        description={`Every night TruckWys checks each invoice, each customer's balance and each month's sales and VAT against ${cfg.short}. Differences of ${formatCurrency(0.01)} or less are ignored.`}
        actions={runButton}
      >
        {!last ? (
          <p className="acct-section-desc" style={{ margin: 0 }}>No check has run yet. Run one now, or wait for tonight's.</p>
        ) : (
          <>
            <dl className="acct-facts acct-facts--4" style={{ margin: 0 }}>
              <div><dt>Last checked</dt><dd>{formatDateTime(last.ran_at)}</dd></div>
              <div><dt>Result</dt><dd>{statusChip}</dd></div>
              <div><dt>Differences</dt><dd>{last.difference_count.toLocaleString('en-ZA')}</dd></div>
              <div><dt>Checked</dt><dd>{[
                last.checked.invoices != null && plural(last.checked.invoices, 'invoice'),
                last.checked.customers != null && plural(last.checked.customers, 'customer'),
                last.checked.months != null && plural(last.checked.months, 'month'),
              ].filter(Boolean).join(' · ') || '—'}</dd></div>
            </dl>
            {last.status === 'FAILED' && last.error && <p className="acct-error" role="status" style={{ marginTop: 12 }}>{last.error}</p>}
            {last.status !== 'FAILED' && differences.length === 0 && (
              <p className="acct-ok-line" role="status">
                <CheckCircle2 size={16} aria-hidden="true" />
                Everything matches {cfg.short}. Next check tonight.
              </p>
            )}
          </>
        )}
      </AcctCard>

      {last && last.status !== 'FAILED' && differences.length > 0 && SCOPES.map(({ scope, title, first }) => {
        const rows = differences.filter(d => d.scope === scope);
        const checked = scope === 'INVOICE' ? last.checked.invoices : scope === 'CUSTOMER' ? last.checked.customers : last.checked.months;
        if (!rows.length) {
          return (
            <section key={scope} style={{ ...settingsCardStyle }} className="acct-match-line">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span><strong>{title}</strong> {checked != null ? `All ${plural(checked, title.toLowerCase().replace(/s$/, ''))} match ${cfg.short}.` : `No differences.`}</span>
            </section>
          );
        }
        const hasLinks = rows.some(d => d.provider_url);
        return (
          <AcctCard key={scope} title={title} description={`${plural(rows.length, 'difference')}. Difference = TruckWys minus ${cfg.short}.`} flush>
            <div className="acct-table-wrap acct-only-wide" role="region" aria-label={`${title} differences`} tabIndex={0}>
              <table className="acct-table acct-table--recon">
                <colgroup>
                  <col style={{ width: '34%' }} /><col style={{ width: '16%' }} /><col style={{ width: '16%' }} />
                  <col style={{ width: '16%' }} /><col style={{ width: '18%' }} />{hasLinks && <col style={{ width: 44 }} />}
                </colgroup>
                <thead>
                  <tr>
                    <th>{first}</th>
                    <th>What</th>
                    <th className="num">TruckWys</th>
                    <th className="num">{cfg.short}</th>
                    <th className="num">Difference</th>
                    {hasLinks && <th><span className="acct-sr">Open in {cfg.short}</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(d => <DiffRow key={d.id} d={d} providerName={cfg.short} hasLinks={hasLinks} />)}
                </tbody>
              </table>
            </div>
            {/* Phones: one block per difference instead of a squeezed table. */}
            <ul className="acct-list acct-only-phone">
              {rows.map(d => {
                const [head, ...rest] = (d.label || d.key).split(' · ');
                return (
                  <li key={d.id} className="acct-diff-card">
                    <div className="acct-diff-card__top">
                      <span style={{ minWidth: 0 }}>
                        {d.local_url ? <Link className="acct-link" to={d.local_url}>{head}</Link> : <span className="acct-row__title">{head}</span>}
                        {rest.length > 0 && <span className="acct-row__sub"> · {rest.join(' · ')}</span>}
                      </span>
                      <strong className="acct-diff">{diffText(d)}</strong>
                    </div>
                    <div className="acct-row__sub">{FIELD_LABEL[d.field] ?? humanise(d.field)}: TruckWys {showValue(d.truckwys)}, {cfg.short} {showValue(d.provider)}</div>
                    {d.provider_url && <a className="acct-link" style={{ fontSize: 13 }} href={d.provider_url} target="_blank" rel="noopener noreferrer">Open in {cfg.short} <ExternalLink size={12} aria-hidden="true" /></a>}
                  </li>
                );
              })}
            </ul>
          </AcctCard>
        );
      })}
    </>
  );
}

/** Money differences as rand; a status mismatch has no amount. */
const diffText = (d: ReconDifference) => (isMoney(d.difference) && d.difference !== '' ? formatCurrency(d.difference) : '—');

function DiffRow({ d, providerName, hasLinks }: { d: ReconDifference; providerName: string; hasLinks: boolean }) {
  // "INV-00008 · Eagle Retail Group": the number links, the customer sits under it.
  const [head, ...rest] = (d.label || d.key).split(' · ');
  return (
    <tr>
      <td>
        {d.local_url ? <Link className="acct-link" to={d.local_url}>{head}</Link> : head}
        {rest.length > 0 && <div className="acct-row__sub">{rest.join(' · ')}</div>}
      </td>
      <td>{FIELD_LABEL[d.field] ?? humanise(d.field)}</td>
      <td className="num">{showValue(d.truckwys)}</td>
      <td className="num">{showValue(d.provider)}</td>
      <td className="num acct-diff">{diffText(d)}</td>
      {hasLinks && (
        <td>
          {d.provider_url && (
            <a className="acct-link" href={d.provider_url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${d.label || d.key} in ${providerName}`} title={`Open in ${providerName}`}>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </td>
      )}
    </tr>
  );
}
