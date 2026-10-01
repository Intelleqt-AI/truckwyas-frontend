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
  // only the status line and the button wait for the server.
  return (
    <div className="acct-cards" aria-busy={q.isLoading || undefined}>
      {q.isError && (
        <p className="acct-section-desc" role="alert" style={{ color: 'var(--status-danger-text)' }}>
          {apiMessage(q.error, "Couldn't load your accounting connection. Refresh the page to try again.")}
        </p>
      )}
      {providers.map(p => (
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
  const comingSoon = info.availability === 'coming_soon';
  const mine = live && live.provider === info.provider ? live : null;
  const other = live && live.provider !== info.provider ? providerConfig(live.provider) : null;
  const chip = mine ? connectionChip(mine.status, mine.readiness?.sync_enabled ?? true) : null;

  // Same layout as the other integration cards on this page (Cartrack,
  // CtrlFleet): logo, name and one line, status on the right; details in a
  // nested box; actions underneath, left-aligned.
  let meta: React.ReactNode = null;
  let actions: React.ReactNode = null;
  const chipEl = loading && !comingSoon
    ? <span className="ops-skel" style={{ width: 96, height: 12 }} aria-hidden="true" />
    : comingSoon
      ? <StatusChip tone="neutral" label="Coming soon" />
      : chip ? <StatusChip tone={chip.tone} label={chip.label} /> : <StatusChip status="DISCONNECTED" />;

  if (loading && !comingSoon) {
    // Most states show a detail box; reserve one so the card doesn't grow.
    meta = <span aria-hidden="true" style={{ display: 'block', height: 44 }}><span className="ops-skel" style={{ width: 200, height: 12, marginTop: 4 }} /><span className="ops-skel" style={{ width: 260, height: 12, marginTop: 12 }} /></span>;
    actions = <span className="tw-btn" style={{ visibility: 'hidden', width: 120 }} aria-hidden="true" />;
  } else if (comingSoon) {
    meta = null;
  } else if (mine) {
    meta = mine.status === 'PENDING_ORG'
      ? <>Signed in to {cfg.short}. Choose which organisation holds this company's books.</>
      : <>
          <strong>Organisation:</strong> {mine.tenant_name || `${cfg.short} organisation`}
          {mine.status === 'NEEDS_REAUTH' && <span className="acct-card__note acct-card__note--danger">{mine.status_reason || `${cfg.short} needs an admin to sign in again.`}</span>}
          {mine.status === 'ACTIVE' && !mine.readiness.sync_enabled && <span className="acct-card__note">Nothing is sent to {cfg.short} until setup is finished.</span>}
        </>;
    actions = (
      <>
        {mine.status === 'NEEDS_REAUTH' && (
          <button type="button" className="tw-btn tw-btn--primary" onClick={onConnect} disabled={!canWrite || busy} title={!canWrite ? disabledTitle : undefined}>
            {busy ? 'Opening…' : 'Reconnect'}
          </button>
        )}
        {!hideManage && (
          <Link to={ACCOUNTING_PAGE} className={`tw-btn${mine.status !== 'NEEDS_REAUTH' && (mine.status === 'PENDING_ORG' || !mine.readiness.sync_enabled) ? ' tw-btn--primary' : ''}`}>
            {mine.status === 'PENDING_ORG' ? 'Choose organisation' : mine.status === 'ACTIVE' && !mine.readiness.sync_enabled ? 'Finish setup' : 'Manage'}
          </Link>
        )}
      </>
    );
  } else if (other) {
    meta = <>Disconnect {other.short} first. Only one accounting system can be connected at a time.</>;
    actions = <button type="button" className="tw-btn" disabled title={`Disconnect ${other.short} first`}>Connect {cfg.short}</button>;
  } else if (!info.configured) {
    meta = <>Not set up on this server yet. Ask TruckWys support to switch it on.</>;
    actions = <button type="button" className="tw-btn" disabled>Connect {cfg.short}</button>;
  } else {
    actions = (
      <button type="button" className="tw-btn tw-btn--primary" onClick={onConnect} disabled={!canWrite || busy} title={!canWrite ? disabledTitle : undefined}>
        {busy ? 'Opening…' : `Connect ${cfg.short}`}
      </button>
    );
  }

  return (
    <div className={`acct-card${comingSoon ? ' is-disabled' : ''}`}>
      <div className="acct-card__top">
        <ProviderLogo provider={info.provider} />
        <div className="acct-card__text">
          <h3 className="acct-card__title">{cfg.name}</h3>
          <p className="acct-card__desc">{cfg.blurb}</p>
        </div>
        <div className="acct-card__chip">{chipEl}</div>
      </div>
      {meta && <div className="acct-card__box">{meta}</div>}
      {actions && <div className="acct-card__actions">{actions}</div>}
    </div>
  );
}
