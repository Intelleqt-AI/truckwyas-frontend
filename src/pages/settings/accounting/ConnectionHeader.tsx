import { useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { StatusChip } from '@/components/ui/StatusChip';
import { ConfirmModal } from '@/components/ConfirmModal';
import RowActions, { type RowActionItem } from '@/components/ui/RowActions';
import { ProviderLogo } from '@/components/accounting/ProviderLogo';
import { startConnect } from '@/components/accounting/AccountingProviderCards';
import { connectionChip } from '@/components/accounting/connectionStatus';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import {
  ACCT_KEYS, accountingApi, apiMessage, invalidateAccounting, providerConfig, type Connection,
} from '@/lib/accounting';
import { settingsCardStyle } from '../settingsUi';
import { SkelLine, useAccountingPermissions } from './shared';

/** Disconnect (or cancel a half-finished connection) behind a confirm dialog. */
function useDisconnect(connection: Connection) {
  const qc = useQueryClient();
  const cfg = providerConfig(connection.provider);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = connection.status === 'PENDING_ORG';
  const run = async () => {
    setConfirming(false);
    setBusy(true);
    try {
      await accountingApi.disconnect();
      toast.success(pending ? 'Connection cancelled' : `${cfg.short} disconnected. Record payments in TruckWys again from now on.`);
      invalidateAccounting(qc);
    } catch (e) {
      toast.error(apiMessage(e, `Couldn't disconnect ${cfg.short}. Try again.`));
    } finally {
      setBusy(false);
    }
  };
  const modal = confirming ? (
    <ConfirmModal
      title={pending ? 'Cancel this connection?' : `Disconnect ${cfg.short}?`}
      message={pending
        ? `Nothing has been linked yet. You can connect again with a different ${cfg.short} login.`
        : `Payments will need to be recorded in TruckWys again. Nothing in ${cfg.short} is deleted, and the sync history stays here. You can connect again later.`}
      confirmLabel={pending ? 'Cancel connection' : `Disconnect ${cfg.short}`}
      danger
      onConfirm={run}
      onCancel={() => setConfirming(false)}
    />
  ) : null;
  return { ask: () => setConfirming(true), busy, modal };
}

/**
 * Org name, status, who connected it and when, and the connection's actions.
 * `compact` (every tab but Setup) keeps only the identity row.
 */
export function ConnectionHeader({ connection, compact = false }: { connection: Connection; compact?: boolean }) {
  const { canWrite, writeTitle } = useAccountingPermissions();
  const cfg = providerConfig(connection.provider);
  const r = connection.readiness;
  const chip = connectionChip(connection.status, r, connection.counts);
  const dis = useDisconnect(connection);
  const [reconnecting, setReconnecting] = useState(false);
  const reauth = connection.status === 'NEEDS_REAUTH';
  const live = r?.sync_enabled ?? false;

  const reconnect = async () => {
    setReconnecting(true);
    await startConnect(cfg.slug, cfg.short);
    setReconnecting(false);
  };

  const menu: RowActionItem[] = [];
  // Phones show no "Open in" button in the header; the menu always has it.
  if (connection.web_url) menu.push({ label: `Open in ${cfg.short}`, onSelect: () => window.open(connection.web_url!, '_blank', 'noopener,noreferrer') });
  if (canWrite) menu.push({ label: dis.busy ? 'Disconnecting…' : `Disconnect ${cfg.short}`, onSelect: dis.ask, disabled: dis.busy, danger: true });

  return (
    <section style={{ ...settingsCardStyle, padding: 'var(--card-pad, 20px)' }} aria-labelledby="acct-conn-title">
      {dis.modal}
      <div className="acct-head">
        <ProviderLogo provider={connection.provider} />
        <div className="acct-head__main">
          <h2 id="acct-conn-title" className="acct-head__name">{connection.tenant_name || `${cfg.short} organisation`}</h2>
          {/* The status always sits on the caption line, in the same place in every state. */}
          <p className="acct-head__caption">
            <span>{cfg.name}</span>
            <StatusChip tone={chip.tone} label={chip.label} size="sm" />
          </p>
        </div>
        <div className="acct-head__actions">
          {connection.web_url && !reauth ? (
            <a href={connection.web_url} target="_blank" rel="noopener noreferrer" className="tw-btn acct-open-btn" aria-label={`Open in ${cfg.short}`} title={`Open in ${cfg.short}`}>
              <span className="acct-open-btn__text">Open in {cfg.short}</span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ) : null}
        </div>
        {menu.length > 0 && <div className="acct-head__menu"><RowActions label={`${cfg.short} connection`} items={menu} /></div>}
      </div>

      {/* The why first, then the one thing to do about it. */}
      {reauth && (
        <div className="acct-notice acct-notice--outline-danger acct-notice--action" role="status" style={{ margin: '16px 0 0' }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <strong style={{ fontWeight: 600 }}>{connection.status_reason || `Your ${cfg.short} sign-in has expired.`}</strong>
            {canWrite ? 'Sign in again to carry on.' : `Ask your company admin to reconnect ${cfg.short}.`} Nothing syncs until then.
          </div>
          <button type="button" className="tw-btn tw-btn--primary" onClick={reconnect} disabled={!canWrite || reconnecting} title={writeTitle}>
            {reconnecting ? 'Opening…' : `Reconnect ${cfg.short}`}
          </button>
        </div>
      )}

      {!compact && (
        <dl className="acct-facts acct-facts--4">
          <div><dt>Connected by</dt><dd>{connection.connected_by || '—'}</dd></div>
          <div><dt>Connected on</dt><dd>{connection.connected_at ? formatDate(connection.connected_at) : '—'}</dd></div>
          <div><dt>Base currency</dt><dd>{connection.base_currency || '—'}</dd></div>
          <div>
            <dt>Start date</dt>
            <dd>{connection.cutover_date ? formatDate(connection.cutover_date) : 'Not chosen'}</dd>
          </div>
          {/* Sync facts only mean something once sync is on. */}
          {live && <div><dt>Payments last fetched</dt><dd>{connection.last_payment_sync_at ? formatDateTime(connection.last_payment_sync_at) : 'Not yet'}</dd></div>}
          {live && <div><dt>Last checked</dt><dd>{connection.last_reconciled_at ? formatDateTime(connection.last_reconciled_at) : 'Not yet'}</dd></div>}
        </dl>
      )}
    </section>
  );
}

/** Who connected it and when: a short card at the end of the Setup tab. */
export function ConnectionDetails({ connection }: { connection: Connection }) {
  const live = connection.readiness?.sync_enabled ?? false;
  // Only what the steps above don't already say.
  if (!live && !connection.cutover_date) return null;
  return (
    <section style={{ ...settingsCardStyle, padding: 'var(--card-pad, 20px)' }} aria-label="Connection details">
      <dl className="acct-facts acct-facts--4" style={{ margin: 0 }}>
        {connection.cutover_date && <div><dt>Start date</dt><dd>{formatDate(connection.cutover_date)}</dd></div>}
        {live && <div><dt>Payments last fetched</dt><dd>{connection.last_payment_sync_at ? formatDateTime(connection.last_payment_sync_at) : 'Not yet'}</dd></div>}
        {live && <div><dt>Last checked</dt><dd>{connection.last_reconciled_at ? formatDateTime(connection.last_reconciled_at) : 'Not yet'}</dd></div>}
      </dl>
    </section>
  );
}

/** Same box as ConnectionHeader while the connection loads. */
export function ConnectionHeaderSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <section style={{ ...settingsCardStyle, padding: 'var(--card-pad, 20px)' }} aria-busy="true" aria-label="Loading your accounting connection" role="status">
      <div className="acct-head">
        <span className="acct-logo" aria-hidden="true" />
        <div className="acct-head__main">
          <SkelLine width="55%" lineHeight={24} />
          <SkelLine width="30%" lineHeight={22} />
        </div>
        <div className="acct-head__actions"><span className="tw-btn acct-hide-phone" style={{ width: 120, visibility: 'hidden' }} aria-hidden="true" /></div>
      </div>
      {!compact && (
        <dl className="acct-facts acct-facts--4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}><dt><SkelLine width={90} /></dt><dd><SkelLine width={110 - (i % 3) * 15} /></dd></div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** PENDING_ORG: the login sees several organisations; pick the one with this company's books. */
export function OrgPicker({ connection }: { connection: Connection }) {
  const qc = useQueryClient();
  const { canWrite, writeTitle } = useAccountingPermissions();
  const cfg = providerConfig(connection.provider);
  const dis = useDisconnect(connection);
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

  const single = eligible.length === 1 ? eligible[0] : null;
  const unavailable = tenants.filter(t => !isZar(t.currency));
  return (
    <>
      {dis.modal}
      <h2 id="acct-org-title" className="acct-section-title">
        {single ? `Link your ${cfg.short} organisation` : `Choose the ${cfg.short} organisation to link`}
      </h2>
      <p className="acct-section-desc">
        {single
          ? `TruckWys will send your invoices and bills to this ${cfg.short} organisation.`
          : `Pick the ${cfg.short} organisation that holds this company's books.`}
      </p>
      <section style={settingsCardStyle} className="acct-org-card" aria-labelledby="acct-org-title">
        {tenants.length === 0 ? (
          <div className="acct-empty">No organisations came back from {cfg.short}. Use a different login and try again.</div>
        ) : single ? (
          <div className="acct-row acct-org acct-org--confirm is-selected">
            <span className="acct-org__radio"><input type="radio" className="acct-radio" checked readOnly aria-label={`${single.name} selected`} /></span>
            <span className="acct-org__mark"><span className="acct-logo acct-org-initials" aria-hidden="true">{single.currency || 'ZAR'}</span></span>
            <span style={{ minWidth: 0 }}>
              <span className="acct-row__title" style={{ display: 'block' }}>{single.name}</span>
              <span className="acct-row__sub">Books in {single.currency || 'ZAR'}</span>
            </span>
            <span />
          </div>
        ) : (
          <div role="radiogroup" aria-labelledby="acct-org-title">
            {eligible.map(t => {
              const selected = choice === t.tenant_id;
              return (
                <label key={t.tenant_id} className={`acct-row acct-org${selected ? ' is-selected' : ''}`}>
                  <span className="acct-org__mark">
                    <input type="radio" name="acct-org" className="acct-radio" value={t.tenant_id} checked={selected}
                      onChange={() => setChoice(t.tenant_id)} disabled={!canWrite} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="acct-row__title" style={{ display: 'block' }}>{t.name}</span>
                    <span className="acct-row__sub">Books in {t.currency || 'ZAR'}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {unavailable.map(t => (
          <div key={t.tenant_id} className="acct-row acct-org acct-org--confirm is-disabled">
            <span className="acct-org__radio"><input type="radio" className="acct-radio" disabled aria-label={`${t.name} can't be linked`} /></span>
            <span className="acct-org__mark"><span className="acct-logo acct-org-initials" aria-hidden="true">{t.currency}</span></span>
            <span style={{ minWidth: 0 }}>
              <span className="acct-row__title" style={{ display: 'block' }}>{t.name}</span>
              <span className="acct-row__sub">Books in {t.currency}. Only ZAR books can be linked.</span>
            </span>
            <span />
          </div>
        ))}
        <div className="acct-formfoot">
          {error && <p className="acct-error" role="alert" style={{ margin: 0, marginRight: 'auto' }}>{error}</p>}
          {!error && <p className="acct-section-desc acct-formfoot__note">{!canWrite ? `${writeTitle}.` : 'Nothing is sent until you finish setup.'}</p>}
          {canWrite && (
            <button type="button" className="tw-btn acct-formfoot__link" onClick={dis.ask} disabled={dis.busy || busy}>
              Use a different {cfg.short} login
            </button>
          )}
          <button type="button" className="tw-btn tw-btn--primary acct-card__btn acct-formfoot__primary" onClick={submit} disabled={!canWrite || !choice || busy}>
            {busy ? 'Linking…' : 'Link organisation'}
          </button>
        </div>
      </section>
    </>
  );
}

