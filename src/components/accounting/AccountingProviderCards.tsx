import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusChip } from '@/components/ui/StatusChip';
import { toast } from '@/lib/toast';
import { useAuth } from '@/lib/AuthContext';
import {
  PROVIDERS, PROVIDER_ORDER, accountingApi, apiMessage, providerConfig, useAccountingProviders,
  type Connection, type ProviderCode, type ProviderInfo, type ProviderSlug,
} from '@/lib/accounting';
import { ProviderLogo } from './ProviderLogo';
import { connectionChip } from './connectionStatus';
import './accounting.css';
import '@/pages/ops-tiles.css';

/** "QuickBooks Online and Sage Business Cloud Accounting are coming soon." (from the server's list). */
export function ComingSoonNote() {
  const q = useAccountingProviders();
  // Until the server answers, assume the usual line-up so the text doesn't pop in.
  const names = q.data
    ? q.data.providers.filter(p => p.availability === 'coming_soon').map(p => providerConfig(p.provider).name)
    : PROVIDER_ORDER.filter(c => c !== 'XERO').map(c => PROVIDERS[c].name);
  if (!names.length) return null;
  return <>{names.join(' and ')} {names.length === 1 ? 'is' : 'are'} coming soon.</>;
}

export const ACCOUNTING_PAGE = '/settings/integrations/accounting';

/** Start the provider's OAuth flow: the server hands back the URL to send the browser to. */
export async function startConnect(slug: ProviderSlug, name: string) {
  try {
    const { auth_url } = await accountingApi.connect(slug);
    if (auth_url) window.location.href = auth_url;
    else toast.error(`Couldn't start the ${name} connection. Try again.`);
  } catch (e) {
    toast.error(apiMessage(e, `Couldn't start the ${name} connection. Try again.`));
  }
}

/**
 * Settings → Integrations → Accounting: one card per provider. Only one
 * accounting system can be connected at a time, so while one is live the
 * others say which one to disconnect first.
 */
export function AccountingProviderCards({ hideManage = false }: { hideManage?: boolean }) {
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const isDemo = !!user?.is_demo;
  const canWrite = isAdmin && !isDemo;
  const q = useAccountingProviders();
  const [busy, setBusy] = useState<ProviderCode | null>(null);

  const serverList = q.data?.providers ?? [];
  const providers: ProviderInfo[] = PROVIDER_ORDER.map(code => {
    const fromServer = serverList.find(p => p.provider === code);
    const cfg = PROVIDERS[code];
    return fromServer ?? { provider: code, slug: cfg.slug, name: cfg.name, availability: code === 'XERO' ? 'available' : 'coming_soon', configured: false };
  });
  const connection = q.data?.connection ?? null;
  const live = connection && connection.status !== 'DISABLED' ? connection : null;

  const connect = async (p: ProviderInfo) => {
    setBusy(p.provider);
    await startConnect(p.slug, providerConfig(p.provider).short);
    setBusy(null);
  };

  // Names and descriptions come from config, so the cards draw at once;
  // only the status line and the button wait for the server. Systems that
  // aren't available yet share one quiet line instead of full cards.
  const available = providers.filter(p => p.availability !== 'coming_soon');
  const soon = providers.filter(p => p.availability === 'coming_soon');
  return (
    <div className="acct-cards" aria-busy={q.isLoading || undefined}>
      {q.isError && (
        <p className="acct-section-desc" role="alert" style={{ color: 'var(--status-danger-text)' }}>
          {apiMessage(q.error, "Couldn't load your accounting connection. Refresh the page to try again.")}
        </p>
      )}
      {available.map(p => (
        <ProviderCard
          key={p.provider}
          info={p}
          live={live}
          canWrite={canWrite}
          disabledTitle={isDemo ? 'Not available in the demo' : !isAdmin ? 'Only a company admin can connect an accounting system' : undefined}
          busy={busy === p.provider}
          onConnect={() => connect(p)}
          hideManage={hideManage}
          loading={q.isLoading}
        />
      ))}
    </div>
  );
}

function ProviderCard({ info, live, canWrite, disabledTitle, busy, onConnect, hideManage, loading }: {
  info: ProviderInfo;
  live: Connection | null;
  canWrite: boolean;
  disabledTitle?: string;
  busy: boolean;
  onConnect: () => void;
  hideManage: boolean;
  loading: boolean;
}) {
  const cfg = providerConfig(info.provider);
  const mine = live && live.provider === info.provider ? live : null;
  const other = live && live.provider !== info.provider ? providerConfig(live.provider) : null;
  const chip = mine ? connectionChip(mine.status, mine.readiness) : null;

  // Same layout as the other integration cards on this page (Cartrack,
  // CtrlFleet): logo, name and one grey line, status on the right, the
  // action underneath.
  let desc: React.ReactNode = 'Invoices, credit notes and supplier bills';
  let note: React.ReactNode = null;
  let actions: React.ReactNode = null;
  const btn = 'tw-btn acct-card__btn';

  if (loading) {
    // Room for the usual connected state: org line, note line and chip.
    desc = <span aria-hidden="true" className="acct-card__desc-skel"><span className="acct-skel-line" style={{ height: 20 }}><span className="ops-skel" style={{ width: 200, maxWidth: '100%' }} /></span></span>;
    actions = <span className={btn} style={{ visibility: 'hidden', width: 120 }} aria-hidden="true" />;
  } else if (mine) {
    desc = mine.status === 'PENDING_ORG'
      ? `Signed in to ${cfg.short}; no organisation chosen yet.`
      : `Linked to ${mine.tenant_name || `your ${cfg.short} ${cfg.orgWord}`}`;
    const left = mine.status === 'ACTIVE' && !mine.readiness.sync_enabled
      ? [!mine.readiness.mapping_complete, mine.readiness.contacts_to_confirm > 0, mine.readiness.backfill_state !== 'DONE'].filter(Boolean).length : 0;
    if (left > 0) desc = <>{mine.tenant_name || `${cfg.short} ${cfg.orgWord}`}<span className="acct-card__note">{left} setup {left === 1 ? 'step' : 'steps'} left</span></>;
    if (mine.status === 'NEEDS_REAUTH') note = <span className="acct-card__note acct-card__note--danger">{mine.status_reason || `Your ${cfg.short} sign-in has expired.`} Nothing is sent until an admin reconnects.</span>;
    const needsYou = mine.status === 'PENDING_ORG' || (mine.status === 'ACTIVE' && !mine.readiness.sync_enabled);
    actions = (
      <>
        {mine.status === 'NEEDS_REAUTH' && (
          <button type="button" className={`${btn} tw-btn--primary`} onClick={onConnect} disabled={!canWrite || busy} title={!canWrite ? disabledTitle : undefined}>
            {busy ? 'Opening…' : `Reconnect ${cfg.short}`}
          </button>
        )}
        {!hideManage && (
          <Link to={ACCOUNTING_PAGE} className={`${btn}${needsYou ? ' tw-btn--primary' : ''}`}>
            {mine.status === 'PENDING_ORG' ? 'Choose organisation' : mine.status === 'ACTIVE' && !mine.readiness.sync_enabled ? 'Finish setup' : 'Manage'}
          </Link>
        )}
      </>
    );
  } else if (other) {
    note = <span className="acct-card__note">Disconnect {other.short} first. One accounting system at a time.</span>;
    actions = <button type="button" className={btn} disabled title={`Disconnect ${other.short} first`}>Connect {cfg.short}</button>;
  } else if (!info.configured) {
    note = <span className="acct-card__note">Not set up on this server yet. Ask TruckWys support to switch it on.</span>;
    actions = <button type="button" className={btn} disabled>Connect {cfg.short}</button>;
  } else {
    actions = (
      <button type="button" className={`${btn} tw-btn--primary`} onClick={onConnect} disabled={!canWrite || busy} title={!canWrite ? disabledTitle : undefined}>
        {busy ? 'Opening…' : `Connect ${cfg.short}`}
      </button>
    );
  }

  return (
    <div className="acct-card">
      <div className="acct-card__top">
        <ProviderLogo provider={info.provider} />
        {/* Same header as the Cartrack and CtrlFleet cards: status on the right. */}
        <div className="acct-card__text">
          <h3 className="acct-card__title">{cfg.name}</h3>
          <p className="acct-card__desc">{desc}{note}</p>
        </div>
        <div className="acct-card__chip">
          {loading
            ? <span className="tw-status" style={{ visibility: 'hidden' }} aria-hidden="true">Setup needed</span>
            : chip ? <StatusChip tone={chip.tone} label={chip.label} /> : <StatusChip status="DISCONNECTED" />}
        </div>
      </div>
      {actions && <div className="acct-card__actions">{actions}</div>}
    </div>
  );
}
