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
          <div className="card-header"><span className="card-title">Vehicle Types</span></div>
          <div className="metric-value" style={{ fontSize: 28 }}>
            {new Set(vehicles.map(v => v.vehicle_type_name || v.type)).size}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        {/* Vehicle Table */}
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
              <option value="MAINTENANCE">Maintenance</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)', padding: '7px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2, cursor: 'pointer',
              }}
            >
              <option value="revenue">Sort by Revenue</option>
            </select>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th className="text-right">Revenue MTD</th>
                  <th className="text-right">Trips MTD</th>
                  <th className="text-right">Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>No vehicles found</td></tr>
                ) : sorted.map(v => (
                  <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/fleet/vehicles/${v.id}`)}>
                    <td className="mono" style={{ fontWeight: 500 }}>{v.plate || v.registration || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {v.vehicle_type_name || v.vehicle_type || '—'}
                    </td>
                    <td>{getStatusBadge(v.status)}</td>
                    <td className="text-right mono" style={{ fontSize: 12 }}>
                      {v.revenue_this_month ? formatZAR(v.revenue_this_month) : '—'}
                    </td>
                    <td className="text-right mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {v.trips_this_month || 0}
                    </td>
                    <td className="text-right mono" style={{ fontSize: 12 }}>
                      {v.fuel_efficiency ? `${v.fuel_efficiency.toFixed(1)} L/100km` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
