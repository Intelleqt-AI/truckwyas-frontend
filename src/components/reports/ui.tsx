import { Fragment, createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check as CheckIcon, ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import { InfoTip } from '@/components/ui/InfoTip';
import { Segmented } from '@/components/ui/Segmented';
import { KpiRow, KpiStats, KpiTile } from '@/components/ui/KpiTile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LoadError from '@/components/data/LoadError';
import { formatCompact, formatDistance } from '@/lib/formatters';
import {
  PERIODS, day, downloadCsv, int, money, moneyBare, pct, resolvePeriod, slug,
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
      {/* Wide screens: the segmented control. Phones: the same choice as a
          menu, so no option is ever cut off at the screen edge. */}
      <span className="fr-period__seg">
        <Seg label="Period" value={period.id} options={list.map(p => ({ id: p.id, label: p.label }))} onChange={id => onChange(id as PeriodId)} />
      </span>
      <span className="fr-period__menu">
        <Choice label="Period" value={period.id} options={list.map(p => ({ id: p.id, label: p.label }))} onChange={id => onChange(id as PeriodId)} />
      </span>
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

/** A compact menu for a report's second setting (basis, view, as-at date,
 *  customer). One segmented control per head: the period (or the view when
 *  there is no period) is the seg; everything else is one of these. An empty
 *  id is allowed and means "the default". */
const NONE = '__default';
export function Choice<T extends string>({ label, prefix, value, options, onChange, wide }: {
  label: string; prefix?: string; value: T; options: { id: T; label: string }[]; onChange: (id: T) => void; wide?: boolean;
}) {
  const current = options.find(o => o.id === value) ?? options[0];
  return (
    <Select value={(value as string) || NONE} onValueChange={v => onChange((v === NONE ? '' : v) as T)}>
      <SelectTrigger aria-label={label} className={`fr-choice${wide ? ' fr-choice--wide' : ''}`} style={{ width: 'auto', padding: '0 10px 0 12px', fontSize: 13 }}>
        <SelectValue>
          {prefix && <span className="fr-choice__pre">{prefix}</span>}
          <span className="fr-choice__val">{current?.label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {options.map(o => <SelectItem key={o.id || NONE} value={(o.id as string) || NONE}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
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

/** Phones: Export CSV and Print live in the page head's "⋯" menu, not in a
 *  row of their own. The report registers its export here; the page (which
 *  owns the head) reads it when the menu item is chosen. */
export const ReportExportContext = createContext<{ current: (() => void) | null } | null>(null);

export function ReportFrame({ title, sub, info, controls, tiles, gaps, csv, csvName, children, companyName, printTitle }: ReportFrameProps) {
  const exportRef = useContext(ReportExportContext);
  const exportCsv = csv ? () => downloadCsv(`truckwys-${csvName || slug(title)}.csv`, csv()) : null;
  useEffect(() => {
    if (!exportRef) return;
    exportRef.current = exportCsv;
    return () => { exportRef.current = null; };
  });
  // The page head (SectionHeader) carries the report title as the one H1 and
  // a back link to the library. This row holds the basis line with its info
  // tip on the left, and the controls, Export and Print on the right; data
  // starts directly below.
  return (
    <article className="fr-report" aria-label={title}>
      <div className="fr-print-head">
        <span>{companyName || 'TruckWys'}</span>
        <span>{printTitle || title} · {sub}</span>
        <span>Printed {day(new Date().toISOString())}</span>
      </div>
      {/* The toolbar is the first content block: settings on the left,
          Export and Print on the right, one row at desktop widths. The basis
          line under it says what the figures are. */}
      <div className="fr-top">
        <div className="tw-toolbar fr-head fr-noprint" role="toolbar" aria-label={`${title} settings`}>
          {controls}
          <div className="tw-toolbar__end fr-head__actions">
            {csv && (
              <button type="button" className="tw-btn fr-head__btn" onClick={() => exportCsv?.()}>
                <Download size={16} strokeWidth={1.75} aria-hidden="true" />
                Export CSV
              </button>
            )}
            <button type="button" className="tw-btn fr-head__btn" onClick={() => window.print()}>
              <Printer size={16} strokeWidth={1.75} aria-hidden="true" />
              Print
            </button>
          </div>
        </div>
        <p className="fr-head__sub">
          {/* The last word and the info tip never part across lines. */}
          {sub.slice(0, sub.lastIndexOf(' ') + 1)}
          <span className="fr-head__tail">
            {sub.slice(sub.lastIndexOf(' ') + 1)}
            <InfoTip label={`How the ${title.toLowerCase()} is built`}>{info}</InfoTip>
          </span>
        </p>
      </div>
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

/** Library link that keeps the period (and other shared settings) but drops
 *  the report-specific ones. */
export function useLibraryHref() {
  const [params] = useSearchParams();
  const back = new URLSearchParams(params);
  ['report', 'customer', 'view', 'basis', 'asat', 'since'].forEach(k => back.delete(k));
  const qs = back.toString();
  return `/finance/reports${qs ? `?${qs}` : ''}`;
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
  const tone = (t: Tile) => (t.delta?.tone === 'down' ? 'danger' : t.delta?.tone === 'up' ? 'success' : 'neutral') as 'danger' | 'success' | 'neutral';
  // One or two figures: a stats line inside one card, never a half-empty row.
  if (kept.length <= 2) {
    return (
      <KpiStats
        className="fr-stats"
        aria-label="Summary"
        items={kept.map(t => ({ label: t.label, figure: <span title={t.title}>{t.value}</span>, note: t.delta ? t.delta.text : t.note, tone: tone(t) }))}
      />
    );
  }
  return (
    <KpiRow className={`fr-tiles fr-tiles--${Math.min(4, kept.length)}`}>
      {kept.map(t => (
        <KpiTile
          key={t.label}
          label={t.label}
          figure={<span title={t.title}>{t.value}</span>}
          note={t.delta ? t.delta.text : t.note}
          tone={tone(t)}
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
export interface Col { label: string; type?: ColType; /** false: left out on phones (a secondary column). */ phone?: boolean }
export type RowKind = 'section' | 'row' | 'subtotal' | 'total' | 'grand' | 'muted' | 'ratio';
export interface SRow { key: string; kind?: RowKind; cells: CsvCell[]; href?: string; indent?: boolean; /** Overrides the column type for number cells (e.g. a margin row). */ fmt?: ColType }
export interface Statement { columns: Col[]; rows: SRow[] }

/** Display density of a fitted statement: 0 full ("R 38 550,00"), 1 tighter
 *  cells, 2 no currency sign (the table says "in rand"), 3 whole rands at
 *  12px. The table steps up only as far as it needs to fit its card.
 *  4 is phones only (compactPhone month statements): "R 12,3k" figures in
 *  equal month columns that snap whole, the exact amount in the title. */
type Density = 0 | 1 | 2 | 3 | 4;

function cell(v: CsvCell, type: ColType = 'text', density: Density = 0) {
  if (v === '') return '';
  if (v == null) return type === 'text' ? '' : '—';
  // Only ISO dates are formatted; a label such as "Total" in a date column stays as written.
  if (typeof v === 'string') return type === 'date' && /^\d{4}-\d{2}-\d{2}/.test(v) ? day(v) : v;
  switch (type) {
    case 'money': {
      const x = Math.abs(v) < 0.005 ? 0 : v;
      if (density >= 4) return x === 0 ? '0' : formatCompact(x);
      return density >= 2 ? moneyBare(x, density >= 3) : money(x);
    }
    case 'int': return int(v);
    case 'pct': return pct(v);
    case 'km': return formatDistance(v);
    default: return String(v);
  }
}

/** Phones (up to 640px): how a statement becomes a stacked list instead of
 *  a table that scrolls sideways. 'pairs': each row is a heading and one
 *  label/value line per column. A ledger spec: one line per entry (date and
 *  what it is, the amount on the right), the reference and running balance
 *  under it; totals rows keep the balance in full view. */
export type Stack = 'pairs' | {
  date: number; title: number; ref?: number;
  /** Column added to the balance (shown as is) and taken off it (shown with a minus). */
  plus: number; minus: number;
  balance: number; balanceLabel: string;
};

function StackList({ table, stack, caption }: { table: Statement; stack: Stack; caption: string }) {
  const { columns, rows } = table;
  const shown = (v: CsvCell, i: number) => cell(v, columns[i]?.type);
  // Pairs leave out empty and zero cells (an age bucket with nothing in it).
  const has = (v: CsvCell) => v !== '' && v != null && !(typeof v === 'number' && Math.abs(v) < 0.005);
  if (stack === 'pairs') {
    return (
      <div className="fr-stack fr-noprint" aria-label={caption} role="group">
        {rows.filter(r => r.kind !== 'section').map(r => (
          <dl key={r.key} className={`fr-stack__pairs fr-stack--${r.kind || 'row'}`}>
            <div className="fr-stack__pairs-head"><dt>{shown(r.cells[0], 0)}</dt></div>
            {r.cells.slice(1).map((v, j) => {
              const i = j + 1;
              if (!has(v)) return null;
              return <div key={i} className={i === r.cells.length - 1 ? 'is-last' : undefined}><dt>{columns[i]?.label}</dt><dd>{shown(v, i)}</dd></div>;
            })}
          </dl>
        ))}
      </div>
    );
  }
  const amt = (v: CsvCell) => (typeof v === 'number' && Math.abs(v) >= 0.005 ? v : null);
  return (
    <ul className="fr-stack fr-noprint" aria-label={caption}>
      {rows.filter(r => r.kind !== 'section').map(r => {
        const plus = amt(r.cells[stack.plus]);
        const minus = amt(r.cells[stack.minus]);
        const bal = r.cells[stack.balance];
        const title = shown(r.cells[stack.title], stack.title) || shown(r.cells[0], 0);
        if (r.kind === 'grand' || r.kind === 'subtotal') {
          // A totals row is named by its first text cell that is not a date ("Total", "Closing balance").
          const isName = (v: CsvCell) => typeof v === 'string' && v !== '' && !/^\d{4}-\d{2}-\d{2}/.test(v);
          const name = [r.cells[0], r.cells[stack.title]].find(isName) ?? title;
          const parts = [plus != null ? `${columns[stack.plus]?.label} ${money(plus)}` : '', minus != null ? `${columns[stack.minus]?.label} ${money(minus)}` : ''].filter(Boolean);
          return (
            <li key={r.key} className={`fr-stack__row fr-stack--${r.kind}`}>
              <span className="fr-stack__title">{name}</span>
              <span className="fr-stack__amt">{shown(bal, stack.balance)}</span>
              {parts.length > 0 && <span className="fr-stack__ref">{parts.join(' · ')}</span>}
            </li>
          );
        }
        const ref = stack.ref != null ? shown(r.cells[stack.ref], stack.ref) : '';
        return (
          <li key={r.key} className="fr-stack__row">
            <span className="fr-stack__title">{title}</span>
            <span className="fr-stack__amt">{plus != null ? money(plus) : minus != null ? `−${money(minus)}` : ''}</span>
            <span className="fr-stack__sub">{shown(r.cells[stack.date], stack.date)}</span>
            <span className="fr-stack__sub fr-stack__bal">{stack.balanceLabel} {shown(bal, stack.balance)}</span>
            {ref && <span className="fr-stack__ref">{r.href ? <Link to={r.href} className="fr-link">{ref}</Link> : ref}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function StatementTable({ table, caption, stickyFirst = true, footer, fit = false, pinLast = false, compactPhone = false, cue = ['Earlier months', 'Later months'] as [string, string] | null, stack }: {
  table: Statement; caption: string; stickyFirst?: boolean; footer?: ReactNode;
  /** Phones (fit month statements): compact figures ("R 12,3k", exact in the
   *  title) in equal columns sized so a whole number of months (at least 3
   *  on a 390 phone) sits between the pinned label and Total, and the
   *  sideways scroll snaps month by month: no figure is ever cut mid-number. */
  compactPhone?: boolean;
  /** Phones: show the statement as a stacked list instead of a sideways-scrolling table. */
  stack?: Stack;
  /** Month statements: tighten cells (then drop the currency sign, then the
   *  cents) only as far as needed to show every column without scrolling.
   *  Display only: the CSV and the check lines keep cents. */
  fit?: boolean;
  /** Keep the last column (Total) in view on the right while the rest scroll. */
  pinLast?: boolean;
  /** Labels for the scroll buttons when the table still has to scroll; null
   *  for the generic "Previous columns" / "More columns". A table that scrolls
   *  always shows the cue: no column is ever off-screen without one. */
  cue?: [string, string] | null;
}) {
  const { columns, rows } = table;
  const scroller = useRef<HTMLDivElement>(null);
  const sig = `${columns.map(c => c.label).join('|')}#${rows.length}`;
  const [dense, setDense] = useState<{ sig: string; w: number; level: Density }>({ sig, w: -1, level: 0 });
  const [edges, setEdges] = useState({ l: false, r: false });
  const [, bump] = useState(0);

  const readEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const l = el.scrollLeft > 1;
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges(e => (e.l === l && e.r === r ? e : { l, r }));
    // Fades sit inside the pinned columns, not over them.
    const heads = el.querySelectorAll<HTMLTableCellElement>('thead th');
    const box = el.parentElement;
    if (box && heads.length) {
      box.style.setProperty('--fr-pin-l', `${stickyFirst ? heads[0].offsetWidth : 0}px`);
      box.style.setProperty('--fr-pin-r', `${pinLast ? heads[heads.length - 1].offsetWidth : 0}px`);
    }
  }, [stickyFirst, pinLast]);

  // Compact phone statements: equal month columns, a whole number of them
  // between the pinned label and Total. The spare pixels go to the label
  // column, so every snap position shows whole months only.
  const sizeColumns = useCallback(() => {
    const el = scroller.current;
    const t = el?.querySelector('table');
    if (!el || !t) return;
    const set = (k: string, v: string | null) => {
      if (t.style.getPropertyValue(k) === (v ?? '')) return;
      if (v == null) t.style.removeProperty(k); else t.style.setProperty(k, v);
    };
    const clear = () => { set('--fr-col-w', null); set('--fr-lab-w', null); };
    if (!t.classList.contains('fr-table--d4')) { clear(); return; }
    const heads = [...t.querySelectorAll<HTMLTableCellElement>('thead th')];
    const count = heads.length - 1 - (pinLast ? 1 : 0);
    if (count < 1) { clear(); return; }
    // Natural width of the widest month figure (content plus padding),
    // measured from the text so the set widths do not feed back into it.
    const rg = document.createRange();
    let natural = 0;
    for (const tr of t.querySelectorAll<HTMLTableRowElement>('tr:not(.fr-row--section)')) {
      const cells = [...tr.children].slice(1, pinLast ? -1 : undefined);
      for (const c of cells) {
        rg.selectNodeContents(c);
        const cs = getComputedStyle(c);
        natural = Math.max(natural, Math.ceil(rg.getBoundingClientRect().width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)));
      }
    }
    // Three months at least: the label column (96px) gives up width, to
    // 80px where labels wrap to a third line, before a month is lost.
    const lab = 96, minLab = 80;
    const tot = pinLast ? heads[heads.length - 1].offsetWidth : 0;
    const room = el.clientWidth - tot;
    let n = Math.max(1, Math.floor((room - lab) / natural));
    if (n < 3 && Math.floor((room - minLab) / natural) >= 3) n = 3;
    if (n >= count) { clear(); return; }
    const avail = room - lab >= n * natural ? room - lab : room - minLab;
    const cw = Math.floor(avail / n);
    set('--fr-col-w', `${cw}px`);
    set('--fr-lab-w', `${room - n * cw}px`);
  }, [pinLast]);

  // Fit: before paint, step the density up until the table fits (or the
  // tightest step is reached). A new table or a new width starts again at 0.
  // The table always opens at the start of the range (scrollLeft 0).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (fit) {
      const w = el.clientWidth;
      const phone = compactPhone && stickyFirst && typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
      if (dense.sig !== sig || dense.w !== w) { setDense({ sig, w, level: phone ? 4 : 0 }); return; }
      if (phone !== (dense.level === 4)) { setDense({ sig, w, level: phone ? 4 : 0 }); return; }
      if (!phone && el.scrollWidth > w + 1 && dense.level < 3) { setDense({ sig, w, level: (dense.level + 1) as Density }); return; }
    }
    sizeColumns();
    readEdges();
  });
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = 0;
  }, [sig]);
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => { if (el.clientWidth !== w) { w = el.clientWidth; bump(n => n + 1); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const level: Density = fit && dense.sig === sig ? dense.level : 0;
  const scrolls = edges.l || edges.r;
  const cueText: [string, string] = cue ?? ['Previous columns', 'More columns'];
  const page = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    const pinned = (stickyFirst ? parseFloat(el.parentElement?.style.getPropertyValue('--fr-pin-l') || '0') : 0)
      + (pinLast ? parseFloat(el.parentElement?.style.getPropertyValue('--fr-pin-r') || '0') : 0);
    // Compact columns snap, so a page is exactly the months in view.
    el.scrollBy({ left: dir * Math.max(80, (el.clientWidth - pinned) * (level === 4 ? 1 : 0.8)), behavior: 'smooth' });
  };
  const tableCls = ['fr-table', stickyFirst ? 'fr-table--sticky' : '', pinLast ? 'fr-table--pin-last' : '', level ? `fr-table--d${level}` : ''].filter(Boolean).join(' ');
  const units = level >= 4 ? 'Amounts in rand, rounded to the nearest R 100 (R 12,3k is R 12 300). Export CSV in the ⋯ menu has the exact amounts.' : level >= 3 ? 'Amounts in rand, rounded to the nearest rand. Export CSV has the cents.' : level >= 2 ? 'Amounts in rand.' : null;

  return (
    <section className={`tw-card tw-card--flush fr-statement${scrolls ? ' is-scrolling' : ''}${stack ? ' has-stack' : ''}`} aria-label={caption}>
      {scrolls && (
        <div className="fr-cue fr-noprint">
          <button type="button" className="fr-cue__btn" onClick={() => page(-1)} disabled={!edges.l} aria-label={`Show ${cueText[0].toLowerCase()}`}>
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />{cueText[0]}
          </button>
          <button type="button" className="fr-cue__btn" onClick={() => page(1)} disabled={!edges.r} aria-label={`Show ${cueText[1].toLowerCase()}`}>
            {cueText[1]}<ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
      {stack && <StackList table={table} stack={stack} caption={caption} />}
      <div className={`fr-scrollbox${edges.l ? ' has-l' : ''}${edges.r ? ' has-r' : ''}`}>
        <div ref={scroller} className="fr-scroll" tabIndex={0} role="region" aria-label={`${caption}, scrolls sideways`} onScroll={readEdges}>
          <table className={tableCls}>
            <caption className="fr-sr">{caption}</caption>
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th key={i} scope="col" className={[c.type && c.type !== 'text' && c.type !== 'date' ? 'is-num' : '', c.phone === false ? 'fr-col--wide' : ''].filter(Boolean).join(' ') || undefined}>{level === 4 && /^\S+ \d{4}$/.test(c.label) ? <>{c.label.split(' ')[0]}<br />{c.label.split(' ')[1]}</> : c.label}</th>
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
                      const content = cell(v, type, level);
                      const exact = level >= 2 && type === 'money' && typeof v === 'number' ? money(Math.abs(v) < 0.005 ? 0 : v) : undefined;
                      const cls = [numeric ? 'is-num' : '', isZero ? 'is-zero' : '', typeof v === 'number' && v < -0.004 && type === 'money' ? 'is-neg' : '', i === 0 && r.indent ? 'is-indent' : '', columns[i]?.phone === false ? 'fr-col--wide' : ''].filter(Boolean).join(' ') || undefined;
                      if (i === 0) {
                        return (
                          <th key={i} scope="row" className={cls} title={!numeric && typeof content === 'string' ? content : undefined}>
                            {r.href ? <Link to={r.href} className="fr-link">{content}</Link> : content}
                          </th>
                        );
                      }
                      return <td key={i} className={cls} title={exact ?? (!numeric && typeof content === 'string' && content.length > 24 ? content : undefined)}>{content}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {(footer || units) && (
        <div className="fr-statement__foot">
          {units && <p className="fr-units">{units}</p>}
          {footer}
        </div>
      )}
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
