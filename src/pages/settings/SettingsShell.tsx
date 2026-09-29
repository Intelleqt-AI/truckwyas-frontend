import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";
import '@/pages/settings/settings-brand.css';

// The settings sidebar + content column, shared by the /settings/:section
// router and the three settings sub-pages that have their own routes
// (billing history, Xero, fleet import). Keeping one shell means the page
// title, sidebar and 960px content column sit at exactly the same place in
// every section — they used to jump when leaving the shell for a sub-page.
// Nav metadata only; which component renders per id stays in Settings.tsx.

export type SettingsNavItem = { id: string; label: string; adminOnly?: boolean };
export type SettingsNavGroup = { group: string; items: SettingsNavItem[] };

export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    group: 'My account',
    items: [
      { id: 'profile', label: 'Profile' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'security', label: 'Security' },
    ],
  },
  {
    group: 'Workspace',
    items: [
      { id: 'company', label: 'Company details', adminOnly: true },
      { id: 'users', label: 'Users and permissions', adminOnly: true },
      { id: 'billing', label: 'Billing', adminOnly: true },
      { id: 'integrations', label: 'Integrations', adminOnly: true },
    ],
  },
  {
    group: 'Directory',
    items: [
      { id: 'customers', label: 'Customers' },
      { id: 'vehicles', label: 'Vehicles' },
      { id: 'vehicle-types', label: 'Vehicle types' },
    ],
  },
  {
    group: 'Developers',
    items: [
      { id: 'risk-api', label: 'Payment risk API', adminOnly: true },
    ],
  },
];

const groupLabelStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  color: 'var(--text-tertiary)',
  letterSpacing: 'normal',
  textTransform: 'none',
};

/* The page head sits ABOVE the sub-nav and the content (R3): the H1 is at the
   same x and y as on every other page, and the sub-nav starts where content
   starts. Each section renders its own SettingsPageHeader; the shell hands it
   a slot at the top through this context (a portal), and shows a fallback
   head with the section's nav label until a page claims the slot, so the
   content never moves when a section finishes loading. On phones the
   sub-nav is a picker under the head. */
type ShellCtx = { slot: HTMLElement | null; phoneNav: ReactNode; claim: () => () => void };
const ShellContext = createContext<ShellCtx | null>(null);

/** Used by SettingsPageHeader: the head slot and phone picker, when inside the shell. */
export function useSettingsShell() {
  const ctx = useContext(ShellContext);
  useLayoutEffect(() => (ctx ? ctx.claim() : undefined), [ctx?.claim]);
  return ctx;
}

/** Kept for callers that rendered the phone nav themselves; the head now carries it. */
export function SettingsPhoneNav() {
  return null;
}

interface SettingsShellProps {
  /** Sidebar item to highlight (sub-pages pass their parent section). */
  activeId: string;
  children: React.ReactNode;
}

export function SettingsShell({ activeId, children }: SettingsShellProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState(0);
  const claim = useCallback(() => { setClaims(c => c + 1); return () => setClaims(c => c - 1); }, []);

  const visibleSections = SETTINGS_NAV.map(s => ({
    ...s,
    items: s.items.filter(item => !item.adminOnly || isAdmin),
  })).filter(s => s.items.length > 0);
  const allItems = visibleSections.flatMap(s => s.items);
  const activeLabel = allItems.find(i => i.id === activeId)?.label ?? 'Settings';

  // Phones: one picker instead of a strip of links that clips at both edges.
  const phoneNav = (
    <div className="tw-settings-phone-nav">
      <Select value={activeId} onValueChange={(v) => navigate(v === '__admin' ? '/admin' : `/settings/${v}`)}>
        <SelectTrigger aria-label="Settings section" className="tw-settings-phone-nav__trigger"><SelectValue /></SelectTrigger>
        <SelectContent>
          {visibleSections.map(s => (
            <SelectGroup key={s.group}>
              <SelectLabel>{s.group}</SelectLabel>
              {s.items.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
            </SelectGroup>
          ))}
          {user?.is_superuser && (
            <SelectGroup>
              <SelectLabel>Platform</SelectLabel>
              <SelectItem value="__admin">Admin dashboard</SelectItem>
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
  const ctx = useMemo<ShellCtx>(() => ({ slot, phoneNav, claim }), [slot, activeId, isAdmin, user?.is_superuser, claim]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ShellContext.Provider value={ctx}>
    <div className="tw-settings-page">
      <div ref={setSlot} className="tw-settings-page__head">
        {claims === 0 && (
          <>
            <header className="section-header settings-page-head">
              <div className="section-header__top">
                <div className="section-header__titles">
                  <div className="section-header__title-row"><h1 className="section-header__title">{activeLabel}</h1></div>
                  <p className="section-header__description" />
                </div>
              </div>
            </header>
            {phoneNav}
          </>
        )}
      </div>
    <div className="tw-settings-shell">
      {/* Sidebar — this outer column stays full height so its right border
          runs top to bottom alongside the (taller) settings panel; only the
          nav content inside is sticky, via the inner wrapper below. */}
      <div className="tw-settings-shell__side">
      <nav aria-label="Settings" className="tw-settings-shell__nav">
        {visibleSections.map((s, idx) => (
          <div key={s.group} className="tw-settings-shell__group" style={{ marginBottom: idx < visibleSections.length - 1 ? 20 : 0 }}>
            <div className="tw-settings-shell__group-label" style={{ ...groupLabelStyle, padding: idx === 0 ? '0 12px 6px' : '12px 12px 6px' }}>
              {s.group}
            </div>
            {s.items.map(item => {
              const active = activeId === item.id;
              return (
                <NavLink
                  key={item.id}
                  to={`/settings/${item.id}`}
                  className="settings-control settings-nav-link"
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        ))}
        {/* Platform-level, not a company setting — jumps to its own full
            page rather than rendering inline like the sections above. */}
        {user?.is_superuser && (
          <div className="tw-settings-shell__group" style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
            <div className="tw-settings-shell__group-label" style={{ ...groupLabelStyle, padding: '0 12px 6px' }}>
              Platform
            </div>
            <NavLink
              to="/admin"
              className="settings-control settings-nav-link"
            >
              Admin dashboard
            </NavLink>
          </div>
        )}
      </nav>
      </div>

      {/* Content */}
      <div className="tw-settings-shell__content">
        {children}
      </div>
    </div>
    </div>
    </ShellContext.Provider>
  );
}
