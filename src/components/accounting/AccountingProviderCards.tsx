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

  if (q.isLoading) {
    return (
      <div className="acct-cards" aria-busy="true" aria-label="Loading accounting integrations">
        {PROVIDER_ORDER.map(c => <div key={c} className="acct-card" style={{ height: 90 }} />)}
      </div>
    );
  }

  return (
    <div className="acct-cards">
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
        />
      ))}
    </div>
  );
}

function ProviderCard({ info, live, canWrite, disabledTitle, busy, onConnect, hideManage }: {
  info: ProviderInfo;
  live: Connection | null;
  canWrite: boolean;
  disabledTitle?: string;
  busy: boolean;
  onConnect: () => void;
  hideManage: boolean;
}) {
  const cfg = providerConfig(info.provider);
  const comingSoon = info.availability === 'coming_soon';
  const mine = live && live.provider === info.provider ? live : null;
  const other = live && live.provider !== info.provider ? providerConfig(live.provider) : null;
  const chip = mine ? connectionChip(mine.status) : null;

  let meta: React.ReactNode = null;
  let actions: React.ReactNode = null;

  if (comingSoon) {
    meta = null;
    actions = <button type="button" className="tw-btn" disabled>Connect</button>;
  } else if (mine) {
    meta = (
      <p className="acct-card__meta">
        {mine.status === 'PENDING_ORG'
          ? `Signed in to ${cfg.short}. Choose which organisation to link.`
          : <>{mine.tenant_name || `${cfg.short} organisation`}{mine.status === 'NEEDS_REAUTH' && mine.status_reason ? ` · ${mine.status_reason}` : ''}</>}
      </p>
    );
    actions = (
      <>
        {mine.status === 'NEEDS_REAUTH' && (
          <button type="button" className="tw-btn tw-btn--primary" onClick={onConnect} disabled={!canWrite || busy} title={!canWrite ? disabledTitle : undefined}>
            {busy ? 'Opening…' : 'Reconnect'}
          </button>
        )}
        {!hideManage && (
          <Link to={ACCOUNTING_PAGE} className={`tw-btn${mine.status === 'NEEDS_REAUTH' ? '' : ' tw-btn--primary'}`}>
            {mine.status === 'PENDING_ORG' ? 'Choose organisation' : 'Manage'}
          </Link>
        )}
      </>
    );
  } else if (other) {
    meta = <p className="acct-card__meta">Disconnect {other.short} first. Only one accounting system can be connected at a time.</p>;
    actions = <button type="button" className="tw-btn" disabled title={`Disconnect ${other.short} first`}>Connect</button>;
  } else if (!info.configured) {
    meta = <p className="acct-card__meta">Not set up on this server yet. Ask TruckWys support to switch it on.</p>;
    actions = <button type="button" className="tw-btn" disabled>Connect</button>;
  } else {
    actions = (
      <button type="button" className="tw-btn tw-btn--primary" onClick={onConnect} disabled={!canWrite || busy} title={!canWrite ? disabledTitle : undefined}>
        {busy ? 'Opening…' : `Connect ${cfg.short}`}
      </button>
    );
  }

  return (
    <div className={`acct-card${comingSoon ? ' is-disabled' : ''}`}>
      <ProviderLogo provider={info.provider} />
      <div style={{ minWidth: 0 }}>
        <h3 className="acct-card__title">
          {cfg.name}
          {comingSoon && <span className="acct-badge">Coming soon</span>}
          {chip && <StatusChip tone={chip.tone} label={chip.label} size="sm" />}
        </h3>
        <p className="acct-card__desc">{cfg.blurb}</p>
        {meta}
      </div>
      <div className="acct-card__actions">{actions}</div>
    </div>
  );
}
