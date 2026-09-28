import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';
import { Loader } from '@/components/Loader';
import SectionHeader from '@/components/layout/SectionHeader';
import './fleet-vehicles-brand.css';

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

// Deterministic fake heatmap seeded from vehicle/load data
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
    const hour = d.getHours() || 8;
    grid[dayIdx][Math.min(hour, 23)]++;
  }

  // Normalize to 0-100
  const maxVal = Math.max(...grid.flat(), 1);
  return grid.map(row => row.map(v => Math.round((v / maxVal) * 100)));
}

const RouteBar = ({ route, count, revenue }: any) => {
  const maxCount = 10;
  return (
    <div className="fleet-route">
      <div className="fleet-route__row">
        <span className="fleet-route__name">{route}</span>
        <div className="fleet-route__figures">
          <span>{count} trips</span>
          <span className="fleet-route__money">{formatCurrency(revenue)}</span>
        </div>
      </div>
      <div className="fleet-route__track" aria-hidden="true">
        <div className="fleet-route__fill" style={{ width: `${Math.min(100, (count / maxCount) * 100)}%` }} />
      </div>
    </div>
  );
};

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

  // Status breakdown
  const statusMap: Record<string, number> = {};
  for (const v of vehicles) {
    statusMap[v.status] = (statusMap[v.status] || 0) + 1;
  }

  // Dots are decorative swatches; the adjacent text label carries the meaning.
  const STATUS_COLOR: Record<string, string> = {
    AVAILABLE: 'var(--status-success)',
    IN_USE: 'var(--accent-primary)',
    MAINTENANCE: 'var(--status-warning)',
    OUT_OF_SERVICE: 'var(--status-danger)',
  };
  const formatStatus = (st: string) =>
    st ? st.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

  const utilRate = vehicles.length > 0
    ? Math.round((statusMap['IN_USE'] || 0) / vehicles.length * 100)
    : 0;

  return (
    <div className="fleet-page">
      <SectionHeader
        eyebrow="Fleet"
        title="Utilisation heatmap"
        description="Load activity by day and hour, and your busiest routes."
        actions={
          <button data-fleet-control className="fleet-secondary-button" onClick={() => navigate('/fleet/vehicles')}>
            Back to fleet
          </button>
        }
      />

      {/* KPI strip — same summary grid as the Fleet list pages */}
      <div className="fleet-summary fleet-summary--4">
        {[
          { label: 'Fleet size', value: vehicles.length, sub: 'Total vehicles', color: 'var(--text-primary)' },
          { label: 'In use now', value: statusMap['IN_USE'] || 0, sub: `${utilRate}% utilisation`, color: 'var(--accent-primary)' },
          { label: 'Available', value: statusMap['AVAILABLE'] || 0, sub: 'Ready to deploy', color: 'var(--status-success-text, var(--status-success))' },
          { label: 'In maintenance', value: statusMap['MAINTENANCE'] || 0, sub: 'Off the road', color: 'var(--status-warning-text, var(--status-warning))' },
        ].map(k => (
          <div key={k.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{k.label}</span></div>
            <div className="metric-value" style={{ color: k.color }}>{k.value}</div>
            <div className="fleet-metric-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Utilisation gauge */}
      <section className="card fleet-panel" style={{ marginBottom: 24 }}>
        <h2 className="fleet-panel__title">Fleet utilisation rate</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, height: 12, background: 'var(--border-subtle)', borderRadius: 6 }} aria-hidden="true">
            <div style={{ height: 12, width: `${utilRate}%`, background: utilRate >= 70 ? 'var(--status-success)' : utilRate >= 40 ? 'var(--accent-primary)' : 'var(--status-warning)', borderRadius: 6, transition: 'width 0.6s ease' }} />
          </div>
          <span className="fleet-panel__figure" style={{ color: utilRate >= 70 ? 'var(--status-success-text, var(--status-success))' : 'var(--accent-primary)' }}>{utilRate}%</span>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
          {Object.entries(statusMap).map(([st, count]) => (
            <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[st] || 'var(--text-tertiary)' }} aria-hidden="true" />
              <span className="fleet-muted">{formatStatus(st)} ({count})</span>
            </div>
          ))}
        </div>
      </section>

      <div className="fleet-heatmap-grid">
        {/* Heatmap */}
        <section className="card fleet-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <h2 className="fleet-panel__title" style={{ margin: 0 }}>Load activity by day and hour</h2>
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
                    <div key={hi} title={`${day} ${hi}:00 — ${val}%`} style={{ aspectRatio: '1', background: getUtilColor(val), borderRadius: 2, cursor: 'default', transition: 'transform 0.1s', minHeight: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Top routes */}
        <section className="card fleet-panel">
          <h2 className="fleet-panel__title">Top routes by volume</h2>
          {topRoutes.length === 0 ? (
            <div className="fleet-muted" style={{ textAlign: 'center', padding: '20px 0' }}>No route data yet</div>
          ) : topRoutes.map(([route, data]) => (
            <RouteBar key={route} route={route} count={data.count} revenue={data.revenue} />
          ))}
        </section>
      </div>
    </div>
  );
}
