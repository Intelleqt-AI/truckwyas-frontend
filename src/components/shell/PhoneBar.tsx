import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { prefetchProps } from './routePrefetch';
import { Ellipsis, Settings, MessageSquareText, Sun, Moon, LogOut, X } from 'lucide-react';
import { NAV_GROUPS, PHONE_PRIMARY, isItemActive, underPrefix, type NavItem } from './nav';

interface PhoneBarProps {
  allowed: (key: string) => boolean;
  canAccessSettings: boolean;
  canAsk: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSignOut: () => void;
  status: { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' };
}

/**
 * Phone navigation: exactly four fixed tabs plus "More". Nothing scrolls
 * sideways; everything else lives in the More sheet, grouped like the sidebar.
 */
export function PhoneBar({ allowed, canAccessSettings, canAsk, open, setOpen, theme, onToggleTheme, onSignOut, status }: PhoneBarProps) {
  const { pathname } = useLocation();
  const sheetRef = useRef<HTMLDivElement>(null);

  const visible: NavItem[] = NAV_GROUPS.flatMap((g) => g.items.filter((i) => allowed(i.key)));
  // Preferred four first; if a role cannot see one, the next visible item fills the slot.
  const primary = [
    ...visible.filter((i) => PHONE_PRIMARY.includes(i.id)),
    ...visible.filter((i) => !PHONE_PRIMARY.includes(i.id)),
  ].slice(0, 4);
  const primaryIds = new Set(primary.map((i) => i.id));
  const moreActive = !open && (visible.some((i) => !primaryIds.has(i.id) && isItemActive(i, pathname)) || underPrefix(pathname, '/settings') || underPrefix(pathname, '/copilot'));

  // Close on route change and on Escape.
  useEffect(() => { setOpen(false); }, [pathname, setOpen]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    sheetRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  return (
    <>
      <nav className="tw-tabbar" aria-label="Main navigation">
        {primary.map((i) => {
          const Icon = i.icon;
          const active = !open && isItemActive(i, pathname);
          return (
            <Link key={i.id} to={i.to} {...prefetchProps(i.to)} className={`tw-tab${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              <span>{i.short || i.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          data-shell-more
          className={`tw-tab${open || moreActive ? ' is-active' : ''}`}
          aria-expanded={open}
          aria-controls="tw-more-sheet"
          onClick={() => setOpen(!open)}
        >
          <Ellipsis size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      {open && (
        <div className="tw-sheet-backdrop" onClick={() => setOpen(false)}>
          <div
            id="tw-more-sheet"
            ref={sheetRef}
            tabIndex={-1}
            className="tw-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tw-sheet__head">
              <span className="tw-sheet__title">More</span>
              <button type="button" className="tw-icon-btn" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            {NAV_GROUPS.map((g) => {
              const items = g.items.filter((i) => allowed(i.key) && !primaryIds.has(i.id));
              if (!items.length) return null;
              return (
                <div key={g.id} className="tw-sheet__group">
                  {g.label && <div className="tw-nav__group-label">{g.label}</div>}
                  {items.map((i) => {
                    const Icon = i.icon;
                    const active = isItemActive(i, pathname);
                    return (
                      <Link key={i.id} to={i.to} {...prefetchProps(i.to)} className={`tw-nav__item${active ? ' is-active' : ''}${i.muted ? ' is-muted' : ''}`} aria-current={active ? 'page' : undefined}>
                        <Icon className="tw-nav__icon" aria-hidden="true" strokeWidth={1.75} />
                        <span className="tw-nav__label">{i.label}</span>
                        {i.muted && <span className="tw-nav__soon">Soon</span>}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
            <div className="tw-sheet__group">
              <div className="tw-nav__group-label">Account</div>
              {canAsk && (
                <Link to="/copilot" className={`tw-nav__item${underPrefix(pathname, '/copilot') ? ' is-active' : ''}`}>
                  <MessageSquareText className="tw-nav__icon" aria-hidden="true" strokeWidth={1.75} />
                  <span className="tw-nav__label">Ask Copilot</span>
                </Link>
              )}
              {canAccessSettings && (
                <Link to="/settings" className={`tw-nav__item${underPrefix(pathname, '/settings') ? ' is-active' : ''}`}>
                  <Settings className="tw-nav__icon" aria-hidden="true" strokeWidth={1.75} />
                  <span className="tw-nav__label">Settings</span>
                </Link>
              )}
              <button type="button" className="tw-nav__item" onClick={onToggleTheme}>
                {theme === 'dark'
                  ? <Sun className="tw-nav__icon" aria-hidden="true" strokeWidth={1.75} />
                  : <Moon className="tw-nav__icon" aria-hidden="true" strokeWidth={1.75} />}
                <span className="tw-nav__label">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
              </button>
              <button type="button" className="tw-nav__item is-danger" onClick={onSignOut}>
                <LogOut className="tw-nav__icon" aria-hidden="true" strokeWidth={1.75} />
                <span className="tw-nav__label">Sign out</span>
              </button>
            </div>
            <div className={`tw-side__status is-${status.tone}`} aria-label={`Account: ${status.label}`}>
              <span className="tw-dot" aria-hidden="true" />
              <span>{status.label}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
