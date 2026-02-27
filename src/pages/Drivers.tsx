import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  'R ' + v.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function Drivers() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [overview, setOverview] = useState<DriverOverview | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchData('api/v1/drivers/'),
      fetchData('api/v1/drivers/overview/'),
      fetchData('api/v1/drivers/leaderboard/')
    ])
      .then(([driversData, overviewData, leaderboardData]) => {
        // API returns paginated {count, results}
        setDrivers(Array.isArray(driversData) ? driversData : (driversData?.results || []));
        // overview returns {header, banner, kpi_cards} — extract into flat shape
        if (overviewData?.kpi_cards) {
          const cards = overviewData.kpi_cards as any[];
          const findVal = (keyword: string) => {
            const card = cards.find((c: any) => (c.key || c.label || '').toString().toLowerCase().includes(keyword));
            return card?.value || 0;
          };
          setOverview({
            total_drivers: findVal('total') || findVal('driver') || driversData?.count || 0,
            active_drivers: findVal('active') || 0,
            avg_revenue_per_driver: findVal('revenue') || findVal('avg') || 0,
          });
        } else {
          setOverview(overviewData);
        }
        // leaderboard returns {title, columns, data: [...], total_count}
        const lbData = Array.isArray(leaderboardData) ? leaderboardData : (leaderboardData?.data || []);
        setLeaderboard(lbData.map((d: any, i: number) => ({
          driver_id: d.id || d.driver_id || i,
          driver_name: d.driver_name || d.name || `Driver ${d.id}`,
          revenue: d.revenue || d.revenue_generated || 0,
          trips: d.trips || d.trips_completed || 0,
          efficiency_score: d.efficiency_score || d.on_time_percentage || 0,
          rank: d.rank || i + 1,
        })));
        setError(null);
      })
      .catch(() => {
        setError('Failed to load driver data');
        setDrivers([]);
        setOverview(null);
        setLeaderboard([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filter drivers
  const filtered = drivers.filter(d => {
    if (statusFilter === 'All') return true;
    return d.status === statusFilter;
  });

  const getDriverName = (d: Driver) => {
    if (d.first_name && d.last_name) return `${d.first_name} ${d.last_name}`;
    if (d.name) return d.name;
    if (d.first_name) return d.first_name;
    return `Driver ${d.id}`;
  };

  const getLeaderboardColor = (rank: number) => {
    if (rank === 1) return 'var(--accent-primary)';
    if (rank === 2) return 'var(--status-warning)';
    if (rank === 3) return 'var(--text-secondary)';
    return 'var(--text-tertiary)';
  };

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8, width: '20%' }} />
          <div style={{ height: 24, background: 'var(--bg-surface)', borderRadius: 4, width: '30%' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
              <div style={{ height: 32, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Fleet</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Drivers</div>
      </div>

      {/* Driver Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Total Drivers</span></div>
          <div className="metric-value" style={{ fontSize: 28 }}>{overview?.total_drivers || drivers.length}</div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Active</span></div>
          <div className="metric-value" style={{ fontSize: 28, color: 'var(--accent-primary)' }}>
            {overview?.active_drivers || drivers.filter(d => d.status === 'ACTIVE').length}
          </div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Avg Revenue per Driver</span></div>
          <div className="metric-value" style={{ fontSize: 22 }}>
            {formatZAR(overview?.avg_revenue_per_driver || 0)}
          </div>
        </div>
      </div>

      {/* Leaderboard Section */}
      {leaderboard.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 12 }}>
            TOP PERFORMERS THIS MONTH
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {leaderboard.slice(0, 3).map((entry, i) => (
              <div
                key={entry.driver_id}
                className="card"
                style={{
                  padding: 16,
                  borderLeft: `3px solid ${getLeaderboardColor(entry.rank)}`,
                  cursor: 'pointer'
                }}
                onClick={() => navigate(`/drivers/${entry.driver_id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 600, color: getLeaderboardColor(entry.rank) }}>
                    #{entry.rank}
                  </div>
                  {entry.rank === 1 && <div style={{ fontSize: 20 }}>🏆</div>}
                  {entry.rank === 2 && <div style={{ fontSize: 18 }}>🥈</div>}
                  {entry.rank === 3 && <div style={{ fontSize: 18 }}>🥉</div>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                  {entry.driver_name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>Revenue</span>
                  <span className="mono" style={{ color: 'var(--text-primary)' }}>{formatZAR(entry.revenue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>Trips</span>
                  <span className="mono" style={{ color: 'var(--text-primary)' }}>{entry.trips}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span>Efficiency</span>
                  <span className="mono" style={{ color: 'var(--text-primary)' }}>{entry.efficiency_score || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Driver Table */}
      <div>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
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
        <div className="card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>License</th>
                <th>Status</th>
                <th className="text-right">Trips MTD</th>
                <th className="text-right">Revenue Generated</th>
                <th className="text-right">Efficiency Score</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>No drivers found</td></tr>
              ) : filtered.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/drivers/${d.id}`)}>
                  <td style={{ fontWeight: 500 }}>{getDriverName(d)}</td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {d.license_number || '—'}
                  </td>
                  <td>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: STATUS_COLOR[d.status] || 'var(--text-secondary)',
                      padding: '2px 6px',
                      background: 'var(--bg-surface-hover)',
                      borderRadius: 2,
                      textTransform: 'uppercase'
                    }}>
                      {d.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-right mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {d.trips_this_month || 0}
                  </td>
                  <td className="text-right mono" style={{ fontSize: 12 }}>
                    {d.revenue_generated ? formatZAR(d.revenue_generated) : '—'}
                  </td>
                  <td className="text-right mono" style={{ fontSize: 12 }}>
                    {d.efficiency_score || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
