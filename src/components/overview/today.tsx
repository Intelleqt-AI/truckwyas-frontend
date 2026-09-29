import { useMemo, useRef, useState } from 'react';
import { Tip, TipRow, localPoint, niceTicks, rand, randCompact, useTip, useWidth } from '@/components/viz/core';
import '@/components/viz/viz.css';

/**
 * Home (Overview) presentation pieces. Every value comes from what the page
 * already fetched; nothing here requests or invents data.
 */

// ---------------------------------------------------------------- micro bars

/**
 * Inline bar sparkline for a KPI tile (the Vantage pattern). History in a
 * muted tone, the latest period in the accent. Missing values are gaps.
 */
export function MicroBars({ values, ariaLabel, width = 84, height = 28, tone = 'default' }: {
  values: (number | null)[];
  ariaLabel: string;
  width?: number;
  height?: number;
  tone?: 'default' | 'inverse';
}) {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (present.length < 2 || present.every((v) => v === 0)) return null;
  const max = Math.max(...present.map((v) => Math.abs(v)), 0) || 1;
  const n = values.length;
  const gap = n > 14 ? 1 : 2;
  const bw = Math.max(1.5, (width - gap * (n - 1)) / n);
  return (
    <svg className={`td-micro td-micro--${tone}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
      {values.map((v, i) => {
        const x = i * (bw + gap);
        if (v == null || !Number.isFinite(v)) return null;
        const h = Math.max(2, (Math.abs(v) / max) * (height - 2));
        return (
          <rect
            key={i}
            x={x}
            y={height - h}
            width={bw}
            height={h}
            rx={Math.min(1.5, bw / 2)}
            className={i === n - 1 ? 'is-current' : v < 0 ? 'is-negative' : ''}
          />
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------ revenue vs costs bars

export interface MonthPoint { label: string; full: string; revenue: number; costs: number }

/**
 * Monthly revenue against costs. Revenue is the accent (current month solid,
 * earlier months softened); costs are the neutral comparison, hatched.
 */
export function RevenueCostBars({ months }: { months: MonthPoint[] }) {
  const [ref, W] = useWidth<HTMLDivElement>(640);
  const svgRef = useRef<SVGSVGElement>(null);
  const { tip, show, hide } = useTip();
  const [hover, setHover] = useState<number | null>(null);

  const H = 264;
  const padL = 52;
  const padB = 28;
  const padT = 8;
  const plotW = Math.max(100, W - padL);
  const plotH = H - padB - padT;
  const maxV = Math.max(1, ...months.flatMap((m) => [m.revenue, m.costs]));
  const ticks = niceTicks(0, maxV, 4);
  const top = ticks[ticks.length - 1] || maxV;
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const band = plotW / Math.max(1, months.length);
  // Narrow data gets wider bars, not a narrower chart (§11.1).
  const bw = Math.max(6, Math.min(40, band * 0.28));
  const last = months.length - 1;

  const showAt = (i: number) => {
    const m = months[i];
    setHover(i);
    show(padL + band * i + band / 2, y(Math.max(m.revenue, m.costs)), (
      <>
        <div className="viz-tip__title">{m.full}</div>
        <TipRow color="var(--chart-series-1)" value={rand(m.revenue, 0)} label="revenue" />
        <TipRow color="var(--chart-hatch)" value={rand(m.costs, 0)} label="costs" />
        <TipRow keyShape="none" value={`${m.revenue - m.costs < 0 ? '−' : ''}${rand(Math.abs(m.revenue - m.costs), 0)}`} label={m.revenue - m.costs < 0 ? 'short' : 'left over'} />
      </>
    ));
  };

  const onMove = (e: React.PointerEvent) => {
    if (!svgRef.current) return;
    const p = localPoint(svgRef.current, e);
    const i = Math.floor((p.x - padL) / band);
    if (i >= 0 && i < months.length) showAt(i); else { hide(); setHover(null); }
  };

  return (
    <div ref={ref} className="td-chart" style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Revenue and costs per month, ${months[0]?.full || ''} to ${months[last]?.full || ''}`}
        onPointerMove={onMove}
        onPointerLeave={() => { hide(); setHover(null); }}
      >
        <defs>
          <pattern id="td-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" className="td-hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="5" className="td-hatch-line" strokeWidth="2" />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className={t === 0 ? 'td-axis' : 'td-grid'} />
            <text x={padL - 10} y={y(t)} dy="0.32em" textAnchor="end" className="td-tick">{randCompact(t)}</text>
          </g>
        ))}
        {months.map((m, i) => {
          const cx = padL + band * i + band / 2;
          const isCur = i === last;
          // Hover draws a column band; the other months keep full value (no dimming).
          return (
            <g key={m.full}>
              {hover === i && <rect x={padL + band * i + 2} y={padT} width={band - 4} height={plotH} rx={8} className="td-hover-band" />}
              <rect x={cx - bw - 2} y={y(m.revenue)} width={bw} height={Math.max(0, y(0) - y(m.revenue))} rx={4} className={`td-bar-rev${isCur ? ' is-current' : ''}`} />
              <rect x={cx + 2} y={y(m.costs)} width={bw} height={Math.max(0, y(0) - y(m.costs))} rx={4} fill="url(#td-hatch)" className="td-bar-cost" />
              <text x={cx} y={H - 8} textAnchor="middle" className={`td-tick${isCur ? ' is-current' : ''}`}>{m.label}</text>
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} width={W} />
      <table className="ov-sr-only">
        <caption>Revenue and costs per month</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Revenue</th><th scope="col">Costs</th></tr></thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.full}><th scope="row">{m.full}</th><td>{rand(m.revenue)}</td><td>{rand(m.costs)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------- quote pipeline

const SENT = ['SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'IT', 'COMPLETED'];
const WON = ['ACCEPTED', 'IT', 'COMPLETED'];
const MOVING = ['IT', 'COMPLETED'];

/** Quotes by how far they got, from the quotes the page already holds. */
export function usePipeline(quotes: any[]) {
  return useMemo(() => {
    const st = (q: any) => String(q.status || '').toUpperCase();
    const count = (set: string[]) => quotes.filter((q) => set.includes(st(q))).length;
    const stages = [
      { key: 'quoted', label: 'Quoted', count: quotes.length },
      { key: 'sent', label: 'Sent', count: count(SENT) },
      { key: 'won', label: 'Accepted', count: count(WON) },
      { key: 'moving', label: 'On the road', count: count(MOVING) },
      { key: 'done', label: 'Completed', count: count(['COMPLETED']) },
    ];
    const awaiting = quotes.filter((q) => st(q) === 'SENT').length;
    const drafts = quotes.length - count(SENT);
    const sent = count(SENT);
    const winRate = sent > 0 ? Math.round((count(WON) / sent) * 100) : null;
    return { stages, awaiting, drafts, winRate };
  }, [quotes]);
}

export function PipelineBars({ stages }: { stages: { key: string; label: string; count: number }[] }) {
  const max = Math.max(1, stages[0]?.count || 0);
  return (
    <ol className="td-pipe" aria-label="Quotes by how far they progressed">
      {stages.map((s) => {
        // Stage-to-stage percentages read oddly beside the counts ("3 accepted
        // 75%"); the one rate that matters is the win rate, shown below.
        return (
          <li key={s.key} className={`td-pipe__row${s.key === 'won' ? ' is-key' : ''}`}>
            <span className="td-pipe__label">{s.label}</span>
            <span className="td-pipe__track" aria-hidden="true">
              <span style={{ width: `${(s.count / max) * 100}%` }} />
            </span>
            <span className="td-pipe__count">{s.count}</span>
          </li>
        );
      })}
    </ol>
  );
}
