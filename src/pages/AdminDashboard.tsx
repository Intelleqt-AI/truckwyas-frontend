import { useEffect, useRef } from 'react';
import { useParams, NavLink, Navigate } from 'react-router-dom';
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
  // On phones the section list is one horizontal row; keep the current one in view.
  const navRef = useRef<HTMLElement>(null);
  const phoneNavRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = phoneNavRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    const cur = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!cur) return;
    const left = cur.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    nav.scrollLeft = left - (nav.clientWidth - cur.offsetWidth) / 2;
  }, [section]);

  // Real enforcement is server-side (every /api/v1/admin/ endpoint requires
  // IsSuperUser) — this is just so a non-superuser never lands on a dead page.
  if (!authUser?.is_superuser) return <Navigate to="/" replace />;

  if (!section) return <Navigate to="/admin/home" replace />;

  const current = ALL_ITEMS.find(i => i.id === section);
  if (!current) return <Navigate to="/admin/home" replace />;

  const CurrentComponent = current.component;

  return (
    <div className="tw-admin-shell" style={{ display: 'flex', minHeight: '100%', gap: 0 }}>
      {/* Sidebar — same shape as Settings.tsx's own section nav, so the two
          "many sub-pages under one prefix" areas of the app feel consistent. */}
      <div className="tw-admin-shell__side" style={{
        width: 220,
        flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)',
      }}>
        <nav ref={navRef} aria-label="Admin dashboard" className="tw-admin-shell__nav" style={{
          position: 'sticky',
          top: 0,
          maxHeight: '100vh',
          overflowY: 'auto',
          paddingTop: 8,
          paddingBottom: 24,
        }}>
          <div className="tw-admin-shell__brand" style={{ padding: '4px 20px 16px' }}>
            <div style={{ fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'normal' }}>
              Platform
            </div>
            <div style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>Admin dashboard</div>
          </div>
          {SECTIONS.map((s, idx) => (
            <div key={s.group} className="tw-admin-shell__group" style={{ marginBottom: idx < SECTIONS.length - 1 ? 20 : 0 }}>
              <div className="tw-admin-shell__group-label" style={{
                fontSize: 13,
                lineHeight: '20px',
                fontWeight: 500,
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-tertiary)',
                letterSpacing: 'normal',
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
                    className="admin-control admin-nav-link"
                    aria-current={active ? 'page' : undefined}
                    style={{
                      display: 'block',
                      margin: '0 8px',
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
      <div className="tw-admin-shell__content" style={{ flex: 1, padding: '0 0 60px 32px', minWidth: 0 }}>
        {/* Same page head as every other section (SectionHeader geometry). */}
        <header className="section-header settings-page-head">
          <div className="section-header__top">
            <div className="section-header__titles">
              <div className="section-header__title-row">
                <h1 className="section-header__title">{current.label}</h1>
              </div>
              <p className="section-header__description">Superuser only. Every change is audited.</p>
            </div>
            <div className="section-header__actions" />
          </div>
        </header>
        {/* Phones: the section list sits under the head, so the H1 is where
            it is on every other page. */}
        <nav ref={phoneNavRef} aria-label="Admin sections" className="tw-admin-phone-nav">
          {ALL_ITEMS.map(item => (
            <NavLink key={item.id} to={`/admin/${item.id}`} className="admin-control admin-nav-link" aria-current={section === item.id ? 'page' : undefined}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <CurrentComponent />
      </div>
    </div>
  );
}
