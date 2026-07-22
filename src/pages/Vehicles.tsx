import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from '@tanstack/react-query';
import { fetchData, patchData, deleteData } from '../lib/Api';
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { LiveBadge } from "@/components/LiveBadge";
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddVehicleDrawer } from '@/components/AddVehicleDrawer';
import { EditVehicleDrawer } from '@/components/EditVehicleDrawer';

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
  revenue_generated?: number;
  total_trips?: number;
  fuel_efficiency_score?: number;
  utilisation_rate?: number;
  ai_health_score?: number;
  plate?: string;
  vin?: string;
  mileage?: number;
  driver?: number | null;
  insurance_expiry?: string;
  registration_expiry?: string;
  fuel_type?: string;
  type?: string;
  last_maintenance_date?: string;
  next_maintenance_due?: string;
  service_interval_km?: number | null;
  last_service_mileage?: number | string | null;
  cartrack_registration?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  heading?: number | string | null;
  speed_kmh?: number | string | null;
  ignition_on?: boolean | null;
  last_location_at?: string | null;
  temp1?: number | string | null;
  temp2?: number | string | null;
  temp3?: number | string | null;
  temp4?: number | string | null;
  cartrack_current_driver_ref?: string;
  door_open?: boolean | null;
  last_door_event_at?: string | null;
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
  revenue_generated?: number;
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
  'R ' + v.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Sentence-case a status token for display: "IN_USE" → "In use".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

// Fetches all fleet data + derives lists. Lives in the queryFn so the result is
// cached by TanStack Query (keyed by search below) and survives navigation —
// revisiting the page no longer refires these requests until the cache goes stale.
async function loadFleet(q: string) {
  const vehiclesUrl = q
    ? `api/v1/vehicles/?search=${encodeURIComponent(q)}`
    : 'api/v1/vehicles/';
  const [vehData, overviewData, insightsData, vtData, driverData] = await Promise.all([
    fetchData(vehiclesUrl),
    fetchData('api/v1/fleet/overview/'),
    fetchData('api/v1/fleet/intelligence/'),
    fetchData('api/v1/vehicle-types/'),
    fetchData('api/v1/drivers/'),
  ]);

  const vehicles: Vehicle[] = Array.isArray(vehData) ? vehData : (vehData?.results || []);

  const overview: FleetOverview | null = overviewData;

  const insights: FleetInsight[] = Array.isArray(insightsData) ? insightsData : (insightsData?.opportunities || []);

  const vtList = Array.isArray(vtData) ? vtData : (vtData?.results || []);
  const vehicleTypes = vtList.map((vt: any) => ({ id: vt.id, name: vt.name }));

  const driverList = Array.isArray(driverData) ? driverData : (driverData?.results || []);
  const drivers = driverList.map((d: any) => {
    const ud = d.user_details || {};
    const fn = d.first_name || ud.first_name || '';
    const ln = d.last_name || ud.last_name || '';
    const name = fn && ln ? `${fn} ${ln}` : fn || ln || d.name || `Driver ${d.id}`;
    return { id: d.id, name };
  });

  return { vehicles, overview, insights, vehicleTypes, drivers };
}

export default function Vehicles() {
  const navigate = useNavigate();
  const location = useLocation();
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [sortBy, setSortBy] = useState('revenue');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [confirmOpts, setConfirmOpts] = useState<{
    title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);

  const { data, isLoading: loading, refetch } = useQuery({
    // search drives the vehicles fetch URL (server-side search), so it must be
    // part of the key — statusFilter / sortBy are applied client-side in render.
    queryKey: ['vehicles-page', debouncedSearch],
    queryFn: () => loadFleet(debouncedSearch),
  });

  // Cached data drives the view; defaults keep the first render safe.
  // vehicleTypes/drivers are fetched here too, but only AddVehicleDrawer /
  // EditVehicleDrawer need them, and each self-fetches its own copy — nothing
  // in this page reads data.vehicleTypes/data.drivers directly.
  const vehicles = data?.vehicles ?? [];

  // Mirror the typed-search value into the debounced value (300ms) used by the query key.
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(val), 300);
  };

  useAutoRefresh(refetch);

  // Filter vehicles
  const filtered = vehicles.filter(v => {
    if (statusFilter === 'All') return true;
    return v.status === statusFilter;
  });

  // Sort vehicles
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'revenue') {
      return (b.revenue_generated || 0) - (a.revenue_generated || 0);
    }
    return 0;
  });

  // Cartrack polls every ~20s; treat anything older than 60s as stale so a
  // vehicle that's gone offline doesn't silently look "live" forever.
  const LOCATION_STALE_AFTER_MS = 60_000;

  const formatLastSeen = (v: Vehicle) => {
    if (!v.last_location_at) return null;
    const seenAt = new Date(v.last_location_at).getTime();
    const ageMs = Date.now() - seenAt;
    const isStale = ageMs > LOCATION_STALE_AFTER_MS;
    const minutes = Math.floor(ageMs / 60_000);
    const label = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: isStale ? 'var(--text-tertiary)' : 'var(--status-success)',
        marginTop: 2,
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: isStale ? 'var(--text-tertiary)' : 'var(--status-success)',
          display: 'inline-block',
        }} />
        {label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const color = STATUS_COLOR[status] || 'var(--text-secondary)';
    return (
      <span style={{
        display: 'inline-block',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color,
        padding: '2px 6px',
        background: 'var(--bg-surface-hover)',
        borderRadius: 4,
      }}>
        {formatStatus(status)}
      </span>
    );
  };

  if (loading) {
    return (
      <div>
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
    background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.05em',
    fontWeight: active ? 500 : 400,
    padding: '12px 0', marginRight: 24, cursor: 'pointer', marginBottom: -1,
    transition: 'all 0.2s ease',
  });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Fleet</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Fleet</div>
            <LiveBadge />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => navigate('/fleet/heatmap')} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '8px 14px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.06em' }}>Heatmap</button>
            <button className="btn-action" onClick={() => setShowAddForm(true)}>+ Add vehicle</button>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        {/* Vehicle Table */}
        <div>
          {/* Search + Status Filter Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search VIN, plate, make, model..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              style={{
                width: 280,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: 2,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {['All', 'AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE'].map(status => {
                const isActive = statusFilter === status;
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    style={{
                      background: isActive ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: isActive ? 'var(--bg-deep)' : 'var(--text-secondary)',
                      padding: '6px 12px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      borderRadius: 2,
                      cursor: 'pointer',
                      letterSpacing: '0.06em',
                      fontWeight: isActive ? 500 : 400,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {status === 'All' ? 'All' : formatStatus(status)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Registration', 'Make / Model', 'Type', 'Status', 'Utilization', 'Revenue MTD', 'Trips MTD', 'Efficiency', ''].map(h => (
                    <th key={h} style={{
                      padding: '12px 20px 12px 32px', textAlign: 'left',
                      fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
                      letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                      borderBottom: '1px solid var(--border-subtle)', fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  vehicles.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: 0 }}>
                        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🚛</div>
                          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                            No vehicles yet
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                            Get started by adding your first vehicle to your fleet
                          </div>
                          <button onClick={() => setShowAddForm(true)} className="btn-action">
                            Add vehicle
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>No vehicles match your filters</td></tr>
                  )
                ) : sorted.map((v, idx) => {
                  const utilizationPercent = ((v.total_trips || 0) / 20) * 100;
                  const utilizationColor = utilizationPercent > 70 ? 'var(--status-success)' : utilizationPercent >= 40 ? 'var(--status-warning)' : 'var(--status-danger)';

                  return (
                    <tr
                      key={v.id}
                      style={{ cursor: 'pointer', borderBottom: idx < sorted.length - 1 ? '1px solid var(--border-row)' : 'none' }}
                      onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 20px 12px 32px', fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        <div>{v.plate || v.registration || '—'}</div>
                        {formatLastSeen(v)}
                      </td>
                      <td style={{ padding: '12px 20px 12px 32px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={[v.make, v.model].filter(Boolean).join(' ')}>
                        {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td style={{ padding: '12px 20px 12px 32px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {v.vehicle_type_name || '—'}
                      </td>
                      <td style={{ padding: '12px 20px 12px 32px' }}>{getStatusBadge(v.status)}</td>
                      <td style={{ padding: '12px 20px 12px 32px' }}>
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
                      <td style={{ padding: '12px 20px 12px 32px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {v.revenue_generated ? formatZAR(v.revenue_generated) : '—'}
                      </td>
                      <td style={{ padding: '12px 20px 12px 32px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {v.total_trips ?? 0}
                      </td>
                      <td style={{ padding: '12px 20px 12px 32px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {v.fuel_efficiency_score ? `${parseFloat(v.fuel_efficiency_score as any).toFixed(0)}/100` : '—'}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditVehicle(v);
                            }}
                            style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: 2, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em' }}
                          >EDIT</button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmOpts({
                                title: 'Delete Vehicle',
                                message: `Remove ${v.plate || v.registration} from your fleet? This cannot be undone.`,
                                confirmLabel: 'Delete',
                                danger: true,
                                onConfirm: async () => {
                                  try {
                                    await deleteData({ url: `api/v1/vehicles/${v.id}/` });
                                    toast.success('Vehicle deleted');
                                    refetch();
                                  } catch (err: any) {
                                    toast.error(err?.message || 'Failed to delete vehicle');
                                  }
                                },
                              });
                            }}
                            style={{ background: 'none', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', padding: '4px 10px', borderRadius: 2, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em' }}
                          >DEL</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <AddVehicleDrawer
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        onCreated={refetch}
      />

      <EditVehicleDrawer
        open={!!editVehicle}
        vehicle={editVehicle}
        onClose={() => setEditVehicle(null)}
        onUpdated={refetch}
      />

      {confirmOpts && (
        <ConfirmModal
          title={confirmOpts.title}
          message={confirmOpts.message}
          confirmLabel={confirmOpts.confirmLabel || 'Confirm'}
          danger={confirmOpts.danger}
          onConfirm={confirmOpts.onConfirm}
          onCancel={() => setConfirmOpts(null)}
        />
      )}
    </div>
  );
}
