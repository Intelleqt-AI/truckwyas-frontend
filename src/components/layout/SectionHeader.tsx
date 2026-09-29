import { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { NAV_GROUPS, isItemActive, underPrefix } from '@/components/shell/nav';
import { prefetchProps } from '@/components/shell/routePrefetch';
import './section-header.css';

export interface SectionTab {
  label: string;
  to: string;
  /** Match only the exact path; otherwise child routes keep the tab active. */
  end?: boolean;
}

interface SectionHeaderProps {
  /** Section name; used only for the tabs' accessible name (no eyebrow row). */
  eyebrow?: string;
  title: string;
  /** One short line (at most 8 words). Its line is reserved either way. */
  description?: ReactNode;
  /** Primary actions, right-aligned on the title row. */
  actions?: ReactNode;
  /** Route-based sub-navigation shared by every page in the section. */
  tabs?: SectionTab[];
  /** Inline adornment next to the title (e.g. a status chip). */
  titleAdornment?: ReactNode;
  /** Detail pages: a back link shown on the subtitle line, never above the title. */
  back?: { to: string; label: string };
}

/** The nav item the current route belongs to (its label is the section's H1). */
export function useActiveNavLabel(): string | undefined {
  const { pathname } = useLocation();
  for (const g of NAV_GROUPS) for (const i of g.items) if (isItemActive(i, pathname)) return i.label;
  return undefined;
}

const tabActive = (t: SectionTab, pathname: string) =>
  t.end ? pathname === t.to : underPrefix(pathname, t.to);

/**
 * THE page head. One geometry on every page (tokens in theme.css):
 * H1 28/34 600 at --page-head-top from the top of <main>, a reserved
 * one-line subtitle, actions right on the title row, then (optionally) the
 * tabs row at --head-to-tabs and content at --tabs-to-content.
 *
 * Section pages (those that pass `tabs`) take their H1 from the sidebar item
 * they live under, so the nav label and the H1 always agree ("Finance",
 * "Quotes and loads", "Fleet"). Tabs render only when one of them matches the
 * current route, so a page that has its own nav item (Reports) shows no
 * orphan tab row.
 */
export default function SectionHeader({ eyebrow, title, description, actions, tabs, titleAdornment, back }: SectionHeaderProps) {
  const { pathname } = useLocation();
  const navLabel = useActiveNavLabel();
  const shownTitle = tabs && navLabel ? navLabel : title;
  const showTabs = !!tabs && tabs.length > 1 && tabs.some((t) => tabActive(t, pathname));
  return (
    <header className={`section-header tw-page-head-block${showTabs ? ' has-tabs' : ''}`}>
      <div className="section-header__top">
        <div className="section-header__titles">
          <div className="section-header__title-row">
            <h1 className="section-header__title">{shownTitle}</h1>
            {titleAdornment}
          </div>
          <p className="section-header__description">
            {back && (
              <Link to={back.to} className="section-header__back">
                <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" />
                {back.label}
              </Link>
            )}
            {back && description ? <span aria-hidden="true" className="section-header__sep">·</span> : null}
            {description}
          </p>
        </div>
        {actions ? <div className="section-header__actions">{actions}</div> : null}
      </div>
      {showTabs && (
        <nav className="section-header__tabs" aria-label={`${eyebrow ?? shownTitle} sections`}>
          {tabs!.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => `section-header__tab${isActive ? ' is-active' : ''}`}
              data-label={t.label}
              {...prefetchProps(t.to)}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

/**
 * Route-loading placeholder at the exact page-head geometry: the H1 is real
 * (the active nav label), the rest is quiet skeleton. Used by the shell's
 * Suspense boundary so a lazy page never blanks the screen or moves the head.
 */
export function PageHeadSkeleton() {
  const label = useActiveNavLabel();
  return (
    <div className="tw-route-skeleton" aria-busy="true" aria-live="polite">
      <header className="section-header">
        <div className="section-header__top">
          <div className="section-header__titles">
            <div className="section-header__title-row">
              {label ? <h1 className="section-header__title">{label}</h1> : <span className="tw-skel tw-skel--title" />}
            </div>
            <p className="section-header__description"><span className="tw-skel tw-skel--line" /></p>
          </div>
        </div>
      </header>
      <div className="tw-route-skeleton__body">
        <span className="tw-skel tw-skel--card" />
        <span className="tw-skel tw-skel--card" />
        <span className="tw-skel tw-skel--card" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

// Finance tabs (Invoices, Expenses). Reports has its own sidebar item, so it is not a tab.
export const FINANCE_TABS: SectionTab[] = [
  { label: 'Invoices', to: '/finance/invoices' },
  { label: 'Expenses', to: '/finance/expenses' },
];

export const FLEET_TABS: SectionTab[] = [
  { label: 'Vehicles', to: '/fleet/vehicles' },
  { label: 'Drivers', to: '/fleet/drivers' },
];
