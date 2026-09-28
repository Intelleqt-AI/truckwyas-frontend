import { useQuery } from '@tanstack/react-query';
import { formatMoneyWhole } from '@/lib/formatters';
import { fetchAllPages } from '@/components/insights/findings';
import { BlockSkeleton } from '@/components/fleet-detail/ContentSkeleton';
import SectionHeader from '@/components/layout/SectionHeader';
import './fleet-vehicles-brand.css';
import { InfoTip } from '@/components/ui/InfoTip';
import LoadError, { loadFailed } from '@/components/data/LoadError';

// 7-day heatmap — Mon → Sun
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getUtilColor(value: number) {
  if (value === 0) return 'var(--heat-empty)';
  if (value < 30) return 'var(--heat-low)';
  if (value < 60) return 'var(--heat-medium)';
  if (value < 80) return 'var(--heat-high)';
  return 'var(--heat-max)';
}

// Pickup counts by weekday and hour, from the loads' own pickup dates.
function countPickups(loads: any[]) {
  const grid: number[][] = DAYS.map(() => HOURS.map(() => 0));
  for (const load of loads) {
    if (!load.pickup_date) continue;
    const d = new Date(load.pickup_date);
    const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0
    const hour = d.getHours();
    grid[dayIdx][Math.min(hour, 23)]++;
  }
  return grid;
}

// Same counts normalised to 0-100 of the busiest slot, for the colour scale.
function generateHeatmap(loads: any[], vehicleCount: number) {
  const grid: number[][] = DAYS.map(() => HOURS.map(() => 0));
  if (vehicleCount === 0) return grid;

  // Seed from load delivery dates
  const now = new Date();
  const day0 = new Date(now); day0.setDate(now.getDate() - now.getDay() + 1); // this Monday
  day0.setHours(0, 0, 0, 0);

  for (const load of loads) {
    if (!load.pickup_date) continue;
    const d = new Date(load.pickup_date);
    const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0
    const hour = d.getHours();
    grid[dayIdx][Math.min(hour, 23)]++;
  }

  // Normalize to 0-100
  const maxVal = Math.max(...grid.flat(), 1);
  return grid.map(row => row.map(v => Math.round((v / maxVal) * 100)));
}

// Ranked row: the bar encodes the load count the list is sorted by, scaled
// to the busiest route; the share of all loads sits next to the count.
const RouteBar = ({ route, count, revenue, maxCount, total }: any) => (
  <div className="fleet-route">
    <div className="fleet-route__row">
      <span className="fleet-route__name">{route}</span>
      <div className="fleet-route__figures">
        <span>{count} {count === 1 ? 'load' : 'loads'}, {total ? Math.round((count / total) * 100) : 0}%</span>
        <span className="fleet-route__money">{formatMoneyWhole(revenue)}</span>
      </div>
    </div>
    <div className="fleet-route__track" aria-hidden="true">
      <div className="fleet-route__fill" style={{ width: `${Math.min(100, (count / Math.max(maxCount, 1)) * 100)}%` }} />
    </div>
  </div>
);


// ---- data hygiene: never present an artefact as a pattern

/** Local calendar date of an ISO timestamp, from its own date part (no tz shift). */
const isoDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);

/** A pickup "has a time" only if it is not stored as a bare date: exact
 *  midnight UTC or local (date-only values saved as timestamps) does not count. */
function hasRealTime(iso?: string | null) {
  if (!iso || iso.length <= 10) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const utcMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  const localMidnight = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
  return !utcMidnight && !localMidnight;
}

const PLACE_ALIAS: Record<string, string> = {
  JHB: 'Johannesburg', JOBURG: 'Johannesburg', JNB: 'Johannesburg', CPT: 'Cape Town', DBN: 'Durban', DUR: 'Durban',
  PTA: 'Pretoria', PE: 'Port Elizabeth', PLZ: 'Port Elizabeth', BFN: 'Bloemfontein', EL: 'East London', PLK: 'Polokwane',
};
const NOT_A_PLACE = new Set(['', 'TBD', 'TBA', 'TBC', '?', 'N/A', 'NA', 'UNKNOWN', 'NONE', '-']);

/** "  jhb " -> "Johannesburg", "cape  town" -> "Cape Town"; null when not a real place. */
function place(raw?: string | null): string | null {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim();
  const up = t.toUpperCase();
  if (NOT_A_PLACE.has(up)) return null;
  if (PLACE_ALIAS[up]) return PLACE_ALIAS[up];
  return t.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());
}

export default function FleetHeatmap() {
  // Every load (the API returns 20 a page), so the view is not a sample.
  const loadsQuery = useQuery({
    queryKey: ['loads-heatmap-all'],
    queryFn: () => fetchAllPages<any>('api/v1/loads/'),
  });
  const { data: loadsData } = loadsQuery;
  // A failed load list must not draw as an empty (all quiet) heatmap.
  const loadsFailed = loadFailed(loadsQuery);
  const isLoading = loadsQuery.isLoading && !loadsFailed;

  const loads: any[] = loadsData?.rows ?? [];
  const withPickup = loads.filter(l => l.pickup_date);
  const timed = withPickup.filter(l => hasRealTime(l.pickup_date));
  // Times are only shown when most pickups carry a real time of day.
  const timesCaptured = withPickup.length > 0 && timed.length >= 10 && timed.length / withPickup.length >= 0.5;

  const heatmap = generateHeatmap(timed, 1);
  const pickupCounts = countPickups(timed);
  const byWeekday = DAYS.map(() => 0);
  for (const l of withPickup) {
    const d = isoDay(l.pickup_date);
    if (!Number.isNaN(d.getTime())) byWeekday[d.getDay() === 0 ? 6 : d.getDay() - 1]++;
  }
  const maxDay = Math.max(1, ...byWeekday);
  const sampleNote = loadsData && !loadsData.complete
    ? `Based on the first ${loads.length} of ${loadsData.count} loads.`
    : `Based on ${loads.length} ${loads.length === 1 ? 'load' : 'loads'}.`;

  // Route frequency, on cleaned place names; loads without a real route are left out.
  const routeMap: Record<string, { count: number; revenue: number }> = {};
  let unrouted = 0;
  for (const load of loads) {
    const from = place(load.pickup_city || load.pickup_location);
    const to = place(load.delivery_city || load.delivery_location);
    if (!from || !to) { unrouted++; continue; }
    const key = `${from} → ${to}`;
    if (!routeMap[key]) routeMap[key] = { count: 0, revenue: 0 };
    routeMap[key].count++;
    routeMap[key].revenue += parseFloat(load.total_amount || '0');
  }
  const routed = loads.length - unrouted;
  const topRoutes = Object.entries(routeMap)
    .sort((a, b) => b[1].count - a[1].count || b[1].revenue - a[1].revenue)
    .slice(0, 8);
  const maxRouteCount = topRoutes[0]?.[1].count ?? 0;

  return (
    <div className="fleet-page">
      <SectionHeader
        title="Activity heatmap"
        description="When pickups happen and the busiest routes"
        back={{ to: '/fleet/vehicles', label: 'Fleet' }}
      />

      {loadsFailed ? (
        <LoadError
          what="fleet activity"
          error={loadsQuery.error ?? loadsQuery.failureReason}
          busy={loadsQuery.isFetching}
          onRetry={() => loadsQuery.refetch()}
        />
      ) : isLoading ? (
        <BlockSkeleton height={320} label="Loading activity" />
      ) : (
      <div className={`fleet-heatmap-grid${timesCaptured ? '' : ' fleet-heatmap-grid--2'}`}>
        {timesCaptured ? (
          <section className="card fleet-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <h2 className="fleet-panel__title" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Pickup times
                  <InfoTip>Pickups by weekday and hour, shaded against the busiest slot. Pickups saved without a time are left out.</InfoTip>
                </h2>
                <p className="fleet-muted" style={{ margin: '4px 0 0' }}>
                  {timed.length} of {withPickup.length} pickups have a time
                </p>
              </div>
              <div className="fleet-muted" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span>Low</span>
                {[0, 25, 50, 75, 100].map(v => <div key={v} style={{ width: 12, height: 12, background: getUtilColor(v), borderRadius: 2, border: '1px solid var(--border-subtle)' }} aria-hidden="true" />)}
                <span>High</span>
              </div>
            </div>
            <div className="fleet-heatmap">
              <div className="fleet-heatmap__row">
                <div />
                {HOURS.map(h => (
                  <div key={h} className="fleet-heatmap__hour" style={{ visibility: h % 3 === 0 ? 'visible' : 'hidden' }}>{h}h</div>
                ))}
              </div>
              {DAYS.map((day, di) => (
                <div key={day} className="fleet-heatmap__row">
                  <div className="fleet-heatmap__day">{day}</div>
                  {heatmap[di].map((val, hi) => (
                    <div key={hi} title={`${day} ${String(hi).padStart(2, '0')}:00, ${pickupCounts[di][hi]} ${pickupCounts[di][hi] === 1 ? 'pickup' : 'pickups'}`} aria-label={`${day} ${hi}:00, ${pickupCounts[di][hi]} pickups`} className="fleet-heatmap__cell" style={{ background: getUtilColor(val) }} />
                  ))}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="card fleet-panel">
            <h2 className="fleet-panel__title" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Pickups by weekday
              <InfoTip>Pickups counted on their pickup date. {sampleNote}</InfoTip>
            </h2>
            <p className="fleet-muted" style={{ margin: '4px 0 16px' }}>
              Pickup times are not captured (only dates), so the hour view is hidden.
              {withPickup.length ? ` ${timed.length} of ${withPickup.length} pickups carry a time.` : ''}
            </p>
            {withPickup.length === 0 ? (
              <p className="fleet-muted">No loads have a pickup date yet.</p>
            ) : (
              <div className="fleet-days" role="list">
                {DAYS.map((day, i) => (
                  <div key={day} className="fleet-days__row" role="listitem" aria-label={`${day}, ${byWeekday[i]} ${byWeekday[i] === 1 ? 'pickup' : 'pickups'}`}>
                    <span className="fleet-days__day">{day}</span>
                    <span className="fleet-route__track fleet-days__track" aria-hidden="true">
                      <span className="fleet-route__fill" style={{ display: 'block', width: `${(byWeekday[i] / maxDay) * 100}%` }} />
                    </span>
                    <span className="fleet-days__count">{byWeekday[i]}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="card fleet-panel fleet-routes-panel">
          <h2 className="fleet-panel__title" style={{ marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Top routes
            <InfoTip>Routes by number of loads, with order totals. Place names are cleaned first (spacing, case, and short codes such as JHB), so the same route is counted once. {sampleNote}</InfoTip>
          </h2>
          <p className="fleet-muted" style={{ margin: '0 0 16px' }}>
            By number of loads{unrouted > 0 ? `. ${unrouted} ${unrouted === 1 ? 'load has' : 'loads have'} no route set and ${unrouted === 1 ? 'is' : 'are'} left out` : ''}
          </p>
          {topRoutes.length === 0 ? (
            <div className="fleet-muted" style={{ textAlign: 'center', padding: '20px 0' }}>No loads with a route yet.</div>
          ) : (
            <div className={`fleet-routes${timesCaptured ? '' : ' fleet-routes--1'}`}>
              {topRoutes.map(([route, data]) => (
                <RouteBar key={route} route={route} count={data.count} revenue={data.revenue} maxCount={maxRouteCount} total={routed} />
              ))}
            </div>
          )}
        </section>
      </div>
      )}
    </div>
  );
}
