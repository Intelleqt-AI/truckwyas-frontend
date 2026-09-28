import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sparkline } from '@/components/viz';

/* Building blocks for the one-page vehicle and driver records
   (src/pages/VehicleFinancialProfile.tsx, src/pages/DriverProfile.tsx).
   Styles live in src/pages/fleet-detail.css under the fd- prefix. */

// ------------------------------------------------------------------ format

export const DAY_MS = 24 * 60 * 60 * 1000;

/** "IN_USE" → "In use". */
export const formatStatus = (s?: string | null) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : '—';

/** Whole rands for headline figures: "R 25 573". */
export const randWhole = (v: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(v);

/** Rands and cents per unit: "R 15,50". */
export const randCents = (v: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v);

export const kmText = (n: number) => `${Math.round(n).toLocaleString('en-ZA')} km`;

export const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

/** "7 Jan 2026". Missing or unparseable dates are the placeholder. */
export const dateText = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
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

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-ZA')} ${n === 1 ? one : many}`;

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
      label: d.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' }),
      short: d.toLocaleDateString('en-ZA', { month: 'short' }),
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
  return out;
}

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

export const StatusChip = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span className={`fd-chip fd-chip--${tone}`}>
    <i className="fd-chip__dot" aria-hidden="true" />
    {children}
  </span>
);

export function RecordHeader({ crumb, crumbTo, title, chip, meta, actions }: {
  crumb: string; crumbTo: string; title: string; chip: ReactNode; meta?: ReactNode; actions?: ReactNode;
}) {
  return (
    <header className="fd-head">
      <nav className="fd-crumb" aria-label="Breadcrumb">
        <Link to={crumbTo}>{crumb}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{title}</span>
      </nav>
      <div className="fd-head__row">
        <div className="fd-head__id">
          <div className="fd-head__title-row">
            <h1 className="fd-head__title">{title}</h1>
            {chip}
          </div>
          {meta && <p className="fd-head__meta">{meta}</p>}
        </div>
        {actions && <div className="fd-head__actions">{actions}</div>}
      </div>
    </header>
  );
}

/** Segmented status control. Keeps the old buttons' PATCH-per-click behaviour. */
export function StatusControl({ label, options, current, busy, onPick }: {
  label: string; options: readonly string[]; current?: string; busy: boolean; onPick: (s: string) => void;
}) {
  return (
    <div className="fd-seg" role="group" aria-label={label}>
      {options.map((s) => {
        const on = current === s;
        return (
          <button key={s} type="button" className="fd-seg__btn" aria-pressed={on} disabled={on || busy} onClick={() => onPick(s)}>
            {formatStatus(s)}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------- KPIs

export interface KpiProps {
  label: string;
  /** Headline figure; `null` renders the muted `empty` text instead. */
  value: ReactNode | null;
  empty?: string;
  unit?: ReactNode;
  tag?: ReactNode;
  info?: ReactNode;
  sub?: ReactNode;
  tone?: 'danger' | 'warning';
  spark?: { values: number[]; labels: string[]; format: (v: number) => string; ariaLabel: string };
}

export function Kpi({ label, value, empty = 'Not enough data', unit, tag, info, sub, tone, spark }: KpiProps) {
  return (
    <div className="fd-kpi">
      <div className="fd-kpi__head">
        <span className="fd-kpi__label">{label}</span>
        {tag}
        {info && <InfoTip label={label}>{info}</InfoTip>}
      </div>
      {value == null
        ? <div className="fd-kpi__value is-empty">{empty}</div>
        : <div className={`fd-kpi__value${tone ? ` is-${tone}` : ''}`}>{value}{unit && <span className="fd-kpi__unit">{unit}</span>}</div>}
      {sub && <div className="fd-kpi__sub">{sub}</div>}
      {spark && (
        <div className="fd-kpi__spark">
          <Sparkline variant="bars" height={28} minPoints={2} {...spark} />
        </div>
      )}
    </div>
  );
}

export const KpiStrip = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="fd-strip" aria-label={label}>{children}</section>
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

export function DetailSkeleton() {
  return (
    <div className="fleet-detail" aria-busy="true" aria-label="Loading">
      <div className="fd-skel" style={{ width: 120, height: 16, marginBottom: 16 }} />
      <div className="fd-skel" style={{ width: 260, height: 28, marginBottom: 8 }} />
      <div className="fd-skel" style={{ width: 200, height: 16, marginBottom: 32 }} />
      <div className="fd-strip">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="fd-kpi">
            <div className="fd-skel" style={{ width: 90, height: 14 }} />
            <div className="fd-skel" style={{ width: 140, height: 28, marginTop: 12 }} />
          </div>
        ))}
      </div>
      <div className="fd-body">
        <div className="fd-main">
          <div className="fd-panel"><div className="fd-skel" style={{ height: 200 }} /></div>
          <div className="fd-panel"><div className="fd-skel" style={{ height: 240 }} /></div>
        </div>
        <div className="fd-side">
          <div className="fd-panel"><div className="fd-skel" style={{ height: 420 }} /></div>
        </div>
      </div>
    </div>
  );
}

export function DetailMessage({ title, body, primary, secondary }: {
  title: string; body: string; primary: { label: string; onClick: () => void }; secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="fleet-detail">
      <div className="fd-message" role="alert">
        <h1 className="fd-message__title">{title}</h1>
        <p className="fd-message__body">{body}</p>
        <div className="fd-message__actions">
          <button type="button" className="btn-action" onClick={primary.onClick}>{primary.label}</button>
          {secondary && <button type="button" className="fd-button" onClick={secondary.onClick}>{secondary.label}</button>}
        </div>
      </div>
    </div>
  );
}

/** True when a react-query error is an HTTP 404. */
export const isNotFound = (err: unknown) => ((err as any)?.status ?? (err as any)?.response?.status) === 404;
