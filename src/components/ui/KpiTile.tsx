import { Children, type CSSProperties, type ReactNode } from 'react';

/**
 * v3 standard KPI tile (DESIGN-PRINCIPLES §11.6). Label, figure, one line.
 * --kpi-height on every page (label 12/16, figure 28/34, note 12/16, inside
 * the one card padding --card-pad: 106px desktop, 98px phone). Tiles hold decisions, not attributes: dates, distances, weights
 * and limits go in a definition list instead. Never show a dash or "No data"
 * in a tile; leave the tile out.
 *
 *   <KpiRow>
 *     <KpiTile label="Owed to you" figure="R 542 140" note="12 invoices" />
 *     <KpiTile label="Overdue" figure="R 88 200" note={<span className="is-down">3 late</span>} tone="danger" />
 *   </KpiRow>
 *
 * Styles: `.tw-kpi` / `.tw-kpi-row` in src/styles/theme.css. One tile per
 * page may be `emphasis` (the figure that needs action).
 */
export interface KpiTileProps {
  label: ReactNode;
  figure: ReactNode;
  /** The one supporting line: a delta, a count or a short context note. */
  note?: ReactNode;
  /** Colours the note only (the figure stays primary). */
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  /** The page's single emphasis tile. */
  emphasis?: boolean;
  /** Optional right-aligned slot in the label row (an InfoTip, a menu). */
  aside?: ReactNode;
  /** Makes the whole tile a link or button. */
  onClick?: () => void;
  href?: string;
  className?: string;
  'aria-label'?: string;
}

export function KpiTile({ label, figure, note, tone = 'neutral', emphasis, aside, onClick, href, className, ...rest }: KpiTileProps) {
  const cls = ['tw-kpi', emphasis ? 'tw-kpi--emphasis' : '', onClick || href ? 'tw-kpi--link' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const body = (
    <>
      <span className="tw-kpi__head">
        <span className="tw-kpi__label">{label}</span>
        {aside}
      </span>
      <span className="tw-kpi__figure">{figure}</span>
      {note !== undefined && note !== null && note !== '' && (
        <span className={`tw-kpi__note tw-kpi__note--${tone}`}>{note}</span>
      )}
    </>
  );
  if (href) return <a className={cls} href={href} aria-label={rest['aria-label']}>{body}</a>;
  if (onClick) return <button type="button" className={cls} onClick={onClick} aria-label={rest['aria-label']}>{body}</button>;
  return <div className={cls} aria-label={rest['aria-label']}>{body}</div>;
}

/**
 * A row of 3 or 4 tiles that FILLS the content width (R3: no per-tile cap),
 * so its right edge matches the table or card below. Columns follow the tile
 * count. On phones: 2 columns, an odd last tile spans the row with the same
 * anatomy. For 1-2 figures use <KpiStats> instead (never a half-empty row).
 */
export function KpiRow({ children, className }: { children: ReactNode; className?: string }) {
  const count = Children.toArray(children).length;
  const style = count > 0 ? ({ '--kpi-cols': Math.min(count, 4) } as CSSProperties) : undefined;
  return <div className={['tw-kpi-row', className ?? ''].filter(Boolean).join(' ')} style={style}>{children}</div>;
}

export interface KpiStat {
  label: ReactNode;
  figure: ReactNode;
  note?: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  /** Optional right slot in the label row (an InfoTip). */
  aside?: ReactNode;
}

/**
 * Compact stats line inside a card (R3), for pages with only 1-3 summary
 * figures, or for figures that belong above a table: label over a 20px
 * figure over an optional note, separated by hairlines, in one card with the
 * shared padding. Optional `title` and `actions` sit on the card's head row.
 * On phones the stats wrap two per row.
 *
 *   <KpiStats
 *     aria-label="Debtors summary"
 *     items={[
 *       { label: 'Owed to you', figure: 'R 542 140', note: '12 invoices' },
 *       { label: 'Over 60 days', figure: 'R 88 200', tone: 'danger', note: '3 late' },
 *     ]}
 *   />
 *
 * Pass `bare` to render the line without its own card (inside an existing card).
 */
export function KpiStats({
  items, title, actions, bare, className, ...rest
}: {
  items: KpiStat[];
  title?: ReactNode;
  actions?: ReactNode;
  bare?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const shown = items.filter((i) => i.figure !== undefined && i.figure !== null && i.figure !== '');
  const cls = ['tw-kpi-stats', bare ? 'tw-kpi-stats--bare' : 'tw-card', className ?? ''].filter(Boolean).join(' ');
  return (
    <section className={cls} aria-label={rest['aria-label']}>
      {(title || actions) && (
        <div className="tw-kpi-stats__head">
          {title ? <h2 className="tw-card__title">{title}</h2> : <span />}
          {actions ? <div className="tw-kpi-stats__actions">{actions}</div> : null}
        </div>
      )}
      <dl className="tw-kpi-stats__list">
        {shown.map((it, i) => (
          <div className="tw-kpi-stats__item" key={i}>
            <dt className="tw-kpi-stats__label">{it.label}{it.aside}</dt>
            <dd className="tw-kpi-stats__figure">{it.figure}</dd>
            {it.note !== undefined && it.note !== null && it.note !== '' && (
              <dd className={`tw-kpi-stats__note tw-kpi__note--${it.tone ?? 'neutral'}`}>{it.note}</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

export default KpiTile;
