import './fleet-vehicles-brand.css';
import './table-heading-roles.css';
import { Truck as EmptyFleetIcon } from 'lucide-react';
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
import { PasteImportDrawer } from '@/components/import/PasteImportDrawer';
import { BulkDeleteBar, RowCheckbox } from '@/components/BulkDeleteBar';
import { EditVehicleDrawer } from '@/components/EditVehicleDrawer';
import { Loader } from '@/components/Loader';
import { secondaryButtonStyle } from '@/components/BulkDeleteBar';
import { useAuth } from '@/lib/AuthContext';

interface Vehicle {
  id: number;
  registration: string;
  make?: string;
  model?: string;
  vehicle_type?: string;
  vehicle_type_name?: string;
  vehicle_type_capacity?: string | number | null;
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
  const { user: authUser } = useAuth();
  // Shared public demo account — creation/edit/delete controls are fixed off,
  // viewing/filtering/search stay fully live.
  const isDemo = !!authUser?.is_demo;
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [sortBy, setSortBy] = useState('revenue');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const toggleOne = (id: number, on: boolean) =>
    setSelected(prev => (on ? [...prev, id] : prev.filter(x => x !== id)));
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
        fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px',
        color: isStale ? 'var(--text-tertiary)' : 'var(--status-success)',
        marginTop: 4,
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
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        lineHeight: '20px',
        color,
        padding: '4px 8px',
        background: 'var(--bg-surface-hover)',
        borderRadius: 4,
      }}>
        {formatStatus(status)}
      </span>
    );
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', letterSpacing: 'normal',
    fontWeight: active ? 500 : 400,
    padding: '12px 0', marginRight: 24, cursor: 'pointer', marginBottom: -1,
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  });

  return (
    <div className="fleet-page">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'normal', textTransform: 'none', marginBottom: 4 }}>Fleet</div>
        <div className="fleet-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="fleet-page-title">Fleet</h1>
            <LiveBadge />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button data-fleet-control onClick={() => navigate('/fleet/heatmap')} style={{ fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', letterSpacing: 'normal' }}>Heatmap</button>
            <button data-fleet-control
              onClick={() => setShowImport(true)}
              disabled={isDemo}
              title={isDemo ? 'Fixed in demo mode' : 'Paste a fleet list from Excel'}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', background: 'none',
                border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                padding: '8px 16px', borderRadius: 6, letterSpacing: 'normal',
                cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1,
              }}
            >Import from Excel</button>
            <button data-fleet-control
              className="btn-action"
              onClick={() => setShowAddForm(true)}
              disabled={isDemo}
              title={isDemo ? 'Fixed in demo mode' : undefined}
              style={isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >+ Add vehicle</button>
          </div>
        </div>
      </div>

      {/* Fleet sub-tabs */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 24, display: 'flex', overflowX: 'auto' }}>
        <button style={tabStyle(!location.pathname.includes('/drivers'))} onClick={() => navigate('/fleet/vehicles')}>Vehicles</button>
        <button style={tabStyle(location.pathname.includes('/drivers'))} onClick={() => navigate('/fleet/drivers')}>Drivers</button>
      </div>

      {/* Fleet Summary — always computed from real vehicle data */}
      <div className="fleet-summary fleet-summary--4">
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Total vehicles</span></div>
          <div className="metric-value" style={{ fontSize: 28 }}>{vehicles.length}</div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Available</span></div>
          <div className="metric-value" style={{ fontSize: 28, color: 'var(--status-success)' }}>
            {vehicles.filter(v => v.status === 'AVAILABLE' || v.status === 'ACTIVE' || v.status === 'IN_USE').length}
          </div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">In maintenance</span></div>
          <div className="metric-value" style={{ fontSize: 28, color: 'var(--status-warning)' }}>
            {vehicles.filter(v => v.status === 'MAINTENANCE').length}
          </div>
        </div>
        <div className="card metric-card">
          <div className="card-header"><span className="card-title">Fleet health score</span></div>
          <div className="metric-value" style={{ fontSize: 28, color: 'var(--accent-primary)' }}>
            {(() => {
              const scores = vehicles.filter(v => v.ai_health_score).map(v => v.ai_health_score || 0);
              return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : '—';
            })()}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, gap: 20 }}>
        {/* Vehicle Table */}
        <div style={{ minWidth: 0 }}>
          {/* Search + Status Filter Toolbar */}
          <div className="fleet-toolbar">
            <input data-fleet-control
              type="text"
              aria-label="Search vehicles"
              placeholder="Search VIN, plate, make, model..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              style={{
                width: 280,
                maxWidth: '100%',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: 6,
                lineHeight: '20px',
                fontFamily: 'var(--font-sans)',
              }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['All', 'AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE'].map(status => {
                const isActive = statusFilter === status;
                return (
                  <button data-fleet-control
                    key={status}
                    aria-pressed={isActive}
                    onClick={() => setStatusFilter(status)}
                    style={{
                      background: isActive ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: isActive ? 'var(--btn-action-color)' : 'var(--text-secondary)',
                      padding: '8px 12px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 14,
                      lineHeight: '20px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      letterSpacing: 'normal',
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

          {/* Above the table so it never covers the rows being chosen. */}
          <BulkDeleteBar
            entity="vehicles"
            selected={selected}
            onClear={() => setSelected([])}
            onDeleted={() => { setSelected([]); refetch(); }}
          />

          {/* Table */}
          <div className="card fleet-table-region" role="region" aria-label="Vehicles table" tabIndex={0} style={{ padding: 0, overflowX: 'auto', minWidth: 0, maxWidth: '100%' }}>
            <table className="table-heading-roles" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 0 12px 20px', width: 32, borderBottom: '1px solid var(--border-subtle)' }}>
                    {sorted.length > 0 && (
                      <RowCheckbox
                        title="Select everything shown"
                        checked={selected.length > 0 && sorted.every((v: any) => selected.includes(v.id))}
                        onChange={on => setSelected(on ? sorted.map((v: any) => v.id) : [])}
                      />
                    )}
                  </th>
                  {['Registration', 'Make / model', 'Type', 'Status', 'Utilization', 'Revenue MTD', 'Trips MTD', 'Efficiency', ''].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px 12px 12px', textAlign: 'left',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  vehicles.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: 0 }}>
                        <div style={{ padding: '48px var(--fleet-card-inset)', textAlign: 'center' }}>
                          <div style={{ marginBottom: 16, opacity: 0.3 }}><EmptyFleetIcon size={40} aria-hidden="true" /></div>
                          <div style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                            No vehicles yet
                          </div>
                          <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', marginBottom: 20 }}>
                            Already have your fleet in a spreadsheet? Paste the list straight in.
                          </div>
                          <button data-fleet-control
                            onClick={() => setShowImport(true)}
                            className="btn-action"
                            disabled={isDemo}
                            title={isDemo ? 'Fixed in demo mode' : undefined}
                            style={{ ...(isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : {}), marginRight: 8 }}
                          >
                            Paste from Excel
                          </button>
                          <button data-fleet-control
                            onClick={() => setShowAddForm(true)}
                            disabled={isDemo}
                            title={isDemo ? 'Fixed in demo mode' : undefined}
                            style={{ ...secondaryButtonStyle, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', letterSpacing: 'normal', borderRadius: 6, padding: '8px 16px', cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1 }}
                          >
                            Add one at a time
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40, fontSize: 13, lineHeight: '20px' }}>No vehicles match your filters</td></tr>
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
                      <td style={{ padding: '12px 0 12px 20px', width: 32 }}>
                        <RowCheckbox
                          checked={selected.includes(v.id)}
                          onChange={on => toggleOne(v.id, on)}
                        />
                      </td>
                      <td style={{ padding: '12px 16px 12px 12px', fontFamily: 'var(--font-mono)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        <div>{v.plate || v.registration || '—'}</div>
                        {formatLastSeen(v)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={[v.make, v.model].filter(Boolean).join(' ')}>
                        {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {v.vehicle_type_name || '—'}
                        {v.vehicle_type_capacity != null && (
                          <span style={{ marginLeft: 6, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px' }}>
                            · {v.vehicle_type_capacity}t
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{getStatusBadge(v.status)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: 13,
                          lineHeight: '20px',
                          color: utilizationColor,
                          padding: '4px 8px',
                          background: 'var(--bg-surface-hover)',
                          borderRadius: 4,
                          fontWeight: 600
                        }}>
                          {Math.min(utilizationPercent, 100).toFixed(0)}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {v.revenue_generated ? formatZAR(v.revenue_generated) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {v.total_trips ?? 0}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {v.fuel_efficiency_score ? `${parseFloat(v.fuel_efficiency_score as any).toFixed(0)}/100` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button data-fleet-control
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditVehicle(v);
                            }}
                            disabled={isDemo}
                            title={isDemo ? 'Fixed in demo mode' : undefined}
                            style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: 6, cursor: isDemo ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', letterSpacing: 'normal', opacity: isDemo ? 0.5 : 1 }}
                          >Edit</button>
                          <button data-fleet-control
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmOpts({
                                title: 'Delete vehicle',
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
                            disabled={isDemo}
                            title={isDemo ? 'Fixed in demo mode' : undefined}
                            style={{ background: 'none', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', padding: '4px 12px', borderRadius: 6, cursor: isDemo ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', letterSpacing: 'normal', opacity: isDemo ? 0.5 : 1 }}
                          >Delete</button>
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

      <PasteImportDrawer
        entity="vehicles"
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => refetch()}
      />

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
