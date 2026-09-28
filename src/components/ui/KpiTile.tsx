import type { ReactNode } from 'react';

/**
 * v3 standard KPI tile (DESIGN-PRINCIPLES §11.6). Label, figure, one line.
 * 96px tall on every page (label 12/16, figure 28/34, note 12/16, 16px
 * padding). Tiles hold decisions, not attributes: dates, distances, weights
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

/** A row of 2 to 4 equal tiles. Three tiles never orphan on a phone. */
export function KpiRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['tw-kpi-row', className ?? ''].filter(Boolean).join(' ')}>{children}</div>;
}

export default KpiTile;
