import { useMemo } from 'react';
import { ActivityStrip, AgeingStrip, Funnel, type ActivityRow, type FunnelStage } from '@/components/viz';
import { plural, rand } from '@/components/viz/core';

/**
 * Overview adapters: derive chart series from the lists the Overview already
 * fetched (no new requests) and hand them to the shared viz primitives.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMs = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayLabel = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

// ------------------------------------------------------------- fleet activity

/**
 * "Is the fleet working?" Days in the last 28 on which each truck had a load
 * between pickup and delivery. Only loads with a truck assigned count.
 */
export function FleetActivity({ loads, loadsTotal, vehicles, activeVehicles, totalVehicles }: {
  loads: any[];
  loadsTotal?: number;
  vehicles: any[];
  activeVehicles: number;
  totalVehicles: number;
}) {
  const model = useMemo(() => {
    const today = startOfDay(new Date());
    const N = 28;
    const first = new Date(today.getTime() - (N - 1) * dayMs);
    const labels = Array.from({ length: N }, (_, i) => dayLabel(new Date(first.getTime() + i * dayMs)));
    const plate = new Map<string, string>(vehicles.map((v: any) => [String(v.id), v.plate || v.registration || `Truck ${v.id}`]));
    const rows = new Map<string, ActivityRow>();
    let assigned = 0;
    let latest: { date: Date; plate: string } | null = null;
    for (const l of loads) {
      if (l.vehicle == null || String(l.status).toUpperCase() === 'CANCELLED') continue;
      const startRaw = l.pickup_date || l.created_at;
      if (!startRaw) continue;
      assigned += 1;
      const s = startOfDay(new Date(startRaw));
      const endRaw = l.actual_delivered_at || l.delivery_date || startRaw;
      const e = startOfDay(new Date(endRaw));
      const id = String(l.vehicle);
      const name = plate.get(id) || l.vehicle_info || `Truck ${id}`;
      const lastDay = e.getTime() > today.getTime() ? today : e;
      if (!latest || lastDay > latest.date) latest = { date: lastDay, plate: name };
      const row = rows.get(id) || { id, label: name, days: new Array(N).fill(0) };
      for (let t = Math.max(s.getTime(), first.getTime()); t <= Math.min(e.getTime(), today.getTime()); t += dayMs) {
        const d = Math.round((t - first.getTime()) / dayMs);
        if (d >= 0 && d < N) row.days[d] += 1;
      }
      rows.set(id, row);
    }
    const all = [...rows.values()];
    const worked = all.filter((r) => r.days.some((v) => v > 0)).sort((a, b) => b.days.filter((v) => v > 0).length - a.days.filter((v) => v > 0).length);
    // The load list is one page; if its oldest load is inside the window, loads may be missing.
    const oldest = loads.reduce<number | null>((m, l) => {
      const t = new Date(l.created_at || l.pickup_date || 0).getTime();
      return t && (m == null || t < m) ? t : m;
    }, null);
    const partial = loadsTotal != null && loadsTotal > loads.length && oldest != null && oldest > first.getTime();
    return { labels, worked, assigned, latest, partial };
  }, [loads, loadsTotal, vehicles]);

  const idleCount = Math.max(0, totalVehicles - model.worked.length);
  return (
    <>
      {model.worked.length > 0 ? (
        <>
          <ActivityStrip rows={model.worked} dayLabels={model.labels} maxRows={8} />
          <p className="ov-viz-note">
            {plural(model.worked.length, 'truck')} had a load on the road in the last 28 days{idleCount > 0 ? `; ${idleCount} had none` : ''}.
            {model.partial ? ' Only the most recent loads are loaded here, so earlier days may be undercounted.' : ''}
          </p>
        </>
      ) : (
        <div className="ov-viz-empty">
          <p>
            <strong>No truck had a load on the road in the last 28 days.</strong>{' '}
            {model.latest
              ? `The most recent assigned load ended on ${dayLabel(model.latest.date)} ${model.latest.date.getFullYear()} (${model.latest.plate}).`
              : model.assigned === 0 ? 'None of your recent loads has a truck assigned yet, so activity per truck cannot be shown.' : ''}
          </p>
          {totalVehicles > 0 && (
            <>
              <div className="ov-meter" aria-hidden="true">
                <span style={{ width: `${Math.min((activeVehicles / totalVehicles) * 100, 100)}%` }} />
              </div>
              <p className="ov-viz-note">{activeVehicles} of {totalVehicles} vehicles are marked available or in use in your fleet list.</p>
            </>
          )}
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------------- quote conversion

const SENT = ['SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'IT', 'COMPLETED'];
const WON = ['ACCEPTED', 'IT', 'COMPLETED'];
// Load statuses once a booked job is moving / done. Legacy IT/COMPLETED
// quotes (from before quotes converted into loads) count the same way.
const LOAD_MOVING = ['IN_TRANSIT', 'DELIVERED', 'INVOICED'];
const LOAD_DONE = ['DELIVERED', 'INVOICED'];
type FunnelQuote = { status?: string; converted?: boolean; booked_load?: { status?: string } | null };

/** "How do quotes convert?" Quote stages, then the booked load's progress. */
export function QuoteConversion({ quotes }: { quotes: any[] }) {
  const stages = useMemo<FunnelStage[]>(() => {
    const st = (q: any) => String(q.status || '').toUpperCase();
    const loadSt = (q: FunnelQuote) => String(q.booked_load?.status || '').toUpperCase();
    // Same "Booked" rule as the Quotes board: a load exists (or a legacy status).
    const isBooked = (q: FunnelQuote) => !!q.booked_load || !!q.converted || st(q) === 'IT' || st(q) === 'COMPLETED';
    const isMoving = (q: FunnelQuote) => LOAD_MOVING.includes(loadSt(q)) || st(q) === 'IT' || st(q) === 'COMPLETED';
    const isDone = (q: FunnelQuote) => LOAD_DONE.includes(loadSt(q)) || st(q) === 'COMPLETED';
    const count = (set: string[]) => quotes.filter((q) => set.includes(st(q)) || isBooked(q)).length;
    const where = (fn: (q: FunnelQuote) => boolean) => quotes.filter(fn).length;
    const by = (s: string) => quotes.filter((q) => st(q) === s).length;
    const notWon = [
      by('SENT') ? `${by('SENT')} awaiting a reply` : null,
      by('DECLINED') ? `${by('DECLINED')} declined` : null,
      by('EXPIRED') ? `${by('EXPIRED')} expired` : null,
    ].filter(Boolean).join(', ');
    return [
      { key: 'quoted', label: 'Quoted', count: quotes.length },
      { key: 'sent', label: 'Sent', count: count(SENT), dropNote: 'still drafts' },
      { key: 'won', label: 'Accepted', count: count(WON), dropNote: `not accepted${notWon ? ` (${notWon})` : ''}` },
      { key: 'booked', label: 'Booked', count: where(isBooked), dropNote: 'accepted, not yet booked' },
      { key: 'moving', label: 'On the road', sub: 'In transit or delivered', count: where(isMoving), dropNote: 'booked, not yet on the road' },
      { key: 'done', label: 'Delivered', count: where(isDone), dropNote: 'still in transit' },
    ];
  }, [quotes]);
  return <Funnel stages={stages} noun="quote" ariaLabel="Quotes by how far they progressed" />;
}

// ------------------------------------------------------------------ owed strip

/** Thin two-part strip for the "Owed to you" tile: not yet due against past due. */
export function OwedStrip({ outstanding, overdue }: { outstanding: number; overdue: number }) {
  if (!(outstanding > 0)) return null;
  const past = Math.min(Math.max(overdue, 0), outstanding);
  return (
    <div className="ov-owed-strip">
      <AgeingStrip
        scaleTo={outstanding}
        ariaLabel={`Of ${rand(outstanding)} owed, ${Math.round((past / outstanding) * 100)}% is past its due date`}
        buckets={[
          { key: 'due', label: 'Not yet due', amount: outstanding - past },
          { key: 'late', label: 'Past due', amount: past },
        ]}
      />
      <div className="ov-owed-strip__axis" aria-hidden="true">
        <span>{past < outstanding ? `Not yet due ${Math.round(((outstanding - past) / outstanding) * 100)}%` : ''}</span>
        <span>{past > 0 ? `Past due ${Math.round((past / outstanding) * 100)}%` : ''}</span>
      </div>
    </div>
  );
}
