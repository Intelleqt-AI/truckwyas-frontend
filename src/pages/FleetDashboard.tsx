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
    Promise.all([
      fetchData('/api/v1/vehicles/'),
      fetchData('/api/v1/drivers/')
    ])
      .then(([vehiclesData, driversData]) => {
        setVehicles(vehiclesData || []);
        setDrivers(driversData || []);
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
        <div className="card" style={{ padding: 24 }}>
          <div style={{ height: 16, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
          <div style={{ height: 32, background: 'var(--bg-surface)', borderRadius: 4, width: '40%' }} />
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
        <div className="card" style={{ padding: 24, color: 'var(--status-danger)' }}>
          {error}
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
