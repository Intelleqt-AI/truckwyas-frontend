import './insight-card.css';
import { useId, type ReactNode } from 'react';

/* Card shell for every Insights panel: the question as the title (16/24/600),
   the basis in one description line directly beneath (13/20), both INSIDE the
   card, 16px above the body. 1px border, no shadow, 12px radius, 24px padding. */
export default function InsightCard({
  title,
  description,
  action,
  children,
  flush,
}: {
  title: string;
  description?: ReactNode;
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
          <h2 id={id} className="ic-card__title">{title}</h2>
          {description && <p className="ic-card__desc">{description}</p>}
        </div>
        {action && <div className="ic-card__action">{action}</div>}
      </header>
      <div className={flush ? 'ic-card__body ic-card__body--flush' : 'ic-card__body'}>{children}</div>
    </section>
  );
}
