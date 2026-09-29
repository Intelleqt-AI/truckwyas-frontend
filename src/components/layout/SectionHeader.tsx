import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { NAV_GROUPS, isItemActive, underPrefix } from '@/components/shell/nav';
import { prefetchProps } from '@/components/shell/routePrefetch';
import OverflowMenu, { type MenuItem } from '@/components/ui/OverflowMenu';
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
  /** One short line (at most 8 words). Its line is reserved either way; on phones it may wrap to 2 lines. */
  description?: ReactNode;
  /**
   * Actions, right-aligned on the title row. Desktop: all shown. Phone
   * (<= 768px): the primary (the `--primary` button, or the only action)
   * stays on the title row at 36px; every other action moves into a "⋯"
   * menu beside it (see `useHeadActionsFit`). Put the primary LAST.
   */
  actions?: ReactNode;
  /**
   * Extra items that live only in the "⋯" menu, on every width (e.g. Export,
   * Import). Prefer this over hidden buttons for secondary actions.
   */
  menuItems?: MenuItem[];
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

/** Section subtitles used when a tabbed page passes none, so the reserved
 *  subtitle line is never an empty gap between the H1 and the tabs. */
const SECTION_DESCRIPTIONS: Record<string, string> = {
  Finance: 'Invoices, expenses and what you are owed',
  Fleet: 'Your trucks, your drivers and what each is doing',
};

const PHONE_MQ = '(max-width: 768px)';
function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_MQ).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_MQ);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

const CONTROL = 'button, a[href], [role="button"], input, select';
const MARKS = ['data-sh-hidden', 'data-sh-primary', 'data-sh-icon'];

/** The page's own action elements inside the actions slot (wrappers flattened). */
function actionElements(slot: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  const walk = (el: Element) => {
    if (!(el instanceof HTMLElement) || el.hasAttribute('data-sh-more') || el.classList.contains('tw-rowact-sr')) return;
    if (el.matches(CONTROL)) { out.push(el); return; }
    for (const c of Array.from(el.children)) walk(c);
  };
  for (const c of Array.from(slot.children)) walk(c);
  return out;
}

const labelOf = (el: HTMLElement) =>
  (el.textContent || '').replace(/\s+/g, ' ').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || 'Action';

/**
 * Phone head fit (R4). Decides, by measuring, how the actions share the
 * title row, trying each step until the H1 row fits on one line:
 *   1. primary with its label + "⋯" for the rest
 *   2. primary as its icon only (when it has a leading icon; label kept as aria-label)
 *   3. every action moves into "⋯" (only "⋯" is left on the row; a page's
 *      own "⋯" menu becomes one "More actions…" item that opens it)
 *   4. as 3, with the H1 at 24px (long IDs)
 *   5. the H1 wraps (last resort)
 * Moved actions stay mounted (hidden at the "⋯" position) and the menu item
 * clicks them, so every page keeps its own handlers and popovers.
 */
function useHeadActionsFit(phone: boolean, deps: unknown[]) {
  const headRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const moved = useRef<HTMLElement[]>([]);

  const fit = useCallback(() => {
    const head = headRef.current;
    const row = rowRef.current;
    const slot = slotRef.current;
    if (!head || !row) return;
    const els = slot ? actionElements(slot) : [];
    for (const el of els) {
      for (const m of MARKS) el.removeAttribute(m);
      if (el.hasAttribute('data-sh-aria')) { el.removeAttribute('aria-label'); el.removeAttribute('data-sh-aria'); }
    }
    head.removeAttribute('data-sh-fit');
    head.removeAttribute('data-sh-more');
    head.style.removeProperty('--sh-actions-w');
    moved.current = [];
    if (!phone) return;

    // Only what the page itself shows on phones takes part.
    const live = els.filter((el) => getComputedStyle(el).display !== 'none');
    const ownMenu = live.find((el) => el.matches('.tw-rowact--icon'));
    const rest = live.filter((el) => el !== ownMenu);
    const primary = rest.find((el) => /(^|\s)[\w-]*--primary(\s|$)/.test(el.className)) ?? (rest.length === 1 ? rest[0] : undefined);
    const secondary = rest.filter((el) => el !== primary);
    const svgFirst = !!primary && primary.firstElementChild?.tagName.toLowerCase() === 'svg';

    const apply = (level: number) => {
      // 1-2: the primary stays (2: icon only); 3+: every action is in "⋯".
      const hide = level >= 3 ? live : [...secondary];
      for (const el of live) { el.removeAttribute('data-sh-hidden'); el.removeAttribute('data-sh-icon'); el.removeAttribute('data-sh-primary'); }
      for (const el of hide) el.setAttribute('data-sh-hidden', '');
      if (primary && level < 3) {
        primary.setAttribute('data-sh-primary', '');
        if (level === 2) {
          primary.setAttribute('data-sh-icon', '');
          if (!primary.hasAttribute('aria-label')) { primary.setAttribute('aria-label', labelOf(primary)); primary.setAttribute('data-sh-aria', ''); }
        } else if (primary.hasAttribute('data-sh-aria')) { primary.removeAttribute('aria-label'); primary.removeAttribute('data-sh-aria'); }
      }
      // The page's own "⋯" (e.g. RowActions) is listed as one item that opens it.
      moved.current = hide;
      if (hide.length) head.setAttribute('data-sh-more', ''); else head.removeAttribute('data-sh-more');
      head.setAttribute('data-sh-fit', String(level));
      head.style.setProperty('--sh-actions-w', `${slot ? slot.offsetWidth : 0}px`);
    };
    // The row's content (H1 + adornment) must end before the reserved actions width.
    const fits = () => {
      const box = row.getBoundingClientRect();
      const limit = box.right - parseFloat(getComputedStyle(row).paddingRight || '0') + 1;
      return Array.from(row.children).every((c) => c.getBoundingClientRect().right <= limit);
    };

    const levels = [1];
    if (primary && svgFirst) levels.push(2);
    if (live.length) levels.push(3);
    levels.push(4);
    for (const level of levels) {
      apply(level);
      if (fits()) return;
    }
    apply(5);
  }, [phone]);

  useLayoutEffect(() => {
    fit();
    const head = headRef.current;
    const slot = slotRef.current;
    if (!head) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(head);
    let mo: MutationObserver | undefined;
    if (slot && phone) {
      mo = new MutationObserver(() => fit());
      mo.observe(slot, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'disabled', 'aria-disabled', 'style'] });
    }
    return () => { ro.disconnect(); mo?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, ...deps]);

  const overflowItems = useCallback((): MenuItem[] => moved.current.map((el) => {
    const disabled = (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true';
    return {
      label: el.matches('.tw-rowact--icon') ? 'More actions…' : labelOf(el),
      disabled,
      title: el.getAttribute('title') || undefined,
      onSelect: () => el.click(),
    };
  }), []);

  return { headRef, rowRef, slotRef, overflowItems };
}

/**
 * THE page head. One geometry on every page (tokens in theme.css):
 * H1 28/34 600 at --page-head-top from the top of <main>, a reserved
 * subtitle line, actions right on the title row, then (optionally) the
 * tabs row at --head-to-tabs and content at --tabs-to-content.
 *
 * Phones: the title row carries at most one compact action plus a "⋯" menu
 * for the rest, and the tabs follow the head directly (no action row), so
 * content starts at 146 (untabbed and detail pages) or 202 (tabbed).
 *
 * Section pages (those that pass `tabs`) take their H1 from the sidebar item
 * they live under, so the nav label and the H1 always agree ("Finance",
 * "Quotes and loads", "Fleet"). Tabs render only when one of them matches the
 * current route, so a page that has its own nav item (Reports) shows no
 * orphan tab row.
 */
export default function SectionHeader({ eyebrow, title, description, actions, menuItems, tabs, titleAdornment, back }: SectionHeaderProps) {
  const { pathname } = useLocation();
  const navLabel = useActiveNavLabel();
  const shownTitle = tabs && navLabel ? navLabel : title;
  const showTabs = !!tabs && tabs.length > 1 && tabs.some((t) => tabActive(t, pathname));
  const shownDescription = description ?? (showTabs ? SECTION_DESCRIPTIONS[shownTitle] : undefined);
  const phone = usePhone();
  const { headRef, rowRef, slotRef, overflowItems } = useHeadActionsFit(phone, [actions, shownTitle, titleAdornment]);
  const extra = menuItems ?? [];
  const hasSlot = !!actions || extra.length > 0;
  return (
    <header ref={headRef} className={`section-header tw-page-head-block${showTabs ? ' has-tabs' : ''}${extra.length ? ' has-menu' : ''}`}>
      <div className="section-header__top">
        <div className="section-header__titles">
          <div ref={rowRef} className="section-header__title-row">
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
            {back && shownDescription ? <span aria-hidden="true" className="section-header__sep">·</span> : null}
            {shownDescription}
          </p>
        </div>
        {hasSlot ? (
          <div ref={slotRef} className="section-header__actions">
            {actions}
            {(phone || extra.length > 0) && (
              <span className="section-header__more" data-sh-more="">
                <OverflowMenu
                  label={`${shownTitle}: more actions`}
                  triggerLabel="More actions"
                  triggerClassName="section-header__more-btn"
                  items={() => [...overflowItems(), ...extra]}
                />
              </span>
            )}
          </div>
        ) : null}
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
 * The same tabs row for in-page (state) tabs, e.g. Insights, so every tabs
 * row in the app has one height, type and underline. Renders directly under
 * a SectionHeader (it takes the header's --head-to-tabs / --tabs-to-content
 * rhythm via .section-header + .section-tabs).
 */
export function SectionTabs<T extends string>({ label, tabs, value, onChange }: {
  label: string;
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="section-header__tabs section-tabs" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          data-label={t.label}
          className={`section-header__tab${value === t.id ? ' is-active' : ''}`}
          aria-current={value === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
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
