import './viz.css';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

/* Shared chart plumbing: measured width, nice ticks, compact money, the one
   tooltip, the legend and the table twin. Every chart in src/components/viz
   builds on these so they read as one system. */

// ---------------------------------------------------------------- formatting

/** Full rand amount, e.g. "R 12 345,67". Missing values are the placeholder. */
export const rand = (v: number | null | undefined, digits = 2) =>
  v == null || !Number.isFinite(v)
    ? '—'
    : new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);

/** Compact rand for axes and direct labels: "R 45k", "-R 1,2m", "R 850". */
export const randCompact = (v: number) => {
  const a = Math.abs(v);
  const sign = v < 0 ? '\u2212' : '';
  if (a >= 1_000_000) return `${sign}R ${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace('.', ',')}m`;
  if (a >= 1_000) return `${sign}R ${Math.round(a / 1_000)}k`;
  return `${sign}R ${Math.round(a)}`;
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ------------------------------------------------------------------- scales

/** Round tick values covering [min, max], always including 0 when in range. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) { if (max === 0) return [0, 1]; min = Math.min(0, min); max = Math.max(0, max); }
  const span = max - min;
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return out;
}

export const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

// ------------------------------------------------------------ measured width

/** Width of a container in CSS pixels, so SVG text is drawn at its true size. */
export function useWidth<T extends HTMLElement>(fallback = 640): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(Math.max(200, Math.floor(el.getBoundingClientRect().width)));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// ------------------------------------------------------------------ tooltip

export interface TipState { x: number; y: number; content: ReactNode }

/** One tooltip per chart, positioned inside the chart container and clamped to it. */
export function useTip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = useCallback((x: number, y: number, content: ReactNode) => setTip({ x, y, content }), []);
  const hide = useCallback(() => setTip(null), []);
  return { tip, show, hide };
}

export function Tip({ tip, width }: { tip: TipState | null; width: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 180, h: 60 });
  useLayoutEffect(() => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      if (Math.abs(r.width - box.w) > 1 || Math.abs(r.height - box.h) > 1) setBox({ w: r.width, h: r.height });
    }
  });
  if (!tip) return null;
  // Prefer right of the pointer; flip left near the edge; sit above the point.
  let left = tip.x + 14;
  if (left + box.w > width) left = tip.x - 14 - box.w;
  left = Math.max(0, Math.min(left, width - box.w));
  const top = Math.max(-8, tip.y - box.h - 10);
  return (
    <div ref={ref} className="viz-tip" role="status" aria-live="polite" style={{ left, top }}>
      {tip.content}
    </div>
  );
}

/** Tooltip row: short line key in the series colour, value first, label after. */
export function TipRow({ color, value, label, keyShape = 'line' }: { color?: string; value: ReactNode; label: ReactNode; keyShape?: 'line' | 'ring' | 'none' }) {
  return (
    <div className="viz-tip__row">
      {keyShape === 'line' && color && <i className="viz-key viz-key--line" style={{ background: color }} aria-hidden="true" />}
      {keyShape === 'ring' && <i className="viz-key viz-key--ring" aria-hidden="true" />}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

// ------------------------------------------------------------------- legend

export interface LegendItem { label: string; color?: string; shape: 'rect' | 'line' | 'dot' | 'ring' | 'wash' }

export function Legend({ items }: { items: LegendItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="viz-legend" aria-label="Legend">
      {items.map((it) => (
        <li key={it.label}>
          <i className={`viz-key viz-key--${it.shape}`} style={it.color ? { background: it.shape === 'ring' ? undefined : it.color, borderColor: it.shape === 'ring' ? it.color : undefined } : undefined} aria-hidden="true" />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

// -------------------------------------------------------------- table twin

export interface TableSpec {
  caption: string;
  columns: { label: string; numeric?: boolean }[];
  rows: { key: string; cells: ReactNode[] }[];
}

/** The accessible twin of a chart: a real table, one click away. */
export function TableTwin({ table, note }: { table: TableSpec; note?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <div className="viz-foot">
        {note ? <span className="viz-foot__note">{note}</span> : <span />}
        <button type="button" className="viz-table-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide table' : 'Show as table'}
        </button>
      </div>
      <div id={id} className="viz-table-wrap" hidden={!open}>
        <table className="viz-table">
          <caption>{table.caption}</caption>
          <thead>
            <tr>{table.columns.map((c) => <th key={c.label} scope="col" className={c.numeric ? 'num' : undefined}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.key}>
                {r.cells.map((c, i) =>
                  i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i} className={table.columns[i]?.numeric ? 'num' : undefined}>{c}</td>,
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Closes the tooltip when focus or the pointer leaves the chart. */
export function useOutside(ref: RefObject<HTMLElement>, onOut: () => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const leave = () => onOut();
    el.addEventListener('pointerleave', leave);
    return () => el.removeEventListener('pointerleave', leave);
  }, [ref, onOut]);
}

/** Pointer position relative to an element. */
export const localPoint = (el: Element, e: { clientX: number; clientY: number }) => {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

/** Position of an SVG element's box relative to a container, for keyboard focus tooltips. */
export const boxIn = (container: Element, el: Element) => {
  const a = container.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  return { x: b.left - a.left + b.width / 2, y: b.top - a.top };
};

export const VIZ = {
  accent: 'var(--viz-accent)',
  warm: 'var(--viz-warm)',
  neutral: 'var(--viz-neutral)',
  neutralStrong: 'var(--viz-neutral-strong)',
  ord: ['var(--viz-ord-1)', 'var(--viz-ord-2)', 'var(--viz-ord-3)', 'var(--viz-ord-4)', 'var(--viz-ord-5)'],
};
