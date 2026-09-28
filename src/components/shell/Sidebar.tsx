import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { NAV_GROUPS, isItemActive, underPrefix, type NavItem } from './nav';

interface SidebarProps {
  allowed: (key: string) => boolean;
  canAccessSettings: boolean;
  collapsed: boolean;
  onToggle: () => void;
  companyName: string;
  theme: 'dark' | 'light';
  status: { label: string; tone: 'ok' | 'warn' | 'bad'; detail: string; needsBilling: boolean };
}

function NavLinkItem({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={`tw-nav__item${active ? ' is-active' : ''}${item.muted ? ' is-muted' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      <Icon className="tw-nav__icon" aria-hidden="true" strokeWidth={1.75} />
      <span className="tw-nav__label">{item.label}</span>
      {item.muted && !collapsed && <span className="tw-nav__soon">Soon</span>}
      {collapsed && <span className="tw-tip" role="tooltip">{item.label}{item.muted ? ' (not live)' : ''}</span>}
    </Link>
  );
}

/** Labelled, grouped sidebar. 232px, collapsible to a 64px rail with tooltips. */
export function Sidebar({ allowed, canAccessSettings, collapsed, onToggle, companyName, theme, status }: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const initial = (companyName || 'T').trim().charAt(0).toUpperCase();

  return (
    <aside className="tw-side" aria-label="Main navigation">
      <div className="tw-side__brand">
        <Link to="/" className="tw-side__logo" aria-label="TruckWys home">
          <img
            src="/brand/truckwys-logo.png"
            alt=""
            style={{ filter: theme === 'dark' ? 'invert(1) brightness(2)' : 'none' }}
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

      <div className="tw-side__company" title={companyName}>
        <span className="tw-side__company-mark" aria-hidden="true">{initial}</span>
        <span className="tw-side__company-name">{companyName}</span>
      </div>

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
          <span className="tw-side__status-label">{status.label === 'Online' ? 'Account active' : status.label}</span>
          <span className="tw-tip tw-tip--wide" role="tooltip">{status.detail}</span>
        </button>
      </div>
    </aside>
  );
}
