import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronLeft, Info, X, XCircle } from 'lucide-react';
import { AccountingProviderCards } from '@/components/accounting/AccountingProviderCards';
import {
  apiMessage, apiStatus, callbackMessage, invalidateAccounting, providerBySlug, providerConfig, useAccountingConnection,
} from '@/lib/accounting';
import { SettingsShell } from './SettingsShell';
import { SettingsPageHeader, settingsCardStyle } from './settingsUi';
import { ConnectionHeader, ConnectionHeaderSkeleton, OrgPicker } from './accounting/ConnectionHeader';
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
    qc.invalidateQueries({ queryKey: ['accounting', 'connection'] });
    setParams(next, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // One short line, the same before and after the data lands (no head jump).
  const title = 'Accounting';
  // A sub-page of Integrations: the subtitle line carries the way back, as on
  // every detail page (the settings nav keeps "Integrations" highlighted).
  const stateLine = !live ? 'Connect your accounting system'
    : live.status === 'PENDING_ORG' ? 'Choose an organisation'
      : live.status === 'NEEDS_REAUTH' ? `${cfg!.short} sign-in expired`
        : live.readiness.sync_enabled ? `${cfg!.short} connection and sync`
          : `Setting up ${cfg!.short}`;
  const description = (
    <>
      <Link to="/settings/integrations" className="section-header__back">
        <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" />
        Integrations
      </Link>
      <span aria-hidden="true" className="section-header__sep">·</span>
      {conn.isLoading ? 'Accounting system' : stateLine}
    </>
  );

  const bannerIcon = banner?.tone === 'success' ? <CheckCircle2 size={16} aria-hidden="true" />
    : banner?.tone === 'warning' ? <Info size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />;

  const r = live?.readiness;
  const tabBadge = (t: AccountingTab): number | undefined => {
    if (!live || !r || live.status !== 'ACTIVE') return undefined;
    if (t === 'contacts' && r.contacts_to_confirm > 0) return r.contacts_to_confirm;
    if (t === 'mapping' && !r.mapping_complete && r.missing_mappings.length) return r.missing_mappings.length;
    if (t === 'sync' && r.sync_enabled && (live.counts.errors + live.counts.dead) > 0) return live.counts.errors + live.counts.dead;
    return undefined;
  };

  // Phones: the tab strip scrolls sideways; keep the open tab in view.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = tabsRef.current;
    const el = strip?.querySelector<HTMLElement>('.is-active');
    if (el && strip) strip.scrollLeft = Math.max(0, el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2);
    // Fade whichever edge hides more tabs, so it reads as a strip that scrolls.
    const edges = () => {
      if (!strip) return;
      strip.dataset.moreLeft = String(strip.scrollLeft > 2);
      strip.dataset.moreRight = String(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2);
    };
    edges();
    strip?.addEventListener('scroll', edges, { passive: true });
    window.addEventListener('resize', edges);
    return () => { strip?.removeEventListener('scroll', edges); window.removeEventListener('resize', edges); };
  }, [tab, live?.id]);

  const tabCountTitle = (t: AccountingTab, n: number) =>
    t === 'contacts' ? `${n} need action` : t === 'mapping' ? `${n} still to map` : `${n} failed to send`;

  let body: React.ReactNode;
  if (conn.isLoading) {
    body = (
      <>
        <ConnectionHeaderSkeleton compact />
        <div className="acct-tabs" aria-hidden="true"><span className="ops-skel" style={{ width: 'min(100%, 520px)', height: 32, borderRadius: 8 }} /></div>
        <section style={settingsCardStyle}><LoadingBlock label="Loading setup" rows={5} /></section>
      </>
    );
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
        <h2 className="acct-section-title">Connect your accounting system</h2>
        <p className="acct-section-desc">One accounting system can be connected at a time.</p>
        <AccountingProviderCards hideManage />
        <section style={settingsCardStyle} aria-labelledby="acct-how-title">
          <div style={{ padding: '16px var(--card-pad, 20px)', borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 id="acct-how-title" style={{ margin: 0, font: '600 16px/24px var(--font-sans)', color: 'var(--text-primary)' }}>After you connect</h2>
            <p className="acct-section-desc" style={{ margin: '2px 0 0' }}>Takes about ten minutes, once, and needs a company admin. Afterwards, payments you record in your accounting system update TruckWys on their own.</p>
          </div>
          <ol className="acct-check">
            {[
              ['Map accounts and VAT', 'Pick the income account and VAT rate for each kind of charge, and where supplier bills go.'],
              ['Confirm contacts', 'Most customers and suppliers are matched for you on VAT or registration number.'],
              ['Choose a cut-over date', 'Documents from that date on are sent; anything earlier is assumed to be in your books.'],
            ].map(([t, d], i) => (
              <li key={t}>
                <span className="acct-step-num" aria-hidden="true">{i + 1}</span>
                <div style={{ minWidth: 0, maxWidth: 560 }}>
                  <div className="acct-check__title">{t}</div>
                  <div className="acct-check__desc">{d}</div>
                </div>
                <span />
              </li>
            ))}
          </ol>

        </section>
      </>
    );
  } else if (live.status === 'PENDING_ORG') {
    body = (
      <>
        <OrgPicker connection={live} />
      </>
    );
  } else {
    body = (
      <>
        <ConnectionHeader connection={live} compact />
        <div className="acct-tabs">
          <div className="tw-seg" role="tablist" ref={tabsRef} aria-label={`${cfg!.short} settings`}>
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
                  {n != null && <span className="acct-tab-count" title={tabCountTitle(t.id, n)} aria-label={tabCountTitle(t.id, n)}><span className="acct-tab-count__dot" aria-hidden="true" />{n}</span>}
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
          {tab === 'sync' && <SyncTab connection={live} onOpen={openTab} />}
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

        {!canWrite && (
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
