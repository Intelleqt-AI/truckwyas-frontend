import { useRef } from 'react';
import { Tip, TipRow, VIZ, boxIn, plural, rand, useTip, useWidth } from './core';

/**
 * "Where is my cash stuck?" A single 100% strip from not-yet-due to the
 * oldest band, on the lateness ramp (neutral greys that darken with age, and
 * the accent only for the oldest band; viz.css), with each band's amount and share
 * labelled directly beneath. The strip carries no text of its own: the labels
 * beneath hold every figure, so nothing sits on a coloured fill. With `scaleTo` it becomes a
 * thin per-row bar whose total length encodes the row's amount against the
 * largest row, so a ranked list can show both size and age in one mark.
 */
export interface AgeBucket { key: string; label: string; amount: number; count?: number }

export function AgeingStrip({ buckets, ariaLabel, scaleTo, showLabels = true, hideEmptyLabels = false, countNoun = 'invoice' }: {
  buckets: AgeBucket[];
  ariaLabel: string;
  /** Row mode: draw the strip at amount / scaleTo of the full width, thin, no labels. */
  scaleTo?: number;
  showLabels?: boolean;
  /** Label only the bands that hold money, so empty bands do not take the legend's width. */
  hideEmptyLabels?: boolean;
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
  return (
    <div className="viz" ref={figRef} onPointerLeave={hide}>
      <div ref={ref}>
        <div className={`viz-strip${rowMode ? ' viz-strip--thin' : ''}`} role="img" aria-label={ariaLabel} style={{ width: `${widthPct}%` }}>
          {buckets.map((b, i) => {
            if (b.amount <= 0) return null;
            // Pointer only: the strip is one labelled image and the labels beneath carry every value.
            return (
              <span key={b.key} className="viz-strip__seg" aria-hidden="true"
                style={{ flexGrow: b.amount, flexBasis: 0, background: color(i) }}
                onPointerEnter={(e) => open(i, e.currentTarget)} />
            );
          })}
        </div>
      </div>
      {!rowMode && showLabels && (
        <div className="viz-strip-labels">
          {buckets.map((b, i) => (hideEmptyLabels && b.amount <= 0 ? null : (
            <div key={b.key} className={`viz-strip-label${b.amount <= 0 ? ' is-zero' : ''}`}>
              <span className="viz-strip-label__name"><i className="viz-key viz-key--rect" style={{ background: color(i) }} aria-hidden="true" />{b.label}</span>
              <span className="viz-strip-label__value">{b.amount <= 0 ? 'None' : rand(b.amount, 0)}</span>
              {b.amount > 0 && <span className="viz-strip-label__meta">{share(b.amount)}%{b.count != null ? ` · ${plural(b.count, countNoun)}` : ''}</span>}
            </div>
          )))}
        </div>
      )}
      <Tip tip={tip} width={W} />
    </div>
  );
}
