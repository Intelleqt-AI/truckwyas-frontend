import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check as CheckIcon, ChevronRight, Download, Printer } from 'lucide-react';
import { InfoTip } from '@/components/ui/InfoTip';
import { Segmented } from '@/components/ui/Segmented';
import { KpiRow, KpiTile } from '@/components/ui/KpiTile';
import LoadError from '@/components/data/LoadError';
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
  // The product-standard segmented control (neutral active chip, one track).
  // On a phone the track scrolls sideways; keep the chosen option in view.
  const wrap = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const track = wrap.current?.querySelector<HTMLElement>('.tw-seg');
    const active = track?.querySelector<HTMLElement>('.is-active');
    if (!track || !active || track.scrollWidth <= track.clientWidth) return;
    const left = active.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
    if (left < track.scrollLeft || left + active.offsetWidth > track.scrollLeft + track.clientWidth) {
      track.scrollLeft = Math.max(0, left - (track.clientWidth - active.offsetWidth) / 2);
    }
  }, [value]);
  return (
    <div ref={wrap} className="fr-seg-wrap">
      <Segmented<T> label={label} value={value} className="fr-seg" options={options.map(o => ({ value: o.id, label: o.label }))} onChange={onChange} />
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
  // One heading level under the Finance header: "Reports › Title", with the
  // basis on the same line and the controls, Export and Print on the right.
  return (
    <article className="fr-report" aria-labelledby="fr-report-title">
      <div className="fr-print-head">
        <span>{companyName || 'TruckWys'}</span>
        <span>{printTitle || title} · {sub}</span>
        <span>Printed {day(new Date().toISOString())}</span>
      </div>
      <header className="fr-head">
        <div className="fr-head__titles">
          <h2 id="fr-report-title" className="fr-head__title">
            <Link className="fr-crumb fr-noprint" to={`/finance/reports${qs ? `?${qs}` : ''}`}>Reports</Link>
            <ChevronRight className="fr-crumb__sep fr-noprint" size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className="fr-head__name">{title}</span>
            <InfoTip label={`How the ${title.toLowerCase()} is built`}>{info}</InfoTip>
          </h2>
          <p className="fr-head__sub">{sub}</p>
        </div>
        <div className="fr-head__actions fr-noprint">
          {controls}
          {csv && (
            <button type="button" className="tw-btn fr-head__btn" onClick={() => downloadCsv(`truckwys-${csvName || slug(title)}.csv`, csv())}>
              <Download size={16} strokeWidth={1.75} aria-hidden="true" />
              Export CSV
            </button>
          )}
          <button type="button" className="tw-btn fr-head__btn" onClick={() => window.print()}>
            <Printer size={16} strokeWidth={1.75} aria-hidden="true" />
            Print
          </button>
        </div>
      </header>
      {tiles}
      {children}
      {/* What TruckWys does not capture: a note under the figures, beside the
          reconciliation lines, so the data starts right under the head. */}
      {gaps && gaps.length > 0 && (
        <ul className="fr-gaps">
          {gaps.map(g => <li key={g}>{g}</li>)}
        </ul>
      )}
    </article>
  );
}

// ------------------------------------------------------------------- tiles

export interface Tile {
  label: string; value: string; title?: string; delta?: { text: string; tone?: 'up' | 'down' }; note?: string;
  /** The money figure the tile shows, so a figure already in the table is not repeated. */
  amount?: number;
  /** The money figure inside the note, if any (same rule). */
  noteAmount?: number;
  /** Shown instead of the note when the note's figure is already on the page. */
  noteFallback?: string;
}

const whole = (v: number) => Math.round(v);

/** Every money figure a statement shows, in whole rands. */
export function tableFigures(tables?: Statement | Statement[]): Set<number> {
  const out = new Set<number>();
  const list = !tables ? [] : Array.isArray(tables) ? tables : [tables];
  list.forEach(t => t.rows.forEach(r => {
    if (r.kind === 'section') return;
    r.cells.forEach((v, i) => {
      const type = i > 0 && r.fmt ? r.fmt : t.columns[i]?.type;
      if (type === 'money' && typeof v === 'number' && Math.abs(v) >= 0.5) out.add(whole(Math.abs(v)));
    });
  }));
  return out;
}

/** Tiles only carry figures the table below does not: a tile whose figure is
 *  already in the table (or in an earlier tile) is left out, and a note that
 *  repeats one is dropped. Nothing renders when no tile is left. */
export function Tiles({ tiles, table }: { tiles: Tile[]; table?: Statement | Statement[] }) {
  const seen = tableFigures(table);
  const kept = tiles.flatMap(t => {
    // No zero tiles, and no figure the table (or an earlier tile) already shows.
    if (t.amount != null && (Math.abs(t.amount) < 0.5 || seen.has(whole(Math.abs(t.amount))))) return [];
    if (t.amount != null) seen.add(whole(Math.abs(t.amount)));
    const noteRepeats = t.noteAmount != null && seen.has(whole(Math.abs(t.noteAmount)));
    if (t.noteAmount != null && !noteRepeats) seen.add(whole(Math.abs(t.noteAmount)));
    return [noteRepeats ? { ...t, note: t.noteFallback } : t];
  });
  if (!kept.length) return null;
  return (
    <KpiRow className={`fr-tiles fr-tiles--${Math.min(4, kept.length)}`}>
      {kept.map(t => (
        <KpiTile
          key={t.label}
          label={t.label}
          figure={<span title={t.title}>{t.value}</span>}
          note={t.delta ? t.delta.text : t.note}
          tone={t.delta?.tone === 'down' ? 'danger' : t.delta?.tone === 'up' ? 'success' : 'neutral'}
        />
      ))}
    </KpiRow>
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
  // Only ISO dates are formatted; a label such as "Total" in a date column stays as written.
  if (typeof v === 'string') return type === 'date' && /^\d{4}-\d{2}-\d{2}/.test(v) ? day(v) : v;
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
    if (!scrollEnd || !el) return;
    const table = el.querySelector('table');
    table?.style.removeProperty('--fr-tail');
    el.scrollLeft = el.scrollWidth;
    // Opening at the right edge can leave the first visible month cut in half
    // behind the sticky label column ("…45,60"). Add just enough trailing space
    // after the last column that the cut column scrolls fully out of view, so
    // every figure on screen is whole. Display only: no values change.
    const heads = Array.from(el.querySelectorAll<HTMLTableCellElement>('thead th'));
    if (!table || heads.length < 2 || el.scrollWidth <= el.clientWidth) return;
    const left = el.scrollLeft + (stickyFirst ? heads[0].offsetWidth : 0);
    const cut = heads.slice(1).find(th => th.offsetLeft < left - 1 && th.offsetLeft + th.offsetWidth > left + 1);
    if (!cut) return;
    const tail = Math.ceil(cut.offsetLeft + cut.offsetWidth - left);
    table.style.setProperty('--fr-tail', `${tail}px`);
    el.scrollLeft = el.scrollWidth;
  }, [scrollEnd, stickyFirst, columns.length, rows.length]);
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
                        <th key={i} scope="row" className={cls} title={!numeric && typeof content === 'string' ? content : undefined}>
                          {r.href ? <Link to={r.href} className="fr-link">{content}</Link> : content}
                        </th>
                      );
                    }
                    return <td key={i} className={cls} title={!numeric && typeof content === 'string' && content.length > 24 ? content : undefined}>{content}</td>;
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
        <div className="fr-skel fr-skel--table" />
      </div>
    );
  }
  if (error) {
    return <LoadError what="this report" onRetry={onRetry} />;
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
