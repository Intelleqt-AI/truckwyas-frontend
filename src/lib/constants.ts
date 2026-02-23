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
    children: [
      {
        id: 'bookings-pipeline',
        label: 'Pipeline',
        href: '/bookings/pipeline'
      },
      {
        id: 'bookings-orders',
        label: 'Orders',
        href: '/bookings'
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