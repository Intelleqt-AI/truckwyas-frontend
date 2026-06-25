import { useParams, NavLink, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

// Import individual setting pages
import { ProfileSettings } from "./settings/ProfileSettings";
import { NotificationSettings } from "./settings/NotificationSettings";
import { SecuritySettings } from "./settings/SecuritySettings";
import { CompanySettings } from "./settings/CompanySettings";
import { UsersPermissions } from "./settings/UsersPermissions";
import { BillingSettings } from "./settings/BillingSettings";
import { IntegrationsSettings } from "./settings/IntegrationsSettings";
import { CustomersDirectory } from "./settings/CustomersDirectory";
import { VehiclesDirectory } from "./settings/VehiclesDirectory";
import { VehicleTypesDirectory } from "./settings/VehicleTypesDirectory";
import { DeveloperApi } from "./settings/DeveloperApi";

const SECTIONS = [
  {
    group: 'My Account',
    items: [
      { id: 'profile', label: 'Profile', component: ProfileSettings },
      { id: 'notifications', label: 'Notifications', component: NotificationSettings },
      { id: 'security', label: 'Security', component: SecuritySettings },
    ],
  },
  {
    group: 'Workspace',
    items: [
      { id: 'company', label: 'Company Details', component: CompanySettings, adminOnly: true },
      { id: 'users', label: 'Users & Permissions', component: UsersPermissions, adminOnly: true },
      { id: 'billing', label: 'Billing', component: BillingSettings, adminOnly: true },
      { id: 'integrations', label: 'Integrations', component: IntegrationsSettings, adminOnly: true },
    ],
  },
  {
    group: 'Directory',
    items: [
      { id: 'customers', label: 'Customers', component: CustomersDirectory },
      { id: 'vehicles', label: 'Vehicles', component: VehiclesDirectory },
      { id: 'vehicle-types', label: 'Vehicle Types', component: VehicleTypesDirectory },
    ],
  },
  {
    group: 'Developers',
    items: [
      { id: 'risk-api', label: 'Risk-Scoring API', component: DeveloperApi, adminOnly: true },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap(s => s.items);

export default function Settings() {
  const { section } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  if (!section) return <Navigate to="/settings/profile" replace />;

  const current = ALL_ITEMS.find(i => i.id === section);

  // Redirect non-admins away from admin-only sections
  if ((current as any)?.adminOnly && !isAdmin) {
    return <Navigate to="/settings/profile" replace />;
  }

  const CurrentComponent = current?.component || ProfileSettings;

  const visibleSections = SECTIONS.map(s => ({
    ...s,
    items: s.items.filter(item => !(item as any).adminOnly || isAdmin),
  })).filter(s => s.items.length > 0);

  return (
    <div style={{ display: 'flex', minHeight: '100%', gap: 0 }}>
      {/* Sidebar */}
      <div style={{
        width: 220,
        flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)',
        paddingTop: 8,
        paddingBottom: 24,
      }}>
        {visibleSections.map((s, idx) => (
          <div key={s.group} style={{ marginBottom: idx < visibleSections.length - 1 ? 20 : 0 }}>
            <div style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '12px 20px 6px',
            }}>
              {s.group}
            </div>
            {s.items.map(item => {
              const active = section === item.id;
              return (
                <NavLink
                  key={item.id}
                  to={`/settings/${item.id}`}
                  style={{
                    display: 'block',
                    padding: '8px 20px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    textDecoration: 'none',
                    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    background: active ? 'rgba(var(--accent-primary-rgb, 37,99,235), 0.08)' : 'transparent',
                    borderLeft: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    transition: 'color 0.15s, background 0.15s',
                  }}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '0 0 0 32px', minWidth: 0 }}>
        <CurrentComponent />
      </div>
    </div>
  );
}
