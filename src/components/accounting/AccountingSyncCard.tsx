import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
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
          <dt>Last sent successfully</dt>
          <dd>{sync.last_synced_at ? formatDateTime(sync.last_synced_at) : 'Not yet'}</dd>
        </div>
      </dl>
      {sync.last_error && (sync.status === 'ERROR' || sync.status === 'DEAD' || sync.status === 'BLOCKED') && (
        <p className="acct-sync-err" role="status">Latest attempt failed: {sync.last_error}</p>
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
 * Top of the Payments card while an accounting system owns payments: where
 * to record them, and that they come back here on their own.
 */
export function PaymentsManagedNote({ providerName, recordUrl }: { providerName: string; recordUrl: string | null }) {
  return (
    <div className="acct-managed">
      <p>Record payments in {providerName}. They show here, with the balance updated, after the next sync.</p>
      {recordUrl && (
        <a href={recordUrl} target="_blank" rel="noopener noreferrer" className="tw-btn" style={{ width: '100%' }}>
          Record in {providerName}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

/** Above the document: this one didn't reach the accounting system, and where to fix it. */
export function AccountingSyncNotice({ sync, what }: { sync: AccountingSync | null | undefined; what: 'invoice' | 'credit note' }) {
  if (!sync || !['ERROR', 'DEAD', 'BLOCKED'].includes(sync.status)) return null;
  const name = providerConfig(sync.provider).short || sync.provider_name;
  const retrying = sync.status === 'ERROR';
  return (
    <div className="fl-notice fl-notice--warning" role="status">
      <AlertTriangle size={16} aria-hidden="true" />
      <div>
        <strong>{retrying ? `The latest update didn't reach ${name}; retrying` : `This ${what} isn't up to date in ${name}`}</strong>
        {sync.last_error || `${name} refused it.`}
      </div>
      <Link to="/settings/integrations/accounting?tab=sync" className="tw-btn fl-notice__action">Sync status</Link>
    </div>
  );
}

/** "From Xero" badge for a payment that came from the accounting system. */
export function PaymentSourceBadge({ source }: { source?: string | null }) {
  if (!source || source === 'MANUAL') return null;
  const label = source === 'BANK' ? 'From bank feed' : `From ${providerConfig(source).short}`;
  return <span className="acct-source-badge">{label}</span>;
}
