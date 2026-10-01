import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDate } from '@/lib/formatters';
import { providerConfig, type AccountingSync } from '@/lib/accounting';
import { documentSyncChip } from './connectionStatus';
import './accounting.css';

/**
 * Rail card on invoice and credit note detail: where this document stands in
 * the accounting system (status, its number there, a link, the last error).
 */
export function AccountingSyncCard({ sync, what, localNumber }: { sync: AccountingSync | null | undefined; what: 'invoice' | 'credit note'; localNumber?: string }) {
  if (!sync) return null;
  const cfg = providerConfig(sync.provider);
  const name = cfg.short || sync.provider_name;
  const chip = documentSyncChip(sync.status);
  const titleId = `acct-sync-${what.replace(' ', '-')}`;
  return (
    <section className="card acct-sync-card" aria-labelledby={titleId}>
      <div className="fin-panel-head" style={{ marginBottom: 4 }}>
        <div className="fin-panel-head__text" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
          <h2 id={titleId} className="fin-panel-title">{name}</h2>
          <StatusChip tone={chip.tone} label={chip.label} size="sm" />
        </div>
      </div>
      <dl className="fin-dl">
        {/* Only when it differs from ours (it usually doesn't). */}
        {sync.external_number && sync.external_number !== localNumber && (
          <div className="fin-dl__row">
            <dt>Number in {name}</dt>
            <dd>{sync.external_number}</dd>
          </div>
        )}
        {(sync.status === 'ERROR' || sync.status === 'DEAD' || sync.status === 'BLOCKED') && (
          <div className="fin-dl__row">
            <dt>Latest change</dt>
            <dd>Not sent yet</dd>
          </div>
        )}
        <div className="fin-dl__row">
          <dt>{sync.status === 'SYNCED' ? 'Last sent' : 'Last sent successfully'}</dt>
          <dd style={{ whiteSpace: 'nowrap' }}>{sync.last_synced_at ? formatDate(sync.last_synced_at) : sync.status === 'PENDING' ? 'Not sent yet' : 'Not yet'}</dd>
        </div>
      </dl>
      {sync.url && (
        <a href={sync.url} target="_blank" rel="noopener noreferrer" className="tw-btn tw-btn--sm" style={{ marginTop: 12, alignSelf: 'flex-start' }}>
          Open {what} in {name}
          <ExternalLink size={12} aria-hidden="true" />
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
      {recordUrl && (
        <a href={recordUrl} target="_blank" rel="noopener noreferrer" className="tw-btn tw-btn--sm acct-record-btn">
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
        <strong>{retrying ? `Last change didn't reach ${name}` : `This ${what} isn't up to date in ${name}`}</strong>
        {(sync.last_error || `${name} refused it`).replace(/\.$/, '')}. {retrying ? "We'll keep retrying; it goes through once that's fixed." : 'Fix it, then retry from the sync page.'}
      </div>
      <Link to={`/settings/integrations/accounting?tab=${/account|tax|vat|tracking/i.test(sync.last_error) ? 'mapping' : 'sync'}`} className="tw-btn fl-notice__action">
        {/account|tax|vat|tracking/i.test(sync.last_error) ? 'Fix in Accounts and VAT' : 'View sync issue'}
      </Link>
    </div>
  );
}

/**
 * Where a payment came from, tagged only when it's the exception: while an
 * accounting system owns payments, the ones entered in TruckWys before; else
 * the ones that came from the accounting system.
 */
export function PaymentSourceBadge({ source, managed = false }: { source?: string | null; managed?: boolean }) {
  const manual = !source || source === 'MANUAL';
  if (managed) return <span className="acct-source-note">{manual ? 'Recorded in TruckWys' : `From ${source === 'BANK' ? 'bank feed' : providerConfig(source).short}`}</span>;
  if (manual) return null;
  const label = source === 'BANK' ? 'From bank feed' : `From ${providerConfig(source).short}`;
  return <span className="acct-source-badge">{label}</span>;
}
