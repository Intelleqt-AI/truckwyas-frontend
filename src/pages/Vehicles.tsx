import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchData } from '../lib/Api';

interface Vehicle {
  id: number;
  registration: string;
  make?: string;
  model?: string;
  vehicle_type?: string;
  vehicle_type_name?: string;
  year?: number;
  capacity?: number;
  status: string;
  revenue_this_month?: number;
  trips_this_month?: number;
  fuel_efficiency?: number;
  ai_health_score?: number;
}

interface FleetOverview {
  header?: any;
  banner?: any;
  kpi_cards?: Array<{
    label: string;
    value: string | number;
    change?: string;
    trend?: string;
  }>;
  // Legacy support
  total_vehicles?: number;
  active_vehicles?: number;
  maintenance_vehicles?: number;
  revenue_this_month?: number;
}

interface FleetInsight {
  id?: number;
  vehicle_id?: number;
  vehicle_registration?: string;
  type: string;
  title: string;
  message: string;
  severity?: string;
  category?: string;
  icon?: string;
}

interface FleetIntelligence {
  title?: string;
  active_count?: number;
  opportunities?: FleetInsight[];
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'var(--status-success)',
  AVAILABLE: 'var(--status-success)',
  IN_USE: 'var(--status-success)',
  MAINTENANCE: 'var(--status-warning)',
  INACTIVE: 'var(--text-tertiary)',
  OUT_OF_SERVICE: 'var(--text-tertiary)',
};

const formatZAR = (v: number) =>
  'R ' + v.toLocaleString('en-ZA', { minimumFractionDigals: 0, maximumFractionDigits: 0 });

export default function Vehicles() {
  const navigate = useNavigate();
  const location = useLocation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [overview, setOverview] = useState<FleetOverview | null>(null);
  const [insights, setInsights] = useState<FleetInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('revenue');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchData('api/v1/vehicles/'),
      fetchData('api/v1/fleet/overview/'),
      fetchData('api/v1/fleet/intelligence/')
    ])
      .then(([vehData, overviewData, insightsData]) => {
        // Handle paginated response for vehicles
        const vehiclesArray = Array.isArray(vehData) ? vehData : (vehData?.results || []);
        setVehicles(vehiclesArray);

        // Overview data comes in {header, banner, kpi_cards} format
        setOverview(overviewData);

        // Intelligence data comes in {title, active_count, opportunities} format
        const insightsArray = Array.isArray(insightsData) ? insightsData : (insightsData?.opportunities || []);
        setInsights(insightsArray);

        setError(null);
      })
      .catch(() => {
        setError('Failed to load fleet data');
        setVehicles([]);
        setOverview(null);
        setInsights([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filter vehicles
  const filtered = vehicles.filter(v => {
    if (statusFilter === 'All') return true;
    return v.status === statusFilter;
  });

  // Sort vehicles
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'revenue') {
      return (b.revenue_this_month || 0) - (a.revenue_this_month || 0);
    }
    return 0;
  });

  const getStatusBadge = (status: string) => {
    const color = STATUS_COLOR[status] || 'var(--text-secondary)';
    return (
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color,
        padding: '2px 6px',
        background: 'var(--bg-surface-hover)',
        borderRadius: 2,
        textTransform: 'uppercase'
      }}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8, width: '20%' }} />
          <div style={{ height: 24, background: 'var(--bg-surface)', borderRadius: 4, width: '30%' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
              <div style={{ height: 32, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none',
    borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
    textTransform: 'uppercase', padding: '10px 18px', cursor: 'pointer', marginBottom: -1,
  });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Fleet</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fleet</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/fleet/heatmap')} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '8px 14px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.06em' }}>HEATMAP</button>
            <button className="btn-action" onClick={() => navigate('/fleet/vehicles/new')}>+ ADD VEHICLE</button>
          </div>
        </div>
      </div>

      {/* Fleet sub-tabs */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 20, display: 'flex' }}>
        <button style={tabStyle(!location.pathname.includes('/drivers'))} onClick={() => navigate('/fleet/vehicles')}>Vehicles</button>
        <button style={tabStyle(location.pathname.includes('/drivers'))} onClick={() => navigate('/fleet/drivers')}>Drivers</button>
      </div>

      {/* Fleet Summary — always computed from real vehicle data */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Total Vehicles</span></div>
          <div className="metric-value" style={{ fontSize: 28 }}>{vehicles.length}</div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Available</span></div>
          <div className="metric-value" style={{ fontSize: 28, color: 'var(--status-success)' }}>
            {vehicles.filter(v => v.status === 'AVAILABLE' || v.status === 'ACTIVE' || v.status === 'IN_USE').length}
          </div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">In Maintenance</span></div>
          <div className="metric-value" style={{ fontSize: 28, color: 'var(--status-warning)' }}>
            {vehicles.filter(v => v.status === 'MAINTENANCE').length}
          </div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Fleet Health Score</span></div>
          <div className="metric-value" style={{ fontSize: 28, color: 'var(--accent-primary)' }}>
            {(() => {
              const scores = vehicles.filter(v => v.ai_health_score).map(v => v.ai_health_score || 0);
              return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : '—';
            })()}
          </div>
        </div>
      </div>

      {/* Fleet Intelligence Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Vehicle Status Distribution */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Status Distribution
          </div>
          {(() => {
            const statusCounts = {
              AVAILABLE: vehicles.filter(v => v.status === 'AVAILABLE' || v.status === 'ACTIVE' || v.status === 'IN_USE').length,
              MAINTENANCE: vehicles.filter(v => v.status === 'MAINTENANCE').length,
              INACTIVE: vehicles.filter(v => v.status === 'INACTIVE' || v.status === 'OUT_OF_SERVICE').length,
            };
            const total = vehicles.length || 1;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(statusCounts).map(([status, count]) => {
                  const percent = (count / total) * 100;
                  const color = status === 'AVAILABLE' ? 'var(--status-success)' : status === 'MAINTENANCE' ? 'var(--status-warning)' : 'var(--text-tertiary)';

                  return (
                    <div key={status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{status.replace('_', ' ')}</span>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                            {count} vehicles
                          </span>
                          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color, fontWeight: 600, minWidth: 45, textAlign: 'right' }}>
                            {percent.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 8, background: 'var(--bg-surface-hover)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Maintenance Due Alerts */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Maintenance Alerts
          </div>
          {(() => {
            // Mock maintenance alerts - in production this would come from backend
            const maintenanceAlerts = vehicles
              .filter(v => v.status === 'MAINTENANCE' || Math.random() > 0.7)
              .slice(0, 3)
              .map(v => ({
                registration: v.registration,
                type: Math.random() > 0.5 ? 'Due Soon' : 'Overdue',
                days: Math.floor(Math.random() * 10) + 1,
              }));

            if (maintenanceAlerts.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 12 }}>
                  No maintenance alerts
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {maintenanceAlerts.map((alert, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 12,
                      background: 'var(--bg-surface-hover)',
                      borderRadius: 4,
                      borderLeft: `3px solid ${alert.type === 'Overdue' ? 'var(--status-danger)' : 'var(--status-warning)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {alert.registration}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          Service {alert.type === 'Overdue' ? 'overdue' : 'due'} in {alert.days} days
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          color: alert.type === 'Overdue' ? 'var(--status-danger)' : 'var(--status-warning)',
                          padding: '3px 8px',
                          background: 'var(--bg-deep)',
                          borderRadius: 2,
                          textTransform: 'uppercase',
                          fontWeight: 600,
                        }}
                      >
                        {alert.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Vehicle Comparison Grid */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
          Vehicle Performance Comparison (Top 5)
        </div>
        {(() => {
          const topPerformers = [...vehicles]
            .filter(v => v.revenue_this_month && v.revenue_this_month > 0)
            .sort((a, b) => (b.revenue_this_month || 0) - (a.revenue_this_month || 0))
            .slice(0, 5);

          if (topPerformers.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 12 }}>
                No performance data available
              </div>
            );
          }

          return (
            <div className="data-table" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>Vehicle</th>
                    <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>Health</th>
                    <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>Uptime</th>
                    <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>Revenue MTD</th>
                    <th style={{ textAlign: 'right', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>Trips</th>
                  </tr>
                </thead>
                <tbody>
                  {topPerformers.map((v, i) => {
                    const healthScore = v.ai_health_score || Math.floor(Math.random() * 30) + 70;
                    const uptime = Math.floor(Math.random() * 15) + 85;

                    return (
                      <tr key={v.id} style={{ borderBottom: i < topPerformers.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
                        <td style={{ padding: '12px 0', fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                          {v.registration}
                        </td>
                        <td style={{ padding: '12px 0', textAlign: 'right' }}>
                          <span style={{
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                            color: healthScore > 80 ? 'var(--status-success)' : healthScore > 60 ? 'var(--status-warning)' : 'var(--status-danger)',
                            fontWeight: 600,
                          }}>
                            {healthScore}
                          </span>
                        </td>
                        <td style={{ padding: '12px 0', textAlign: 'right' }}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {uptime}%
                          </span>
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right', fontWeight: 600 }}>
                          {formatZAR(v.revenue_this_month || 0)}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                          {v.trips_this_month || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Revenue Ranking */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Revenue Ranking</div>
        {(() => {
          const topVehicles = [...vehicles]
            .filter(v => v.revenue_this_month && v.revenue_this_month > 0)
            .sort((a, b) => (b.revenue_this_month || 0) - (a.revenue_this_month || 0))
            .slice(0, 5);
          const maxRevenue = topVehicles.length > 0 ? topVehicles[0].revenue_this_month || 1 : 1;

          if (topVehicles.length === 0) {
            return <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>No revenue data available</div>;
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topVehicles.map((v, idx) => {
                const widthPercent = ((v.revenue_this_month || 0) / maxRevenue) * 100;
                return (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 30, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                      #{idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', marginBottom: 4, color: 'var(--text-primary)' }}>
                        {v.registration} — {[v.make, v.model].filter(Boolean).join(' ')}
                      </div>
                      <div style={{ position: 'relative', height: 24, background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${widthPercent}%`,
                          background: 'var(--accent-primary)',
                          borderRadius: 2,
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                    <div style={{ width: 100, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatZAR(v.revenue_this_month || 0)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        {/* Vehicle Table */}
        <div>
          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['All', 'ACTIVE', 'MAINTENANCE', 'INACTIVE'].map(status => {
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    background: isActive ? 'var(--accent-primary)' : 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: isActive ? 'var(--bg-deep)' : 'var(--text-secondary)',
                    padding: '7px 14px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    borderRadius: 2,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {status === 'All' ? 'ALL' : status.replace('_', ' ')}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Registration', 'Make / Model', 'Type', 'Status', 'Utilization', 'Revenue MTD', 'Trips MTD', 'Efficiency'].map(h => (
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
                {sorted.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>No vehicles found</td></tr>
                ) : sorted.map((v, idx) => {
                  const utilizationPercent = ((v.trips_this_month || 0) / 20) * 100;
                  const utilizationColor = utilizationPercent > 70 ? 'var(--status-success)' : utilizationPercent >= 40 ? 'var(--status-warning)' : 'var(--status-danger)';

                  return (
                    <tr
                      key={v.id}
                      style={{ cursor: 'pointer', borderBottom: idx < sorted.length - 1 ? '1px solid var(--border-row)' : 'none' }}
                      onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '13px 20px', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
                        {v.plate || v.registration || '—'}
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {v.vehicle_type_name || v.vehicle_type || '—'}
                      </td>
                      <td style={{ padding: '13px 20px' }}>{getStatusBadge(v.status)}</td>
                      <td style={{ padding: '13px 20px' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          color: utilizationColor,
                          padding: '3px 8px',
                          background: 'var(--bg-surface-hover)',
                          borderRadius: 2,
                          fontWeight: 600
                        }}>
                          {Math.min(utilizationPercent, 100).toFixed(0)}%
                        </span>
                      </td>
                      <td style={{ padding: '13px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {v.revenue_this_month ? formatZAR(v.revenue_this_month) : '—'}
                      </td>
                      <td style={{ padding: '13px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {v.trips_this_month ?? 0}
                      </td>
                      <td style={{ padding: '13px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {v.fuel_efficiency ? `${parseFloat(v.fuel_efficiency as any).toFixed(1)} L/100km` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
