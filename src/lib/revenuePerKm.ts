/*
 * Revenue per km (R6, one basis for the whole app).
 *
 * Delivered work only (delivered, invoiced, completed, paid), dated by its
 * delivery date (else pickup, else creation), in a named window: by default
 * the last 12 months (this month and the 11 before it). Loads without a
 * recorded distance are left out of both the rand and the km.
 *
 * Insights Lanes, the vehicle and driver pages ("vs the fleet's R x") all use
 * this, so "your average" and "the fleet's" are the same figure.
 */

export const DELIVERED_STATUSES = new Set(['DELIVERED', 'INVOICED', 'COMPLETED', 'PAID']);

export interface PerKmPeriod { from: Date; to: Date; /** "last 12 months" */ label: string }

/** This month and the 11 before it, to today. */
export function lastTwelveMonths(now = new Date()): PerKmPeriod {
  return { from: new Date(now.getFullYear(), now.getMonth() - 11, 1), to: now, label: 'last 12 months' };
}

type KmLoad = { status?: string | null; distance?: unknown; total_amount?: unknown; delivery_date?: string | null; pickup_date?: string | null; created_at?: string | null };

const n = (v: unknown) => { const x = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(x) ? x : 0; };
const dateOf = (l: KmLoad) => l.delivery_date || l.pickup_date || l.created_at || null;
const asDate = (iso: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);

/** Delivered loads with a distance, dated inside the period. The rows every per-km figure is built from. */
export function perKmLoads<T extends KmLoad>(loads: readonly T[] | null | undefined, period: PerKmPeriod = lastTwelveMonths()): T[] {
  if (!loads) return [];
  return loads.filter((l) => {
    if (!DELIVERED_STATUSES.has(String(l.status || '').toUpperCase())) return false;
    if (n(l.distance) <= 0) return false;
    const iso = dateOf(l); if (!iso) return false;
    const d = asDate(iso);
    return !Number.isNaN(d.getTime()) && d >= period.from && d <= period.to;
  });
}

export interface FleetPerKm { perKm: number | null; km: number; revenue: number; loads: number; period: PerKmPeriod }

/** The fleet's revenue per km over a period (default last 12 months). perKm is null with no km. */
export function fleetRevenuePerKm(loads: readonly KmLoad[] | null | undefined, period: PerKmPeriod = lastTwelveMonths()): FleetPerKm {
  const rows = perKmLoads(loads, period);
  const km = rows.reduce((s, l) => s + n(l.distance), 0);
  const revenue = rows.reduce((s, l) => s + n(l.total_amount), 0);
  return { perKm: km > 0 ? revenue / km : null, km, revenue, loads: rows.length, period };
}
