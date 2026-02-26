import { useState } from "react";
import { useNavigate } from "react-router-dom";

const MOCK_VEHICLES = [
  { id: 1, registration: 'CA 123-456', make: 'Volvo', model: 'FH16', status: 'IN_TRANSIT', driver: 'S. Nkosi', route: 'JHB → CPT', fuel: 82 },
  { id: 2, registration: 'GP 789-012', make: 'Mercedes', model: 'Actros', status: 'LOADING', driver: 'J. Dlamini', route: 'DBN → JHB', fuel: 65 },
  { id: 3, registration: 'KZN 345-678', make: 'MAN', model: 'TGX', status: 'IDLE', driver: 'P. Botha', route: '—', fuel: 91 },
  { id: 4, registration: 'WC 901-234', make: 'DAF', model: 'XF', status: 'MAINTENANCE', driver: '—', route: '—', fuel: 45 },
  { id: 5, registration: 'GP 567-890', make: 'Volvo', model: 'FH13', status: 'IN_TRANSIT', driver: 'M. Moyo', route: 'PE → JHB', fuel: 74 },
];

const MOCK_DRIVERS = [
  { id: 1, name: 'S. Nkosi', code: 'DRV-001', trips: 42, onTime: 96, rating: 4.8, status: 'ACTIVE' },
  { id: 2, name: 'J. Dlamini', code: 'DRV-002', trips: 38, onTime: 89, rating: 4.5, status: 'ACTIVE' },
  { id: 3, name: 'P. Botha', code: 'DRV-003', trips: 55, onTime: 94, rating: 4.7, status: 'IDLE' },
  { id: 4, name: 'M. Moyo', code: 'DRV-004', trips: 31, onTime: 82, rating: 4.2, status: 'ACTIVE' },
  { id: 5, name: 'L. Zulu', code: 'DRV-005', trips: 27, onTime: 91, rating: 4.6, status: 'OFF' },
];

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

  const activeVehicles = MOCK_VEHICLES.filter(v => v.status === 'IN_TRANSIT' || v.status === 'LOADING').length;
  const idleVehicles = MOCK_VEHICLES.filter(v => v.status === 'IDLE').length;
  const inMaintenance = MOCK_VEHICLES.filter(v => v.status === 'MAINTENANCE').length;
  const activeDrivers = MOCK_DRIVERS.filter(d => d.status === 'ACTIVE').length;

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
          { label: 'Total Vehicles', value: MOCK_VEHICLES.length, color: 'var(--text-primary)' },
          { label: 'Active', value: activeVehicles, color: 'var(--accent-primary)' },
          { label: 'Idle', value: idleVehicles, color: 'var(--text-secondary)' },
          { label: 'Maintenance', value: inMaintenance, color: 'var(--status-danger)' },
          { label: 'Drivers On Duty', value: activeDrivers, color: '#22c55e' },
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
              {MOCK_VEHICLES.map(v => (
                <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/fleet/vehicles/${v.id}`)}>
                  <td className="mono">{v.registration}</td>
                  <td>{v.make} {v.model}</td>
                  <td>{v.driver}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[v.status] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                      {v.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{v.route}</td>
                  <td className="text-right">
                    <span style={{ fontFamily: 'var(--font-mono)', color: v.fuel < 50 ? 'var(--status-danger)' : v.fuel < 70 ? 'var(--status-warning)' : 'var(--text-primary)' }}>
                      {v.fuel}%
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
              {MOCK_DRIVERS.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/fleet/drivers/${d.id}`)}>
                  <td>{d.name}</td>
                  <td className="mono">{d.code}</td>
                  <td className="mono">{d.trips}</td>
                  <td style={{ color: d.onTime >= 90 ? 'var(--accent-primary)' : d.onTime >= 80 ? 'var(--status-warning)' : 'var(--status-danger)', fontFamily: 'var(--font-mono)' }}>{d.onTime}%</td>
                  <td style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>★ {d.rating}</td>
                  <td className="text-right">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[d.status], padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                      {d.status}
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
