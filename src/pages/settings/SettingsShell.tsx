import { NavLink } from "react-router-dom";
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
      { id: 'users', label: 'Users & permissions', adminOnly: true },
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
      { id: 'risk-api', label: 'Risk-scoring API', adminOnly: true },
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

interface SettingsShellProps {
  /** Sidebar item to highlight (sub-pages pass their parent section). */
  activeId: string;
  children: React.ReactNode;
}

export function SettingsShell({ activeId, children }: SettingsShellProps) {
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  const visibleSections = SETTINGS_NAV.map(s => ({
    ...s,
    items: s.items.filter(item => !item.adminOnly || isAdmin),
  })).filter(s => s.items.length > 0);

  return (
    <div className="tw-settings-shell" style={{ display: 'flex', minHeight: '100%', gap: 0 }}>
      {/* Sidebar — this outer column stays full height so its right border
          runs top to bottom alongside the (taller) settings panel; only the
          nav content inside is sticky, via the inner wrapper below. */}
      <div style={{
        width: 220,
        flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)',
      }}>
      <nav aria-label="Settings" style={{
        position: 'sticky',
        top: 0,
        maxHeight: '100vh',
        overflowY: 'auto',
        paddingTop: 8,
        paddingBottom: 24,
      }}>
        {visibleSections.map((s, idx) => (
          <div key={s.group} style={{ marginBottom: idx < visibleSections.length - 1 ? 20 : 0 }}>
            <div style={{ ...groupLabelStyle, padding: '12px 20px 6px' }}>
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
          <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ ...groupLabelStyle, padding: '0 20px 6px' }}>
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
      <div style={{ flex: 1, padding: '0 0 0 32px', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
