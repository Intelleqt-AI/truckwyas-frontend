import './insight-card.css';
import { useId, type ReactNode } from 'react';
import InfoTip from './InfoTip';

/* Card shell for every Insights panel: a 2 to 6 word title (16/24/600), an
   optional one-line subtitle of at most 8 words (13/20), and the method behind
   an info icon. 1px border, no shadow, 12px radius, 24px padding. */
export default function InsightCard({
  title,
  description,
  info,
  action,
  children,
  flush,
}: {
  title: string;
  description?: ReactNode;
  /** Methodology, shown behind an info icon next to the title. */
  info?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** Remove body padding (e.g. edge-to-edge charts). */
  flush?: boolean;
}) {
  const id = useId();
  return (
    <section className="ic-card" aria-labelledby={id}>
      <header className="ic-card__head">
        <div className="ic-card__heading">
          <h2 id={id} className="ic-card__title">
            {title}
            {info && <> <InfoTip label={`How "${title}" is calculated`}><p className="it__title">How this is calculated</p>{typeof info === 'string' ? <p>{info}</p> : info}</InfoTip></>}
          </h2>
          {description && <p className="ic-card__desc">{description}</p>}
        </div>
        {action && <div className="ic-card__action">{action}</div>}
      </header>
      <div className={flush ? 'ic-card__body ic-card__body--flush' : 'ic-card__body'}>{children}</div>
    </section>
  );
}
