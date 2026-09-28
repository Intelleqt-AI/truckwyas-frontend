import { useRef } from 'react';
import { Tip, TipRow, localPoint, useTip, useWidth, VIZ } from './core';

/**
 * Sparkline for a KPI tile. The history is drawn in the de-emphasis grey and
 * the latest period in the accent, so the eye lands on "now". Missing values
 * are gaps, never zeros. A crosshair snaps to the nearest period on hover and
 * keyboard focus, and the first and last period are named under the line.
 */
export interface SparklineProps {
  values: (number | null)[];
  /** One label per value, e.g. month names or dates. */
  labels: string[];
  /** Formats a value for the tooltip. */
  format: (v: number) => string;
  /** Accessible summary of the whole trend. */
  ariaLabel: string;
  variant?: 'line' | 'bars';
  height?: number;
  /** Minimum present points before a line is drawn (default 3). */
  minPoints?: number;
}

export function Sparkline({ values, labels, format, ariaLabel, variant = 'line', height = 40, minPoints = 3 }: SparklineProps) {
  const [ref, W] = useWidth<HTMLDivElement>(240);
  const svgRef = useRef<SVGSVGElement>(null);
  const { tip, show, hide } = useTip();
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (present.length < minPoints || present.every((v) => v === 0)) return null;

  const H = height;
  const padY = 5;
  const max = Math.max(...present, 0);
  const min = Math.min(...present, 0);
  const span = max - min || 1;
  const y = (v: number) => padY + (1 - (v - min) / span) * (H - padY * 2);
  const n = values.length;
  const last = n - 1;
  const inset = variant === 'line' ? 5 : 0;
  const x = (i: number) => (n === 1 ? W / 2 : inset + (i / (n - 1)) * (W - inset * 2));
  const step = W / n;

  const nearest = (px: number) => {
    if (variant === 'bars') return Math.max(0, Math.min(last, Math.floor(px / step)));
    return Math.max(0, Math.min(last, Math.round(((px - inset) / (W - inset * 2)) * (n - 1))));
  };
  const cx = (i: number) => (variant === 'bars' ? i * step + step / 2 : x(i));
  const showAt = (i: number) => {
    const v = values[i];
    show(cx(i), v == null ? H / 2 : variant === 'bars' ? y(Math.max(v, 0)) : y(v), (
      <>
        <div className="viz-tip__title">{labels[i]}</div>
        <TipRow keyShape="none" value={v == null ? 'No data' : format(v)} label={i === last ? 'latest' : ''} />
      </>
    ));
  };
  const hoverIdx = tip ? nearest(tip.x) : null;

  let body;
  if (variant === 'bars') {
    const bw = Math.max(2, Math.min(8, step * 0.62));
    const base = y(Math.max(min, 0));
    body = values.map((v, i) => {
      if (v == null) return null;
      const top = v === 0 ? base - 1 : y(v);
      return (
        <rect key={i} x={i * step + (step - bw) / 2} y={Math.min(top, base)} width={bw} height={Math.max(1, Math.abs(base - top))} rx={Math.min(2, bw / 2)}
          fill={i === last ? VIZ.accent : VIZ.neutral} opacity={hoverIdx != null && hoverIdx !== i ? 0.6 : 1} />
      );
    });
  } else {
    const runs: string[][] = [];
    let cur: string[] = [];
    values.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) { if (cur.length) runs.push(cur); cur = []; }
      else cur.push(`${x(i)},${y(v)}`);
    });
    if (cur.length) runs.push(cur);
    const lv = values[last];
    const pv = values[last - 1];
    body = (
      <>
        {runs.map((pts, i) => pts.length > 1
          ? <polyline key={i} points={pts.join(' ')} fill="none" stroke={VIZ.neutral} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          : <circle key={i} cx={pts[0].split(',')[0]} cy={pts[0].split(',')[1]} r={2} fill={VIZ.neutral} />)}
        {lv != null && pv != null && (
          <line x1={x(last - 1)} y1={y(pv)} x2={x(last)} y2={y(lv)} stroke={VIZ.accent} strokeWidth={2} strokeLinecap="round" />
        )}
        {lv != null && <circle cx={x(last)} cy={y(lv)} r={4} fill={VIZ.accent} stroke="var(--viz-surface)" strokeWidth={2} />}
      </>
    );
  }

  return (
    <div className="viz viz-spark" ref={ref} onPointerLeave={hide}>
      <svg ref={svgRef} width={W} height={H} role="img" aria-label={ariaLabel}
        tabIndex={0}
        onFocus={() => showAt(last)} onBlur={hide}
        onKeyDown={(e) => {
          if (!tip) return;
          const i = nearest(tip.x);
          if (e.key === 'ArrowLeft') { e.preventDefault(); showAt(Math.max(0, i - 1)); }
          if (e.key === 'ArrowRight') { e.preventDefault(); showAt(Math.min(last, i + 1)); }
          if (e.key === 'Escape') hide();
        }}
        onPointerMove={(e) => showAt(nearest(localPoint(svgRef.current!, e).x))}
        style={{ outline: 'none' }}>
        {min < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="viz-baseline" />}
        {body}
        {hoverIdx != null && variant === 'line' && <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={0} y2={H} className="viz-cross" />}
        {hoverIdx != null && variant === 'line' && values[hoverIdx] != null && hoverIdx !== last && (
          <circle cx={x(hoverIdx)} cy={y(values[hoverIdx] as number)} r={3.5} fill={VIZ.neutralStrong} stroke="var(--viz-surface)" strokeWidth={2} />
        )}
      </svg>
      <div className="viz-spark__axis" aria-hidden="true">
        <span>{labels[0]}</span>
        <span>{labels[last]}</span>
      </div>
      <Tip tip={tip} width={W} />
    </div>
  );
}
