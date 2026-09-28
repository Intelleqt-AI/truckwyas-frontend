import './fleet-vehicles-brand.css';
import './table-heading-roles.css';
import './ops-tiles.css';
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/Api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Loader } from "@/components/Loader";
import SectionHeader from "@/components/layout/SectionHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { KpiRow, KpiTile } from "@/components/ui/KpiTile";

const chip = (st?: string) => <StatusChip status={st} size="sm" />;
function formatStatusToken(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}

// Sentence-case a status token for display: "IN_TRANSIT" → "In transit".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

const tabStyle = (active: boolean): React.CSSProperties => ({
  background: 'none',
  border: 'none',
  borderBottom: active ? '2px solid var(--text-primary)' : '2px solid transparent',
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
        <div className="card" role="alert" style={{ padding: 24, color: 'var(--status-danger-text)', fontSize: 14, lineHeight: '20px' }}>
          {error}
        </div>
      </div>
    );
  }

  // A driver column that reads "—" on every row answers nothing: hide it.
  const hasDrivers = vehicles.some((v: any) => v.driver_name);

  return (
    <div className="fleet-page">
      {header}

      {/* Summary tiles: what is working, what is free, who is on. */}
      <KpiRow className="ops-kpis">
        <KpiTile aria-label="On a job now" label="On a job now" figure={<>{activeVehicles}<span className="tw-kpi__of"> of {vehicles.length}</span></>} note="Status In use" />
        <KpiTile aria-label="Available" label="Available" figure={idleVehicles} note={`${inMaintenance} in maintenance`} />
        <KpiTile aria-label="Active drivers" label="Active drivers" figure={<>{activeDrivers}<span className="tw-kpi__of"> of {drivers.length}</span></>} note="Status Active" />
      </KpiRow>

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
                <th>Registration</th><th>Vehicle</th>{hasDrivers && <th>Driver</th>}<th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/fleet/vehicles/${v.id}`)}>
                  <td className="mono">{v.plate || v.registration || '—'}</td>
                  <td>{v.make || ''} {v.model || ''}</td>
                  {hasDrivers && <td>{v.driver_name || 'Unassigned'}</td>}
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
