import type { ReactNode } from 'react';
import { InfoTip } from '@/components/ui/InfoTip';
import { FitText } from '@/components/ui/FitText';
import { formatMoneyWhole } from '@/lib/formatters';

/**
 * One figure per card, the Today-page tile pattern (DESIGN-PRINCIPLES §5, §9):
 * short label (+ method behind an InfoTip), big figure, one short sub-line or
 * delta, optional single link action. Styles live in pages/finance-brand.css.
 */
export function FinTile({ label, info, value, valueTitle, sub, subTone, action, small }: {
  label: string;
  info?: ReactNode;
  value: ReactNode;
  /** Full-precision value (e.g. cents) shown on hover when the tile rounds. */
  valueTitle?: string;
  sub?: ReactNode;
  subTone?: 'danger' | 'muted';
  action?: { label: string; onClick: () => void };
  /** Text-sized figure for words or dates rather than amounts. */
  small?: boolean;
}) {
  return (
    <section className="fin-tile" aria-label={label}>
      <h2 className="fin-tile__label">
        {label}
        {info && <InfoTip>{info}</InfoTip>}
      </h2>
      <FitText as="div" className={`fin-tile__value${small ? ' fin-tile__value--sm' : ''}`} title={valueTitle}>{value}</FitText>
      <div className="fin-tile__foot">
        {sub != null && sub !== '' && (
          <span className={`fin-tile__sub${subTone === 'danger' ? ' fin-text-danger' : ''}`}>{sub}</span>
        )}
        {action && (
          <button type="button" className="fin-link fin-tile__action" onClick={action.onClick}>{action.label}</button>
        )}
      </div>
    </section>
  );
}

export function FinTiles({ children, label }: { children: ReactNode; label?: string }) {
  return <div className="fin-tiles" role="group" aria-label={label}>{children}</div>;
}

/** Whole rands for tiles; the exact figure goes in the title attribute. */
export const wholeRand = (v: number) => formatMoneyWhole(v);
