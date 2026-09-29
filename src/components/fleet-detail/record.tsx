import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DELIVERED } from '@/components/reports/data';
import { formatNumber } from '@/lib/formatters';
import { StatusChip as UiStatusChip } from '@/components/ui/StatusChip';
import { MonthlyBars } from './MonthlyBars';
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
 * Twelve months of delivered work. Costs follow the P&L rule: approved
 * expenses count, pending ones are reported but not deducted.
 */
export function performance(loads: any[], expenses: any[] | null, now = new Date()): Perf {
  const from = windowStart(now);
  const inWin = (iso?: string | null) => { if (!iso) return false; const d = new Date(iso); return !Number.isNaN(d.getTime()) && d >= from && d <= now; };
  const deliveredAll = loads.filter(isDelivered);
  const delivered = deliveredAll.filter((l) => inWin(loadDate(l)));
  const revenue = delivered.reduce((s, l) => s + num(l.total_amount), 0);
  const withKm = delivered.filter((l) => num(l.distance) > 0);
  const km = withKm.reduce((s, l) => s + num(l.distance), 0);
  const kmRevenue = withKm.reduce((s, l) => s + num(l.total_amount), 0);
  let costs = 0; let pending = 0; let pendingCount = 0; let costCount = 0;
  for (const e of expenses ?? []) {
    if (!inWin(e.expense_date)) continue;
    const st = String(e.status || '').toUpperCase();
    if (st === 'APPROVED') { costs += num(e.amount); costCount += 1; } else if (st === 'PENDING') { pending += num(e.amount); pendingCount += 1; }
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

// ------------------------------------------------------------------ head

/** Initials avatar for a person's record (in the Contact card; the H1 keeps the page's x). */
export function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  return <span className="fd-avatar" aria-hidden="true">{initials}</span>;
}

/** One line under the head: what the truck or driver is doing right now. */
export function NowLine({ children, flag, action }: { children: ReactNode; flag?: string; action?: ReactNode }) {
  return (
    <section className="fd-now fd-card-now" aria-label="Doing now">
      <span className="fd-now__label">Now</span>
      <span className="fd-now__text">
        {flag && <UiStatusChip tone="warning" size="sm" label={flag} />}
        <span className="fd-now__sentence">{children}</span>
      </span>
      {action && <span className="fd-now__action">{action}</span>}
    </section>
  );
}

/** A load reference that opens the booking. */
export const LoadLink = ({ load }: { load: any }) => (
  <Link className="fd-inline-link fd-mono" to={`/bookings/${load.id}`}>{load.load_number || `Load ${load.id}`}</Link>
);

// ----------------------------------------------------------- performance

export interface PerfFigure { label: string; value: ReactNode; note?: ReactNode; lead?: boolean }

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
          <p className="fd-panel__sub">{empty ? 'No delivered loads yet' : thinLine ?? 'Last 12 months'}</p>
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
              <div key={f.label} className={`fd-perf__fig${f.lead ? ' is-lead' : ''}`}>
                <dt>{f.label}</dt>
                <dd>
                  <span className="fd-perf__value">{f.value}</span>
                  {f.note && <span className="fd-perf__note">{f.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
          {monthsWithRevenue(perf.months) >= 2 && (
            <div className="fd-perf__trend">
              <MonthlyBars data={perf.months} caption="Delivered revenue by month" height={112} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Figures shared by the vehicle and driver cards. */
export function perfFigures(perf: Perf, opts: { revenueLabel: string; thin: boolean; costs?: boolean }): PerfFigure[] {
  const n = perf.delivered.length;
  const figs: PerfFigure[] = [
    { label: opts.revenueLabel, value: randWhole(perf.revenue), note: opts.thin ? undefined : plural(n, 'load'), lead: true },
  ];
  if (opts.costs) {
    figs.push({
      label: 'Margin after truck costs',
      value: perf.margin !== null ? randWhole(perf.margin) : null,
      note: perf.margin !== null
        ? <>Less {randWhole(perf.costs)} costs{perf.pending > 0 ? <> · {randWhole(perf.pending)} pending</> : null}</>
        : undefined,
    });
  }
  figs.push({ label: 'Revenue per km', value: perf.perKm !== null ? randCents(perf.perKm) : null, note: perf.km > 0 ? `Over ${kmText(perf.km)}` : undefined });
  if (!opts.thin) figs.push({ label: 'Days on a job', value: formatNumber(perf.days), note: 'Pickup to delivery' });
  return figs;
}

// ------------------------------------------------------------- condition

/** Score bands (the Vehicles Health tip uses the same words). Below 40 needs action. */
export const ACTION_BELOW = 40;
export const band = (n: number) => (n >= 80 ? 'Good' : n >= 60 ? 'Fair' : n >= ACTION_BELOW ? 'Low' : 'Needs action');

/** A 0-100 meter with ticks at 40, 60 and 80. Neutral fill; danger only below the action threshold. */
export function Meter({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <span className={`fd-meter fd-meter--${size}`} aria-hidden="true">
      <span className={`fd-meter__fill${v < ACTION_BELOW ? ' is-action' : ''}`} style={{ width: `${v}%` }} />
      {[ACTION_BELOW, 60, 80].map((t) => <span key={t} className="fd-meter__tick" style={{ left: `${t}%` }} />)}
    </span>
  );
}

export function ConditionCard({ overall, parts, info, className }: {
  overall: number | null; parts: { label: string; score: number | null; note?: ReactNode }[]; info: ReactNode; className?: string;
}) {
  const scored = parts.filter((p) => p.score);
  return (
    <section className={`fd-panel fd-condition ${className ?? ''}`} aria-label="Condition">
      <div className="fd-panel__head">
        <div className="fd-panel__titles">
          <h2 className="fd-panel__title">Condition <InfoTip label="condition scores">{info}</InfoTip></h2>
          <p className="fd-panel__sub">{overall ? 'Out of 100' : 'Not scored yet. Scores need maintenance, fuel or uptime data.'}</p>
        </div>
      </div>
      {overall ? (
        <>
          <div className="fd-condition__overall" role="img" aria-label={`Overall ${overall} out of 100, ${band(overall)}`}>
            <span className="fd-condition__score">{overall}</span>
            <span className={`fd-condition__band${overall < ACTION_BELOW ? ' is-action' : ''}`}>{band(overall)}</span>
            <Meter value={overall} size="lg" />
          </div>
          {scored.length > 0 && (
            <ul className="fd-condition__parts">
              {scored.map((p) => (
                <li key={p.label} className="fd-condition__part" aria-label={`${p.label} ${p.score} out of 100, ${band(p.score!)}`}>
                  <span className="fd-condition__label">
                    {p.label}
                    {p.note && <span className="fd-condition__note">{p.note}</span>}
                  </span>
                  <Meter value={p.score!} />
                  <span className={`fd-condition__n${p.score! < ACTION_BELOW ? ' is-action' : ''}`}>{p.score}</span>
                </li>
              ))}
            </ul>
          )}
        </>
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
export function ComplianceCard({ items, className }: { items: ToDo[]; className?: string }) {
  const sorted = [...items].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
  const todo = items.filter((i) => i.tone !== 'ok').length;
  return (
    <section className={`fd-panel fd-todo ${className ?? ''}`} aria-label="Compliance">
      <div className="fd-panel__head">
        <div className="fd-panel__titles">
          <h2 className="fd-panel__title">Compliance</h2>
          <p className="fd-panel__sub">{todo === 0 ? 'Nothing due' : plural(todo, 'thing', 'things') + ' to do'}</p>
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

export interface Fact { label: string; value: ReactNode; mono?: boolean; add?: () => void }

/** Label/value facts. A missing fact the owner can fill shows an Add; one they cannot is left out. */
export function FactsCard({ title, facts, className, addLabel = 'Add', children, lead }: {
  title: string; facts: Fact[]; className?: string; addLabel?: string; children?: ReactNode; lead?: ReactNode;
}) {
  const rows = facts.filter((f) => (f.value !== null && f.value !== undefined && f.value !== '') || f.add);
  return (
    <section className={`fd-panel fd-facts ${className ?? ''}`} aria-label={title}>
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
              <div key={f.label} className="fd-row">
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
