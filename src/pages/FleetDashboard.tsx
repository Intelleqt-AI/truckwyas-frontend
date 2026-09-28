import './fleet-vehicles-brand.css';
import './table-heading-roles.css';
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Loader } from "@/components/Loader";
import SectionHeader from "@/components/layout/SectionHeader";

const STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: 'var(--accent-primary)',
  LOADING: 'var(--status-warning-text, var(--status-warning))',
  IDLE: 'var(--text-secondary)',
  MAINTENANCE: 'var(--status-danger-text, var(--status-danger))',
  ACTIVE: 'var(--accent-primary)',
  OFF: 'var(--text-tertiary)',
};

// Sentence-case a status token for display: "IN_TRANSIT" → "In transit".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

const tabStyle = (active: boolean): React.CSSProperties => ({
  background: 'none',
  border: 'none',
  borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  lineHeight: '20px',
  letterSpacing: 'normal',
  fontWeight: active ? 500 : 400,
  padding: '12px 0',
  marginRight: 24,
  cursor: 'pointer',
  marginBottom: -1,
  whiteSpace: 'nowrap',
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

  // Same shared header in every state so loading/error never move the title.
  const header = (
    <SectionHeader
      eyebrow="Fleet"
      title="Fleet command"
      actions={!loading && !error ? (
        <button data-fleet-control className="btn-action" onClick={() => navigate(tab === 'vehicles' ? '/fleet/vehicles' : '/fleet/drivers')}>
          + Add {tab === 'vehicles' ? 'vehicle' : 'driver'}
        </button>
      ) : undefined}
    />
  );

  if (loading) {
    return (
      <div className="fleet-page">
        {header}
        <div className="fleet-table-state"><Loader size={32} label="Loading fleet" /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fleet-page">
        {header}
        <div className="card" role="alert" style={{ padding: 24, color: 'var(--status-danger-text, var(--status-danger))', fontSize: 14, lineHeight: '20px' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="fleet-page">
      {header}

      {/* Stats — always visible */}
      <div className="fleet-summary fleet-summary--5">
        {[
          { label: 'Total vehicles', value: vehicles.length, color: 'var(--text-primary)' },
          { label: 'Active', value: activeVehicles, color: 'var(--accent-primary)' },
          { label: 'Idle', value: idleVehicles, color: 'var(--text-secondary)' },
          { label: 'Maintenance', value: inMaintenance, color: 'var(--status-danger-text, var(--status-danger))' },
          { label: 'Drivers on duty', value: activeDrivers, color: 'var(--status-success-text, var(--status-success))' },
        ].map(m => (
          <div key={m.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{m.label}</span></div>
            <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 24, display: 'flex', overflowX: 'auto' }}>
        <button style={tabStyle(tab === 'vehicles')} onClick={() => setTab('vehicles')}>Vehicles</button>
        <button style={tabStyle(tab === 'drivers')} onClick={() => setTab('drivers')}>Drivers</button>
      </div>

      {/* Vehicles tab */}
      {tab === 'vehicles' && (
        <div className="card table-card">
          <table className="data-table table-heading-roles">
            <thead>
              <tr>
                <th>Registration</th><th>Vehicle</th><th>Driver</th><th>Status</th><th>Route</th><th className="text-right">Fuel</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/fleet/vehicles/${v.id}`)}>
                  <td className="mono">{v.plate || v.registration || '—'}</td>
                  <td>{v.make || ''} {v.model || ''}</td>
                  <td>{v.driver || '—'}</td>
                  <td>
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap', fontSize: 13, lineHeight: '20px', color: STATUS_COLOR[v.status] || 'var(--text-secondary)', padding: '2px 8px', background: 'var(--bg-surface-hover)', borderRadius: 4 }}>
                      {v.status ? formatStatus(v.status) : '—'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{v.route || '—'}</td>
                  <td className="text-right">
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: v.fuel < 50 ? 'var(--status-danger-text, var(--status-danger))' : v.fuel < 70 ? 'var(--status-warning-text, var(--status-warning))' : 'var(--text-primary)' }}>
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
          <table className="data-table table-heading-roles">
            <thead>
              <tr>
                <th>Name</th><th>Licence</th><th className="text-right">Trips</th><th className="text-right">On time</th><th className="text-right">Rating</th><th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/fleet/drivers/${d.id}`)}>
                  <td>{(d.user_details ? `${d.user_details.first_name || ''} ${d.user_details.last_name || ''}`.trim() : '') || d.name || `Driver ${d.id}`}</td>
                  <td className="mono">{d.license_number || '—'}</td>
                  <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.total_trips ?? '—'}</td>
                  <td className="text-right" style={{ color: d.onTime >= 90 ? 'var(--accent-primary)' : d.onTime >= 80 ? 'var(--status-warning-text, var(--status-warning))' : 'var(--status-danger-text, var(--status-danger))', fontVariantNumeric: 'tabular-nums' }}>
                    {d.onTime !== undefined ? `${d.onTime}%` : '—'}
                  </td>
                  <td className="text-right" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {d.rating !== undefined ? `${d.rating}` : '—'}
                  </td>
                  <td className="text-right">
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap', fontSize: 13, lineHeight: '20px', color: STATUS_COLOR[d.status] || 'var(--text-secondary)', padding: '2px 8px', background: 'var(--bg-surface-hover)', borderRadius: 4 }}>
                      {d.status ? formatStatus(d.status) : '—'}
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
