// Truckwys Application Constants

export const APP_CONFIG = {
  name: 'TruckWys',
  version: '3.0.0',
  description: 'World-Class AI Financial & Logistics Platform'
} as const;

// Navigation types
interface NavigationChild {
  id: string;
  label: string;
  href: string;
}

interface NavigationParent {
  id: string;
  label: string;
  icon: string;
  children: NavigationChild[];
}

interface NavigationLink {
  id: string;
  label: string;
  href: string;
  icon: string;
}

export type NavigationItem = NavigationParent | NavigationLink;

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    icon: 'LayoutDashboard'
  },
  {
    id: 'bookings',
    label: 'Bookings',
    icon: 'FileText',
    href: '/bookings'
  },
  {
    id: 'fleet',
    label: 'Fleet',
    icon: 'Truck',
    children: [
      {
        id: 'vehicles',
        label: 'Vehicles',
        href: '/fleet/vehicles'
      },
      {
        id: 'drivers',
        label: 'Drivers',
        href: '/fleet/drivers'
      }
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'Building2',
    children: [
      {
        id: 'invoices',
        label: 'Invoices',
        href: '/finance/invoices'
      },
      {
        id: 'expenses',
        label: 'Expenses',
        href: '/finance/expenses'
      },
      {
        id: 'reports',
        label: 'Reports',
        href: '/finance/reports'
      }
    ]
  },
  {
    id: 'capital',
    label: 'Capital',
    href: '/capital',
    icon: 'Banknote'
  },
  {
    id: 'insights',
    label: 'Insights',
    href: '/insights',
    icon: 'Sparkles'
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: 'Settings'
  }
] as const;

// Removed MOCK_DATA_ENDPOINTS - use API calls via useFetch/usePost hooks

export const STATUS_COLOURS = {
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  destructive: 'hsl(var(--destructive))',
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))'
} as const;

export const CONFIDENCE_THRESHOLDS = {
  high: 0.8,
  medium: 0.6,
  low: 0.4
} as const;

export const METRIC_FORMATS = {
  currency: 'ZAR',
  distance: 'km',
  weight: 'tonnes',
  volume: 'litres'
} as const;

// Invoice Status Configuration
export const INVOICE_STATUS = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  CANCELLED: 'CANCELLED'
} as const;

export const INVOICE_STATUS_COLORS = {
  DRAFT: { bg: 'var(--text-tertiary)', text: 'var(--bg-deep)' },
  SENT: { bg: 'var(--accent-primary)', text: 'var(--bg-deep)' },
  PAID: { bg: 'var(--status-success)', text: 'var(--bg-deep)' },
  OVERDUE: { bg: 'var(--status-danger)', text: 'var(--bg-deep)' },
  PARTIALLY_PAID: { bg: 'var(--status-warning)', text: 'var(--bg-deep)' },
  CANCELLED: { bg: 'var(--text-secondary)', text: 'var(--bg-deep)' }
} as const;

// Expense Status Configuration
export const EXPENSE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
} as const;

// Expense Category Configuration
export const EXPENSE_CATEGORIES = {
  FUEL: { label: 'Fuel', icon: '⛽', color: 'var(--status-warning)' },
  TOLLS: { label: 'Tolls', icon: '🛣️', color: 'var(--accent-primary)' },
  MAINTENANCE: { label: 'Maintenance', icon: '🔧', color: 'var(--status-danger)' },
  DRIVER: { label: 'Driver', icon: '👤', color: 'var(--status-success)' },
  INSURANCE: { label: 'Insurance', icon: '🛡️', color: 'var(--accent-primary)' },
  OVERHEAD: { label: 'Overhead', icon: '📋', color: 'var(--text-secondary)' }
} as const;

// Currency Formatter Utility
export const formatZAR = (amount: number, showPrefix = true): string => {
  const formatted = amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return showPrefix ? `R ${formatted}` : formatted;
};

// Date Age Calculator
export const calculateDaysAge = (date: string): number => {
  const targetDate = new Date(date);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - targetDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};