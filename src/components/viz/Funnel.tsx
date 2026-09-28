import { useRef } from 'react';
import { Tip, TipRow, VIZ, boxIn, plural, useTip, useWidth } from './core';

/**
 * Process funnel (the "from detection to resolution" pattern). Each stage is
 * a bar whose length is its count against the first stage, with the count and
 * the rate from the previous stage right-aligned. Between stages, the number
 * that dropped out is named, with where they went when known. A stage with
 * nothing in it keeps its row, drawn as a hairline, so the drop is visible.
 */
/** dropNote: text after the count that left before this stage, e.g. "still drafts". Default "dropped out". */
export interface FunnelStage { key: string; label: string; count: number; sub?: string; dropNote?: string }

export function Funnel({ stages, noun = 'item', ariaLabel }: { stages: FunnelStage[]; noun?: string; ariaLabel: string }) {
  const [ref, W] = useWidth<HTMLOListElement>(600);
  const figRef = useRef<HTMLDivElement>(null);
  const { tip, show, hide } = useTip();
  const first = stages[0]?.count ?? 0;
  if (first <= 0) return null;

  const open = (i: number, el: Element) => {
    const s = stages[i];
    const b = boxIn(figRef.current!, el);
    const prev = i > 0 ? stages[i - 1].count : null;
    show(b.x, b.y, (
      <>
        <div className="viz-tip__title">{s.label}</div>
        <TipRow color={VIZ.accent} value={plural(s.count, noun)} label={`${Math.round((s.count / first) * 100)}% of all`} />
        {prev != null && prev > 0 && <div className="viz-tip__note">{Math.round((s.count / prev) * 100)}% of the {plural(prev, noun)} at the stage before</div>}
      </>
    ));
  };

  return (
    <div className="viz" ref={figRef} onPointerLeave={hide}>
      <ol className="viz-funnel" ref={ref} aria-label={ariaLabel}>
        {stages.map((s, i) => {
          const pct = (s.count / first) * 100;
          const prev = i > 0 ? stages[i - 1].count : null;
          const dropped = prev != null ? prev - s.count : 0;
          return (
            <li key={s.key}>
              {i > 0 && dropped > 0 && (
                <div className="viz-funnel__drop">{dropped} {s.dropNote ?? 'dropped out'}</div>
              )}
              <div className="viz-funnel__stage">
                <span className="viz-funnel__label">{s.label}{s.sub && <span className="viz-funnel__sub">{s.sub}</span>}</span>
                <span className="viz-funnel__track" tabIndex={0}
                  aria-label={`${s.label}: ${plural(s.count, noun)}${prev ? `, ${Math.round((s.count / prev) * 100)}% of the stage before` : ''}`}
                  onPointerEnter={(e) => open(i, e.currentTarget)} onFocus={(e) => open(i, e.currentTarget)} onBlur={hide}>
                  <span className={`viz-funnel__bar${s.count === 0 ? ' is-zero' : ''}`} style={{ width: s.count === 0 ? 0 : `${Math.max(pct, 0.5)}%` }} />
                </span>
                <span className="viz-funnel__value">
                  {s.count}
                  <span className="viz-funnel__rate">{i === 0 ? '100%' : prev && prev > 0 ? `${Math.round((s.count / prev) * 100)}% of previous` : ''}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <Tip tip={tip} width={W} />
    </div>
  );
}
