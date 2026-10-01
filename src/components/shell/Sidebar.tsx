import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { prefetchProps } from './routePrefetch';
import { PanelLeftClose, PanelLeftOpen, Settings, ChevronsUpDown, Building2, CreditCard, Users, LogOut } from 'lucide-react';
import { NAV_GROUPS, isItemActive, underPrefix, type NavItem } from './nav';

interface SidebarProps {
  allowed: (key: string) => boolean;
  canAccessSettings: boolean;
  /** Company details, users and billing are admin-only settings sections. */
  isAdmin: boolean;
  collapsed: boolean;
  onToggle: () => void;
  companyName: string;
  /** The company's uploaded logo (company profile), resolved to an absolute URL. */
  companyLogo?: string;
  onSignOut: () => void;
  theme: 'dark' | 'light';
  status: { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral'; detail: string; needsBilling: boolean };
}

function NavLinkItem({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={`tw-nav__item${active ? ' is-active' : ''}${item.muted ? ' is-muted' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      {...prefetchProps(item.to)}
    >
      <Icon className="tw-nav__icon" aria-hidden="true" strokeWidth={1.75} />
      <span className="tw-nav__label">{item.label}</span>
      {item.muted && !collapsed && <span className="tw-nav__soon">Soon</span>}
      {collapsed && <span className="tw-tip" role="tooltip">{item.label}{item.muted ? ' (not live)' : ''}</span>}
    </Link>
  );
}

/** Company switcher-style chip: logo (or initial) + name, opens the company menu. */
function CompanyMenu({ companyName, companyLogo, isAdmin, canAccessSettings, collapsed, onSignOut }: {
  companyName: string; companyLogo?: string; isAdmin: boolean; canAccessSettings: boolean; collapsed: boolean; onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const initial = (companyName || 'T').trim().charAt(0).toUpperCase();
  const showLogo = !!companyLogo && !logoFailed;

  useEffect(() => { setLogoFailed(false); }, [companyLogo]);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    // Focus the first item so keyboard users land inside the menu.
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const go = (to: string) => { setOpen(false); navigate(to); };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={wrapRef} className="tw-company">
      <button
        ref={triggerRef}
        type="button"
        className="tw-side__company"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${companyName}: company menu`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`tw-side__company-mark${showLogo ? ' has-logo' : ''}`} aria-hidden="true">
          {showLogo ? <img src={companyLogo} alt="" onError={() => setLogoFailed(true)} /> : initial}
        </span>
        <span className="tw-side__company-name">{companyName}</span>
        <ChevronsUpDown className="tw-side__company-chev" size={14} strokeWidth={1.75} aria-hidden="true" />
        {collapsed && !open && <span className="tw-tip" role="tooltip">{companyName}</span>}
      </button>
      {open && (
        <div ref={menuRef} className="tw-menu tw-company__menu" role="menu" aria-label="Company" onKeyDown={onMenuKey}>
          <div className="tw-menu__head">
            <div className="tw-menu__name">{companyName}</div>
          </div>
          {isAdmin && (
            <>
              <button type="button" role="menuitem" className="tw-menu__item" onClick={() => go('/settings/company')}>
                <Building2 size={16} strokeWidth={1.75} aria-hidden="true" /> Company settings
              </button>
              <button type="button" role="menuitem" className="tw-menu__item" onClick={() => go('/settings/billing')}>
                <CreditCard size={16} strokeWidth={1.75} aria-hidden="true" /> Billing and plan
              </button>
              <button type="button" role="menuitem" className="tw-menu__item" onClick={() => go('/settings/users')}>
                <Users size={16} strokeWidth={1.75} aria-hidden="true" /> Users
              </button>
            </>
          )}
          {!isAdmin && canAccessSettings && (
            <button type="button" role="menuitem" className="tw-menu__item" onClick={() => go('/settings')}>
              <Settings size={16} strokeWidth={1.75} aria-hidden="true" /> Settings
            </button>
          )}
          <div className="tw-menu__sep" role="separator" />
          <button type="button" role="menuitem" className="tw-menu__item tw-menu__item--danger" onClick={() => { setOpen(false); onSignOut(); }}>
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Labelled, grouped sidebar. 232px, collapsible to a 64px rail with tooltips. */
export function Sidebar({ allowed, canAccessSettings, isAdmin, collapsed, onToggle, companyName, companyLogo, onSignOut, theme, status }: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="tw-side" aria-label="Main navigation">
      <div className="tw-side__brand">
        <Link to="/" className="tw-side__logo" aria-label="TruckWys home">
          <img
            src="/brand/truckwys-logo.png"
            alt=""
            style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }}
          />
        </Link>
        <button
          type="button"
          className="tw-icon-btn tw-side__toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.75} /> : <PanelLeftClose size={16} strokeWidth={1.75} />}
          {collapsed && <span className="tw-tip" role="tooltip">Expand sidebar</span>}
        </button>
      </div>

      <CompanyMenu
        companyName={companyName}
        companyLogo={companyLogo}
        isAdmin={isAdmin}
        canAccessSettings={canAccessSettings}
        collapsed={collapsed}
        onSignOut={onSignOut}
      />

      <nav className="tw-nav" aria-label="Sections">
        {NAV_GROUPS.map((g) => {
          const items = g.items.filter((i) => allowed(i.key));
          if (items.length === 0) return null;
          return (
            <div className="tw-nav__group" key={g.id} role="group" aria-label={g.label || 'Home'}>
              {g.label && <div className="tw-nav__group-label">{g.label}</div>}
              {items.map((i) => (
                <NavLinkItem key={i.id} item={i} active={isItemActive(i, pathname)} collapsed={collapsed} />
              ))}
            </div>
          );
        })}
      </nav>

      <div className="tw-side__foot">
        {canAccessSettings && (
          <Link
            to="/settings"
            className={`tw-nav__item${underPrefix(pathname, '/settings') ? ' is-active' : ''}`}
            aria-current={underPrefix(pathname, '/settings') ? 'page' : undefined}
            aria-label={collapsed ? 'Settings' : undefined}
          >
            <Settings className="tw-nav__icon" aria-hidden="true" strokeWidth={1.75} />
            <span className="tw-nav__label">Settings</span>
            {collapsed && <span className="tw-tip" role="tooltip">Settings</span>}
          </Link>
        )}
        <button
          type="button"
          className={`tw-side__status is-${status.tone}`}
          onClick={() => status.needsBilling && navigate('/settings/billing')}
          aria-label={`Account: ${status.label}. ${status.detail}`}
          style={{ cursor: status.needsBilling ? 'pointer' : 'default' }}
        >
          <span className="tw-dot" aria-hidden="true" />
          <span className="tw-side__status-label">{status.label}</span>
          <span className="tw-tip tw-tip--wide" role="tooltip">{status.detail}</span>
        </button>
      </div>
    </aside>
  );
}
