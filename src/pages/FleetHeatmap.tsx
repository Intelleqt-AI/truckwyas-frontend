import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';

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
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{route}</span>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{count} trips</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{formatCurrency(revenue)}</span>
        </div>
      </div>
      <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2 }}>
        <div style={{ height: 4, width: `${Math.min(100, (count / maxCount) * 100)}%`, background: 'var(--accent-primary)', borderRadius: 2 }} />
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

  const STATUS_COLOR: Record<string, string> = {
    AVAILABLE: 'var(--status-success)',
    IN_USE: 'var(--accent-primary)',
    MAINTENANCE: 'var(--status-warning)',
    OUT_OF_SERVICE: 'var(--status-danger)',
  };

  const utilRate = vehicles.length > 0
    ? Math.round((statusMap['IN_USE'] || 0) / vehicles.length * 100)
    : 0;

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 4 }}>Fleet intelligence</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Utilisation Heatmap</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Live fleet activity and route performance</div>
        </div>
        <button onClick={() => navigate('/fleet')} style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 12px', borderRadius: 2, cursor: 'pointer' }}>← FLEET</button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'FLEET SIZE', value: vehicles.length, sub: 'Total vehicles', color: 'var(--text-primary)' },
          { label: 'IN USE NOW', value: statusMap['IN_USE'] || 0, sub: `${utilRate}% utilisation`, color: 'var(--accent-primary)' },
          { label: 'AVAILABLE', value: statusMap['AVAILABLE'] || 0, sub: 'Ready to deploy', color: 'var(--status-success)' },
          { label: 'MAINTENANCE', value: statusMap['MAINTENANCE'] || 0, sub: 'Off the road', color: 'var(--status-warning)' },
        ].map(k => (
          <div key={k.label} className="card metric-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 500, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Utilisation gauge */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 16 }}>Fleet utilisation rate</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, height: 12, background: 'var(--border-subtle)', borderRadius: 6 }}>
            <div style={{ height: 12, width: `${utilRate}%`, background: utilRate >= 70 ? 'var(--status-success)' : utilRate >= 40 ? 'var(--accent-primary)' : 'var(--status-warning)', borderRadius: 6, transition: 'width 0.6s ease' }} />
          </div>
          <span style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-mono)', color: utilRate >= 70 ? 'var(--status-success)' : 'var(--accent-primary)', minWidth: 60 }}>{utilRate}%</span>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
          {Object.entries(statusMap).map(([s, count]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s] || 'var(--text-tertiary)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.replace('_', ' ')} ({count})</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Heatmap */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>LOAD ACTIVITY — WEEKLY PATTERN</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 10, color: 'var(--text-tertiary)' }}>
              <span>Low</span>
              {[0, 25, 50, 75, 100].map(v => <div key={v} style={{ width: 12, height: 12, background: getUtilColor(v), borderRadius: 2, border: '1px solid var(--border-subtle)' }} />)}
              <span>High</span>
            </div>
          </div>

          {isLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>
          ) : (
            <div>
              {/* Hour labels */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 3, marginBottom: 4 }}>
                <div />
                {HOURS.map(h => (
                  <div key={h} style={{ fontSize: 9, color: h % 3 === 0 ? 'var(--text-tertiary)' : 'transparent', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>{h}h</div>
                ))}
              </div>
              {/* Heatmap grid */}
              {DAYS.map((day, di) => (
                <div key={day} style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 3, marginBottom: 3 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center' }}>{day}</div>
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
        </div>

        {/* Top routes */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 16 }}>Top routes by volume</div>
          {topRoutes.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>No route data yet</div>
          ) : topRoutes.map(([route, data]) => (
            <RouteBar key={route} route={route} count={data.count} revenue={data.revenue} />
          ))}
        </div>
      </div>
    </div>
  );
}
