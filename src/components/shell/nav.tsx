import type { LucideIcon } from 'lucide-react';
import {
  House, MessageSquareText, FileText, Receipt, ChartNoAxesColumn, FileBarChart, Users, Truck, Zap, ShieldCheck,
} from 'lucide-react';

/**
 * v3 navigation model. Ordered the way money moves (price, bill and pay, know the
 * numbers), then the records that serve every job, then what is not live yet.
 *
 * `key` is the permission key checked against OSLayout's NAV_ACCESS table, so
 * role gating is unchanged: an item shows only if its key is allowed.
 * `to` is where the item links; `match` keeps it active on sub-routes and
 * legacy aliases; `exclude` hands a sub-route to a more specific item.
 */
export interface NavItem {
  id: string;
  key: string;
  label: string;
  /** Short label for the phone tab bar. */
  short?: string;
  to: string;
  match: string[];
  exclude?: string[];
  icon: LucideIcon;
  muted?: boolean;
}

export interface NavGroup {
  id: string;
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'home',
    items: [
      { id: 'today', key: '/', label: 'Home', to: '/', match: [], icon: House },
      { id: 'copilot', key: '/copilot', label: 'Copilot', to: '/copilot', match: ['/copilot'], icon: MessageSquareText },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    items: [
      { id: 'quote', key: '/bookings', label: 'Quotes and loads', short: 'Quotes', to: '/bookings/quotes', match: ['/bookings', '/quotes'], icon: FileText },
      { id: 'getpaid', key: '/invoices', label: 'Finance', to: '/finance/invoices', match: ['/finance', '/invoices', '/expenses'], exclude: ['/finance/reports'], icon: Receipt },
    ],
  },
  {
    id: 'numbers',
    label: 'Numbers',
    items: [
      { id: 'insights', key: '/insights', label: 'Insights', short: 'Numbers', to: '/insights', match: ['/insights'], icon: ChartNoAxesColumn },
      { id: 'reports', key: '/invoices', label: 'Reports', to: '/finance/reports', match: ['/finance/reports', '/finance-reports'], icon: FileBarChart },
    ],
  },
  {
    id: 'records',
    label: 'Records',
    items: [
      { id: 'customers', key: '/customers', label: 'Customers', to: '/customers', match: ['/customers'], icon: Users },
      { id: 'fleet', key: '/fleet', label: 'Fleet', to: '/fleet/vehicles', match: ['/fleet', '/vehicles', '/drivers'], icon: Truck },
    ],
  },
  {
    id: 'soon',
    label: 'Coming soon',
    items: [
      { id: 'fastpay', key: '/capital', label: 'Fast Pay', to: '/capital', match: ['/capital'], icon: Zap, muted: true },
      { id: 'insurance', key: '/insurance', label: 'Insurance', to: '/insurance', match: ['/insurance'], icon: ShieldCheck, muted: true },
    ],
  },
];

/** Phone tab bar: these four (when the role can see them), then "More". */
export const PHONE_PRIMARY = ['today', 'quote', 'getpaid', 'insights'];

export const underPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + '/');

export function isItemActive(item: NavItem, pathname: string) {
  if (item.to === '/') return pathname === '/';
  if (item.exclude?.some((p) => underPrefix(pathname, p))) return false;
  return item.match.some((p) => underPrefix(pathname, p));
}
