import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@/components/ui/date-picker';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { fetchData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import {
  ACCT_KEYS, ACCT_URL, accountingApi, apiMessage, invalidateAccounting, providerConfig,
  type Backfill, type Connection, type StepState,
} from '@/lib/accounting';
import { AcctCard, ErrorBlock, LoadingBlock, StepIcon, plural, useAccountingPermissions, type StepLook } from './shared';
import type { AccountingTab } from './tabs';

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

  if (q.isLoading) return <AcctCard title="Cut-over date"><LoadingBlock label="Loading cut-over" /></AcctCard>;
  if (q.isError || !b) return <AcctCard title="Cut-over date"><ErrorBlock message={apiMessage(q.error, "Couldn't load the cut-over status.")} onRetry={() => q.refetch()} /></AcctCard>;

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
  if (!date) reasons.push('Choose a cut-over date');
  const canStart = reasons.length === 0 && !locked && !starting;

  const start = async () => {
    if (!canStart) return;
    setStarting(true); setError('');
    try {
      const res = await accountingApi.startBackfill(date);
      qc.setQueryData([...ACCT_KEYS.backfill, date], res);
      qc.invalidateQueries({ queryKey: ACCT_KEYS.connection });
    } catch (e) {
      setError(apiMessage(e, "Couldn't start. Try again."));
    } finally {
      setStarting(false);
    }
  };

  const previewDate = b.cutover_date ?? date;
  const doneSteps = b.steps.filter(x => x.state === 'DONE' || x.state === 'SKIPPED').length;
  const startedAt = b.started_at ? new Date(b.started_at) : null;
  const startedTime = startedAt && !isNaN(startedAt.getTime())
    ? startedAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }) : null;

  return (
    <>
      <AcctCard
        title="Cut-over date"
        description={`From this date TruckWys sends every invoice, credit note and supplier bill to ${cfg.short}. Anything dated earlier is not sent: we assume it's already in your books.`}
      >
        <div className="acct-cutover">
          <div className="acct-cutover__date">
            {locked ? (
              <dl className="acct-facts" style={{ margin: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <div><dt>Cut-over date</dt><dd>{formatDate(b.cutover_date)}</dd></div>
              </dl>
            ) : (
              <>
                <label htmlFor="acct-cutover" className="acct-field-label">Cut-over date</label>
                <DatePicker id="acct-cutover" value={date} onChange={setDate} />
              </>
            )}
            <p className="acct-section-desc" style={{ margin: '6px 0 0' }}>
              {locked ? "Locked once the first send has started." : 'Usually the first day of a month or VAT period still open in your books.'}
              {!locked && !date && (
                <> <button type="button" className="acct-linkbtn" onClick={() => setDate(firstOfMonth())}>Use {formatDate(firstOfMonth())}</button></>
              )}
            </p>
          </div>
        </div>

        <div className="acct-field-label" style={{ marginTop: 20 }}>
          {previewDate ? `What will be sent, from ${formatDate(previewDate)}` : 'What will be sent'}
        </div>
        {p ? (
          <div className="acct-tiles">
            <div><span>Invoices</span><strong>{p.invoices.toLocaleString('en-ZA')}</strong></div>
            <div><span>Credit notes</span><strong>{p.credit_notes.toLocaleString('en-ZA')}</strong></div>
            <div><span>Supplier bills</span><strong>{p.bills.toLocaleString('en-ZA')}</strong></div>
            <div><span>Earlier payments</span><strong>{p.historic_receipts.toLocaleString('en-ZA')}</strong></div>
          </div>
        ) : (
          <p className="acct-section-desc" style={{ margin: 0 }}>Choose a date to see the counts.</p>
        )}
        {p && p.historic_receipts > 0 && (
          <p className="acct-section-desc" style={{ margin: '8px 0 0' }}>
            Earlier payments are payments already recorded in TruckWys. They go into the bank account chosen under{' '}
            <button type="button" className="acct-linkbtn" onClick={() => onOpen('mapping')}>Accounts and VAT</button>.
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

      {(b.state !== 'NOT_STARTED' || b.steps.some(x => x.state !== 'PENDING')) && (
        <AcctCard
          title="Progress"
          description={running
            ? 'You can leave this page; sending carries on.'
            : done
              ? `Finished ${b.finished_at ? formatDateTime(b.finished_at) : ''}.`
              : b.state === 'FAILED' ? 'Stopped. Fix what the failed step says, then try again.' : undefined}
          actions={running
            ? <StatusChip tone="info" label={startedTime ? `Sending · started ${startedTime}` : 'Sending'} />
            : done ? <StatusChip tone="success" label="Done" /> : b.state === 'FAILED' ? <StatusChip tone="danger" label="Stopped" /> : undefined}
          flush
        >
          <div className="acct-progress" role="progressbar" aria-valuemin={0} aria-valuemax={b.steps.length} aria-valuenow={doneSteps}
            aria-label={`${doneSteps} of ${b.steps.length} steps done`}>
            <div className="acct-progress__bar"><span style={{ width: `${b.steps.length ? (doneSteps / b.steps.length) * 100 : 0}%` }} /></div>
            <span className="acct-progress__text">{doneSteps} of {b.steps.length} steps</span>
          </div>
          <ol className="acct-steps">
            {b.steps.map(x => (
              <li key={x.key}>
                <StepIcon look={STEP_LOOK[x.state] ?? 'todo'} />
                <div style={{ minWidth: 0 }}>
                  <div className="acct-check__title">{x.label}</div>
                  {x.error && <div className="acct-error" style={{ marginTop: 0 }}>{x.error}</div>}
                  {x.state === 'SKIPPED' && <div className="acct-check__desc">Nothing to do</div>}
                </div>
                <span className="acct-steps__count">
                  {x.count > 0 ? `${x.count.toLocaleString('en-ZA')} ${x.state === 'RUNNING' ? 'so far' : 'done'}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </AcctCard>
      )}
    </>
  );
}
