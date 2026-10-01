import { formatDate } from './formatters';
import { saDateISO, saDaysBetween } from './dates';

/*
 * Stale work (R6, one rule for the whole app).
 *
 * An open load (Pending, Assigned, Loading or In transit) is stale when it is
 * past its delivery date, or when it has been open for more than 30 days
 * (counted from its pickup date, else from when it was created). Stale loads
 * are never shown as current work: they carry "since <date> (N days)" and the
 * one action the page can actually take.
 *
 * Used by Orders, Booking detail, Vehicles "Doing now", the vehicle and driver
 * Now line, Home and Findings, so their counts always agree.
 *
 * Days are whole South African calendar days (Africa/Johannesburg), whatever
 * the viewer's time zone: the same count as the Debtors age analysis
 * (reports/data.ts todayISO + daysBetween) and Findings.
 */

export const OPEN_LOAD_STATUSES = ['PENDING', 'ASSIGNED', 'LOADING', 'IN_TRANSIT'] as const;
/** An open load older than this (from pickup, else creation) is stale. */
export const STALE_AFTER_DAYS = 30;

type LoadLike = {
  status?: string | null;
  delivery_date?: string | null;
  pickup_date?: string | null;
  created_at?: string | null;
};

const statusOf = (l: LoadLike | null | undefined) => String(l?.status || '').toUpperCase();
export const isOpenLoad = (l: LoadLike | null | undefined) => (OPEN_LOAD_STATUSES as readonly string[]).includes(statusOf(l));

/** Whole calendar days from a to b (b later is positive), South African days. Same result as Debtors. */
export function calendarDays(a: string | Date, b: string | Date): number | null {
  return saDaysBetween(a, b);
}

/** "20 Jun 2026" for the South African calendar day of a date or timestamp. */
const dayText = (v: string) => { const iso = saDateISO(v); return iso ? formatDate(iso) : v; };

export interface Stale {
  /** The date the load has been stale since (ISO, as stored). */
  iso: string;
  /** The same date for display, e.g. "20 Jun 2026". */
  since: string;
  /** Whole days since then. */
  days: number;
  /** True when past the delivery date; false when only open too long. */
  overdue: boolean;
  /** @deprecated alias of `overdue` (bookings-stale.ts shape). */
  pastDue: boolean;
}

/** Null when the load is not open or still current. */
export function staleWork(load: LoadLike | null | undefined, today: Date | string = new Date()): Stale | null {
  if (!load || !isOpenLoad(load)) return null;
  if (load.delivery_date) {
    const late = calendarDays(load.delivery_date, today);
    if (late !== null && late > 0) {
      return { iso: load.delivery_date, since: dayText(load.delivery_date), days: late, overdue: true, pastDue: true };
    }
  }
  const start = load.pickup_date || load.created_at || null;
  if (start) {
    const age = calendarDays(start, today);
    if (age !== null && age > STALE_AFTER_DAYS) {
      return { iso: start, since: dayText(start), days: age, overdue: false, pastDue: false };
    }
  }
  return null;
}

/** The stale loads in a list (open and stale), oldest first. */
export function staleLoads<T extends LoadLike>(loads: readonly T[] | null | undefined, today: Date | string = new Date()): T[] {
  if (!loads) return [];
  return loads
    .map((l) => ({ l, s: staleWork(l, today) }))
    .filter((x): x is { l: T; s: Stale } => x.s !== null)
    .sort((a, b) => b.s.days - a.s.days)
    .map((x) => x.l);
}

/** How many loads in a list are stale. */
export const countStale = (loads: readonly LoadLike[] | null | undefined, today: Date | string = new Date()) =>
  loads ? loads.reduce((n, l) => n + (staleWork(l, today) ? 1 : 0), 0) : 0;

/**
 * Words for a stale load:
 *   since    "since 20 Jun 2026"
 *   days     "101 days"
 *   overdue  past the delivery date (else: open too long)
 *   text     "since 20 Jun 2026 (101 days)"
 */
export function staleLabel(s: Stale): { since: string; days: string; overdue: boolean; text: string } {
  const days = `${s.days} ${s.days === 1 ? 'day' : 'days'}`;
  const since = `since ${s.since}`;
  return { since, days, overdue: s.overdue, text: `${since} (${days})` };
}

/**
 * The action a page can really take on a stale load. Assignment is locked
 * once a load is Loading or In transit.
 *   Pending     "Assign a vehicle or cancel it"
 *   Assigned    "Start it, reassign it or cancel it"
 *   Loading     "Mark it in transit or cancel it"
 *   In transit  "Mark it delivered or cancel it"
 */
export function staleAction(load: LoadLike | null | undefined): string {
  const st = statusOf(load);
  // Only moves the status menu allows (Bookings.tsx VALID_TRANSITIONS).
  if (st === 'PENDING') return 'Assign a vehicle or cancel it';
  if (st === 'ASSIGNED') return 'Start it, reassign it or cancel it';
  if (st === 'LOADING') return 'Mark it in transit or cancel it';
  return 'Mark it delivered or cancel it';
}
