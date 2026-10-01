import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@/components/ui/date-picker';
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

  return (
    <>
      <AcctCard
        title="Cut-over date"
        description={`From this date TruckWys sends every invoice, credit note and supplier bill to ${cfg.short}. Anything dated earlier is not sent: we assume it's already in your books.`}
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', alignItems: 'start' }}>
          <div>
            <label className="fin-label" htmlFor="acct-cutover" style={{ display: 'block', font: '500 13px/20px var(--font-sans)', color: 'var(--text-primary)', marginBottom: 6 }}>Cut-over date</label>
            {locked ? (
              <p style={{ margin: 0, font: '500 14px/40px var(--font-sans)', color: 'var(--text-primary)' }}>{formatDate(b.cutover_date)}</p>
            ) : (
              <DatePicker id="acct-cutover" value={date} onChange={setDate} />
            )}
            <p className="acct-section-desc" style={{ margin: '6px 0 0' }}>
              {locked ? "Can't be changed once the first send has started." : 'Usually the first day of a month or VAT period that is still open in your books.'}
            </p>
            {!locked && !date && (
              <button type="button" className="acct-linkbtn" style={{ font: '500 13px/20px var(--font-sans)', marginTop: 4 }} onClick={() => setDate(firstOfMonth())}>
                Use {formatDate(firstOfMonth())}
              </button>
            )}
          </div>
          <div>
            <div style={{ font: '500 13px/20px var(--font-sans)', color: 'var(--text-primary)', marginBottom: 6 }}>
              {previewDate ? `What will be sent (from ${formatDate(previewDate)})` : 'What will be sent'}
            </div>
            {p ? (
              <dl className="acct-facts" style={{ margin: 0, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div><dt>Invoices</dt><dd>{p.invoices.toLocaleString('en-ZA')}</dd></div>
                <div><dt>Credit notes</dt><dd>{p.credit_notes.toLocaleString('en-ZA')}</dd></div>
                <div><dt>Supplier bills</dt><dd>{p.bills.toLocaleString('en-ZA')}</dd></div>
                <div><dt>Payments recorded in TruckWys</dt><dd>{p.historic_receipts.toLocaleString('en-ZA')}</dd></div>
              </dl>
            ) : (
              <p className="acct-section-desc" style={{ margin: 0 }}>Choose a date to see the counts.</p>
            )}
            {p && p.historic_receipts > 0 && (
              <p className="acct-section-desc" style={{ margin: '8px 0 0' }}>
                Payments already recorded in TruckWys go into the bank account you chose under{' '}
                <button type="button" className="acct-linkbtn" onClick={() => onOpen('mapping')}>Accounts and VAT</button>.
              </p>
            )}
          </div>
        </div>

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

      {(b.state !== 'NOT_STARTED' || b.steps.some(s => s.state !== 'PENDING')) && (
        <AcctCard
          title="Progress"
          description={running
            ? `Working… this page updates every few seconds. You can leave it; the send carries on.`
            : done
              ? `Finished ${b.finished_at ? formatDateTime(b.finished_at) : ''}.`
              : b.state === 'FAILED' ? 'Stopped. Fix what the failed step says, then try again.' : undefined}
          flush
        >
          <ol className="acct-steps">
            {b.steps.map(s => (
              <li key={s.key}>
                <StepIcon look={STEP_LOOK[s.state] ?? 'todo'} />
                <div style={{ minWidth: 0 }}>
                  <div className="acct-check__title">{s.label}</div>
                  {s.error && <div className="acct-error" style={{ marginTop: 0 }}>{s.error}</div>}
                  {s.state === 'SKIPPED' && <div className="acct-check__desc">Nothing to do</div>}
                </div>
                <span className="acct-steps__count">{s.count > 0 ? s.count.toLocaleString('en-ZA') : ''}</span>
              </li>
            ))}
          </ol>
        </AcctCard>
      )}
    </>
  );
}
