import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchData } from "@/lib/Api";

const STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: 'var(--accent-primary)',
  LOADING: 'var(--status-warning)',
  IDLE: 'var(--text-secondary)',
  MAINTENANCE: 'var(--status-danger)',
  ACTIVE: 'var(--accent-primary)',
  OFF: 'var(--text-tertiary)',
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  background: 'none',
  border: 'none',
  borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
  color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: '10px 18px',
  cursor: 'pointer',
  marginBottom: -1,
});

export default function FleetDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'vehicles' | 'drivers'>('vehicles');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Fleet - TruckWys';
  }, []);

  useEffect(() => {
    Promise.all([
      fetchData('api/v1/vehicles/'),
      fetchData('api/v1/drivers/')
    ])
      .then(([vehiclesData, driversData]) => {
        setVehicles(Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.results || []));
        setDrivers(Array.isArray(driversData) ? driversData : (driversData?.results || []));
      })
      .catch(() => {
        setError('Failed to load fleet data');
        setVehicles([]);
        setDrivers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeVehicles = vehicles.filter(v => v.status === 'IN_TRANSIT' || v.status === 'LOADING').length;
  const idleVehicles = vehicles.filter(v => v.status === 'IDLE').length;
  const inMaintenance = vehicles.filter(v => v.status === 'MAINTENANCE').length;
  const activeDrivers = drivers.filter(d => d.status === 'ACTIVE').length;

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Fleet</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fleet Command</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div style={{ height: 12, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '65%' }} />
              <div style={{ height: 28, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
            </div>
          ))}
        </div>
        <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 20 }} />
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ height: 10, background: 'var(--bg-surface)', borderRadius: 4, width: '70%' }} />
          </div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ padding: '13px 20px', borderBottom: '1px solid var(--border-row)', display: 'flex', gap: 40 }}>
              <div style={{ height: 14, background: 'var(--bg-surface)', borderRadius: 4, width: '15%' }} />
              <div style={{ height: 14, background: 'var(--bg-surface)', borderRadius: 4, width: '20%' }} />
              <div style={{ height: 14, background: 'var(--bg-surface)', borderRadius: 4, width: '12%' }} />
              <div style={{ height: 14, background: 'var(--bg-surface)', borderRadius: 4, width: '10%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Fleet</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fleet Command</div>
        </div>
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--status-danger)" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.6 }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>Unable to load fleet data</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Check your connection and try refreshing the page</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Fleet</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fleet Command</div>
        </div>
        <button className="btn-action" onClick={() => navigate(tab === 'vehicles' ? '/fleet/vehicles' : '/fleet/drivers')}>
          + ADD {tab === 'vehicles' ? 'VEHICLE' : 'DRIVER'}
        </button>
      </div>

      {/* Stats — always visible */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Vehicles', value: vehicles.length, color: 'var(--text-primary)' },
          { label: 'Active', value: activeVehicles, color: 'var(--accent-primary)' },
          { label: 'Idle', value: idleVehicles, color: 'var(--text-secondary)' },
          { label: 'Maintenance', value: inMaintenance, color: 'var(--status-danger)' },
          { label: 'Drivers On Duty', value: activeDrivers, color: 'var(--status-success)' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ fontSize: 26, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 20, display: 'flex' }}>
        <button style={tabStyle(tab === 'vehicles')} onClick={() => setTab('vehicles')}>Vehicles</button>
        <button style={tabStyle(tab === 'drivers')} onClick={() => setTab('drivers')}>Drivers</button>
      </div>

      {/* Vehicles tab */}
      {tab === 'vehicles' && (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Registration</th><th>Vehicle</th><th>Driver</th><th>Status</th><th>Route</th><th className="text-right">Fuel %</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }}>
                    <rect x="1" y="3" width="15" height="13" rx="2" /><path d="M16 8h4l3 3v5a2 2 0 0 1-2 2h-1" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>No vehicles in fleet</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Add your first vehicle to get started</div>
                </td></tr>
              )}
              {vehicles.map(v => (
                <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/fleet/vehicles/${v.id}`)}>
                  <td className="mono">{v.registration || '—'}</td>
                  <td>{v.make || ''} {v.model || ''}</td>
                  <td>{v.driver || '—'}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[v.status] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                      {v.status ? v.status.replace('_', ' ') : '—'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{v.route || '—'}</td>
                  <td className="text-right">
                    <span style={{ fontFamily: 'var(--font-mono)', color: v.fuel < 50 ? 'var(--status-danger)' : v.fuel < 70 ? 'var(--status-warning)' : 'var(--text-primary)' }}>
                      {v.fuel !== undefined ? `${v.fuel}%` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drivers tab */}
      {tab === 'drivers' && (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Code</th><th>Trips</th><th>On Time %</th><th>Rating</th><th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>No drivers registered</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Add a driver to begin tracking performance</div>
                </td></tr>
              )}
              {drivers.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/fleet/drivers/${d.id}`)}>
                  <td>{d.name || '—'}</td>
                  <td className="mono">{d.code || '—'}</td>
                  <td className="mono">{d.trips !== undefined ? d.trips : '—'}</td>
                  <td style={{ color: d.onTime >= 90 ? 'var(--accent-primary)' : d.onTime >= 80 ? 'var(--status-warning)' : 'var(--status-danger)', fontFamily: 'var(--font-mono)' }}>
                    {d.onTime !== undefined ? `${d.onTime}%` : '—'}
                  </td>
                  <td style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                    {d.rating !== undefined ? `★ ${d.rating}` : '—'}
                  </td>
                  <td className="text-right">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[d.status] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                      {d.status || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
