import './fleet-vehicles-brand.css';
import './table-heading-roles.css';
import { Truck as EmptyFleetIcon } from 'lucide-react';
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from '@tanstack/react-query';
import { fetchData, patchData, deleteData } from '../lib/Api';
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddVehicleDrawer } from '@/components/AddVehicleDrawer';
import { PasteImportDrawer } from '@/components/import/PasteImportDrawer';
import { BulkDeleteBar, RowCheckbox } from '@/components/BulkDeleteBar';
import { EditVehicleDrawer } from '@/components/EditVehicleDrawer';
import { Loader } from '@/components/Loader';
import SectionHeader, { FLEET_TABS } from '@/components/layout/SectionHeader';
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
  ACTIVE: 'var(--status-success-text, var(--status-success))',
  AVAILABLE: 'var(--status-success-text, var(--status-success))',
  IN_USE: 'var(--status-success-text, var(--status-success))',
  MAINTENANCE: 'var(--status-warning-text, var(--status-warning))',
  INACTIVE: 'var(--text-tertiary)',
  OUT_OF_SERVICE: 'var(--text-tertiary)',
};

// Numeric columns are right aligned (header and cells) per the table standard.
const NUMERIC_COLUMNS = new Set(['Revenue MTD', 'Trips MTD']);

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
        color: isStale ? 'var(--text-tertiary)' : 'var(--status-success-text, var(--status-success))',
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

  const secondaryHeaderButton: React.CSSProperties = {
    background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
    padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
  };

  return (
    <div className="fleet-page">
      <SectionHeader
        eyebrow="Fleet"
        title="Fleet"
        tabs={FLEET_TABS}
        actions={<>
          <button data-fleet-control onClick={() => navigate('/fleet/heatmap')} style={secondaryHeaderButton}>Heatmap</button>
          <button data-fleet-control
            onClick={() => setShowImport(true)}
            disabled={isDemo}
            title={isDemo ? 'Fixed in demo mode' : 'Paste a fleet list from Excel'}
            style={{ ...secondaryHeaderButton, cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1 }}
          >Import from Excel</button>
          <button data-fleet-control
            className="btn-action"
            onClick={() => setShowAddForm(true)}
            disabled={isDemo}
            title={isDemo ? 'Fixed in demo mode' : undefined}
            style={isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >+ Add vehicle</button>
        </>}
      />

      {/* Fleet summary — always computed from real vehicle data. Same 4-card
          grid, toolbar and table card as Drivers so switching tabs never moves the page. */}
      <div className="fleet-summary fleet-summary--4">
        {[
          { label: 'Total vehicles', value: vehicles.length, color: 'var(--text-primary)' },
          { label: 'Available', value: vehicles.filter(v => v.status === 'AVAILABLE' || v.status === 'ACTIVE' || v.status === 'IN_USE').length, color: 'var(--status-success-text, var(--status-success))' },
          { label: 'In maintenance', value: vehicles.filter(v => v.status === 'MAINTENANCE').length, color: 'var(--status-warning-text, var(--status-warning))' },
          {
            label: 'Fleet health score',
            value: (() => {
              const scores = vehicles.filter(v => v.ai_health_score).map(v => v.ai_health_score || 0);
              return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : '—';
            })(),
            color: 'var(--accent-primary)',
          },
        ].map(k => (
          <div key={k.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{k.label}</span></div>
            <div className="metric-value" style={{ color: loading ? 'var(--text-tertiary)' : k.color }}>{loading ? '—' : k.value}</div>
          </div>
        ))}
      </div>

      {/* Search + status filter toolbar */}
      <div className="fleet-toolbar">
        <input data-fleet-control
          type="text"
          aria-label="Search vehicles"
          placeholder="Search VIN, plate, make, model..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          className="fleet-search"
        />
        <div className="fleet-filters">
          {['All', 'AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE'].map(status => {
            const isActive = statusFilter === status;
            return (
              <button data-fleet-control
                key={status}
                aria-pressed={isActive}
                onClick={() => setStatusFilter(status)}
                className="fleet-filter"
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
      <div className="card fleet-table-region" role="region" aria-label="Vehicles table" tabIndex={0}>
        <table className="table-heading-roles fleet-table">
          <thead>
            <tr>
              <th className="fleet-table__select">
                {sorted.length > 0 && (
                  <RowCheckbox
                    title="Select everything shown"
                    checked={selected.length > 0 && sorted.every((v: any) => selected.includes(v.id))}
                    onChange={on => setSelected(on ? sorted.map((v: any) => v.id) : [])}
                  />
                )}
              </th>
              {['Registration', 'Make / model', 'Type', 'Status', 'Utilization', 'Revenue MTD', 'Trips MTD', 'Efficiency', ''].map(h => (
                <th key={h} className={NUMERIC_COLUMNS.has(h) ? 'is-numeric' : undefined}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="fleet-table__state-cell">
                  <div className="fleet-table-state"><Loader size={32} label="Loading vehicles" /></div>
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              vehicles.length === 0 ? (
                <tr>
                  <td colSpan={10} className="fleet-table__state-cell">
                    <div className="fleet-empty">
                      <div className="fleet-empty__icon"><EmptyFleetIcon size={40} aria-hidden="true" /></div>
                      <h2 className="fleet-empty__title">No vehicles yet</h2>
                      <p className="fleet-empty__text">Already have your fleet in a spreadsheet? Paste the list straight in.</p>
                      <div className="fleet-empty__actions">
                      <button data-fleet-control
                        onClick={() => setShowImport(true)}
                        className="btn-action"
                        disabled={isDemo}
                        title={isDemo ? 'Fixed in demo mode' : undefined}
                        style={isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
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
                    </div>
                  </td>
                </tr>
              ) : (
                <tr><td colSpan={10} className="fleet-table__no-match">No vehicles match your filters</td></tr>
              )
            ) : sorted.map((v, idx) => {
              const utilizationPercent = ((v.total_trips || 0) / 20) * 100;
              const utilizationColor = utilizationPercent > 70 ? 'var(--status-success-text, var(--status-success))' : utilizationPercent >= 40 ? 'var(--status-warning-text, var(--status-warning))' : 'var(--status-danger-text, var(--status-danger))';

              return (
                <tr
                  key={v.id}
                  style={{ cursor: 'pointer', borderBottom: idx < sorted.length - 1 ? '1px solid var(--border-row)' : 'none' }}
                  onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="fleet-table__select">
                    <RowCheckbox
                      checked={selected.includes(v.id)}
                      onChange={on => toggleOne(v.id, on)}
                    />
                  </td>
                  <td>
                    <div className="fleet-table__id">{v.plate || v.registration || '—'}</div>
                    {formatLastSeen(v)}
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={[v.make, v.model].filter(Boolean).join(' ')}>
                    {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td>
                    {v.vehicle_type_name || '—'}
                    {v.vehicle_type_capacity != null && (
                      <span style={{ marginLeft: 4, color: 'var(--text-tertiary)' }}>
                        · {v.vehicle_type_capacity}t
                      </span>
                    )}
                  </td>
                  <td>{getStatusBadge(v.status)}</td>
                  <td>
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
                  <td className="is-numeric">
                    {v.revenue_generated ? formatZAR(v.revenue_generated) : '—'}
                  </td>
                  <td className="is-numeric">
                    {v.total_trips ?? 0}
                  </td>
                  <td>
                    {v.fuel_efficiency_score ? `${parseFloat(v.fuel_efficiency_score as any).toFixed(0)}/100` : '—'}
                  </td>
                  <td className="fleet-table__actions">
                    <div>
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
                        style={{ background: 'none', border: '1px solid var(--status-danger)', color: 'var(--status-danger-text, var(--status-danger))', padding: '4px 12px', borderRadius: 6, cursor: isDemo ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', letterSpacing: 'normal', opacity: isDemo ? 0.5 : 1 }}
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
