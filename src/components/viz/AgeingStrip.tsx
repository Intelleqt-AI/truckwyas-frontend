import { useRef } from 'react';
import { Tip, TipRow, VIZ, boxIn, plural, rand, useTip, useWidth } from './core';

/**
 * "Where is my cash stuck?" A single 100% strip from not-yet-due to the
 * oldest band, in an ordinal blue ramp (later = stronger), with each band's
 * amount and share labelled directly beneath. With `scaleTo` it becomes a
 * thin per-row bar whose total length encodes the row's amount against the
 * largest row, so a ranked list can show both size and age in one mark.
 */
export interface AgeBucket { key: string; label: string; amount: number; count?: number }

export function AgeingStrip({ buckets, ariaLabel, scaleTo, showLabels = true, countNoun = 'invoice' }: {
  buckets: AgeBucket[];
  ariaLabel: string;
  /** Row mode: draw the strip at amount / scaleTo of the full width, thin, no labels. */
  scaleTo?: number;
  showLabels?: boolean;
  countNoun?: string;
}) {
  const [ref, W] = useWidth<HTMLDivElement>(600);
  const figRef = useRef<HTMLDivElement>(null);
  const { tip, show, hide } = useTip();
  const total = buckets.reduce((s, b) => s + Math.max(0, b.amount), 0);
  const rowMode = scaleTo != null;
  const widthPct = rowMode ? (scaleTo! > 0 ? Math.min(100, (total / scaleTo!) * 100) : 0) : 100;
  const share = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const color = (i: number) => VIZ.ord[Math.min(VIZ.ord.length - 1, Math.round((i / Math.max(1, buckets.length - 1)) * (VIZ.ord.length - 1)))];
  // Text inside a segment picks white or ink by the fill's lightness.
  const inkFor = (i: number) => {
    const step = Math.round((i / Math.max(1, buckets.length - 1)) * 4);
    return step <= 1 ? 'var(--viz-ink-on-ord-low)' : 'var(--viz-ink-on-ord-high)';
  };

  const open = (i: number, el: Element) => {
    const b = buckets[i];
    const p = boxIn(figRef.current!, el);
    show(p.x, p.y, (
      <>
        <div className="viz-tip__title">{b.label}</div>
        <TipRow color={color(i)} value={rand(b.amount)} label={`${share(b.amount)}%`} />
        {b.count != null && <div className="viz-tip__note">{plural(b.count, countNoun)}</div>}
      </>
    ));
  };

  if (total <= 0) return null;
  const stripPx = (W * widthPct) / 100;
  return (
    <div className="viz" ref={figRef} onPointerLeave={hide}>
      <div ref={ref}>
        <div className={`viz-strip${rowMode ? ' viz-strip--thin' : ''}`} role="img" aria-label={ariaLabel} style={{ width: `${widthPct}%` }}>
          {buckets.map((b, i) => {
            if (b.amount <= 0) return null;
            const px = (b.amount / total) * stripPx;
            const text = `${share(b.amount)}%`;
            const fits = !rowMode && px >= text.length * 8 + 16;
            return (
              <span key={b.key} className="viz-strip__seg" tabIndex={rowMode ? -1 : 0}
                aria-label={`${b.label}: ${rand(b.amount)}, ${share(b.amount)}%`}
                style={{ flexGrow: b.amount, flexBasis: 0, background: color(i), color: inkFor(i) }}
                onPointerEnter={(e) => open(i, e.currentTarget)} onFocus={(e) => open(i, e.currentTarget)} onBlur={hide}>
                {fits ? text : ''}
              </span>
            );
          })}
        </div>
      </div>
      {!rowMode && showLabels && (
        <div className="viz-strip-labels">
          {buckets.map((b, i) => (
            <div key={b.key} className={`viz-strip-label${b.amount <= 0 ? ' is-zero' : ''}`}>
              <span className="viz-strip-label__name"><i className="viz-key viz-key--rect" style={{ background: color(i) }} aria-hidden="true" />{b.label}</span>
              <span className="viz-strip-label__value">{b.amount <= 0 ? 'None' : rand(b.amount, 0)}</span>
              {b.amount > 0 && <span className="viz-strip-label__meta">{share(b.amount)}%{b.count != null ? ` · ${plural(b.count, countNoun)}` : ''}</span>}
            </div>
          ))}
        </div>
      )}
      <Tip tip={tip} width={W} />
    </div>
  );
}
