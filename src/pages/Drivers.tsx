import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchData } from '../lib/Api';

interface Driver {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  status: string;
  trips_this_month?: number;
  revenue_generated?: number;
  efficiency_score?: number;
  phone?: string;
  license_number?: string;
}

interface DriverOverview {
  total_drivers: number;
  active_drivers: number;
  avg_revenue_per_driver: number;
}

interface LeaderboardEntry {
  driver_id: number;
  driver_name: string;
  revenue: number;
  trips: number;
  efficiency_score: number;
  rank: number;
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'var(--accent-primary)',
  INACTIVE: 'var(--text-tertiary)',
  ON_LEAVE: 'var(--status-warning)',
};

const formatZAR = (v: number) =>
  'R ' + (v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const getDriverName = (d: Driver) => {
  if (d.first_name && d.last_name) return `${d.first_name} ${d.last_name}`;
  if (d.name) return d.name;
  if (d.first_name) return d.first_name;
  return `Driver ${d.id}`;
};

export default function Drivers() {
  const navigate = useNavigate();
  const location = useLocation();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [overview, setOverview] = useState<DriverOverview | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchData('api/v1/drivers/'),
      fetchData('api/v1/drivers/overview/').catch(() => null),
      fetchData('api/v1/drivers/leaderboard/').catch(() => null),
    ]).then(([driversData, overviewData, leaderboardData]) => {
      const driverList = Array.isArray(driversData) ? driversData : (driversData?.results || []);

      // Parse leaderboard data
      const lbData = Array.isArray(leaderboardData) ? leaderboardData : (leaderboardData?.data || []);
      const leaderboardEntries = lbData.map((d: any, i: number) => ({
        driver_id: d.id || d.driver_id || i,
        driver_name: d.driver_name || d.name || `Driver ${d.id}`,
        revenue: d.revenue || d.revenue_generated || 0,
        trips: d.trips || d.trips_completed || 0,
        efficiency_score: d.efficiency_score || d.on_time_percentage || 0,
        rank: d.rank || i + 1,
      }));

      // Merge leaderboard data into driver list
      const driversWithPerformance = driverList.map((driver: Driver) => {
        const leaderboardEntry = leaderboardEntries.find((lb: LeaderboardEntry) => lb.driver_id === driver.id);
        if (leaderboardEntry && !driver.efficiency_score) {
          return { ...driver, efficiency_score: leaderboardEntry.efficiency_score };
        }
        return driver;
      });

      setDrivers(driversWithPerformance);
      setLeaderboard(leaderboardEntries);

      if (overviewData?.kpi_cards) {
        const cards = overviewData.kpi_cards as any[];
        const findVal = (kw: string) => {
          const c = cards.find((c: any) => (c.key || c.label || '').toString().toLowerCase().includes(kw));
          return parseFloat(c?.value) || 0;
        };
        setOverview({
          total_drivers: findVal('total') || driversData?.count || driverList.length,
          active_drivers: findVal('active') || driverList.filter((d: any) => d.status === 'ACTIVE').length,
          avg_revenue_per_driver: findVal('revenue') || findVal('avg') || 0,
        });
      } else if (overviewData) {
        setOverview(overviewData);
      } else {
        setOverview({
          total_drivers: driverList.length,
          active_drivers: driverList.filter((d: any) => d.status === 'ACTIVE').length,
          avg_revenue_per_driver: 0,
        });
      }
    }).catch(() => {
      setDrivers([]);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = drivers.filter(d => statusFilter === 'All' || d.status === statusFilter);

  const rankColor = (rank: number) => {
    if (rank === 1) return 'var(--accent-primary)';
    if (rank === 2) return 'var(--status-warning)';
    return 'var(--text-secondary)';
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none',
    borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
    textTransform: 'uppercase', padding: '10px 18px', cursor: 'pointer', marginBottom: -1,
  });

  if (loading) return (
    <div style={{ padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>
  );

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Fleet</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fleet</div>
        </div>
        <button className="btn-action">+ ADD DRIVER</button>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 20, display: 'flex' }}>
        <button style={tabStyle(false)} onClick={() => navigate('/fleet/vehicles')}>Vehicles</button>
        <button style={tabStyle(true)}>Drivers</button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Drivers', value: overview?.total_drivers ?? drivers.length, color: 'var(--text-primary)' },
          { label: 'Active', value: overview?.active_drivers ?? drivers.filter(d => d.status === 'ACTIVE').length, color: 'var(--accent-primary)' },
          { label: 'Avg Revenue per Driver', value: formatZAR(overview?.avg_revenue_per_driver ?? 0), color: 'var(--text-primary)' },
        ].map(k => (
          <div key={k.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{k.label}</span></div>
            <div className="metric-value" style={{ fontSize: 28, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Top performers */}
      {leaderboard.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 12 }}>TOP PERFORMERS THIS MONTH</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {leaderboard.slice(0, 3).map(entry => (
              <div
                key={entry.driver_id}
                className="card"
                style={{ padding: 16, borderLeft: `3px solid ${rankColor(entry.rank)}`, cursor: 'pointer' }}
                onClick={() => navigate(`/fleet/drivers/${entry.driver_id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: rankColor(entry.rank) }}>#{entry.rank}</span>
                  <span style={{ fontSize: 18 }}>{entry.rank === 1 ? '🏆' : entry.rank === 2 ? '🥈' : '🥉'}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>{entry.driver_name}</div>
                {[
                  { label: 'Revenue', value: formatZAR(entry.revenue) },
                  { label: 'Trips', value: entry.trips },
                  { label: 'Efficiency', value: entry.efficiency_score || '—' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.label}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)', padding: '7px 12px',
            fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2, cursor: 'pointer',
          }}
        >
          <option value="All">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ON_LEAVE">On Leave</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name', 'License', 'Status', 'Trips MTD', 'Revenue Generated', 'Performance'].map(h => (
                <th key={h} style={{
                  padding: '10px 20px', textAlign: 'left',
                  fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                  borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40, fontSize: 13 }}>No drivers found</td></tr>
            ) : filtered.map((d, idx) => {
              const statusDotColor = d.status === 'ACTIVE' ? 'var(--status-success)' : d.status === 'ON_LEAVE' ? 'var(--status-warning)' : 'var(--text-tertiary)';
              const efficiencyScore = d.efficiency_score || 0;

              return (
                <tr
                  key={d.id}
                  style={{ cursor: 'pointer', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-row)' : 'none' }}
                  onClick={() => navigate(`/drivers/${d.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '13px 20px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: statusDotColor,
                        flexShrink: 0
                      }} />
                      {getDriverName(d)}
                    </div>
                  </td>
                  <td style={{ padding: '13px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {d.license_number || '—'}
                  </td>
                  <td style={{ padding: '13px 20px' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: STATUS_COLOR[d.status] || 'var(--text-secondary)',
                      textTransform: 'uppercase',
                    }}>
                      {d.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '13px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                    {d.trips_this_month ?? 0}
                  </td>
                  <td style={{ padding: '13px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                    {d.revenue_generated ? formatZAR(d.revenue_generated) : '—'}
                  </td>
                  <td style={{ padding: '13px 20px' }}>
                    {efficiencyScore > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, maxWidth: 120, height: 6, background: 'var(--bg-surface-hover)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(efficiencyScore, 100)}%`,
                            height: '100%',
                            background: 'var(--accent-primary)',
                            borderRadius: 3,
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
                          {efficiencyScore}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
