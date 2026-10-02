import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { AlertTriangle, CheckCircle2, ChevronLeft, Info, Lock, X, XCircle } from 'lucide-react';
import { AccountingProviderCards, ComingSoonNote } from '@/components/accounting/AccountingProviderCards';
import {
  ACCT_KEYS, ACCT_URL, apiMessage, apiStatus, callbackMessage, type Reconciliation, invalidateAccounting, providerBySlug, providerConfig, useAccountingConnection,
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
import { AcctCard, ErrorBlock, LoadingBlock, useAccountingPermissions } from './accounting/shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    setBanner(callbackMessage(result, params.get('reason'), provider.short, provider.orgWord));
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
  // Same subtitle as other detail pages (Invoices): the way back, then what this page is.
  const description = (
    <>
      <Link to="/settings/integrations" className="section-header__back">
        <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" />
        Integrations
      </Link>
      <span aria-hidden="true" className="section-header__sep">·</span>
      {cfg ? cfg.name : 'No system connected'}
    </>
  );

  const bannerIcon = banner?.tone === 'success' ? <CheckCircle2 size={16} aria-hidden="true" />
    : banner?.tone === 'warning' ? <Info size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />;

  const r = live?.readiness;
  // Differences badge the Reconciliation tab, like counts on the others.
  const recon = useQuery<Reconciliation>({
    queryKey: ACCT_KEYS.reconciliation, queryFn: () => fetchData(ACCT_URL.reconciliation),
    enabled: !!live && live.status === 'ACTIVE' && !!live.readiness?.sync_enabled, retry: 0, staleTime: 60_000,
  });
  const tabBadge = (t: AccountingTab): number | undefined => {
    if (!live || !r || live.status !== 'ACTIVE') return undefined;
    if (t === 'contacts' && r.contacts_to_confirm > 0) return r.contacts_to_confirm;
    if (t === 'mapping' && !r.mapping_complete && r.missing_mappings.length) return r.missing_mappings.length;
    if (t === 'reconciliation' && r.sync_enabled && (recon.data?.run?.difference_count ?? 0) > 0) return recon.data!.run!.difference_count;
    if (t === 'sync' && r.sync_enabled && (live.counts.errors + live.counts.dead) > 0) return live.counts.errors + live.counts.dead;
    return undefined;
  };

  // Phones: the tab strip scrolls sideways; keep the open tab in view.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = tabsRef.current;
    const el = strip?.querySelector<HTMLElement>('.is-active');
    // Scroll in whole tabs: the left edge always starts on a tab, never a fragment.
    if (el && strip) {
      const base = strip.getBoundingClientRect().left - strip.scrollLeft;
      const pos = (n: HTMLElement) => n.getBoundingClientRect().left - base;
      const tabsEls = Array.from(strip.querySelectorAll<HTMLElement>('.section-header__tab'));
      const elRight = pos(el) + el.offsetWidth;
      // Smallest scroll that shows the open tab whole (plus room for the fade),
      // rounded to the start of a tab so no word is cut on the left.
      const need = Math.max(0, elRight + 28 - strip.clientWidth);
      const start = tabsEls.map(pos).find(x => x >= need) ?? need;
      strip.scrollLeft = need === 0 ? 0 : Math.max(0, Math.min(start, pos(el)) - 2);
    }
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
  }, [tab, live?.id, recon.data?.run?.difference_count]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabCountTitle = (t: AccountingTab, n: number) =>
    t === 'contacts' ? `${n} need action` : t === 'mapping' ? `${n} still to map` : t === 'reconciliation' ? `${n} differences` : `${n} failed to send`;

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
        <p className="acct-section-desc acct-desc-cap">Send invoices and bills to your books. Payments come back automatically. <ComingSoonNote /></p>
        <AccountingProviderCards hideManage />
        <div style={{ height: 12 }} />
        <AcctCard title="How setup works" description="About 10 minutes, done by a company admin. You'll see these steps again after connecting." flush>
          <ol className="acct-check">
            {[
              ['Connect your accounting system', 'Sign in to it and choose which books to link.'],
              ['Map charges, expenses and VAT', 'Tell TruckWys where each kind of charge and supplier bill goes in your books, and which VAT rates to use.'],
              ['Confirm contacts', 'Most customers and suppliers are matched for you on VAT or registration number.'],
              ['Choose a start date', 'We send documents from that date. Anything earlier should already be in your books.'],
              ['Sync starts', 'Automatically, once the steps above are done.'],
            ].map(([t, d], i) => (
              <li key={t}>
                <span className="acct-step-num is-plain" aria-hidden="true">{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="acct-check__title">{t}</div>
                  <div className="acct-check__desc">{d}</div>
                </div>
                <span />
              </li>
            ))}
          </ol>
        </AcctCard>
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
          <div className="section-header__tabs acct-utabs" role="tablist" ref={tabsRef} aria-label={`${cfg!.short} settings`}>
            {ACCOUNTING_TABS.map(t => {
              const n = tabBadge(t.id);
              const locked = live.status === 'NEEDS_REAUTH' && t.id !== 'setup';
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`acct-tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls="acct-tabpanel"
                  className={`section-header__tab${tab === t.id ? ' is-active' : ''}`}
                  data-label={t.label}
                  onClick={() => { if (!locked) openTab(t.id); }}
                  aria-disabled={locked || undefined}
                  title={locked ? `Available after you reconnect ${cfg!.short}` : n != null ? tabCountTitle(t.id, n) : undefined}
                  data-locked={locked ? '' : undefined}
                >
                  <span className="acct-utab">
                    {locked && <Lock size={12} aria-hidden="true" />}
                    {t.label}
                    {n != null && <span className="acct-tab-num" aria-label={tabCountTitle(t.id, n)}>{n}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* Phones: one picker instead of a strip that clips, as the settings nav does. */}
        <div className="acct-tabs-phone">
          <Select value={tab} onValueChange={v => openTab(v as AccountingTab)}>
            <SelectTrigger aria-label={`${cfg!.short} settings page`} className="acct-tabs-phone__trigger"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACCOUNTING_TABS.map(t => {
                const n = tabBadge(t.id);
                const locked = live.status === 'NEEDS_REAUTH' && t.id !== 'setup';
                return (
                  <SelectItem key={t.id} value={t.id} disabled={locked}>
                    {t.label}{n != null ? ` · ${tabCountTitle(t.id, n)}` : ''}{locked ? ' · after you reconnect' : ''}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
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
        <SettingsPageHeader title={title} description={description} subPage />

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
