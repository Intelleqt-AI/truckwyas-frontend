/**
 * Route chunk prefetch. The same module specifiers App.tsx lazy-loads, so the
 * bundler hands back the very chunk React.lazy will ask for: once prefetched,
 * the route renders without suspending (no skeleton, no layout shift).
 *
 * Triggered on sidebar/tab hover or focus, and for every primary route once
 * the browser is idle after the first page has rendered.
 */
type Loader = () => Promise<unknown>;

const ROUTES: Array<[prefix: string, load: Loader]> = [
  ['/bookings/quotes/new', () => import('@/pages/QuoteBuilder')],
  ['/bookings/quotes/', () => import('@/pages/QuoteDetail')],
  ['/bookings/quotes', () => import('@/pages/LoadsList')],
  ['/bookings/orders', () => import('@/pages/LoadsList')],
  ['/bookings/history', () => import('@/pages/LoadsList')],
  ['/finance/invoices/new', () => import('@/pages/CreateInvoice')],
  ['/finance/credit-notes/', () => import('@/pages/CreditNoteDetail')],
  ['/finance/credit-notes', () => import('@/pages/CreditNotes')],
  ['/finance/suppliers', () => import('@/pages/Suppliers')],
  ['/finance/invoices/', () => import('@/pages/InvoiceDetail')],
  ['/finance/invoices', () => import('@/pages/Invoices')],
  ['/finance/expenses', () => import('@/pages/Expenses')],
  ['/finance/reports', () => import('@/pages/FinanceReports')],
  ['/insights', () => import('@/pages/Insights')],
  ['/customers/', () => import('@/pages/CustomerDetail')],
  ['/customers', () => import('@/pages/Customers')],
  ['/fleet/vehicles/', () => import('@/pages/VehicleFinancialProfile')],
  ['/fleet/vehicles', () => import('@/pages/Vehicles')],
  ['/fleet/drivers/', () => import('@/pages/DriverProfile')],
  ['/fleet/drivers', () => import('@/pages/Drivers')],
  ['/fleet/heatmap', () => import('@/pages/FleetHeatmap')],
  ['/capital', () => import('@/pages/Capital')],
  ['/insurance', () => import('@/pages/Insurance')],
  ['/copilot', () => import('@/pages/Copilot')],
  ['/settings', () => import('@/pages/Settings')],
  ['/admin', () => import('@/pages/AdminDashboard')],
];

/** Routes warmed on idle: what the sidebar and section tabs link to. */
const IDLE_WARM = [
  '/bookings/quotes', '/finance/invoices', '/finance/expenses', '/insights', '/finance/reports',
  '/customers', '/fleet/vehicles', '/fleet/drivers', '/capital', '/insurance', '/settings',
];

const started = new Set<Loader>();

export function prefetchRoute(path: string): void {
  const hit = ROUTES.find(([prefix]) => (prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix || path.startsWith(prefix + '?')));
  if (!hit) return;
  const load = hit[1];
  if (started.has(load)) return;
  started.add(load);
  // A failed prefetch is harmless: React.lazy retries the import on render.
  load().catch(() => started.delete(load));
}

let warmed = false;
/** Warm the primary routes one at a time while the main thread is idle. */
export function warmRoutesWhenIdle(): void {
  if (warmed || typeof window === 'undefined') return;
  warmed = true;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || '')) return;
  const queue = [...IDLE_WARM];
  const ric: (cb: () => void) => void =
    (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback
      ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 4000 })
      : (cb) => window.setTimeout(cb, 400);
  const next = () => {
    const path = queue.shift();
    if (!path) return;
    prefetchRoute(path);
    ric(next);
  };
  window.setTimeout(() => ric(next), 1500);
}

/** Props to spread on a link so hover or keyboard focus warms its chunk. */
export const prefetchProps = (to: string) => ({
  onMouseEnter: () => prefetchRoute(to),
  onFocus: () => prefetchRoute(to),
  onTouchStart: () => prefetchRoute(to),
});
