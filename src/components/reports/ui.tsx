import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check as CheckIcon, Download, Printer } from 'lucide-react';
import { InfoTip } from '@/components/ui/InfoTip';
import {
  PERIODS, day, downloadCsv, int, money, pct, resolvePeriod, slug,
  type CsvCell, type Period, type PeriodId,
} from './data';

/* Shared parts of every report: the frame (back link, title, info tip,
   one-line basis, Export CSV and Print), figure tiles, the statement table
   and the period control. Words follow DESIGN-PRINCIPLES section 9. */

// ------------------------------------------------------------------ period

export function usePeriod(defaultId: PeriodId = 'last-12'): [Period, (id: PeriodId, from?: string, to?: string) => void] {
  const [params, setParams] = useSearchParams();
  const id = (params.get('period') as PeriodId) || defaultId;
  const p = resolvePeriod(PERIODS.some(x => x.id === id) ? id : defaultId, params.get('from'), params.get('to'));
  const set = (next: PeriodId, from?: string, to?: string) => setParams(prev => {
    const n = new URLSearchParams(prev);
    n.set('period', next);
    if (next === 'custom') { n.set('from', from ?? p.from); n.set('to', to ?? p.to); } else { n.delete('from'); n.delete('to'); }
    return n;
  }, { replace: true });
  return [p, set];
}

export function PeriodControl({ period, onChange, options }: {
  period: Period; onChange: (id: PeriodId, from?: string, to?: string) => void; options?: PeriodId[];
}) {
  const list = PERIODS.filter(p => !options || options.includes(p.id));
  return (
    <div className="fr-period">
      <Seg label="Period" value={period.id} options={list.map(p => ({ id: p.id, label: p.label }))} onChange={id => onChange(id as PeriodId)} />
      {period.id === 'custom' && (
        <span className="fr-period__custom">
          <input type="month" className="fr-input" aria-label="From month" value={period.from} onChange={e => e.target.value && onChange('custom', e.target.value, period.to)} />
          <span className="fr-muted">to</span>
          <input type="month" className="fr-input" aria-label="To month" value={period.to} onChange={e => e.target.value && onChange('custom', period.from, e.target.value)} />
        </span>
      )}
    </div>
  );
}

export function Seg<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { id: T; label: string }[]; onChange: (id: T) => void;
}) {
  return (
    <div className="tw-seg fr-seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" className={`tw-seg__opt${value === o.id ? ' is-active' : ''}`} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------- frame

export interface ReportFrameProps {
  title: string;
  /** At most 8 words: the basis or scope. */
  sub: string;
  info: ReactNode;
  controls?: ReactNode;
  tiles?: ReactNode;
  /** One short line each, for data TruckWys does not capture. */
  gaps?: string[];
  csv?: () => CsvCell[][];
  csvName?: string;
  printTitle?: string;
  children: ReactNode;
  companyName?: string;
}

export function ReportFrame({ title, sub, info, controls, tiles, gaps, csv, csvName, children, companyName, printTitle }: ReportFrameProps) {
  const [params] = useSearchParams();
  const back = new URLSearchParams(params); back.delete('report'); back.delete('customer'); back.delete('view'); back.delete('basis'); back.delete('asat');
  const qs = back.toString();
  return (
    <article className="fr-report" aria-labelledby="fr-report-title">
      <div className="fr-print-head">
        <span>{companyName || 'TruckWys'}</span>
        <span>{printTitle || title} · {sub}</span>
        <span>Printed {day(new Date().toISOString())}</span>
      </div>
      <Link className="fr-back fr-noprint" to={`/finance/reports${qs ? `?${qs}` : ''}`}>
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        All reports
      </Link>
      <header className="fr-head">
        <div className="fr-head__titles">
          <h2 id="fr-report-title" className="fr-head__title">
            {title}
            <InfoTip label={`How the ${title.toLowerCase()} is built`}>{info}</InfoTip>
          </h2>
          <p className="fr-head__sub">{sub}</p>
        </div>
        <div className="fr-head__actions fr-noprint">
          {csv && (
            <button type="button" className="tw-btn" onClick={() => downloadCsv(`truckwys-${csvName || slug(title)}.csv`, csv())}>
              <Download size={16} strokeWidth={1.75} aria-hidden="true" />
              Export CSV
            </button>
          )}
          <button type="button" className="tw-btn" onClick={() => window.print()}>
            <Printer size={16} strokeWidth={1.75} aria-hidden="true" />
            Print
          </button>
        </div>
      </header>
      {controls && <div className="fr-controls fr-noprint">{controls}</div>}
      {tiles}
      {gaps && gaps.length > 0 && (
        <ul className="fr-gaps">
          {gaps.map(g => <li key={g}>{g}</li>)}
        </ul>
      )}
      {children}
    </article>
  );
}

// ------------------------------------------------------------------- tiles

export interface Tile { label: string; value: string; title?: string; delta?: { text: string; tone?: 'up' | 'down' }; note?: string }

export function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <dl className={`fr-tiles fr-tiles--${Math.min(4, tiles.length)}`}>
      {tiles.map(t => (
        <div key={t.label} className="fr-tile">
          <dt className="tw-label">{t.label}</dt>
          <dd className="fr-tile__value" title={t.title}>{t.value}</dd>
          {t.delta && <dd className={`tw-delta${t.delta.tone === 'up' ? ' is-up' : t.delta.tone === 'down' ? ' is-down' : ''}`}>{t.delta.text}</dd>}
          {t.note && <dd className="fr-tile__note">{t.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** "+12,4% vs Oct 2024 to Sep 2025"; null when there is nothing to compare. */
export function changeText(now: number, before: number, label: string, higherIsGood = true): Tile['delta'] | undefined {
  if (Math.abs(before) < 0.005) return undefined;
  const c = ((now - before) / Math.abs(before)) * 100;
  const sign = c > 0 ? '+' : c < 0 ? '−' : '';
  const tone = Math.abs(c) < 0.05 ? undefined : (c > 0) === higherIsGood ? 'up' : 'down';
  return { text: `${sign}${pct(Math.abs(c))} vs ${label}`, tone };
}

// --------------------------------------------------------------- statement

export type ColType = 'text' | 'money' | 'int' | 'pct' | 'date' | 'km';
export interface Col { label: string; type?: ColType }
export type RowKind = 'section' | 'row' | 'subtotal' | 'total' | 'grand' | 'muted' | 'ratio';
export interface SRow { key: string; kind?: RowKind; cells: CsvCell[]; href?: string; indent?: boolean; /** Overrides the column type for number cells (e.g. a margin row). */ fmt?: ColType }
export interface Statement { columns: Col[]; rows: SRow[] }

function cell(v: CsvCell, type: ColType = 'text') {
  if (v === '') return '';
  if (v == null) return type === 'text' ? '' : '—';
  if (typeof v === 'string') return type === 'date' ? day(v) : v;
  switch (type) {
    case 'money': return Math.abs(v) < 0.005 ? '0,00' : money(v);
    case 'int': return int(v);
    case 'pct': return pct(v);
    case 'km': return `${int(v)} km`;
    default: return String(v);
  }
}

export function StatementTable({ table, caption, stickyFirst = true, footer, scrollEnd = false }: {
  table: Statement; caption: string; stickyFirst?: boolean; footer?: ReactNode;
  /** Open scrolled to the right, so the latest months and the totals are in view. */
  scrollEnd?: boolean;
}) {
  const { columns, rows } = table;
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (scrollEnd && el) el.scrollLeft = el.scrollWidth;
  }, [scrollEnd, columns.length]);
  return (
    <section className="tw-card tw-card--flush fr-statement" aria-label={caption}>
      <div ref={scroller} className="fr-scroll" tabIndex={0} role="region" aria-label={`${caption}, scrolls sideways`}>
        <table className={`fr-table${stickyFirst ? ' fr-table--sticky' : ''}`}>
          <caption className="fr-sr">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} scope="col" className={c.type && c.type !== 'text' && c.type !== 'date' ? 'is-num' : undefined}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              if (r.kind === 'section') {
                return (
                  <tr key={r.key} className="fr-row--section">
                    <th scope="colgroup">{r.cells[0]}</th>
                    {columns.length > 1 && <td colSpan={columns.length - 1} aria-hidden="true" />}
                  </tr>
                );
              }
              return (
                <tr key={r.key} className={`fr-row--${r.kind || 'row'}`}>
                  {r.cells.map((v, i) => {
                    const type = i > 0 && r.fmt ? r.fmt : columns[i]?.type;
                    const numeric = type && type !== 'text' && type !== 'date';
                    const isZero = typeof v === 'number' && Math.abs(v) < 0.005 && type === 'money';
                    const content = cell(v, type);
                    const cls = [numeric ? 'is-num' : '', isZero ? 'is-zero' : '', typeof v === 'number' && v < -0.004 && type === 'money' ? 'is-neg' : '', i === 0 && r.indent ? 'is-indent' : ''].filter(Boolean).join(' ') || undefined;
                    if (i === 0) {
                      return (
                        <th key={i} scope="row" className={cls}>
                          {r.href ? <Link to={r.href} className="fr-link">{content}</Link> : content}
                        </th>
                      );
                    }
                    return <td key={i} className={cls}>{content}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer && <div className="fr-statement__foot">{footer}</div>}
    </section>
  );
}

export const statementCsv = (title: string, basis: string, t: Statement): CsvCell[][] => [
  [title], [basis], [],
  t.columns.map(c => c.label),
  ...t.rows.map(r => r.kind === 'section' ? [r.cells[0]] : r.cells.map(v => (typeof v === 'number' ? Math.round(v * 100) / 100 : v))),
];

/** One reconciliation fact under a statement, e.g. "Ties to 14 payments". */
export function Check({ children, ok = true }: { children: ReactNode; ok?: boolean }) {
  return (
    <p className={`fr-check${ok ? '' : ' is-off'}`}>
      <Check16 ok={ok} />
      <span>{children}</span>
    </p>
  );
}
function Check16({ ok }: { ok: boolean }) {
  return ok ? <CheckIcon size={14} strokeWidth={2} aria-hidden="true" /> : <span aria-hidden="true" className="fr-check__dot" />;
}

// ------------------------------------------------------------------ states

export function ReportState({ loading, error, onRetry }: { loading: boolean; error: boolean; onRetry: () => void }) {
  if (loading) {
    return (
      <div className="fr-report" aria-busy="true" aria-label="Loading report">
        <div className="fr-skel fr-skel--head" />
        <div className="fr-tiles fr-tiles--4">{[0, 1, 2, 3].map(i => <div key={i} className="fr-tile fr-skel" />)}</div>
        <div className="fr-skel fr-skel--table" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="fr-state" role="alert">
        <p>Figures could not load.</p>
        <button type="button" className="tw-btn" onClick={onRetry}>Retry</button>
      </div>
    );
  }
  return null;
}

export function Empty({ line, action }: { line: string; action?: { label: string; to: string } }) {
  return (
    <div className="fr-state">
      <p>{line}</p>
      {action && <Link className="tw-btn" to={action.to}>{action.label}</Link>}
    </div>
  );
}

export function Partial({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return <p className="fr-partial" role="status">Partial figures: {notes.join(', ')}.</p>;
}

export function Info({ title, lines }: { title: string; lines: string[] }) {
  return (
    <>
      <span className="fr-info__title">{title}</span>
      {lines.map((l, i) => <Fragment key={i}><span className="fr-info__line">{l}</span></Fragment>)}
    </>
  );
}
