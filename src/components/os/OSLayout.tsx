import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, MessageSquareText, Sun, Moon, ChevronDown } from 'lucide-react';
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

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // "Auto sign out after 30 minutes of inactivity"

export function OSLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tw-theme') as 'dark' | 'light') || 'dark';
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('tw-nav-collapsed') === '1'; } catch { return false; }
  });
  const [narrow, setNarrow] = useState<boolean>(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1100px)').matches);
  const [moreOpen, setMoreOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [agentQuery, setAgentQuery] = useState('');
  // Default ON to match the backend default; corrected by the fetch below.
  const [sessionTimeoutEnabled, setSessionTimeoutEnabled] = useState(true);
  const profileRef = useRef<HTMLDivElement>(null);
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

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
  const allowed = (key: string) => allowedPaths.includes(key);
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
  const status = {
    label: subscriptionStatusLabel(subStatus, cancelAtPeriodEnd),
    tone: statusTone,
    detail: subscriptionStatusDetail(subStatus, cancelAtPeriodEnd),
    needsBilling: isSubscriptionBlocked(subStatus) || cancelAtPeriodEnd,
  };

  // Tablet widths get the rail automatically; the choice is remembered on desktop.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1100px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
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
          <div className="tw-search">
            <Search className="tw-search__icon" size={16} strokeWidth={1.75} aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              className="tw-search__input"
              aria-label="Ask Copilot"
              placeholder="Ask about your business"
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
            <button type="button" className="tw-icon-btn tw-top__ask" aria-label="Ask Copilot" onClick={() => navigate('/copilot')}>
              <MessageSquareText size={18} strokeWidth={1.75} />
            </button>
          )}
          <NotificationBell />
          <button type="button" className="tw-icon-btn tw-top__theme theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title="Toggle theme">
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
          </button>
          <div ref={profileRef} className="os-profile-anchor tw-profile">
            <button type="button" className="os-profile-trigger tw-profile__trigger" aria-label="Open profile menu" aria-expanded={showProfileMenu}
              onClick={() => setShowProfileMenu(p => !p)}
              title={userName}
            >
              <span className="tw-avatar" aria-hidden="true">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
              </span>
              <span className="tw-profile__text">
                <span className="tw-profile__name">{userName}</span>
                <span className="tw-profile__role">{roleLabel}</span>
              </span>
              <ChevronDown className="tw-profile__chev" size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {showProfileMenu && (
              <div className="os-header-popover tw-menu" role="menu">
                <div className="tw-menu__head">
                  <div className="tw-menu__name">{userName}</div>
                  <div className="tw-menu__email">{authUser?.email || authUser?.username || ''}</div>
                </div>
                <button type="button" role="menuitem" className="os-profile-action tw-menu__item"
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/settings');
                  }}
                >
                  Profile & settings
                </button>
                {status.needsBilling && (
                  <button type="button" role="menuitem" className="os-profile-action tw-menu__item"
                    onClick={() => { setShowProfileMenu(false); navigate('/settings/billing'); }}>
                    Go to billing
                  </button>
                )}
                <button type="button" role="menuitem" className="os-profile-action tw-menu__item tw-menu__item--danger" onClick={handleLogout}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main id="main-content" ref={mainRef} tabIndex={-1} className="os-app-main tw-main">
        <ErrorBoundary variant="page" resetKey={pathname}>
          {children}
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
