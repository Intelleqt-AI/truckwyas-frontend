import { useParams, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import '@/pages/admin/admin-brand.css';

import AdminHome from '@/pages/admin/AdminHome';
import { CompaniesTable } from '@/pages/admin/CompaniesTable';
import UsersTable from '@/pages/admin/UsersTable';
import DemoAccountPanel from '@/pages/admin/DemoAccountPanel';
import SearchPanel from '@/pages/admin/SearchPanel';
import PlatformHealth from '@/pages/admin/PlatformHealth';
import AuditLogPanel from '@/pages/admin/AuditLogPanel';
import VehicleTypesPanel from '@/pages/admin/VehicleTypesPanel';
import CrossBorderRatesPanel from '@/pages/admin/CrossBorderRatesPanel';
import '@/components/layout/section-header.css';

type SectionItem = { id: string; label: string; component: () => JSX.Element };
type Section = { group: string; items: SectionItem[] };

const SECTIONS: Section[] = [
  {
    group: 'Summary',
    items: [
      { id: 'home', label: 'Overview', component: AdminHome },
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
      { id: 'demo', label: 'Demo account', component: DemoAccountPanel },
    ],
  },
  {
    group: 'Catalog',
    items: [
      { id: 'vehicle-types', label: 'Truck types', component: VehicleTypesPanel },
      { id: 'cross-border-rates', label: 'Cross-border rates', component: CrossBorderRatesPanel },
    ],
  },
  {
    group: 'Platform',
    items: [
      { id: 'health', label: 'Platform health', component: PlatformHealth },
      { id: 'audit-log', label: 'Audit log', component: AuditLogPanel },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap(s => s.items);

export default function AdminDashboard() {
  const { section } = useParams();
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  // Real enforcement is server-side (every /api/v1/admin/ endpoint requires
  // IsSuperUser) — this is just so a non-superuser never lands on a dead page.
  if (!authUser?.is_superuser) return <Navigate to="/" replace />;

  if (!section) return <Navigate to="/admin/home" replace />;

  const current = ALL_ITEMS.find(i => i.id === section);
  if (!current) return <Navigate to="/admin/home" replace />;

  const CurrentComponent = current.component;

  return (
    <div className="tw-admin-page">
      {/* Head first, full width: the H1 sits at the same x and y as on every
          other page, and the section list starts where the content starts. */}
      <header className="section-header settings-page-head">
        <div className="section-header__top">
          <div className="section-header__titles">
            <div className="section-header__title-row">
              <h1 className="section-header__title">{current.label}</h1>
            </div>
            <p className="section-header__description">Superuser only. Every change is audited.</p>
          </div>
        </div>
      </header>
      {/* Phones: one picker instead of a strip of links that clips at both edges. */}
      <div className="tw-admin-phone-nav">
        <Select value={current.id} onValueChange={(v) => navigate(`/admin/${v}`)}>
          <SelectTrigger aria-label="Admin section" className="tw-admin-phone-nav__trigger"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SECTIONS.map(s => (
              <SelectGroup key={s.group}>
                <SelectLabel>{s.group}</SelectLabel>
                {s.items.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
    <div className="tw-admin-shell">
      <div className="tw-admin-shell__side">
        <nav aria-label="Admin dashboard" className="tw-admin-shell__nav">
          {SECTIONS.map((s, idx) => (
            <div key={s.group} className="tw-admin-shell__group" style={{ marginBottom: idx < SECTIONS.length - 1 ? 20 : 0 }}>
              <div className="tw-admin-shell__group-label" style={{
                fontSize: 13,
                lineHeight: '20px',
                fontWeight: 500,
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-tertiary)',
                letterSpacing: 'normal',
                padding: idx === 0 ? '0 12px 6px' : '12px 12px 6px',
              }}>
                {s.group}
              </div>
              {s.items.map(item => {
                const active = section === item.id;
                return (
                  <NavLink
                    key={item.id}
                    to={`/admin/${item.id}`}
                    className="admin-control admin-nav-link"
                    aria-current={active ? 'page' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: 36,
                      margin: '1px 0',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-control)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 14,
                      lineHeight: '20px',
                      letterSpacing: 'normal',
                      textDecoration: 'none',
                      fontWeight: active ? 500 : 400,
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: active ? 'var(--surface-tint-active)' : 'transparent',
                      transition: 'color 0.15s, background 0.15s',
                    }}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="tw-admin-shell__content">
        <CurrentComponent />
      </div>
    </div>
    </div>
  );
}
