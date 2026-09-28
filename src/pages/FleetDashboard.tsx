import './fleet-vehicles-brand.css';
import './table-heading-roles.css';
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Loader } from "@/components/Loader";
import SectionHeader from "@/components/layout/SectionHeader";

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  AVAILABLE: 'success',
  ACTIVE: 'success',
  IN_USE: 'info',
  IN_TRANSIT: 'info',
  LOADING: 'warning',
  MAINTENANCE: 'warning',
  ON_LEAVE: 'warning',
};
const chip = (st?: string) => (
  <span className={`fleet-chip fleet-chip--${STATUS_TONE[st || ''] || 'neutral'}`}>{st ? formatStatusToken(st) : '—'}</span>
);
function formatStatusToken(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}

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

      {/* Summary strip: what is working, what is free, what is off the road. */}
      <section className="card fleet-kpis" aria-label="Fleet right now">
        <div className="fleet-kpi">
          <div className="fleet-kpi__label">On a job now</div>
          <div className="fleet-kpi__value">{activeVehicles}<span className="fleet-kpi__of">of {vehicles.length}</span></div>
          <div className="fleet-kpi__note">Vehicles with status In use.</div>
        </div>
        <div className="fleet-kpi">
          <div className="fleet-kpi__label">Available</div>
          <div className="fleet-kpi__value">{idleVehicles}</div>
          <div className="fleet-kpi__note">{inMaintenance} in maintenance.</div>
        </div>
        <div className="fleet-kpi">
          <div className="fleet-kpi__label">Active drivers</div>
          <div className="fleet-kpi__value">{activeDrivers}<span className="fleet-kpi__of">of {drivers.length}</span></div>
          <div className="fleet-kpi__note">Drivers with status Active.</div>
        </div>
      </section>

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
                <th>Registration</th><th>Vehicle</th><th>Driver</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/fleet/vehicles/${v.id}`)}>
                  <td className="mono">{v.plate || v.registration || '—'}</td>
                  <td>{v.make || ''} {v.model || ''}</td>
                  <td>{v.driver_name || '—'}</td>
                  <td>{chip(v.status)}</td>
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
                <th>Name</th><th>Licence</th><th className="text-right">Completed loads</th><th className="text-right">On time</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/fleet/drivers/${d.id}`)}>
                  <td>{(d.user_details ? `${d.user_details.first_name || ''} ${d.user_details.last_name || ''}`.trim() : '') || d.name || `Driver ${d.id}`}</td>
                  <td className="mono">{d.license_number || '—'}</td>
                  <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.total_trips ?? '—'}</td>
                  <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {Number(d.on_time_rate) ? `${d.on_time_rate}%` : '—'}
                  </td>
                  <td>{chip(d.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
