import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';
import { Loader } from '@/components/Loader';
import SectionHeader from '@/components/layout/SectionHeader';
import './fleet-vehicles-brand.css';
import './ops-tiles.css';
import { InfoTip } from '@/components/ui/InfoTip';

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
        <span className="fleet-route__money">{formatCurrency(revenue)}</span>
      </div>
    </div>
    <div className="fleet-route__track" aria-hidden="true">
      <div className="fleet-route__fill" style={{ width: `${Math.min(100, (count / Math.max(maxCount, 1)) * 100)}%` }} />
    </div>
  </div>
);

export default function FleetHeatmap() {
  const navigate = useNavigate();

  const { data: loadsData, isLoading } = useQuery({
    queryKey: ['loads-heatmap'],
    queryFn: () => fetchData('api/v1/loads/?page_size=200'),
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-heatmap'],
    queryFn: () => fetchData('api/v1/vehicles/'),
  });

  const loads = Array.isArray(loadsData) ? loadsData : (loadsData?.results || []);
  const vehicles = Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.results || []);

  const heatmap = generateHeatmap(loads, vehicles.length);
  const pickupCounts = countPickups(loads);
  const loadsOnServer: number = Array.isArray(loadsData) ? loads.length : (loadsData?.count ?? loads.length);
  const sampleNote = loadsOnServer > loads.length
    ? `Based on the latest ${loads.length} of ${loadsOnServer} loads.`
    : `Based on ${loads.length} ${loads.length === 1 ? 'load' : 'loads'}.`;

  // Route frequency analysis
  const routeMap: Record<string, { count: number; revenue: number }> = {};
  for (const load of loads) {
    const key = `${load.pickup_city || '?'} → ${load.delivery_city || '?'}`;
    if (!routeMap[key]) routeMap[key] = { count: 0, revenue: 0 };
    routeMap[key].count++;
    routeMap[key].revenue += parseFloat(load.total_amount || '0');
  }
  const topRoutes = Object.entries(routeMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);
  const maxRouteCount = topRoutes[0]?.[1].count ?? 0;

  // Status breakdown
  const statusMap: Record<string, number> = {};
  for (const v of vehicles) {
    statusMap[v.status] = (statusMap[v.status] || 0) + 1;
  }

  const utilRate = vehicles.length > 0
    ? Math.round((statusMap['IN_USE'] || 0) / vehicles.length * 100)
    : 0;

  return (
    <div className="fleet-page">
      <SectionHeader
        eyebrow="Fleet"
        title="Activity heatmap"
        description="Pickup times and top routes"
        actions={
          <button data-fleet-control className="fleet-secondary-button" onClick={() => navigate('/fleet/vehicles')}>
            Back to fleet
          </button>
        }
      />

      {/* Summary tiles: how much of the fleet is working right now. */}
      <section className="ops-tiles" aria-label="Fleet right now">
        <div className="ops-tile">
          <h2 className="ops-tile__label">On a job now</h2>
          <div className="ops-tile__value">{statusMap['IN_USE'] || 0}<span className="ops-tile__of">of {vehicles.length}</span></div>
          <div className="ops-tile__sub">{utilRate}% of the fleet</div>
        </div>
        <div className="ops-tile">
          <h2 className="ops-tile__label">Available</h2>
          <div className="ops-tile__value">{statusMap['AVAILABLE'] || 0}</div>
          <div className="ops-tile__sub">Ready for a load</div>
        </div>
        <div className="ops-tile">
          <h2 className="ops-tile__label">In maintenance</h2>
          <div className="ops-tile__value">{statusMap['MAINTENANCE'] || 0}</div>
          <div className="ops-tile__sub">Off the road</div>
        </div>
      </section>

      <div className="fleet-heatmap-grid">
        {/* Heatmap */}
        <section className="card fleet-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <h2 className="fleet-panel__title" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Pickup times
                <InfoTip>Pickups by weekday and hour, shaded against the busiest slot.</InfoTip>
              </h2>
              <p className="fleet-muted" style={{ margin: '4px 0 0' }}>{sampleNote.replace(/\.$/, '')}</p>
            </div>
            <div className="fleet-muted" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span>Low</span>
              {[0, 25, 50, 75, 100].map(v => <div key={v} style={{ width: 12, height: 12, background: getUtilColor(v), borderRadius: 2, border: '1px solid var(--border-subtle)' }} aria-hidden="true" />)}
              <span>High</span>
            </div>
          </div>

          {isLoading ? (
            <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}><Loader size={28} label="Loading activity" /></div>
          ) : (
            <div className="fleet-heatmap">
              {/* Hour labels */}
              <div className="fleet-heatmap__row">
                <div />
                {HOURS.map(h => (
                  <div key={h} className="fleet-heatmap__hour" style={{ visibility: h % 3 === 0 ? 'visible' : 'hidden' }}>{h}h</div>
                ))}
              </div>
              {/* Heatmap grid */}
              {DAYS.map((day, di) => (
                <div key={day} className="fleet-heatmap__row">
                  <div className="fleet-heatmap__day">{day}</div>
                  {heatmap[di].map((val, hi) => (
                    <div key={hi} title={`${day} ${String(hi).padStart(2, '0')}:00, ${pickupCounts[di][hi]} ${pickupCounts[di][hi] === 1 ? 'pickup' : 'pickups'}`} aria-label={`${day} ${hi}:00, ${pickupCounts[di][hi]} pickups`} style={{ aspectRatio: '1', background: getUtilColor(val), borderRadius: 2, minHeight: 0 }} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Top routes */}
        <section className="card fleet-panel">
          <h2 className="fleet-panel__title" style={{ marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Top routes
            <InfoTip>Top {Math.min(8, topRoutes.length)} routes by number of loads, with order totals. {sampleNote}</InfoTip>
          </h2>
          <p className="fleet-muted" style={{ margin: '0 0 16px' }}>By number of loads</p>
          {topRoutes.length === 0 ? (
            <div className="fleet-muted" style={{ textAlign: 'center', padding: '20px 0' }}>No loads yet.</div>
          ) : topRoutes.map(([route, data]) => (
            <RouteBar key={route} route={route} count={data.count} revenue={data.revenue} maxCount={maxRouteCount} total={loads.length} />
          ))}
        </section>
      </div>
    </div>
  );
}
