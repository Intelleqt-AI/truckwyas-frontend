import { useParams, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

import AdminHome from '@/pages/admin/AdminHome';
import { CompaniesTable } from '@/pages/admin/CompaniesTable';
import UsersTable from '@/pages/admin/UsersTable';
import DemoAccountPanel from '@/pages/admin/DemoAccountPanel';
import SearchPanel from '@/pages/admin/SearchPanel';
import PlatformHealth from '@/pages/admin/PlatformHealth';
import AuditLogPanel from '@/pages/admin/AuditLogPanel';

type SectionItem = { id: string; label: string; component: () => JSX.Element };
type Section = { group: string; items: SectionItem[] };

const SECTIONS: Section[] = [
  {
    group: 'Overview',
    items: [
      { id: 'home', label: 'Home', component: AdminHome },
    ],
  },
  {
    group: 'Tenants',
    items: [
      { id: 'companies', label: 'Companies', component: CompaniesTable },
      { id: 'users', label: 'Users', component: UsersTable },
    ],
  },
  {
    group: 'Support',
    items: [
      { id: 'search', label: 'Search', component: SearchPanel },
      { id: 'demo', label: 'Demo Account', component: DemoAccountPanel },
    ],
  },
  {
    group: 'Platform',
    items: [
      { id: 'health', label: 'Platform Health', component: PlatformHealth },
      { id: 'audit-log', label: 'Audit Log', component: AuditLogPanel },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap(s => s.items);

export default function AdminDashboard() {
  const { section } = useParams();
  const { user: authUser } = useAuth();

  // Real enforcement is server-side (every /api/v1/admin/ endpoint requires
  // IsSuperUser) — this is just so a non-superuser never lands on a dead page.
  if (!authUser?.is_superuser) return <Navigate to="/" replace />;

  if (!section) return <Navigate to="/admin/home" replace />;

  const current = ALL_ITEMS.find(i => i.id === section);
  if (!current) return <Navigate to="/admin/home" replace />;

  const CurrentComponent = current.component;

  return (
    <div style={{ display: 'flex', minHeight: '100%', gap: 0 }}>
      {/* Sidebar — same shape as Settings.tsx's own section nav, so the two
          "many sub-pages under one prefix" areas of the app feel consistent. */}
      <div style={{
        width: 220,
        flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          position: 'sticky',
          top: 0,
          maxHeight: '100vh',
          overflowY: 'auto',
          paddingTop: 8,
          paddingBottom: 24,
        }}>
          <div style={{ padding: '4px 20px 16px' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Platform
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>Admin Dashboard</div>
          </div>
          {SECTIONS.map((s, idx) => (
            <div key={s.group} style={{ marginBottom: idx < SECTIONS.length - 1 ? 20 : 0 }}>
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
                    to={`/admin/${item.id}`}
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
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '0 0 60px 32px', minWidth: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{current.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Cross-tenant visibility and controls, superuser only. Every write action is recorded in the audit log.
          </div>
        </div>
        <CurrentComponent />
      </div>
    </div>
  );
}
