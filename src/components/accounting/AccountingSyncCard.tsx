import { ExternalLink } from 'lucide-react';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDateTime } from '@/lib/formatters';
import { providerConfig, type AccountingSync } from '@/lib/accounting';
import { documentSyncChip } from './connectionStatus';
import './accounting.css';

/**
 * Rail card on invoice and credit note detail: where this document stands in
 * the accounting system (status, its number there, a link, the last error).
 */
export function AccountingSyncCard({ sync, what }: { sync: AccountingSync | null | undefined; what: 'invoice' | 'credit note' }) {
  if (!sync) return null;
  const cfg = providerConfig(sync.provider);
  const name = cfg.short || sync.provider_name;
  const chip = documentSyncChip(sync.status);
  const titleId = `acct-sync-${what.replace(' ', '-')}`;
  return (
    <section className="card acct-sync-card" aria-labelledby={titleId}>
      <div className="fin-panel-head" style={{ marginBottom: 4 }}>
        <div className="fin-panel-head__text">
          <h2 id={titleId} className="fin-panel-title">{name}</h2>
        </div>
        <StatusChip tone={chip.tone} label={chip.label} size="sm" />
      </div>
      <dl className="fin-dl">
        <div className="fin-dl__row">
          <dt>Number in {name}</dt>
          <dd>{sync.external_number || (sync.status === 'PENDING' ? 'Not sent yet' : '—')}</dd>
        </div>
        <div className="fin-dl__row">
          <dt>Last sent</dt>
          <dd>{sync.last_synced_at ? formatDateTime(sync.last_synced_at) : 'Not yet'}</dd>
        </div>
      </dl>
      {sync.last_error && (sync.status === 'ERROR' || sync.status === 'DEAD' || sync.status === 'BLOCKED') && (
        <p className="acct-sync-err" role="status">{sync.last_error}</p>
      )}
      {sync.url && (
        <a href={sync.url} target="_blank" rel="noopener noreferrer" className="tw-btn" style={{ width: '100%', marginTop: 12 }}>
          Open {what} in {name}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
    </section>
  );
}

/**
 * Shown where payments would be recorded while an accounting system owns
 * them: one button that opens the invoice in that system, and why.
 */
export function PaymentsManagedPanel({ providerName, recordUrl }: { providerName: string; recordUrl: string | null }) {
  return (
    <section className="card" aria-labelledby="acct-managed-title">
      <div className="fin-panel-head">
        <div className="fin-panel-head__text">
          <h2 id="acct-managed-title" className="fin-panel-title">Record a payment</h2>
          <p className="fin-panel-desc">Payments sync from {providerName} automatically.</p>
        </div>
      </div>
      <p className="fin-help" style={{ margin: '0 0 12px' }}>
        Record this payment in {providerName}. It shows here, with the balance updated, after the next sync.
      </p>
      {recordUrl ? (
        <a href={recordUrl} target="_blank" rel="noopener noreferrer" className="tw-btn" style={{ width: '100%' }}>
          Record in {providerName}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      ) : (
        <button type="button" className="tw-btn" style={{ width: '100%' }} disabled title={`This invoice hasn't reached ${providerName} yet`}>
          Record in {providerName}
        </button>
      )}
    </section>
  );
}

/** "From Xero" badge for a payment that came from the accounting system. */
export function PaymentSourceBadge({ source }: { source?: string | null }) {
  if (!source || source === 'MANUAL') return null;
  const label = source === 'BANK' ? 'From bank feed' : `From ${providerConfig(source).short}`;
  return <span className="acct-source-badge">{label}</span>;
}
