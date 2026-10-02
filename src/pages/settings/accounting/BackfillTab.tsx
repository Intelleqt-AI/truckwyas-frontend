import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@/components/ui/date-picker';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDate, formatDateTime, formatRelativeTime } from '@/lib/formatters';
import { fetchData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import {
  ACCT_KEYS, ACCT_URL, accountingApi, apiCode, apiMessage, invalidateAccounting, providerBlockers, providerConfig,
  type Backfill, type Connection, type StepState,
} from '@/lib/accounting';
import { AcctCard, ErrorBlock, LoadingBlock, StepIcon, plural, useAccountingPermissions, type StepLook } from './shared';
import type { AccountingTab } from './tabs';

/** Plain-English step names (the server's labels are the fallback). */
const STEP_LABEL: Record<string, (p: string) => string> = {
  settings: p => `Read accounts and VAT from ${p}`,
  contacts: () => 'Link customers and suppliers',
  invoices: () => 'Send invoices and credit notes',
  receipts: () => 'Send recorded payments',
  bills: () => 'Send supplier bills',
  payments: p => `Import payments from ${p}`,
};

const STEP_LOOK: Record<StepState, StepLook> = { PENDING: 'todo', RUNNING: 'busy', DONE: 'done', FAILED: 'bad', SKIPPED: 'skip' };

/** First day of the current month, as YYYY-MM-DD: a sensible default cut-over. */
const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

/**
 * Cut-over + backfill: choose the date from which TruckWys owns sending
 * documents, see what will go, start, and watch each step.
 */
export function BackfillTab({ connection, onOpen }: { connection: Connection; onOpen: (tab: AccountingTab) => void }) {
  const qc = useQueryClient();
  const cfg = providerConfig(connection.provider);
  const { canWrite, writeTitle } = useAccountingPermissions();
  const [date, setDate] = useState<string>(connection.cutover_date ?? '');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const q = useQuery<Backfill>({
    // The chosen date rides along so the server can preview that date; the
    // counts are labelled with the date the server says it used.
    queryKey: [...ACCT_KEYS.backfill, date],
    queryFn: () => fetchData(`${ACCT_URL.backfill}${date ? `?cutover_date=${encodeURIComponent(date)}` : ''}`),
    retry: 1,
    placeholderData: prev => prev,
    refetchInterval: query => (query.state.data?.state === 'RUNNING' ? 3000 : false),
  });
  const b = q.data;

  // Seed the picker from the server once.
  useEffect(() => {
    if (!date && b?.cutover_date) setDate(b.cutover_date);
  }, [b?.cutover_date]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a run finishes, refresh the connection (readiness, counts).
  const prevState = useRef(b?.state);
  useEffect(() => {
    if (prevState.current === 'RUNNING' && b && b.state !== 'RUNNING') {
      invalidateAccounting(qc);
      if (b.state === 'DONE') toast.success(`Done. ${cfg.short} is up to date from ${formatDate(b.cutover_date)}.`);
      else if (b.state === 'FAILED') toast.error('The first send stopped part-way. See the failed step below.');
    }
    prevState.current = b?.state;
  }, [b, qc, cfg.short]);

  if (q.isLoading) return <AcctCard title="Start date"><LoadingBlock label="Loading start date" /></AcctCard>;
  if (q.isError || !b) return <AcctCard title="Start date"><ErrorBlock message={apiMessage(q.error, "Couldn't load the start date.")} onRetry={() => q.refetch()} /></AcctCard>;

  const r = connection.readiness;
  const running = b.state === 'RUNNING';
  const done = b.state === 'DONE';
  const locked = running || done;
  const p = b.preview;

  const reasons: string[] = [];
  if (!canWrite && writeTitle) reasons.push(writeTitle);
  if (connection.status !== 'ACTIVE') reasons.push(`Reconnect ${cfg.short} first`);
  if (!r.mapping_complete) reasons.push('Map every account and VAT code first');
  if (r.contacts_to_confirm > 0 || (p?.contacts_unconfirmed ?? 0) > 0) reasons.push(`Confirm the ${plural(Math.max(r.contacts_to_confirm, p?.contacts_unconfirmed ?? 0), 'contact')} matched on name only`);
  if (!date) reasons.push('Choose a start date');
  if (connection.status === 'ACTIVE' && providerBlockers(r).length) reasons.push(`Change the ${cfg.short} settings listed on the Setup tab, then refresh`);
  const canStart = reasons.length === 0 && !locked && !starting;

  const start = async () => {
    if (!canStart) return;
    setStarting(true); setError('');
    try {
      const res = await accountingApi.startBackfill(date);
      qc.setQueryData([...ACCT_KEYS.backfill, date], res);
      qc.invalidateQueries({ queryKey: ACCT_KEYS.connection });
    } catch (e) {
      setError(apiCode(e) === 'provider_settings'
        ? `${cfg.short} settings stop this: ${apiMessage(e, 'see the Setup tab')}. Change them in ${cfg.short}, then use Refresh from ${cfg.short} on the Setup tab.`
        : apiMessage(e, "Couldn't start. Try again."));
      if (apiCode(e) === 'provider_settings') qc.invalidateQueries({ queryKey: ACCT_KEYS.connection });
    } finally {
      setStarting(false);
    }
  };

  const previewDate = b.cutover_date ?? date;
  // "31 of 52" where the preview knows the total for that step.
  const totals: Record<string, number | undefined> = p ? {
    invoices: p.invoices + p.credit_notes, receipts: p.historic_receipts, bills: p.bills,
  } : {};
  const stepCount = (x: Backfill['steps'][number]) => {
    const total = totals[x.key];
    if (x.state === 'RUNNING') return total ? `${x.count.toLocaleString('en-ZA')} of ${total.toLocaleString('en-ZA')}` : `${x.count.toLocaleString('en-ZA')} so far`;
    if (x.state === 'DONE') return total ? `${x.count.toLocaleString('en-ZA')} of ${total.toLocaleString('en-ZA')}` : 'Done';
    if (x.state === 'SKIPPED') return '';
    return total ? `0 of ${total.toLocaleString('en-ZA')}` : 'Waiting';
  };
  // The bar follows the documents (where the preview knows them), not the steps.
  const itemTotal = Object.values(totals).reduce<number>((n, v) => n + (v ?? 0), 0);
  const itemsDone = b.steps.reduce((n, x) => n + (totals[x.key] != null ? (x.state === 'DONE' ? totals[x.key]! : x.state === 'RUNNING' ? Math.min(x.count, totals[x.key]!) : 0) : 0), 0);
  const updatedTime = new Date(q.dataUpdatedAt || Date.now()).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
  const doneSteps = b.steps.filter(x => x.state === 'DONE' || x.state === 'SKIPPED').length;
  const pctDone = itemTotal ? (itemsDone / itemTotal) * 100 : b.steps.length ? (doneSteps / b.steps.length) * 100 : 0;
  const startedAt = b.started_at ? new Date(b.started_at) : null;
  const startedTime = startedAt && !isNaN(startedAt.getTime())
    ? startedAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }) : null;

  const cutoverCard = (
      <AcctCard
        title="Start date"
        description={`TruckWys sends everything dated from here on to ${cfg.short}. Earlier documents are assumed to be in your books already.`}
      >
        <div className="acct-cutover">
          <div className="acct-cutover__date">
            {locked ? (
              <>
                <div className="acct-big-date">{formatDate(b.cutover_date)}<StatusChip tone="neutral" label="Locked" size="sm" className="acct-lock-chip" /></div>
              </>
            ) : (
              <>
                <label htmlFor="acct-cutover" className="acct-sr">Start date</label>
                <DatePicker id="acct-cutover" value={date} onChange={setDate} />
              </>
            )}
            <p className="acct-section-desc" style={{ margin: '6px 0 0' }}>
              {locked ? 'It can’t be changed once sending has started.' : 'Usually the first day of a month or VAT period still open in your books.'}
              {!locked && !date && (
                <> <button type="button" className="acct-linkbtn" onClick={() => setDate(firstOfMonth())}>Use {formatDate(firstOfMonth())}</button></>
              )}
            </p>
          </div>
        </div>

        {locked ? null : (
          <>
            <div className="acct-field-label" style={{ marginTop: 20 }}>
              {previewDate ? `What will be sent, from ${formatDate(previewDate)}` : 'What will be sent'}
            </div>
            {p ? (
              <div className="acct-tiles">
                <div><span>Invoices</span><strong>{p.invoices.toLocaleString('en-ZA')}</strong></div>
                <div><span>Credit notes</span><strong>{p.credit_notes.toLocaleString('en-ZA')}</strong></div>
                <div><span>Supplier bills</span><strong>{p.bills.toLocaleString('en-ZA')}</strong></div>
                <div><span>Recorded payments</span><strong>{p.historic_receipts.toLocaleString('en-ZA')}</strong></div>
              </div>
            ) : (
              <p className="acct-section-desc" style={{ margin: 0 }}>Choose a date to see the counts.</p>
            )}
          </>
        )}
        {!locked && p && p.historic_receipts > 0 && (
          <p className="acct-section-desc" style={{ margin: '8px 0 0' }}>
            Payments already recorded in TruckWys go into the bank account chosen under{' '}
            <button type="button" className="acct-linkbtn" onClick={() => onOpen('mapping')}>Mapping</button>.
          </p>
        )}

        {!locked && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 20 }}>
            {(reasons.length > 0 || error) && (
              <div style={{ marginRight: 'auto', minWidth: 0 }} role={error ? 'alert' : undefined}>
                {error ? <p className="acct-error" style={{ margin: 0 }}>{error}</p> : (
                  <ul className="acct-section-desc" style={{ margin: 0, paddingLeft: 18 }}>
                    {reasons.map(x => <li key={x}>{x}</li>)}
                  </ul>
                )}
              </div>
            )}
            <button type="button" className="tw-btn tw-btn--primary" onClick={start} disabled={!canStart}>
              {starting ? 'Starting…' : b.state === 'FAILED' ? 'Try again' : `Start sending to ${cfg.short}`}
            </button>
          </div>
        )}
      </AcctCard>
  );

  const progressCard = (b.state !== 'NOT_STARTED' || b.steps.some(x => x.state !== 'PENDING')) && (
        <AcctCard
          title={running ? `Sending history to ${cfg.short}` : 'Progress'}
          description={running
            ? <>{`${b.cutover_date ? `Everything from ${formatDate(b.cutover_date)}. ` : ''}${startedAt ? `Started ${formatRelativeTime(b.started_at!).toLowerCase()}` : 'Started'} · updated ${formatRelativeTime(new Date(q.dataUpdatedAt || Date.now())).toLowerCase()}. You can leave this page; sending carries on.`}
          <div className="acct-progress acct-progress--head" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pctDone)}
            aria-label={itemTotal ? `${itemsDone} of ${itemTotal} documents sent` : `${doneSteps} of ${b.steps.length} steps done`}>
            <div className="acct-progress__bar"><span style={{ width: `${pctDone}%` }} /></div>
            <span className="acct-progress__text">
              {itemTotal ? `${itemsDone.toLocaleString('en-ZA')} of ${itemTotal.toLocaleString('en-ZA')} sent` : `${doneSteps} of ${b.steps.length} steps`}
            </span>
          </div>
            </>
            : done
              ? `Finished ${b.finished_at ? formatDateTime(b.finished_at) : ''}.`
              : b.state === 'FAILED' ? 'Stopped. Fix what the failed step says, then try again.' : undefined}
          actions={done ? <StatusChip tone="success" label="Done" /> : b.state === 'FAILED' ? <StatusChip tone="danger" label="Stopped" /> : undefined}
          flush
        >
          <ol className="acct-steps">
            {b.steps.map(x => (
              <li key={x.key} className={x.state === 'RUNNING' ? 'is-running' : undefined}>
                <StepIcon look={STEP_LOOK[x.state] ?? 'todo'} />
                <div style={{ minWidth: 0 }}>
                  <div className="acct-check__title">{STEP_LABEL[x.key]?.(cfg.short) ?? x.label}</div>
                  {x.error && <div className="acct-error" style={{ marginTop: 0 }}>{x.error}</div>}
                  {x.state === 'SKIPPED' && <div className="acct-check__desc">Nothing to do</div>}
                </div>
                <span className="acct-steps__count">
                  {stepCount(x)}
                </span>
              </li>
            ))}
          </ol>
        </AcctCard>
  );

  // While it runs, progress is what people came to see: it goes first.
  return running ? <>{progressCard}{cutoverCard}</> : <>{cutoverCard}{progressCard}</>;
}
