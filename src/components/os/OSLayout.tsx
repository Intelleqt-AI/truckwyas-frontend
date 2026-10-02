import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Moon, Sun, ChevronDown, Settings as SettingsIcon, CreditCard, LogOut } from 'lucide-react';
import OverflowMenu, { type MenuItem } from '@/components/ui/OverflowMenu';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LiveEvents } from '@/components/LiveEvents';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/lib/AuthContext';
import { fetchData, postData } from '@/lib/Api';
import { toast } from '@/lib/toast';
import { useIdleLogout } from '@/hooks/useIdleLogout';
import { isSubscriptionBlocked, subscriptionStatusDetail, subscriptionStatusLabel } from '@/lib/subscriptionStatus';
import { Sidebar } from '@/components/shell/Sidebar';
import { PhoneBar } from '@/components/shell/PhoneBar';
import '@/components/shell/shell.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageHeadSkeleton } from '@/components/layout/SectionHeader';
import { warmRoutesWhenIdle } from '@/components/shell/routePrefetch';
import { useCapitalStatus } from '@/lib/capital/api';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // "Auto sign out after 30 minutes of inactivity"

export function OSLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tw-theme') as 'dark' | 'light') || 'dark';
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('tw-nav-collapsed') === '1'; } catch { return false; }
  });
  const [narrow, setNarrow] = useState<boolean>(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1100px)').matches);
  // Phones (the top-bar theme button is hidden at <= 768px, shell.css): only
  // there does the account menu carry "Dark theme"; desktop has the toggle.
  const [phone, setPhone] = useState<boolean>(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
  const [moreOpen, setMoreOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [agentQuery, setAgentQuery] = useState('');
  // Default ON to match the backend default; corrected by the fetch below.
  const [sessionTimeoutEnabled, setSessionTimeoutEnabled] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { user: authUser } = useAuth();
  const subStatus = authUser?.subscription_status;
  const cancelAtPeriodEnd = !!authUser?.cancel_at_period_end;
  const statusTone: 'ok' | 'warn' | 'bad' = isSubscriptionBlocked(subStatus) ? 'bad' : (subStatus === 'grace_period' || cancelAtPeriodEnd) ? 'warn' : 'ok';
  const userName = authUser?.name || authUser?.username || 'User';
  const userRole = (authUser?.role || 'VIEWER').toUpperCase();
  const avatarUrl = (authUser?.avatar as string) || undefined;
  const initials =
    userName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'TW';

  const signOut = (message?: string) => {
    // Best-effort server-side session kill; the local token is cleared regardless.
    postData({ url: 'api/v1/auth/logout/' }).catch(() => { /* dead/failed token: proceed anyway */ });
    localStorage.removeItem('access');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('onboarding_done');
    // Query keys carry no user id, so cached data would otherwise survive into
    // the NEXT account's session (staleTime 5min) and show its numbers.
    queryClient.clear();
    if (message) toast.info(message);
    navigate('/login');
  };

  const handleLogout = () => signOut();

  // Track the "Session timeout" preference: fetch once, then react live when it's
  // toggled on the Security Settings page (via a window event, no reload needed).
  useEffect(() => {
    let alive = true;
    fetchData('api/v1/auth/security-settings/')
      .then((s: any) => { if (alive && s && typeof s === 'object') setSessionTimeoutEnabled(!!s.session_timeout); })
      .catch(() => { /* keep the secure default on failure */ });
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail === 'object' && 'session_timeout' in detail) {
        setSessionTimeoutEnabled(!!detail.session_timeout);
      }
    };
    window.addEventListener('tw:security-settings-changed', onChange as EventListener);
    return () => {
      alive = false;
      window.removeEventListener('tw:security-settings-changed', onChange as EventListener);
    };
  }, []);

  // Auto sign-out after 30 min of inactivity when the preference is enabled.
  useIdleLogout({
    enabled: sessionTimeoutEnabled,
    timeoutMs: IDLE_TIMEOUT_MS,
    onTimeout: () => signOut('Signed out due to inactivity'),
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tw-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  // Role-based nav access control
  const NAV_ACCESS: Record<string, string[]> = {
    ADMIN: ['/', '/bookings', '/fleet', '/customers', '/invoices', '/capital', '/insights', '/insurance', '/copilot', '/settings'],
    MANAGER: ['/', '/bookings', '/fleet', '/customers', '/invoices', '/capital', '/insights', '/insurance', '/copilot', '/settings'],
    OPERATOR: ['/', '/bookings', '/fleet', '/customers', '/invoices', '/capital', '/insights', '/insurance', '/copilot'],
    DISPATCHER: ['/', '/bookings', '/fleet', '/customers', '/invoices', '/capital', '/insights', '/insurance', '/copilot'],
    VIEWER: ['/', '/bookings', '/fleet', '/customers', '/insights', '/insurance', '/copilot'],
    DRIVER: ['/', '/bookings'],
  };

  const allowedPaths = NAV_ACCESS[userRole] || NAV_ACCESS['VIEWER'];
  const canAccessSettings = !['VIEWER', 'DRIVER'].includes(userRole);
  // The capital desk is not a company-role item: it shows only when the
  // server says this user is TruckWys staff or a funder member.
  const { data: capitalStatus } = useCapitalStatus();
  const deskAccess = !!capitalStatus?.desk?.access;
  const allowed = (key: string) => (key === '/capital/desk' ? deskAccess : allowedPaths.includes(key));
  // The Copilot page is gated to INSIGHTS_ROLES (App.tsx). Only offer Ask to
  // roles that can reach it, so a DRIVER's query isn't swallowed by the guard.
  const canAsk = ['ADMIN', 'MANAGER', 'OPERATOR', 'DISPATCHER', 'VIEWER'].includes(userRole);
  const roleLabel = userRole.charAt(0) + userRole.slice(1).toLowerCase();
  const companyName = (authUser?.company_name as string) || 'Your company';
  const isAdmin = userRole === 'ADMIN';
  // Company logo for the sidebar chip. Same query key and endpoint the quote
  // builder already uses, so the cache is shared and Company settings'
  // invalidation refreshes it. Failure just falls back to the initial.
  const { data: companyProfile } = useQuery<any>({
    queryKey: ['company-profile'],
    queryFn: () => fetchData('api/v1/company/profile/'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const companyLogo = (() => {
    const url: string | undefined = companyProfile?.logo_url || companyProfile?.logo;
    // The backend returns a placeholder when nothing was uploaded; show the initial then.
    if (!url || typeof url !== 'string' || url.endsWith('/brand/logo.svg')) return undefined;
    if (/^https?:/.test(url)) return url;
    const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
    return `${apiBase}/${url.replace(/^\//, '')}`;
  })();
  // The sidebar's account line uses the SAME source as Settings > Billing
  // (GET billing/status/, same query key shape), so it never says "Account
  // active" on a free plan with no subscription. Roles that cannot read
  // billing fall back to the auth user's subscription_status.
  const { data: billingStatus } = useQuery<any>({
    queryKey: ['billing-status-shell'],
    queryFn: () => fetchData('api/v1/billing/status/'),
    enabled: canAccessSettings,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const billingPlan = String(billingStatus?.subscription_plan ?? '').toLowerCase();
  const billingSub = String(billingStatus?.subscription_status ?? subStatus ?? '').toLowerCase();
  const onFreePlan = !!billingStatus && (!billingPlan || billingPlan === 'free' || billingPlan === 'starter' || !['active', 'grace_period', 'trialing'].includes(billingSub));
  const baseLabel = subscriptionStatusLabel(billingSub || subStatus, cancelAtPeriodEnd);
  const status = {
    // 'Online' is the "active, or not loaded yet" label: say what the plan
    // really is once Billing's status is known.
    label: baseLabel === 'Online' ? (onFreePlan ? 'Free plan' : 'Account active') : baseLabel,
    tone: (baseLabel === 'Online' && onFreePlan ? 'neutral' : statusTone) as 'ok' | 'warn' | 'bad' | 'neutral',
    detail: baseLabel === 'Online' && onFreePlan
      ? 'No active subscription. Subscribe from Settings, Billing.'
      : subscriptionStatusDetail(billingSub || subStatus, cancelAtPeriodEnd),
    needsBilling: isSubscriptionBlocked(subStatus) || cancelAtPeriodEnd || (baseLabel === 'Online' && onFreePlan),
  };

  // Tablet widths get the rail automatically; the choice is remembered on desktop.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1100px)');
    const mqPhone = window.matchMedia('(max-width: 768px)');
    const on = () => setNarrow(mq.matches);
    const onPhone = () => setPhone(mqPhone.matches);
    mq.addEventListener('change', on);
    mqPhone.addEventListener('change', onPhone);
    return () => { mq.removeEventListener('change', on); mqPhone.removeEventListener('change', onPhone); };
  }, []);
  const railed = collapsed || narrow;
  const toggleCollapsed = () => setCollapsed((c) => {
    try { localStorage.setItem('tw-nav-collapsed', c ? '0' : '1'); } catch { /* private mode */ }
    return !c;
  });

  // Cmd/Ctrl+K focuses the Ask field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (!searchRef.current || searchRef.current.offsetParent === null) return;
        e.preventDefault();
        searchRef.current.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const closeMore = useCallback((v: boolean) => setMoreOpen(v), []);
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  // After the first page has rendered, fetch the primary route chunks while idle.
  useEffect(() => { warmRoutesWhenIdle(); }, []);

  return (
    <div
      className={`os-app-shell tw-shell${railed ? ' is-railed' : ''}`}
      data-rail={railed ? 'true' : 'false'}
    >
      {/* First focusable element: jumps past the sidebar and top bar. */}
      <a
        href="#main-content"
        className="tw-skip-link"
        onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); mainRef.current?.scrollIntoView({ block: 'start' }); }}
      >
        Skip to content
      </a>
      <LiveEvents />

      <Sidebar
        allowed={allowed}
        canAccessSettings={canAccessSettings}
        isAdmin={isAdmin}
        collapsed={railed}
        onToggle={toggleCollapsed}
        companyName={companyName}
        companyLogo={companyLogo}
        onSignOut={handleLogout}
        theme={theme}
        status={status}
      />

      {/* TOP BAR */}
      <header className="os-header tw-top">
        <a href="/" className="tw-top__mark" aria-label="TruckWys home" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <img src="/brand/truckwys-logo.png" alt="" style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
        </a>

        {canAsk && (
          <div className="tw-topsearch">
            <Search className="tw-topsearch__icon" size={16} strokeWidth={1.75} aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              className="tw-topsearch__input"
              aria-label="Ask Copilot"
              placeholder="Ask Copilot about your business"
              value={agentQuery}
              onChange={e => setAgentQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && agentQuery.trim()) {
                  navigate(`/copilot?q=${encodeURIComponent(agentQuery.trim())}`);
                  setAgentQuery('');
                  searchRef.current?.blur();
                }
                if (e.key === 'Escape') searchRef.current?.blur();
              }}
            />
            <kbd className="tw-kbd" aria-hidden="true">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
          </div>
        )}

        <div className="tw-top__actions os-header-actions">
          {/* Shared public demo account: always-visible reminder that this
              isn't a real customer's data (emails aren't actually sent, etc). */}
          {authUser?.is_demo && (
            <span className="tw-pill tw-pill--warn" title="Shared public demo account. Actions like emailing customers are simulated, not real.">
              Demo
            </span>
          )}
          {canAsk && (
            // Phones: the same Ask glyph as the desktop Ask box (a search mark, not a chat bubble).
            <button type="button" className="tw-icon-btn tw-top__ask" aria-label="Ask Copilot" onClick={() => navigate('/copilot')}>
              <Search size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          <NotificationBell />
          <button type="button" className="tw-icon-btn tw-top__theme" onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
          </button>
          <div className="os-profile-anchor tw-profile">
            <OverflowMenu
              label={`Account: ${userName}`}
              triggerLabel={`Account menu for ${userName}`}
              triggerTitle={userName}
              triggerClassName="os-profile-trigger tw-profile__trigger"
              trigger={(
                <span className="tw-avatar" aria-hidden="true">
                  {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
                </span>
              )}
              portal={false}
              menuClassName="os-header-popover tw-menu"
              itemClassName="os-profile-action tw-menu__item"
              header={(
                <div className="tw-menu__head">
                  <div className="tw-menu__name">{userName}</div>
                  <div className="tw-menu__email">{authUser?.email || authUser?.username || ''}</div>
                  {roleLabel && <div className="tw-menu__email">{roleLabel}</div>}
                </div>
              )}
              items={[
                // Phones only: a two-state item, "Dark theme" with a check when it is on.
                ...(phone ? [{ label: 'Dark theme', icon: <Moon size={16} strokeWidth={1.75} />, checked: theme === 'dark', onSelect: toggleTheme } as MenuItem] : []),
                { label: 'Profile and settings', icon: <SettingsIcon size={16} strokeWidth={1.75} />, onSelect: () => navigate('/settings') },
                ...(status.needsBilling ? [{ label: 'Go to billing', icon: <CreditCard size={16} strokeWidth={1.75} />, onSelect: () => navigate('/settings/billing') } as MenuItem] : []),
                { label: 'Sign out', icon: <LogOut size={16} strokeWidth={1.75} />, danger: true, onSelect: handleLogout },
              ]}
            />
          </div>
        </div>
      </header>

      {/* CONTENT */}
      {/* The route Suspense boundary lives here, inside <main>: a lazy page
          that is still loading shows the page-head skeleton at the exact head
          geometry, and the sidebar and top bar are never hidden or remounted
          (the app-level boundary in App.tsx would otherwise blank the shell). */}
      <main id="main-content" ref={mainRef} tabIndex={-1} className="os-app-main tw-main" data-route={pathname}>
        <ErrorBoundary variant="page" resetKey={pathname}>
          <Suspense fallback={<PageHeadSkeleton />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>

      <PhoneBar
        allowed={allowed}
        canAccessSettings={canAccessSettings}
        canAsk={canAsk}
        open={moreOpen}
        setOpen={closeMore}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignOut={handleLogout}
        status={status}
      />
    </div>
  );
}
