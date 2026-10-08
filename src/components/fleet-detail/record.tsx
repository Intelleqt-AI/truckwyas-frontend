import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DELIVERED } from '@/components/reports/data';
import { formatNumber } from '@/lib/formatters';
import { StatusChip as UiStatusChip } from '@/components/ui/StatusChip';
import { MonthlyBars } from './MonthlyBars';
import { fleetRevenuePerKm, lastTwelveMonths, perKmLoads } from '@/lib/revenuePerKm';
import {
  DAY_MS, InfoTip, dateText, daysUntil, kmText, loadDate, monthlySeries, monthsWithRevenue, num, plural, randCents, randWhole,
  type MonthPoint,
} from './parts';

/* The record page (vehicle and driver): a "Now" line under the head, a
   Performance card and the loads on the left; Compliance, Condition and the
   facts in a sticky rail on the right. On phones the cards stack in the order
   the owner acts on them (see fleet-detail.css, .fd-record). Every figure is
   computed from data the page already reads (the loads and the Reports
   expense ledger); nothing is fetched from a stats endpoint. */

// ------------------------------------------------------------------ rules

/** Orders that put a truck and a driver on the road (same as Vehicles "Doing now"). */
export const OPEN_LOAD = ['ASSIGNED', 'LOADING', 'IN_TRANSIT'];
/** Delivered work, on the Reports ledger's definition (delivered, invoiced, completed, paid). */
export const isDelivered = (l: any) => DELIVERED.has(String(l?.status || '').toUpperCase());
export const isOpenLoad = (l: any) => OPEN_LOAD.includes(String(l?.status || '').toUpperCase());

/** First day of the month 11 months back: the window is this month and the 11 before it. */
export const windowStart = (now = new Date()) => new Date(now.getFullYear(), now.getMonth() - 11, 1);

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Calendar days with a load under way (pickup to delivery; open loads run to today), in the window. */
export function daysOnJob(loads: any[], from: Date, now = new Date()) {
  const days = new Set<string>();
  const today = startOfDay(now);
  for (const l of loads) {
    const st = String(l?.status || '').toUpperCase();
    if (st === 'CANCELLED' || st === 'CANCELED' || st === 'PENDING' || !l?.pickup_date) continue;
    const a = startOfDay(new Date(l.pickup_date));
    const endRaw = l.actual_delivered_at || l.delivery_date;
    let b = endRaw ? startOfDay(new Date(endRaw)) : today;
    if (isOpenLoad(l) && b < today) b = today; // still out: it has been on the job until now
    if (b > today) b = today;
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) continue;
    for (let d = new Date(Math.max(a.getTime(), from.getTime())); d <= b; d = new Date(d.getTime() + DAY_MS)) days.add(dayKey(d));
  }
  return days.size;
}

export interface Perf {
  /** Delivered loads in the window. */
  delivered: any[];
  revenue: number;
  /** Delivered km with a distance recorded, and the revenue of those loads. */
  km: number;
  perKm: number | null;
  days: number;
  months: MonthPoint[];
  /** Approved costs logged on this record in the window, and those still waiting. */
  costs: number;
  pending: number;
  pendingCount: number;
  costCount: number;
  margin: number | null;
  /** Delivered loads before the window (not in these figures). */
  older: number;
}

/**
 * Twelve months of delivered work. Costs follow the P&L rule: every expense
 * that is not rejected counts (approved and pending), excl. VAT; `pending`
 * is the part still awaiting approval, shown for information.
 */
export function performance(loads: any[], expenses: any[] | null, now = new Date()): Perf {
  const from = windowStart(now);
  const inWin = (iso?: string | null) => { if (!iso) return false; const d = new Date(iso); return !Number.isNaN(d.getTime()) && d >= from && d <= now; };
  const deliveredAll = loads.filter(isDelivered);
  const delivered = deliveredAll.filter((l) => inWin(loadDate(l)));
  const revenue = delivered.reduce((s, l) => s + num(l.total_amount), 0);
  // Per km on the shared basis (delivered, with a distance, last 12 months).
  const withKm = perKmLoads(loads, lastTwelveMonths(now));
  const km = withKm.reduce((s, l) => s + num(l.distance), 0);
  const kmRevenue = withKm.reduce((s, l) => s + num(l.total_amount), 0);
  let costs = 0; let pending = 0; let pendingCount = 0; let costCount = 0;
  for (const e of expenses ?? []) {
    if (!inWin(e.expense_date)) continue;
    const st = String(e.status || '').toUpperCase();
    // Costs excl. their input VAT (load prices are excl. VAT too).
    const net = num(e.amount) - num((e as { vat_amount?: unknown }).vat_amount);
    // Every expense that is not rejected is a cost (the P&L rule); pending is the part awaiting approval.
    if (st === 'APPROVED' || st === 'PENDING') { costs += net; costCount += 1; }
    if (st === 'PENDING') { pending += net; pendingCount += 1; }
  }
  return {
    delivered,
    revenue,
    km,
    perKm: km > 0 ? kmRevenue / km : null,
    days: daysOnJob(loads, from, now),
    months: monthlySeries(delivered, 12, now),
    costs, pending, pendingCount, costCount,
    margin: expenses && (costCount > 0) ? revenue - costs : null,
    older: deliveredAll.length - delivered.length,
  };
}

/** The most recent load by its own date (delivery, else pickup, else created). */
export const latest = (loads: any[]) => [...loads].sort((a, b) => String(loadDate(b) || '').localeCompare(String(loadDate(a) || '')))[0];

/** Whole days since a date (0 today). */
export const daysSince = (iso?: string | null) => { const d = daysUntil(iso); return d === null ? null : -d; };

/* Stale work and revenue per km follow the app-wide rules (R6): one stale
   rule (src/lib/staleWork.ts) and one per-km basis (src/lib/revenuePerKm.ts),
   so the Vehicles list, these pages, Orders, Home and Findings agree. */
export { STALE_AFTER_DAYS, staleWork, staleLabel, staleAction } from '@/lib/staleWork';
import { staleLabel, staleAction, type Stale } from '@/lib/staleWork';

/** The fleet's revenue per km over the last 12 months (the shared basis), with its window. */
export function fleetPerKm(allLoads: any[] | null | undefined, now = new Date()): FleetKm | null {
  if (!allLoads) return null;
  const f = fleetRevenuePerKm(allLoads, lastTwelveMonths(now));
  return f.perKm === null ? null : { perKm: f.perKm, window: '12 months' };
}
export interface FleetKm { perKm: number; /** The named window, e.g. "12 months". */ window: string }

// ------------------------------------------------------------------ head

/** Initials avatar for a person's record (in the Contact card; the H1 keeps the page's x). */
export function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  return <span className="fd-avatar" aria-hidden="true">{initials}</span>;
}

/** One line under the head: what the truck or driver is doing right now. */
export function NowLine({ children, flag, action, dot }: { children: ReactNode; flag?: string; action?: ReactNode; dot?: boolean }) {
  return (
    <section className="fd-now fd-card-now" aria-label="Doing now">
      <span className="fd-now__label">Now</span>
      <span className="fd-now__text">
        {flag && <UiStatusChip tone="warning" size="sm" label={flag} />}
        <span className="fd-now__sentence">{dot && <i className="fd-now__dot" aria-hidden="true" />}{children}</span>
      </span>
      {action && <span className="fd-now__action">{action}</span>}
    </section>
  );
}

/**
 * The Now line for an order left open (R7): one short fact, e.g. "Order to
 * Durban left open since 2 Jan 2026 (270 days)". The order's own page holds
 * the step (start, reassign, mark delivered or cancel), named on the button.
 */
export function staleSentence(load: any, stale: Stale): ReactNode {
  const to = load?.delivery_city || load?.delivery_location;
  return <>Order{to ? <> to {to}</> : null} left open <span className="fd-nowrap">{staleLabel(stale).text}</span></>;
}

/** The one action on a stale Now line: open the order, where it can be closed. */
export const StaleOrderButton = ({ load }: { load: any }) => {
  const step = staleAction(load);
  const ref = load?.load_number || 'the order';
  return (
    <Link className="fd-ghost" to={`/bookings/${load.id}`} title={`${step} on ${ref}`} aria-label={`Open order ${ref}: ${step.toLowerCase()}`}>Open order</Link>
  );
};

/** A load reference that opens the booking. */
export const LoadLink = ({ load }: { load: any }) => (
  <Link className="fd-inline-link fd-mono" to={`/bookings/${load.id}`}>{load.load_number || `Load ${load.id}`}</Link>
);

// ----------------------------------------------------------- performance

export interface PerfFigure { label: string; value: ReactNode; note?: ReactNode; lead?: boolean; quiet?: boolean }

/**
 * Performance for a record: the lead figure in the accent, the others quiet,
 * then a compact monthly trend when two or more months carry revenue. With
 * thin data it says so in one line and shows only the figures that mean
 * something for one or two loads.
 */
export function PerformanceCard({ figures, perf, basis, thinLine, empty, className }: {
  figures: PerfFigure[]; perf: Perf; basis: ReactNode; thinLine?: ReactNode; empty?: { text: ReactNode; action?: ReactNode }; className?: string;
}) {
  const shown = figures.filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
  return (
    <section className={`fd-panel fd-perf ${className ?? ''}`} aria-label="Performance">
      <div className="fd-panel__head">
        <div className="fd-panel__titles">
          <h2 className="fd-panel__title">Performance <InfoTip label="how performance is worked out">{basis}</InfoTip></h2>
          {!empty && <p className="fd-panel__sub">{thinLine ?? 'Last 12 months'}</p>}
        </div>
      </div>
      {empty ? (
        <div className="fd-perf__empty">
          <p className="fd-perf__empty-text">{empty.text}</p>
          {empty.action}
        </div>
      ) : (
        <>
          <dl className="fd-perf__figs" style={{ ['--figs' as any]: shown.length }}>
            {shown.map((f) => (
              <div key={f.label} className={`fd-perf__fig${f.lead ? ' is-lead' : ''}${f.quiet ? ' is-quiet' : ''}`}>
                <dt>{f.label}</dt>
                <dd>
                  <span className="fd-perf__value">{f.value}</span>
                  {f.note && <span className="fd-perf__note">{f.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
          {/* A chart needs at least 3 months with revenue; below that the
              sub line names the months (R5: no chart for < 3 points). */}
          {monthsWithRevenue(perf.months) >= 3 && (
            <div className="fd-perf__trend">
              <MonthlyBars data={perf.months} caption="Delivered revenue by month" height={112} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** "2 delivered loads · Jan and Jun 2026": the compact line that stands in for a chart of < 3 months. */
export function perfLine(perf: Perf): string {
  const n = perf.delivered.length;
  const months = perf.months.filter((m) => m.revenue > 0);
  const head = `${plural(n, 'delivered load')}, last 12 months`;
  if (months.length === 0 || months.length >= 3) return head;
  const years = new Set(months.map((m) => m.key.slice(0, 4)));
  const names = years.size === 1
    ? `${months.map((m) => m.short).join(' and ')} ${months[0].key.slice(0, 4)}`
    : months.map((m) => m.label).join(' and ');
  return `${plural(n, 'delivered load')} · ${names}`;
}

/** Figures shared by the vehicle and driver cards. `fleetKm` is the fleet's revenue per km for comparison. */
export function perfFigures(perf: Perf, opts: { revenueLabel: string; thin: boolean; costs?: boolean; costsKnown?: boolean; fleetKm?: FleetKm | null }): PerfFigure[] {
  const n = perf.delivered.length;
  const figs: PerfFigure[] = [
    { label: opts.revenueLabel, value: randWhole(perf.revenue), note: opts.thin ? undefined : plural(n, 'load'), lead: true },
  ];
  if (opts.costs && opts.costsKnown) {
    if (perf.costCount === 0) {
      figs.push({ label: 'Margin after truck costs', value: 'No costs logged', quiet: true, note: 'On this truck in the last 12 months' });
    } else {
      const margin = perf.revenue - perf.costs;
      figs.push({
        label: 'Margin after truck costs',
        value: randWhole(margin),
        note: perf.pending > 0
          ? `After ${randWhole(perf.costs)} costs, incl. ${randWhole(perf.pending)} awaiting approval`
          : `After ${randWhole(perf.costs)} costs`,
      });
    }
  }
  // Compared with the fleet on the same basis and a named window (R6); the
  // km behind the figure are in the Performance tip.
  let kmNote: ReactNode = perf.km > 0 ? `Over ${kmText(perf.km)}` : undefined;
  if (perf.perKm !== null && opts.fleetKm) {
    const f = opts.fleetKm.perKm;
    const diff = perf.perKm - f;
    kmNote = Math.abs(diff) / f < 0.03
      ? `In line with the fleet's ${randCents(f)} over ${opts.fleetKm.window}`
      : <>
        {/* Narrow cards keep it to two lines (R7): the fleet's figure moves to the tip, the window stays. */}
        <span className="fd-perf__wide">{randCents(Math.abs(diff))} {diff < 0 ? 'below' : 'above'} the fleet's {randCents(f)} over {opts.fleetKm.window}</span>
        <span className="fd-perf__narrow" title={`Fleet ${randCents(f)} per km over ${opts.fleetKm.window}`}>{randCents(Math.abs(diff))} {diff < 0 ? 'below' : 'above'} the fleet ({opts.fleetKm.window})</span>
      </>;
  }
  figs.push({ label: 'Revenue per km', value: perf.perKm !== null ? randCents(perf.perKm) : null, note: kmNote });
  if (!opts.thin) figs.push({ label: 'Days on a job', value: formatNumber(perf.days), note: 'Pickup to delivery' });
  return figs;
}

// ------------------------------------------------------------- condition

/** Score bands (the Vehicles Health tip uses the same words). Below 40 needs action. */
export const ACTION_BELOW = 40;
export const band = (n: number) => (n >= 80 ? 'Good' : n >= 60 ? 'Fair' : n >= ACTION_BELOW ? 'Low' : 'Needs action');

/** A 0-100 meter. Neutral fill; danger only below the action threshold. No tick gaps (they read as data breaks). */
export function Meter({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <span className={`fd-meter fd-meter--${size}`} aria-hidden="true">
      <span className={`fd-meter__fill${v < ACTION_BELOW ? ' is-action' : ''}`} style={{ width: `${v}%` }} />
    </span>
  );
}

/** Condition: the overall score in the sub line, then one compact row per part (label, meter, score, band). */
export function ConditionCard({ overall, parts, info, className }: {
  overall: number | null; parts: { label: string; score: number | null; note?: ReactNode }[]; info: ReactNode; className?: string;
}) {
  const scored = parts.filter((p) => p.score);
  return (
    <section className={`fd-panel fd-condition ${className ?? ''}`} aria-label="Condition">
      <div className="fd-panel__head">
        <div className="fd-panel__titles">
          <h2 className="fd-panel__title">Condition <InfoTip label="condition scores">{info}</InfoTip></h2>
          <p className="fd-panel__sub">
            {overall
              ? <>Overall <span className="fd-condition__overall-n">{overall}</span> of 100 · <span className={overall < ACTION_BELOW ? 'fd-condition__band is-action' : undefined}>{band(overall)}</span></>
              : 'Not scored yet. Scores need maintenance, fuel or uptime data.'}
          </p>
        </div>
      </div>
      {overall && scored.length > 0 ? (
        <ul className="fd-condition__parts">
          {scored.map((p) => (
            <li key={p.label} className="fd-condition__part" aria-label={`${p.label} ${p.score} out of 100, ${band(p.score!)}`}>
              <span className="fd-condition__label">
                {p.label}
                {p.note && <span className="fd-condition__note">{p.note}</span>}
              </span>
              <Meter value={p.score!} />
              <span className={`fd-condition__n${p.score! < ACTION_BELOW ? ' is-action' : ''}`}>{p.score}</span>
              <span className={`fd-condition__band${p.score! < ACTION_BELOW ? ' is-action' : ''}`}>{band(p.score!)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

// ------------------------------------------------------------ compliance

export interface ToDo {
  key: string;
  tone: 'danger' | 'warning' | 'ok' | 'missing';
  title: ReactNode;
  detail?: ReactNode;
  action?: { label: string; onClick: () => void; aria?: string };
}

const TONE_ORDER: Record<ToDo['tone'], number> = { danger: 0, warning: 1, missing: 2, ok: 3 };

/** Countdown to-do for a date field: expired, due soon, fine, or not recorded. */
export function dateToDo(key: string, what: string, iso: string | null | undefined, soon: number, add?: ToDo['action']): ToDo | null {
  const d = daysUntil(iso);
  if (d === null) return add ? { key, tone: 'missing', title: `${what} expiry`, detail: 'Not recorded', action: add } : null;
  const when = dateText(iso);
  if (d < 0) return { key, tone: 'danger', title: `${what} expired`, detail: `${plural(-d, 'day')} ago · ${when}` };
  if (d === 0) return { key, tone: 'danger', title: `${what} expires today`, detail: when };
  return { key, tone: d <= soon ? 'warning' : 'ok', title: `${what} expires in ${plural(d, 'day')}`, detail: when };
}

/** What the owner acts on: overdue and due-soon first, then missing records with an Add, then what is fine. */
export function ComplianceCard({ items, className, title = 'Compliance', sub, lead = [] }: {
  items: ToDo[]; className?: string; title?: string; sub?: ReactNode; lead?: ToDo[];
}) {
  // `lead` items (e.g. a new truck's first steps) stay first, in their order.
  const sorted = [...lead, ...[...items].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])];
  const todo = sorted.filter((i) => i.tone !== 'ok').length;
  return (
    <section className={`fd-panel fd-todo ${className ?? ''}`} aria-label={title}>
      <div className="fd-panel__head">
        <div className="fd-panel__titles">
          <h2 className="fd-panel__title">{title}</h2>
          <p className="fd-panel__sub">{sub ?? (todo === 0 ? 'Nothing due' : plural(todo, 'thing', 'things') + ' to do')}</p>
        </div>
      </div>
      <ul className="fd-todo__list">
        {sorted.map((i) => (
          <li key={i.key} className={`fd-todo__item is-${i.tone}`}>
            <i className="fd-todo__dot" aria-hidden="true" />
            <span className="fd-todo__body">
              <span className="fd-todo__title">{i.title}</span>
              {i.detail && <span className="fd-todo__detail">{i.detail}</span>}
            </span>
            {i.action && (
              <button type="button" className="fd-ghost" onClick={i.action.onClick} aria-label={i.action.aria}>{i.action.label}</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ----------------------------------------------------------------- facts

export interface Fact { label: string; value: ReactNode; mono?: boolean; add?: () => void; phoneOnly?: boolean }

/** Label/value facts. A missing fact the owner can fill shows an Add; one they cannot is left out. */
export function FactsCard({ title, facts, className, addLabel = 'Add', children, lead, wide }: {
  title: string; facts: Fact[]; className?: string; addLabel?: string; children?: ReactNode; lead?: ReactNode;
  /** Two columns of rows (the card sits in the wide main column; desktop only, so phone-only rows are left out). */
  wide?: boolean;
}) {
  const rows = facts.filter((f) => ((f.value !== null && f.value !== undefined && f.value !== '') || f.add) && !(wide && f.phoneOnly));
  return (
    <section className={`fd-panel fd-facts${wide ? ' fd-facts--wide' : ''} ${className ?? ''}`} aria-label={title}>
      <div className="fd-panel__head">
        <div className="fd-panel__titles"><h2 className="fd-panel__title">{title}</h2></div>
      </div>
      {lead}
      {children}
      {rows.length > 0 && (
        <dl className="fd-rows">
          {rows.map((f) => {
            const missing = f.value === null || f.value === undefined || f.value === '';
            return (
              <div key={f.label} className={`fd-row${f.phoneOnly ? ' fd-show-phone' : ''}`}>
                <dt>{f.label}</dt>
                <dd className={f.mono && !missing ? 'fd-mono' : undefined}>
                  {missing
                    ? <button type="button" className="fd-ghost fd-ghost--row" onClick={f.add} aria-label={`Add ${f.label.toLowerCase()}`}>{addLabel}</button>
                    : f.value}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}

/** A small card naming one linked record (the truck's driver, the driver's truck). */
export function LinkCard({ title, className, primary, secondary, action }: {
  title: string; className?: string; primary: ReactNode; secondary?: ReactNode; action?: ReactNode;
}) {
  return (
    <section className={`fd-panel fd-linkcard ${className ?? ''}`} aria-label={title}>
      <h2 className="fd-panel__title fd-linkcard__title">{title}</h2>
      <div className="fd-linkcard__row">
        <span className="fd-linkcard__body">
          <span className="fd-linkcard__primary">{primary}</span>
          {secondary && <span className="fd-linkcard__secondary">{secondary}</span>}
        </span>
        {action}
      </div>
    </section>
  );
}
