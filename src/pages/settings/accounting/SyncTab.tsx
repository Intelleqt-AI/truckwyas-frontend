import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { fetchData } from '@/lib/Api';
import { formatDateTime, formatRelativeTime } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import {
  ACCT_KEYS, ACCT_URL, OBJECT_TYPE_LABEL, accountingApi, apiMessage, humanise, providerConfig,
  type Connection, type LinkError, type SyncStatus,
} from '@/lib/accounting';
import { AcctCard, ErrorBlock, LoadingBlock, useAccountingPermissions } from './shared';
import type { AccountingTab } from './tabs';

// One vocabulary for failures, used in the list and the activity log.
const ERROR_META: Record<string, { tone: StatusTone; label: string }> = {
  ERROR: { tone: 'warning', label: 'Needs a fix' },
  DEAD: { tone: 'danger', label: 'Stopped retrying' },
  BLOCKED: { tone: 'neutral', label: 'Waiting on you' },
};
const LEVEL: Record<string, { tone: StatusTone; label: string }> = {
  INFO: { tone: 'success', label: 'Done' },
  WARNING: { tone: 'warning', label: 'Warning' },
  ERROR: { tone: 'warning', label: 'Failed' },
};
const OVERDUE_MS = 2 * 60 * 60 * 1000;

/** "in 4 min", "due now", "10:00 tomorrow", else the date and time. */
function nextTry(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins <= 0) return 'due now';
  if (mins < 60) return `in ${mins} min`;
  const time = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
  const day = (x: Date) => x.toLocaleDateString('en-CA');
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (day(d) === day(now)) return `${time} today`;
  if (day(d) === day(tomorrow)) return `${time} tomorrow`;
  return formatDateTime(iso);
}

/** In-app link for a document, or plain text when the server has none. */
function DocLink({ url, children }: { url: string | null; children: React.ReactNode }) {
  if (!url) return <>{children}</>;
  return /^https?:/.test(url)
    ? <a className="acct-link" href={url} target="_blank" rel="noopener noreferrer">{children}</a>
    : <Link className="acct-link" to={url}>{children}</Link>;
}

/** Counts, what failed (with retry), and the recent activity log. */
export function SyncTab({ connection, onOpen }: { connection: Connection; onOpen?: (tab: AccountingTab) => void }) {
  const qc = useQueryClient();
  const cfg = providerConfig(connection.provider);
  const { canWrite, writeTitle } = useAccountingPermissions();
  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);

  const q = useQuery<SyncStatus>({
    queryKey: ACCT_KEYS.sync,
    queryFn: () => fetchData(ACCT_URL.sync),
    retry: 1,
    // Queued work drains in the background: keep the numbers fresh while it does.
    refetchInterval: query => ((query.state.data?.counts.queued ?? 0) > 0 ? 10_000 : false),
  });

  const syncNow = async () => {
    setSyncing(true);
    try {
      await accountingApi.syncNow();
      toast.success(`Fetching payments from ${cfg.short}. New payments show on invoices within a minute.`);
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ACCT_KEYS.sync });
        qc.invalidateQueries({ queryKey: ACCT_KEYS.connection });
      }, 5000);
    } catch (e) {
      toast.error(apiMessage(e, `Couldn't reach ${cfg.short}. Try again.`));
    } finally {
      setSyncing(false);
    }
  };

  const retry = async (row: LinkError) => {
    setRetrying(row.id);
    try {
      const updated = await accountingApi.retry(row.id);
      qc.setQueryData<SyncStatus>(ACCT_KEYS.sync, old =>
        old ? { ...old, errors: old.errors.map(e => (e.id === updated.id ? updated : e)) } : old);
      toast.success(`${row.label} queued to send again`);
      qc.invalidateQueries({ queryKey: ACCT_KEYS.sync });
    } catch (e) {
      toast.error(apiMessage(e, `Couldn't retry ${row.label}.`));
    } finally {
      setRetrying(null);
    }
  };

  if (q.isLoading) return <AcctCard title="Sync"><LoadingBlock label="Loading sync status" /></AcctCard>;
  if (q.isError || !q.data) return <AcctCard title="Sync"><ErrorBlock message={apiMessage(q.error, "Couldn't load the sync status.")} onRetry={() => q.refetch()} /></AcctCard>;

  const s = q.data;
  const c = s.counts;
  const lastFetch = s.last_payment_sync_at ? new Date(s.last_payment_sync_at).getTime() : null;
  const overdue = connection.status === 'ACTIVE' && connection.readiness.sync_enabled && (lastFetch == null || Date.now() - lastFetch > OVERDUE_MS);

  const attention = (
    <>
      <AcctCard title={s.errors.length ? <span className="acct-title-warn"><AlertTriangle size={16} aria-hidden="true" />Needs attention</span> : 'Needs attention'} description={s.errors.length ? "Fix the cause, then retry. We also retry on our own, up to 8 times." : undefined} flush>
        {s.errors.length === 0 ? (
          <div className="acct-empty">Nothing is stuck. Every document reached {cfg.short}.</div>
        ) : (
          <ul className="acct-list">
            {s.errors.map(e => {
              const meta = ERROR_META[e.status] ?? { tone: 'neutral' as StatusTone, label: humanise(e.status) };
              return (
                <li key={e.id} className="acct-row acct-row--error">
                  <div style={{ minWidth: 0 }}>
                    <div className="acct-row__title">{e.last_error || 'No reason given'}</div>
                    <div className="acct-row__sub" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      <span>{OBJECT_TYPE_LABEL[e.object_type] ?? humanise(e.object_type)} <DocLink url={e.local_url}>{e.label}</DocLink></span>
                      {e.status !== 'ERROR' && <StatusChip tone={meta.tone} label={meta.label} size="sm" />}
                      {e.status === 'ERROR' && e.next_attempt_at && <><span aria-hidden="true">·</span><span>{e.attempts} of 8 tries used, next {nextTry(e.next_attempt_at)}</span></>}
                    </div>
                  </div>
                  <div className="acct-row__actions">
                    {/* The usual cause is a mapping or a contact: fix that first, then retry. */}
                    {onOpen && /account|tax|vat|tracking/i.test(e.last_error) && (
                      <button type="button" className="tw-btn tw-btn--sm tw-btn--primary" onClick={() => onOpen('mapping')}>Fix account mapping</button>
                    )}
                    {onOpen && /contact/i.test(e.last_error) && (
                      <button type="button" className="tw-btn tw-btn--sm tw-btn--primary" onClick={() => onOpen('contacts')}>Fix in Contacts</button>
                    )}
                    {canWrite && (
                      <button type="button" className="tw-btn tw-btn--sm" onClick={() => retry(e)} disabled={retrying === e.id}>
                        {retrying === e.id ? 'Retrying…' : 'Retry now'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AcctCard>

    </>
  );

  return (
    <>
      {s.errors.length > 0 && attention}
      <AcctCard
        title={`Sync with ${cfg.short}`}
        description={<>
          Documents go to {cfg.short} as you create them; payments are fetched every few minutes.
          {!overdue && s.last_payment_sync_at && <> Last fetched {formatRelativeTime(s.last_payment_sync_at)}.</>}
          {overdue && (
            <span className="acct-hint is-required" style={{ display: 'flex', marginTop: 4 }}>
              Payment fetch is overdue: last fetched {s.last_payment_sync_at ? formatRelativeTime(s.last_payment_sync_at) : 'never'}.
            </span>
          )}
        </>}
        actions={
          <button type="button" className="tw-btn" onClick={syncNow} disabled={!canWrite || syncing || connection.status !== 'ACTIVE'} title={writeTitle}>
            <RefreshCw size={14} aria-hidden="true" className={syncing ? 'animate-spin' : undefined} />
            {syncing ? 'Asking…' : 'Fetch payments now'}
          </button>
        }
        flush
      >
        <div style={{ padding: 'var(--card-pad, 20px)' }}>
          <div className="acct-tiles">
            <div><span>Sent to {cfg.short}</span><strong>{c.synced.toLocaleString('en-ZA')}</strong></div>
            <div title="Waiting to send"><span>Waiting to send</span><strong className={c.queued ? undefined : 'is-zero'}>{c.queued.toLocaleString('en-ZA')}</strong></div>
            <div><span>{c.errors > 0 && <span className="acct-dot acct-dot--warning acct-dot--inline" aria-hidden="true" />}Needs a fix</span><strong className={c.errors ? undefined : 'is-zero'}>{c.errors.toLocaleString('en-ZA')}</strong></div>
            <div title="Stopped retrying after 8 tries; retry from the list above"><span>Stopped retrying</span><strong className={c.dead ? undefined : 'is-zero'}>{c.dead.toLocaleString('en-ZA')}</strong></div>
          </div>
        </div>
      </AcctCard>

      {s.errors.length === 0 && attention}
      <AcctCard title="Recent activity" flush>
        {s.recent.length === 0 ? (
          <div className="acct-empty">No activity yet.</div>
        ) : (
          <ul className="acct-list">
            {[...s.recent].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(ev => (
              <li key={ev.id} className="acct-row acct-row--event">
                <span className={`acct-dot acct-dot--${(LEVEL[ev.level] ?? LEVEL.INFO).tone}`} title={(LEVEL[ev.level] ?? LEVEL.INFO).label} aria-label={(LEVEL[ev.level] ?? LEVEL.INFO).label} role="img" />
                <div style={{ minWidth: 0 }}>
                  <div className="acct-row__title" style={{ fontWeight: 400 }}>
                    {ev.level !== 'INFO' && <span className="acct-event-flag">{(LEVEL[ev.level] ?? LEVEL.INFO).label}: </span>}{ev.label ? <><DocLink url={ev.local_id ? (/CREDIT_NOTE/.test(ev.object_type) ? `/finance/credit-notes/${ev.local_id}` : /INVOICE/.test(ev.object_type) ? `/finance/invoices/${ev.local_id}` : null) : null}>{ev.label}</DocLink> · </> : null}{ev.message || humanise(ev.action)}
                  </div>
                </div>
                <span className="acct-event-time" title={formatDateTime(ev.created_at)}>{formatRelativeTime(ev.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </AcctCard>
    </>
  );
}
