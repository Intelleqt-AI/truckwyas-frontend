// Truckwys Application Constants

export const APP_CONFIG = {
  name: 'Truckwys',
  version: '1.0.0',
  description: 'AI-Powered Logistics Operations Platform'
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
    children: [
      {
        id: 'bookings-overview',
        label: 'Overview',
        href: '/bookings'
      },
      {
        id: 'bookings-pipeline',
        label: 'Pipeline',
        href: '/bookings/pipeline'
      }
    ]
  },
  {
    id: 'fleet',
    label: 'Fleet',
    icon: 'Truck',
    children: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/fleet'
      },
      {
        id: 'vehicles',
        label: 'Vehicles',
        href: '/fleet/vehicles'
      },
      {
        id: 'drivers',
        label: 'Drivers',
        href: '/fleet/drivers'
      },
      {
        id: 'scenarios',
        label: 'Scenarios',
        href: '/fleet/scenarios'
      }
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'Building2',
    children: [
      {
        id: 'finance-overview',
        label: 'Overview',
        href: '/finance-hq'
      },
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
      },
      {
        id: 'economic-model',
        label: 'Economic Model',
        href: '/finance/economic-model'
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
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: 'Settings'
  }
] as const;

export const MOCK_DATA_ENDPOINTS = {
  quotes: '/mocks/quotes.json',
  lanes: '/mocks/lanes.json',
  trips: '/mocks/trips.json',
  invoices: '/mocks/invoices.json',
  finance: '/mocks/finance.json',
  border: '/mocks/border.json',
  fuel: '/mocks/fuel.json',
  loads: '/mocks/loads.json'
} as const;

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