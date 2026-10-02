import type { QueryClient } from '@tanstack/react-query';

/**
 * Live data over the WebSocket (Django Channels), instead of polling.
 *
 * The backend sends `data.changed` with the topics a save or delete touched
 * (core/ws/data_changes.py). Each topic marks the caches that show that data
 * as stale: React Query refetches the ones on screen straight away and the
 * rest the next time they're shown. Polling only runs while the socket is
 * down (see isLiveConnected / useAutoRefresh).
 */

export type LiveTopic =
  | 'invoice' | 'payment' | 'expense' | 'quote' | 'load' | 'trip'
  | 'vehicle' | 'driver' | 'customer' | 'advance';

// Query key roots (queryKey[0]) and full-ledger sources (['insights-source', x])
// that each topic feeds. Home's overview reads almost everything, so it is in
// every topic.
const KEYS: Record<LiveTopic, { roots: string[]; sources: string[] }> = {
  invoice: {
    roots: ['invoices', 'invoices-page', 'invoice', 'invoice-aging', 'invoice-payments', 'capital-eligible',
      'capital-page', 'capital', 'eligible-invoices-risk', 'customer', 'customer-risk', 'risk-scores', 'load'],
    sources: ['invoices'],
  },
  payment: {
    roots: ['invoices', 'invoices-page', 'invoice', 'invoice-aging', 'invoice-payments', 'capital-eligible',
      'capital', 'customer', 'customer-risk', 'risk-scores'],
    sources: ['payments', 'invoices'],
  },
  expense: {
    roots: ['expenses-page', 'vehicle', 'vehicle-detail', 'load', 'driver'],
    sources: ['expenses'],
  },
  quote: {
    roots: ['quote', 'quotes', 'quotes-column', 'customer-quotes', 'customer'],
    sources: ['quotes'],
  },
  load: {
    roots: ['load', 'loads', 'loads-list', 'loads-heatmap-all', 'vehicle-loads', 'driver-loads', 'vehicle',
      'vehicle-detail', 'vehicles-page', 'vehicles-available', 'vehicles-available-for-booking', 'driver',
      'drivers-page', 'drivers-list', 'drivers-active', 'drivers-available-for-booking', 'quote', 'quotes',
      'quotes-column', 'customer', 'customer-quotes'],
    sources: ['loads', 'quotes'],
  },
  trip: {
    roots: ['load', 'loads', 'loads-list', 'vehicle', 'vehicle-detail', 'vehicle-loads', 'driver', 'driver-loads'],
    sources: ['loads', 'expenses'],
  },
  vehicle: {
    roots: ['vehicle', 'vehicle-detail', 'vehicles-page', 'vehicles-available', 'vehicles-available-for-booking',
      'vehicle-types'],
    sources: ['vehicles'],
  },
  driver: {
    roots: ['driver', 'drivers-page', 'drivers-list', 'drivers-active', 'drivers-available-for-booking'],
    sources: [],
  },
  customer: {
    roots: ['customer', 'customers', 'customers-page', 'customer-risk', 'customer-quotes', 'risk-scores'],
    sources: ['customers'],
  },
  advance: {
    roots: ['capital-eligible', 'capital-page', 'capital', 'capital-desk', 'eligible-invoices-risk', 'invoice', 'invoices-page'],
    sources: [],
  },
};
const ALWAYS = ['overview-dashboard'];

/** Mark every cache the topics feed as stale (on-screen ones refetch now). */
export function invalidateTopics(queryClient: QueryClient, topics: Iterable<string>) {
  const roots = new Set(ALWAYS);
  const sources = new Set<string>();
  for (const t of topics) {
    const k = KEYS[t as LiveTopic];
    if (!k) continue;
    k.roots.forEach((r) => roots.add(r));
    k.sources.forEach((s) => sources.add(s));
  }
  queryClient.invalidateQueries({
    predicate: ({ queryKey }) => {
      const [root, sub] = queryKey as unknown[];
      if (typeof root !== 'string') return false;
      if (root === 'insights-source') return typeof sub === 'string' && sources.has(sub);
      return roots.has(root);
    },
  });
}

/** After a reconnect: anything may have changed while the socket was down. */
export function invalidateAllTopics(queryClient: QueryClient) {
  invalidateTopics(queryClient, Object.keys(KEYS));
}

// ---- connection state: polling is only a fallback while this is false ----
let connected = false;
export const isLiveConnected = () => connected;
export function setLiveConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  window.dispatchEvent(new CustomEvent('tw:live-status', { detail: { connected } }));
}
