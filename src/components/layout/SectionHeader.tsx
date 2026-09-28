import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import './section-header.css';

export interface SectionTab {
  label: string;
  to: string;
  /** Match only the exact path; otherwise child routes keep the tab active. */
  end?: boolean;
}

interface SectionHeaderProps {
  /** Section name shown above the title, e.g. "Finance" or "Fleet". */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** Primary actions, right-aligned on desktop. */
  actions?: ReactNode;
  /** Route-based sub-navigation shared by every page in the section. */
  tabs?: SectionTab[];
  /** Inline adornment next to the title (e.g. a status badge). */
  titleAdornment?: ReactNode;
}

/**
 * Every page in a tabbed section (Finance, Fleet, Bookings…) renders this
 * with the same tabs array, so title, tabs and content start at identical
 * coordinates on every sibling route. The block has a fixed geometry:
 * switching tabs must never move the page.
 */
export default function SectionHeader({ eyebrow, title, description, actions, tabs, titleAdornment }: SectionHeaderProps) {
  return (
    <header className="section-header">
      <div className="section-header__top">
        <div className="section-header__titles">
          {/* A label that only repeats the title adds noise. Siblings share both, so alignment holds. */}
          {eyebrow && eyebrow !== title && <div className="section-header__eyebrow">{eyebrow}</div>}
          <div className="section-header__title-row">
            <h1 className="section-header__title">{title}</h1>
            {titleAdornment}
          </div>
          {description && <p className="section-header__description">{description}</p>}
        </div>
        <div className="section-header__actions">{actions}</div>
      </div>
      {tabs && tabs.length > 0 && (
        <nav className="section-header__tabs" aria-label={`${eyebrow ?? title} sections`}>
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => `section-header__tab${isActive ? ' is-active' : ''}`}
              data-label={t.label}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

export const FINANCE_TABS: SectionTab[] = [
  { label: 'Invoices', to: '/finance/invoices' },
  { label: 'Expenses', to: '/finance/expenses' },
  { label: 'Reports', to: '/finance/reports' },
];

export const FLEET_TABS: SectionTab[] = [
  { label: 'Vehicles', to: '/fleet/vehicles' },
  { label: 'Drivers', to: '/fleet/drivers' },
];
