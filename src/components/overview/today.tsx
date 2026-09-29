import { useMemo, useRef, useState } from 'react';
import { Tip, TipRow, localPoint, niceTicks, rand, randCompact, useTip, useWidth } from '@/components/viz/core';
import '@/components/viz/viz.css';
import { staleWork } from '@/lib/staleWork';

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

  const H = 300; // R5: the card ends level with Needs you (5 rows) beside it
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

/**
 * True once a quote's valid-until day is over (compared as local calendar
 * days, so a quote valid until 20 Jul is still live all of 20 Jul).
 */
export function quoteLapsed(q: any, now: Date = new Date()): boolean {
  const v = String(q?.valid_until || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return v < today;
}

/**
 * The one stage rule for a quote, shared by the Quotes board, the Quotes list,
 * Home's pipeline and Customer detail (R8). Accepted also holds the legacy
 * IT/COMPLETED statuses; a Sent quote marked lost sits in Declined. A Draft or
 * Sent quote past its valid-until date is Expired: it is not live work, so it
 * is not counted under Draft or Sent anywhere.
 */
export type BoardStage = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
export function boardStage(q: any, now?: Date): BoardStage | null {
  const st = String(q?.status || '').toUpperCase();
  if (st === 'SENT' && q?.outcome === 'rejected') return 'DECLINED';
  if (st === 'DRAFT' || st === 'SENT') return quoteLapsed(q, now) ? 'EXPIRED' : st;
  if (st === 'ACCEPTED' || st === 'IT' || st === 'COMPLETED') return 'ACCEPTED';
  if (st === 'DECLINED') return 'DECLINED';
  if (st === 'EXPIRED') return 'EXPIRED';
  return null;
}

/**
 * Quotes by their board column, plus orders on the road. Counts are the
 * board's (Draft, Sent, Accepted, Declined, Expired); "On the road" is the
 * Orders tab's In transit count (loads with status IN_TRANSIT), not a quote
 * status. Expired quotes are listed last and never counted as live.
 */
export function usePipeline(quotes: any[], loads: any[] = []) {
  return useMemo(() => {
    const by = { DRAFT: 0, SENT: 0, ACCEPTED: 0, DECLINED: 0, EXPIRED: 0 };
    let expiredSent = 0;
    let draftsAll = 0;
    for (const q of quotes) {
      const s = boardStage(q);
      if (s) by[s] += 1;
      const st = String(q?.status || '').toUpperCase();
      if (st === 'DRAFT') draftsAll += 1;
      if (s === 'EXPIRED' && st === 'SENT') expiredSent += 1;
    }
    // R7: "On the road" is current work only. In-transit loads past their
    // delivery date (or open > 30 days, src/lib/staleWork.ts) are "not closed",
    // counted separately so the card can say so instead of calling them active.
    const inTransit = loads.filter((l) => String(l?.status || '').toUpperCase() === 'IN_TRANSIT');
    const staleInTransit = inTransit.filter((l) => staleWork(l)).length;
    const onTheRoad = inTransit.length - staleInTransit;
    const stages = [
      { key: 'draft', label: 'Draft', count: by.DRAFT },
      { key: 'sent', label: 'Sent', count: by.SENT },
      { key: 'won', label: 'Accepted', count: by.ACCEPTED },
      // Stale in-transit loads are said under this row, never counted in it.
      { key: 'moving', label: 'On the road', count: onTheRoad, note: staleInTransit > 0 ? `${staleInTransit} past ${staleInTransit === 1 ? 'its' : 'their'} delivery date, not closed` : undefined },
      { key: 'lost', label: 'Declined', count: by.DECLINED },
      ...(by.EXPIRED > 0 ? [{ key: 'expired', label: 'Expired', count: by.EXPIRED }] : []),
    ];
    // Every quote that went out: still waiting, accepted, declined, or sent
    // and left to lapse.
    const sentEver = by.SENT + by.ACCEPTED + by.DECLINED + expiredSent;
    const winRate = sentEver > 0 ? Math.round((by.ACCEPTED / sentEver) * 100) : null;
    return { stages, awaiting: by.SENT, drafts: by.DRAFT, draftsAll, expired: by.EXPIRED, accepted: by.ACCEPTED, sentEver, winRate, staleInTransit };
  }, [quotes, loads]);
}

export function PipelineBars({ stages }: { stages: { key: string; label: string; count: number; note?: string }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <ol className="td-pipe" aria-label="Quotes by board column, and orders on the road">
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
            {s.note && <span className="td-pipe__note">{s.note}</span>}
          </li>
        );
      })}
    </ol>
  );
}
