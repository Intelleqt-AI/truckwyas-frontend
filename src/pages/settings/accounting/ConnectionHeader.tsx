import { useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { StatusChip } from '@/components/ui/StatusChip';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ProviderLogo } from '@/components/accounting/ProviderLogo';
import { startConnect } from '@/components/accounting/AccountingProviderCards';
import { connectionChip } from '@/components/accounting/connectionStatus';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import {
  ACCT_KEYS, accountingApi, apiMessage, invalidateAccounting, providerConfig, type Connection,
} from '@/lib/accounting';
import { settingsCardStyle } from '../settingsUi';
import RowActions from '@/components/ui/RowActions';
import { SkelLine, useAccountingPermissions } from './shared';

/** Org name, status, who connected it and when, and the connection's actions. */
export function ConnectionHeader({ connection }: { connection: Connection }) {
  const qc = useQueryClient();
  const { canWrite, writeTitle } = useAccountingPermissions();
  const cfg = providerConfig(connection.provider);
  const chip = connectionChip(connection.status, connection.readiness?.sync_enabled ?? true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<'disconnect' | 'reconnect' | null>(null);

  const disconnect = async () => {
    setConfirming(false);
    setBusy('disconnect');
    try {
      await accountingApi.disconnect();
      toast.success(`${cfg.short} disconnected. Record payments in TruckWys again from now on.`);
      invalidateAccounting(qc);
    } catch (e) {
      toast.error(apiMessage(e, `Couldn't disconnect ${cfg.short}. Try again.`));
    } finally {
      setBusy(null);
    }
  };

  const reconnect = async () => {
    setBusy('reconnect');
    await startConnect(cfg.slug, cfg.short);
    setBusy(null);
  };

  const pending = connection.status === 'PENDING_ORG';

  return (
    <section style={{ ...settingsCardStyle, padding: 'var(--card-pad, 20px)' }} aria-labelledby="acct-conn-title">
      {confirming && (
        <ConfirmModal
          title={`Disconnect ${cfg.short}?`}
          message={`Payments will need to be recorded in TruckWys again. Nothing in ${cfg.short} is deleted, and the sync history stays here. You can connect again later.`}
          confirmLabel={`Disconnect ${cfg.short}`}
          danger
          onConfirm={disconnect}
          onCancel={() => setConfirming(false)}
        />
      )}
      <div className="acct-head">
        <ProviderLogo provider={connection.provider} />
        <div className="acct-head__main">
          <h2 id="acct-conn-title" className="acct-head__name">
            {pending ? `${cfg.short} organisation` : connection.tenant_name || `${cfg.short} organisation`}
          </h2>
          {/* The status always sits on the caption line, in the same place in every state. */}
          <p className="acct-head__caption">
            <span>{cfg.name}</span>
            <StatusChip tone={chip.tone} label={chip.label} size="sm" />
          </p>
        </div>
        {(connection.web_url && !pending) || connection.status === 'NEEDS_REAUTH' ? (
          <div className="acct-head__actions">
            {connection.status === 'NEEDS_REAUTH' && (
              <button type="button" className="tw-btn tw-btn--primary" onClick={reconnect} disabled={!canWrite || busy !== null} title={writeTitle}>
                {busy === 'reconnect' ? 'Opening…' : `Reconnect ${cfg.short}`}
              </button>
            )}
            {connection.web_url && !pending && (
              <a href={connection.web_url} target="_blank" rel="noopener noreferrer" className="tw-btn">
                Open in {cfg.short}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
          </div>
        ) : null}
        {canWrite && (
          <div className="acct-head__menu">
            <RowActions
              label={`${cfg.short} connection`}
              items={[{
                label: busy === 'disconnect' ? 'Disconnecting…' : pending ? 'Cancel connection' : `Disconnect ${cfg.short}`,
                onSelect: () => setConfirming(true),
                disabled: busy !== null,
                danger: true,
              }]}
            />
          </div>
        )}
      </div>

      {connection.status === 'NEEDS_REAUTH' && (
        <div className="acct-notice acct-notice--danger" role="status" style={{ margin: '16px 0 0' }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <strong>{connection.status_reason || `Your ${cfg.short} sign-in has expired.`}</strong>
            An admin needs to sign in to {cfg.short} again. Nothing is sent or fetched until then.
          </div>
        </div>
      )}

      {!pending && (
        <dl className="acct-facts">
          <div><dt>Connected by</dt><dd>{connection.connected_by || '—'}</dd></div>
          <div><dt>Connected on</dt><dd>{connection.connected_at ? formatDate(connection.connected_at) : '—'}</dd></div>
          <div><dt>Base currency</dt><dd>{connection.base_currency || '—'}</dd></div>
          <div><dt>Cut-over date</dt><dd>{connection.cutover_date ? formatDate(connection.cutover_date) : 'Not chosen'}</dd></div>
          <div><dt>Payments last fetched</dt><dd>{connection.last_payment_sync_at ? formatDateTime(connection.last_payment_sync_at) : 'Not yet'}</dd></div>
          <div><dt>Last reconciled</dt><dd>{connection.last_reconciled_at ? formatDateTime(connection.last_reconciled_at) : 'Not yet'}</dd></div>
        </dl>
      )}
    </section>
  );
}

/** Same box as ConnectionHeader while the connection loads. */
export function ConnectionHeaderSkeleton() {
  return (
    <section style={{ ...settingsCardStyle, padding: 'var(--card-pad, 20px)' }} aria-busy="true" aria-label="Loading your accounting connection" role="status">
      <div className="acct-head">
        <span className="acct-logo" aria-hidden="true" />
        <div className="acct-head__main">
          <SkelLine width="55%" lineHeight={24} />
          <SkelLine width="30%" lineHeight={22} />
        </div>
        <div className="acct-head__actions"><span className="tw-btn" style={{ width: 120, visibility: 'hidden' }} aria-hidden="true" /></div>
      </div>
      <dl className="acct-facts">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i}><dt><SkelLine width={90} /></dt><dd><SkelLine width={110 - (i % 3) * 15} /></dd></div>
        ))}
      </dl>
    </section>
  );
}

/** PENDING_ORG: the login sees several organisations; pick the one with this company's books. */
export function OrgPicker({ connection }: { connection: Connection }) {
  const qc = useQueryClient();
  const { canWrite, writeTitle } = useAccountingPermissions();
  const cfg = providerConfig(connection.provider);
  const tenants = connection.pending_tenants ?? [];
  const isZar = (c: string) => !c || c.toUpperCase() === 'ZAR';
  const eligible = tenants.filter(t => isZar(t.currency));
  // One organisation that can be linked: choose it for them.
  const [choice, setChoice] = useState<string>(eligible.length === 1 ? eligible[0].tenant_id : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!choice) return;
    setBusy(true); setError('');
    try {
      const updated = await accountingApi.selectOrg(choice);
      qc.setQueryData(ACCT_KEYS.connection, updated);
      invalidateAccounting(qc);
      toast.success(`${updated.tenant_name || 'Organisation'} linked`);
    } catch (e) {
      setError(apiMessage(e, "Couldn't link that organisation. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={settingsCardStyle} aria-labelledby="acct-org-title">
      <div style={{ padding: '16px var(--card-pad, 20px)', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 id="acct-org-title" style={{ margin: 0, font: '600 16px/24px var(--font-sans)', color: 'var(--text-primary)' }}>Choose your {cfg.short} organisation</h2>
        <p className="acct-section-desc" style={{ margin: '2px 0 0' }}>
          Pick the organisation that holds this company's books. Only organisations that keep their books in rand (ZAR) can be linked.
        </p>
      </div>
      {tenants.length === 0 ? (
        <div className="acct-empty">No organisations came back from {cfg.short}. Cancel the connection and try again.</div>
      ) : (
        <div role="radiogroup" aria-labelledby="acct-org-title">
          {tenants.map(t => {
            const notZar = !isZar(t.currency);
            const selected = choice === t.tenant_id;
            return (
              <label key={t.tenant_id} className={`acct-row acct-org${selected ? ' is-selected' : ''}${notZar ? ' is-disabled' : ''}`}>
                <input
                  type="radio"
                  name="acct-org"
                  className="acct-radio"
                  value={t.tenant_id}
                  checked={selected}
                  onChange={() => setChoice(t.tenant_id)}
                  disabled={!canWrite || notZar}
                />
                <span style={{ minWidth: 0 }}>
                  <span className="acct-row__title" style={{ display: 'block' }}>{t.name}</span>
                  <span className="acct-row__sub">{notZar ? `Can't be linked: books in ${t.currency}` : `Books in ${t.currency || 'ZAR'}`}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}
      <div style={{ padding: '16px var(--card-pad, 20px)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {error && <p className="acct-error" role="alert" style={{ margin: 0, marginRight: 'auto' }}>{error}</p>}
        {!canWrite && <p className="acct-section-desc" style={{ margin: 0, marginRight: 'auto' }}>{writeTitle}.</p>}
        <button type="button" className="tw-btn tw-btn--primary" onClick={submit} disabled={!canWrite || !choice || busy}>
          {busy ? 'Linking…' : 'Link organisation'}
        </button>
      </div>
    </section>
  );
}
