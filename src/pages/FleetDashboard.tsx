import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { LiveBadge } from "@/components/LiveBadge";

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
  padding: '12px 0',
  marginRight: 24,
  cursor: 'pointer',
  marginBottom: -1,
});

export default function FleetDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'vehicles' | 'drivers'>('vehicles');

  // Fetch lives in the queryFn so the result is cached by TanStack Query
  // (keyed below) and survives navigation — revisiting the page no longer
  // refires these requests until the cache goes stale.
  const { data, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ["fleet-dashboard"],
    queryFn: async () => {
      const [vehiclesData, driversData] = await Promise.all([
        fetchData('api/v1/vehicles/'),
        fetchData('api/v1/drivers/')
      ]);
      return {
        vehicles: Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.results || []),
        drivers: Array.isArray(driversData) ? driversData : (driversData?.results || []),
      };
    },
  });

  const vehicles: any[] = data?.vehicles ?? [];
  const drivers: any[] = data?.drivers ?? [];
  const error = queryError ? 'Failed to load fleet data' : null;

  useEffect(() => {
    document.title = 'Fleet - TruckWys';
  }, []);

  useAutoRefresh(refetch); // live-refresh every 30s + on focus

  const activeVehicles = vehicles.filter(v => v.status === 'IN_USE').length;
  const idleVehicles = vehicles.filter(v => v.status === 'AVAILABLE').length;
  const inMaintenance = vehicles.filter(v => v.status === 'MAINTENANCE').length;
  const activeDrivers = drivers.filter(d => d.status === 'ACTIVE').length;

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fleet Command</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
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
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fleet Command</div>
        </div>
        <div className="card" style={{ padding: 20, color: 'var(--status-danger)' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fleet Command</div>
            <LiveBadge />
          </div>
        </div>
        <button className="btn-action" onClick={() => navigate(tab === 'vehicles' ? '/fleet/vehicles' : '/fleet/drivers')}>
          + ADD {tab === 'vehicles' ? 'VEHICLE' : 'DRIVER'}
        </button>
      </div>

      {/* Stats — always visible */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
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
                  <td className="mono">{v.plate || v.registration || '—'}</td>
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
                  <td>{(d.user_details ? `${d.user_details.first_name || ''} ${d.user_details.last_name || ''}`.trim() : '') || d.name || `Driver ${d.id}`}</td>
                  <td className="mono">{d.license_number || '—'}</td>
                  <td className="mono">{d.total_trips ?? '—'}</td>
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
