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
  const failing = ['ERROR', 'DEAD', 'BLOCKED'].includes(sync.status);
  return (
    <section className="card acct-sync-card" aria-labelledby={titleId}>
      <div className="fin-panel-head" style={{ marginBottom: 4 }}>
        <div className="fin-panel-head__text" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
          <h2 id={titleId} className="fin-panel-title">{name}</h2>
          {/* A failure is already the banner above the invoice: the card stays factual. */}
          <StatusChip tone={chip.tone} label={chip.label} size="sm" />
        </div>
      </div>
      {failing ? (
        // Something didn't go through: one plain sentence instead of label/value rows.
        <p className="acct-sync-line">
          {sync.status === 'BLOCKED'
            ? `Waiting on you before it can go to ${name}.`
            : `Last sent ${sync.last_synced_at ? formatDate(sync.last_synced_at) : 'never'}`}
        </p>
      ) : (
        <dl className="fin-dl">
          {sync.external_number && sync.external_number !== localNumber && (
            <div className="fin-dl__row">
              <dt>Number in {name}</dt>
              <dd>{sync.external_number}</dd>
            </div>
          )}
          <div className="fin-dl__row">
            <dt>Last sent</dt>
            <dd style={{ whiteSpace: 'nowrap' }}>{sync.last_synced_at ? formatDate(sync.last_synced_at) : 'Not sent yet'}</dd>
          </div>
        </dl>
      )}
      {sync.url && (
        <a href={sync.url} target="_blank" rel="noopener noreferrer" className="acct-link acct-sync-open">
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
        <a href={recordUrl} target="_blank" rel="noopener noreferrer" className="tw-btn acct-record-btn">
          Record payment in {providerName}
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
    <div className="fl-notice fl-notice--warning acct-sync-notice" role="status">
      <AlertTriangle size={16} aria-hidden="true" />
      <div>
        <strong>{`Not up to date in ${name}`}</strong>
        {(sync.last_error || `${name} refused it`).replace(/\.$/, '')}. {retrying ? 'Fix the mapping and it sends on the next try.' : 'Fix it, then retry from the Sync tab.'}
      </div>
      <Link to={`/settings/integrations/accounting?tab=${/account|tax|vat|tracking/i.test(sync.last_error) ? 'mapping' : 'sync'}`} className="tw-btn fl-notice__action">
        {/account|tax|vat|tracking/i.test(sync.last_error) ? 'Fix account mapping' : 'View sync issue'}
      </Link>
    </div>
  );
}

/**
 * Where a payment came from, tagged only when it's the exception: while an
 * accounting system owns payments, the ones entered in TruckWys before; else
 * the ones that came from the accounting system.
 */
export function PaymentSourceBadge({ source, managed = false, externalId, providerName }: { source?: string | null; managed?: boolean; externalId?: string | null; providerName?: string }) {
  const manual = !source || source === 'MANUAL';
  if (managed) {
    // Its state in the accounting system: came from there, sent there, or only here.
    const where = providerName || (manual ? '' : providerConfig(source).short);
    const label = !manual ? (source === 'BANK' ? 'From bank feed' : `In ${providerConfig(source).short}`)
      : externalId ? `In ${where || 'your books'}` : 'Only in TruckWys';
    const local = manual && !externalId;
    return (
      <span className={`acct-source-note acct-source-note--line acct-paystate${local ? ' is-local' : ''}`}>
        <span className={`acct-dot acct-dot--inline ${local ? 'acct-dot--warning' : 'acct-dot--success'}`} aria-hidden="true" />{label}
        {local && <span className="acct-paystate__hint">Add it in {where || 'your books'} so both match.</span>}
      </span>
    );
  }
  if (manual) return null;
  const label = source === 'BANK' ? 'From bank feed' : `From ${providerConfig(source).short}`;
  return <span className="acct-source-badge">{label}</span>;
}
