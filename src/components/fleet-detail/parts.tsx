import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { StatusMenu } from './StatusMenu';
import SectionHeader from '@/components/layout/SectionHeader';
import { formatDate, formatDistance, formatMoney, formatMoneyWhole, formatMonth, formatNumber } from '@/lib/formatters';
import { Link } from 'react-router-dom';
import { FileSearch } from 'lucide-react';
import LoadError from '@/components/data/LoadError';
import { StatusChip as SharedStatusChip } from '@/components/ui/StatusChip';
import { Segmented } from '@/components/ui/Segmented';
import { KpiRow, KpiTile } from '@/components/ui/KpiTile';

/* Building blocks for the one-page vehicle and driver records
   (src/pages/VehicleFinancialProfile.tsx, src/pages/DriverProfile.tsx).
   Styles live in src/pages/fleet-detail.css under the fd- prefix. */

// ------------------------------------------------------------------ format

export const DAY_MS = 24 * 60 * 60 * 1000;

/** "IN_USE" → "In use". */
export const formatStatus = (s?: string | null) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : '—';

/** Whole rands for headline figures: "R 25 573". */
export const randWhole = (v: number) => formatMoneyWhole(v);

/** Rands and cents per unit: "R 15,50". */
export const randCents = (v: number) => formatMoney(v);

export const kmText = (n: number) => formatDistance(n);

export const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

/** "7 Jan 2026". Missing or unparseable dates are the placeholder. */
export const dateText = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? null : formatDate(d);
};

/** Whole days from today until a date (negative when past). */
export const daysUntil = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / DAY_MS);
};

export const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;

/** A truck's own payload in tonnes (vehicle.capacity is kg), else its type's
 *  default (vehicle_type_capacity is tonnes). One source for the Vehicles
 *  list and the vehicle page, so both print the same "26,6 t". */
export const capacityTonnes = (v: any): number | null => {
  const own = num(v?.capacity);
  if (own > 0) return own / 1000;
  const type = num(v?.vehicle_type_capacity);
  return type > 0 ? type : null;
};

// ---------------------------------------------------------------- monthly

export interface MonthPoint { key: string; label: string; short: string; revenue: number; loads: number }

/** The date a load counts on: delivery, else pickup, else when it was created. */
export const loadDate = (l: any): string | null => l?.delivery_date || l?.pickup_date || l?.created_at || null;

/** Revenue and load count per calendar month for the last `n` months, zeros included. */
export function monthlySeries(loads: any[], n = 12, now = new Date()): MonthPoint[] {
  const out: MonthPoint[] = [];
  const index: Record<string, MonthPoint> = {};
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const p: MonthPoint = {
      key,
      label: formatMonth(d),
      short: formatMonth(d).slice(0, 3),
      revenue: 0,
      loads: 0,
    };
    out.push(p);
    index[key] = p;
  }
  for (const l of loads) {
    const raw = loadDate(l);
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const p = index[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`];
    if (!p) continue;
    p.revenue += num(l.total_amount);
    p.loads += 1;
  }
  // Months before the first load are not "empty months", they are before
  // this record had any work: trim them (keeping at least 3 bars).
  const first = out.findIndex((m) => m.loads > 0);
  return first < 0 ? out : out.slice(Math.min(first, Math.max(0, out.length - 3)));
}

/** Months that actually carry revenue: a chart needs at least two to say anything. */
export const monthsWithRevenue = (months: MonthPoint[]) => months.filter((m) => m.revenue > 0).length;

// ------------------------------------------------------------------ info

/** Methodology behind a small (i). Hover, focus or tap opens it; Escape closes. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const w = Math.min(280, window.innerWidth - 32);
    const left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - 16 - w));
    setPos({ top: r.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const away = (e: PointerEvent) => { if (!btn.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', away);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointerdown', away);
    };
  }, [open]);

  return (
    <span className="fd-info" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        ref={btn}
        type="button"
        className="fd-info__btn"
        aria-label={`About ${label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.2v3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="5" r="0.9" fill="currentColor" />
        </svg>
      </button>
      {open && pos && (
        <span id={id} role="tooltip" className="fd-info__pop" style={{ top: pos.top, left: pos.left }}>
          {children}
        </span>
      )}
    </span>
  );
}

/** Small outlined qualifier: "Modelled", "Default", "Rule-based". */
export const Tag = ({ children }: { children: ReactNode }) => <span className="fd-tag">{children}</span>;

// ------------------------------------------------------------------ header

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

/** The product-wide status chip (components/ui/StatusChip), tone from the shared map. */
export const StatusChip = ({ status, label }: { status?: string | null; label?: string }) => (
  <SharedStatusChip status={status} label={label} />
);

export function RecordHeader({ crumb, crumbTo, title, chip, meta, actions }: {
  crumb: string; crumbTo: string; title: string; chip: ReactNode; meta?: ReactNode; actions?: ReactNode;
}) {
  // The one page head (SectionHeader): H1 at the same place as every other
  // page, the back link on the subtitle line, actions on the title row.
  return (
    <SectionHeader
      title={title}
      titleAdornment={chip}
      back={{ to: crumbTo, label: crumb }}
      description={meta}
      actions={actions}
    />
  );
}

/** Status setter on a vehicle or driver page: the status is shown once as the
 *  header chip; this "Change status" menu is the action, and it confirms the
 *  choice before `onPick` runs the page's PATCH. */
export function StatusControl({ label, options, current, busy, onPick, subject }: {
  label: string; options: readonly string[]; current?: string; busy: boolean; onPick: (s: string) => void; subject?: string;
}) {
  return (
    <StatusMenu
      // The record's one head action: it stays on the phone title row (R4).
      triggerClassName="fd-status-trigger--primary"
      subject={subject || label.replace(/^Set /, '').replace(/ status$/, '')}
      current={current ?? ''}
      busy={busy}
      options={options.map((s) => ({ value: s, label: formatStatus(s) }))}
      onChange={(s) => { if (!busy) onPick(s); }}
    />
  );
}

// ------------------------------------------------------------------- KPIs

export interface KpiProps {
  label: string;
  /** Headline figure; `null` leaves the tile out (a tile never shows "No data"). */
  value: ReactNode | null;
  /** Kept for call-site compatibility; empty tiles are not rendered. */
  empty?: string;
  unit?: ReactNode;
  tag?: ReactNode;
  info?: ReactNode;
  sub?: ReactNode;
  tone?: 'danger' | 'warning';
}

/** One standard KPI tile (components/ui/KpiTile). Renders nothing without a value. */
export function Kpi({ label, value, unit, tag, info, sub, tone }: KpiProps) {
  if (value == null) return null;
  return (
    <KpiTile
      aria-label={label}
      label={<>{label}{tag}</>}
      aside={info ? <InfoTip label={label}>{info}</InfoTip> : undefined}
      figure={<>{value}{unit && <span className="tw-kpi__of"> {unit}</span>}</>}
      note={sub}
      tone={tone}
    />
  );
}

// Kpi returns null for a missing value; drop those children before KpiRow
// counts its columns, so 3 tiles fill the width instead of 3/4 of it.
export const KpiStrip = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="fd-strip" aria-label={label}>
    <KpiRow>{Children.toArray(children).filter((c) => !(isValidElement(c) && c.type === Kpi && (c.props as KpiProps).value == null))}</KpiRow>
  </section>
);

// ----------------------------------------------------------------- panels

export function Panel({ title, sub, info, aside, children, className, flush }: {
  title: string; sub?: ReactNode; info?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={`fd-panel${flush ? ' fd-panel--flush' : ''}${className ? ` ${className}` : ''}`} aria-label={title}>
      <div className="fd-panel__head">
        <div className="fd-panel__titles">
          <h2 className="fd-panel__title">
            {title}
            {info && <InfoTip label={title}>{info}</InfoTip>}
          </h2>
          {sub && <p className="fd-panel__sub">{sub}</p>}
        </div>
        {aside && <div className="fd-panel__aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export interface RowSpec {
  label: string;
  value: ReactNode;
  mono?: boolean;
  tone?: 'danger' | 'warning' | 'muted';
  note?: ReactNode;
  /** Computed from other fields; left out of the "Not recorded" list when missing. */
  derived?: boolean;
}

const isMissing = (v: ReactNode) => v == null || v === '' || v === false;

/**
 * A labelled group of label/value rows. Rows with no value collapse into one
 * muted "Not recorded" line (so every field stays visible without a column
 * of dashes), with an optional action to fill them in.
 */
export function Group({ title, extra, rows, onAdd, addLabel = 'Add', missingText }: {
  title: string; extra?: ReactNode; rows: RowSpec[]; onAdd?: () => void; addLabel?: string; missingText?: string;
}) {
  const present = rows.filter((r) => !isMissing(r.value));
  const missing = rows.filter((r) => isMissing(r.value) && !r.derived);
  const list = missing.map((r, i) => (i === 0 ? r.label : r.label.charAt(0).toLowerCase() + r.label.slice(1))).join(', ');
  return (
    <div className="fd-group">
      <h3 className="fd-group__title">{title}{extra}</h3>
      {present.length > 0 && (
        <dl className="fd-rows">
          {present.map((r) => <Row key={r.label} {...r} />)}
        </dl>
      )}
      {missing.length > 0 && (
        <p className="fd-missing">
          <span><span className="fd-missing__lead">{missingText ?? 'Not recorded'}</span>{missingText ? null : <>: {list}</>}</span>
          {onAdd && <button type="button" className="fd-link fd-link--inline" onClick={onAdd}>{addLabel}</button>}
        </p>
      )}
    </div>
  );
}

/** One label/value row. `mono` only for identifiers. */
export const Row = ({ label, value, mono, tone, note }: RowSpec) => {
  const missing = isMissing(value);
  return (
    <div className="fd-row">
      <dt>{label}</dt>
      <dd className={`${mono && !missing ? 'fd-mono ' : ''}${missing ? 'is-missing' : tone ? `is-${tone}` : ''}`.trim() || undefined}>
        {missing ? '—' : value}
        {note && !missing && <span className="fd-row__note">{note}</span>}
      </dd>
    </div>
  );
};

/** Compact figures under a chart: short label, value, optional tag. */
export function MiniStats({ items }: { items: { label: string; value: ReactNode; note?: ReactNode }[] }) {
  return (
    <dl className="fd-mini">
      {items.map((it) => (
        <div key={it.label} className="fd-mini__item">
          <dt>{it.label}</dt>
          <dd className={isMissing(it.value) ? 'is-missing' : undefined}>
            {isMissing(it.value) ? '—' : it.value}
            {it.note && !isMissing(it.value) && it.note}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ----------------------------------------------------------------- alerts

export interface AlertItem { key: string; tone: 'danger' | 'warning'; text: string; when?: string | null }

/** Real issues only. Renders nothing when there are none. */
export function AlertsPanel({ items }: { items: AlertItem[] }) {
  if (items.length === 0) return null;
  return (
    <Panel title="Needs attention" className="fd-alerts">
      <ul className="fd-alerts__list">
        {items.map((a) => (
          <li key={a.key} className={`fd-alert is-${a.tone}`}>
            <i className="fd-alert__dot" aria-hidden="true" />
            <span className="fd-alert__text">{a.text}</span>
            {a.when && <span className="fd-alert__when">{a.when}</span>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Expiry reminder for a date field: expired, or within `soon` days. */
export function expiryAlert(key: string, what: string, date: string | null | undefined, soon: number): AlertItem | null {
  const d = daysUntil(date);
  if (d === null) return null;
  if (d < 0) return { key, tone: 'danger', text: `${what} expired`, when: dateText(date) };
  if (d <= soon) return { key, tone: 'warning', text: d === 0 ? `${what} expires today` : `${what} expires in ${plural(d, 'day')}`, when: dateText(date) };
  return null;
}

// ------------------------------------------------------------------ states

export function DetailSkeleton({ crumb, crumbTo }: { crumb?: string; crumbTo?: string } = {}) {
  // The head renders straight away; the body mirrors the record layout
  // (Now line, main column, rail) so the page settles without a jump.
  return (
    <div className="fleet-detail" aria-busy="true" aria-label="Loading">
      {crumb && crumbTo ? (
        <SectionHeader title={crumb.replace(/s$/, '')} back={{ to: crumbTo, label: crumb }} />
      ) : (
        <>
          <div className="fd-skel" style={{ width: 260, height: 28, marginBottom: 8 }} />
          <div className="fd-skel" style={{ width: 200, height: 16, marginBottom: 32 }} />
        </>
      )}
      <div className="fd-now fd-now--skel"><span className="fd-skel" style={{ display: 'block', width: '40%', height: 16 }} /></div>
      <div className="fd-record">
        <div className="fd-main">
          <div className="fd-panel"><div className="fd-skel" style={{ height: 180 }} /></div>
          <div className="fd-panel"><div className="fd-skel" style={{ height: 160 }} /></div>
        </div>
        <div className="fd-side">
          <div className="fd-panel"><div className="fd-skel" style={{ height: 160 }} /></div>
          <div className="fd-panel"><div className="fd-skel" style={{ height: 300 }} /></div>
        </div>
      </div>
    </div>
  );
}

/**
 * A record that could not be shown (R7): the page head (H1 = the record's
 * type, "Vehicle" / "Driver", or "… not found") and the breadcrumb stay, as on
 * Invoice. A 404 says the record is not there, with one way back; any other
 * failure is a load error with Retry.
 */
export function RecordState({ kind, type, crumb, crumbTo, what, error, busy, onRetry, missingTitle, missingHint, backLabel }: {
  kind: 'error' | 'missing'; type: string; crumb: string; crumbTo: string;
  /** "this vehicle" */ what: string;
  error?: unknown; busy?: boolean; onRetry?: () => void;
  missingTitle: string; missingHint: string; backLabel: string;
}) {
  return (
    <div className="fleet-detail">
      <SectionHeader title={kind === 'missing' ? `${type} not found` : type} back={{ to: crumbTo, label: crumb }} />
      {kind === 'error' ? (
        <LoadError what={what} error={error} busy={busy} onRetry={onRetry ?? (() => {})} />
      ) : (
        <div className="load-error fd-notfound" role="status">
          <FileSearch className="load-error__icon" size={20} aria-hidden="true" />
          <div className="load-error__text">
            <p className="load-error__title">{missingTitle}</p>
            <p className="load-error__hint">{missingHint}</p>
          </div>
          <Link className="tw-btn load-error__retry" to={crumbTo}>{backLabel}</Link>
        </div>
      )}
    </div>
  );
}

/** True when a react-query error is an HTTP 404. */
export const isNotFound = (err: unknown) => ((err as any)?.status ?? (err as any)?.response?.status) === 404;
