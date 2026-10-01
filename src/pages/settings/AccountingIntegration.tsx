import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { AccountingProviderCards } from '@/components/accounting/AccountingProviderCards';
import {
  apiMessage, apiStatus, callbackMessage, invalidateAccounting, providerBySlug, providerConfig, useAccountingConnection,
} from '@/lib/accounting';
import { SettingsShell } from './SettingsShell';
import { SettingsPageHeader, settingsCardStyle } from './settingsUi';
import { ConnectionHeader, OrgPicker } from './accounting/ConnectionHeader';
import { SetupChecklist } from './accounting/SetupChecklist';
import { MappingTab } from './accounting/MappingTab';
import { ContactsTab } from './accounting/ContactsTab';
import { BackfillTab } from './accounting/BackfillTab';
import { SyncTab } from './accounting/SyncTab';
import { ReconciliationTab } from './accounting/ReconciliationTab';
import { ErrorBlock, LoadingBlock, useAccountingPermissions } from './accounting/shared';
import { ACCOUNTING_TABS, isAccountingTab, type AccountingTab } from './accounting/tabs';
import '@/components/accounting/accounting.css';

type Banner = NonNullable<ReturnType<typeof callbackMessage>>;

/**
 * Settings → Integrations → Accounting (/settings/integrations/accounting).
 * Provider-neutral: Xero today, QuickBooks Online by config. The OAuth
 * callback lands here with ?provider=&result=&reason=.
 */
export default function AccountingIntegration() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { canWrite, isAdmin } = useAccountingPermissions();
  const conn = useAccountingConnection();
  const connection = conn.data ?? null;
  const live = connection && connection.status !== 'DISABLED' ? connection : null;
  const cfg = live ? providerConfig(live.provider) : null;

  // ---- OAuth callback banner (read once, then strip the params)
  const [banner, setBanner] = useState<Banner | null>(null);
  useEffect(() => {
    const result = params.get('result') ?? (params.get('xero') === 'connected' ? 'connected' : params.get('xero') === 'error' ? 'error' : null);
    if (!result) return;
    const provider = providerBySlug(params.get('provider')) ?? providerConfig('XERO');
    setBanner(callbackMessage(result, params.get('reason'), provider.short));
    invalidateAccounting(qc);
    const next = new URLSearchParams(params);
    ['provider', 'result', 'reason', 'xero'].forEach(k => next.delete(k));
    setParams(next, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- tabs live in the URL so a refresh or a shared link keeps the place
  const tabParam = params.get('tab');
  const tab: AccountingTab = isAccountingTab(tabParam) ? tabParam : 'setup';
  const openTab = (t: AccountingTab) => {
    const next = new URLSearchParams(params);
    if (t === 'setup') next.delete('tab'); else next.set('tab', t);
    setParams(next, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const title = cfg ? cfg.name : 'Accounting';
  const description = cfg
    ? `Keep TruckWys and ${cfg.short} in step: documents go there, payments come back.`
    : 'Connect your accounting system so invoices, credit notes and bills flow into your books.';

  const bannerIcon = banner?.tone === 'success' ? <CheckCircle2 size={16} aria-hidden="true" />
    : banner?.tone === 'warning' ? <Info size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />;

  const r = live?.readiness;
  const tabBadge = (t: AccountingTab): number | undefined => {
    if (!live || !r) return undefined;
    if (t === 'contacts' && r.contacts_to_confirm > 0) return r.contacts_to_confirm;
    if (t === 'mapping' && !r.mapping_complete && r.missing_mappings.length) return r.missing_mappings.length;
    if (t === 'sync' && (live.counts.errors + live.counts.dead) > 0) return live.counts.errors + live.counts.dead;
    return undefined;
  };

  let body: React.ReactNode;
  if (conn.isLoading) {
    body = <section style={settingsCardStyle}><LoadingBlock label="Loading your accounting connection" /></section>;
  } else if (conn.isError) {
    body = (
      <section style={settingsCardStyle}>
        <ErrorBlock
          message={apiStatus(conn.error) === 403
            ? apiMessage(conn.error, "You don't have access to the accounting settings.")
            : apiMessage(conn.error, "Couldn't load your accounting connection.")}
          onRetry={() => conn.refetch()}
        />
      </section>
    );
  } else if (!live) {
    body = (
      <>
        <h2 className="acct-section-title">Choose your accounting system</h2>
        <p className="acct-section-desc">
          Once connected, TruckWys sends your invoices, credit notes and supplier bills, and payments recorded there come back here on their own. One system at a time.
        </p>
        <AccountingProviderCards hideManage />
      </>
    );
  } else if (live.status === 'PENDING_ORG') {
    body = (
      <>
        <ConnectionHeader connection={live} />
        <OrgPicker connection={live} />
      </>
    );
  } else {
    body = (
      <>
        <ConnectionHeader connection={live} />
        <div className="acct-tabs">
          <div className="tw-seg" role="tablist" aria-label={`${cfg!.short} settings`}>
            {ACCOUNTING_TABS.map(t => {
              const n = tabBadge(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`acct-tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls="acct-tabpanel"
                  className={`tw-seg__opt${tab === t.id ? ' is-active' : ''}`}
                  onClick={() => openTab(t.id)}
                >
                  {t.label}
                  {n != null && <span style={{ color: 'var(--status-warning-text)', fontVariantNumeric: 'tabular-nums' }}>{n}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div id="acct-tabpanel" role="tabpanel" aria-labelledby={`acct-tab-${tab}`}>
          {tab === 'setup' && <SetupChecklist connection={live} onOpen={openTab} />}
          {tab === 'mapping' && <MappingTab connection={live} />}
          {tab === 'contacts' && <ContactsTab connection={live} />}
          {tab === 'cutover' && <BackfillTab connection={live} onOpen={openTab} />}
          {tab === 'sync' && <SyncTab connection={live} />}
          {tab === 'reconciliation' && <ReconciliationTab connection={live} />}
        </div>
      </>
    );
  }

  return (
    <SettingsShell activeId="integrations">
      <div style={{ maxWidth: 'var(--form-max, 720px)', minWidth: 0 }}>
        <SettingsPageHeader title={title} description={description} />

        {banner && (
          <div className={`acct-notice acct-notice--${banner.tone}`} role={banner.tone === 'danger' ? 'alert' : 'status'}>
            {bannerIcon}
            <div>
              <strong>{banner.title}</strong>
              {banner.body}
            </div>
            <button type="button" className="acct-notice__close" onClick={() => setBanner(null)} aria-label="Dismiss">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {!canWrite && !conn.isLoading && (
          <div className="acct-notice" role="note">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <strong>View only</strong>
              {isAdmin ? 'Changes are switched off in the demo.' : 'Only a company admin can connect, map or change the accounting integration. You can see everything here.'}
            </div>
          </div>
        )}

        {body}
      </div>
    </SettingsShell>
  );
}
