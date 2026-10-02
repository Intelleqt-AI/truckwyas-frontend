import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  { scope: 'MONTH', title: 'Sales and VAT by month', first: 'Month' },
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
      <RefreshCw size={14} aria-hidden="true" className={running ? 'animate-spin' : undefined} />
      {running ? 'Checking…' : 'Check now'}
    </button>
  );

  if (q.isLoading) return <AcctCard title="Reconciliation"><LoadingBlock label="Loading reconciliation" /></AcctCard>;
  if (q.isError || !q.data) return <AcctCard title="Reconciliation"><ErrorBlock message={apiMessage(q.error, "Couldn't load the reconciliation.")} onRetry={() => q.refetch()} /></AcctCard>;

  const { run: last, differences } = q.data;

  return (
    <>
      <AcctCard
        title="Reconciliation"
        description={`Each night we compare invoices, customer balances and monthly sales and VAT with ${cfg.short}. Differences under 1c are ignored.`}
        actions={runButton}
      >
        {!last ? (
          <p className="acct-section-desc" style={{ margin: 0 }}>No check has run yet. Run one now, or wait for tonight's.</p>
        ) : (
          <>
            {/* The result, said once, first. */}
            {last.status === 'FAILED' ? (
              <p className="acct-diff-lead" role="status"><AlertTriangle size={18} aria-hidden="true" />The last check didn't finish</p>
            ) : differences.length === 0 ? (
              <p className="acct-ok-lead" role="status"><CheckCircle2 size={18} aria-hidden="true" />Everything matches {cfg.short}</p>
            ) : (
              <p className="acct-diff-lead" role="status"><AlertTriangle size={18} aria-hidden="true" />{plural(last.difference_count, 'difference')} with {cfg.short}</p>
            )}
            <p className="acct-section-desc" style={{ margin: '-10px 0 14px' }}>Checked {formatDateTime(last.ran_at)} · <span style={{ whiteSpace: 'nowrap' }}>next check tomorrow at {nextCheck(last.ran_at)}</span></p>
            <div className="acct-tiles acct-tiles--3">
              {SCOPES.map(sc => {
                const n = sc.scope === 'INVOICE' ? last.checked.invoices : sc.scope === 'CUSTOMER' ? last.checked.customers : last.checked.months;
                const bad = differences.filter(d => d.scope === sc.scope).length;
                return (
                  <div key={sc.scope}>
                    <span>{sc.title === 'Sales and VAT by month' ? 'Months' : sc.title}</span>
                    <strong>{(n ?? 0).toLocaleString('en-ZA')}</strong>
                    <em className={`acct-tile-status${bad ? ' is-bad' : ''}`}>{bad ? `${bad} differ` : 'All match'}</em>
                  </div>
                );
              })}
            </div>
            {last.status === 'FAILED' && last.error && <p className="acct-error" role="status" style={{ marginTop: 12 }}>{last.error}</p>}
            {differences.length > 0 && <p className="acct-section-desc" style={{ margin: '12px 0 0' }}>Difference is TruckWys minus {cfg.short}. Correct it in {cfg.short} or TruckWys; it clears on the next check.</p>}
          </>
        )}
      </AcctCard>

      {last && last.status !== 'FAILED' && differences.length > 0 && SCOPES.map(({ scope, title, first }, i) => {
        const rows = differences.filter(d => d.scope === scope);
                if (!rows.length) return null;
        void i;
        const hasLinks = true; // same column template in every table, link or not
        return (
          <AcctCard key={scope} id={`acct-recon-${scope.toLowerCase()}`} title={<>{title}<span className="acct-optional"> · {plural(rows.length, 'difference')}</span></>} flush>
            <div className="acct-table-wrap acct-only-wide" role="region" aria-label={`${title} differences`} tabIndex={0}>
              <table className="acct-table acct-table--recon">
                <colgroup>
                  <col style={{ width: '25%' }} /><col style={{ width: '17%' }} /><col style={{ width: '19%' }} />
                  <col style={{ width: '19%' }} /><col style={{ width: '20%' }} />{hasLinks && <col style={{ width: 64 }} />}
                </colgroup>
                <thead>
                  <tr>
                    <th>{first}</th>
                    <th>Field</th>
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
                      <strong className={`acct-diff${isMoney(d.difference) && d.difference !== '' ? '' : ' acct-diff--text'}`}>{isMoney(d.difference) && d.difference !== '' ? diffText(d) : <span className="acct-diff-word">Differs</span>}</strong>
                    </div>
                    <div className="acct-row__sub">{FIELD_LABEL[d.field] ?? humanise(d.field)}</div>
                    <dl className="acct-diff-kv"><dt>TruckWys</dt><dd>{showValue(d.truckwys)}</dd><dt>{cfg.short}</dt><dd>{showValue(d.provider)}</dd></dl>
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
const diffText = (d: ReconDifference) => {
  if (!isMoney(d.difference) || d.difference === '') return 'Status';
  const n = parseFloat(d.difference);
  return n > 0 ? `+${formatCurrency(d.difference)}` : formatCurrency(d.difference);
};

/** The hour of the last run, as "03:00". */
function nextCheck(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '03:00' : d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

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
      <td className={`num acct-diff${isMoney(d.difference) && d.difference !== '' ? '' : ' acct-diff--text'}`}>{isMoney(d.difference) && d.difference !== '' ? diffText(d) : <span className="acct-diff-word">Differs</span>}</td>
      {hasLinks && (
        <td>
          {d.provider_url && (
            <a className="acct-icon-link" href={d.provider_url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${d.label || d.key} in ${providerName}`} title={`Open in ${providerName}`}>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </td>
      )}
    </tr>
  );
}
