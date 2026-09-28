import './fleet-vehicles-brand.css';
import StaleDataNotice from '@/components/data/StaleDataNotice';
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
import { useAuth } from '@/lib/AuthContext';
import RowActions from '@/components/ui/RowActions';
import { InfoTip } from '@/components/ui/InfoTip';
import './ops-tiles.css';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import { rowLink } from '@/lib/rowLink';

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

// Status chip tone. Colour always sits next to the status word.
const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  AVAILABLE: 'success',
  IN_USE: 'info',
  MAINTENANCE: 'warning',
  INACTIVE: 'neutral',
  OUT_OF_SERVICE: 'neutral',
};

// Column headings. The API's revenue_generated / total_trips are all-time
// sums over DELIVERED loads (see VehicleSerializer), so they are labelled as
// such rather than "MTD". Health is the rule-based composite score
// (maintenance, uptime, fuel, age), not a model output, so it is not called AI.
const COLUMNS: { label: string; numeric?: boolean }[] = [
  { label: 'Registration' },
  { label: 'Make and model' },
  { label: 'Type' },
  { label: 'Driver' },
  { label: 'Status' },
  { label: 'Delivered revenue', numeric: true },
  { label: 'Delivered loads', numeric: true },
  { label: 'Health score', numeric: true },
  { label: '' },
];

// The API sends amounts as decimal strings; coerce before formatting.
const formatZAR = (v: number | string | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—';
};

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

  const fleetQuery = useQuery({
    // search drives the vehicles fetch URL (server-side search), so it must be
    // part of the key — statusFilter / sortBy are applied client-side in render.
    queryKey: ['vehicles-page', debouncedSearch],
    queryFn: () => loadFleet(debouncedSearch),
  });
  const { data, refetch, dataUpdatedAt, isRefetchError } = fleetQuery;
  // Failed (or failing and retrying) with nothing to show: say so, never "No vehicles yet".
  const failed = loadFailed(fleetQuery);
  const loading = fleetQuery.isLoading && !failed;

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
      <span className="fleet-table__sub" style={{ color: isStale ? 'var(--text-tertiary)' : 'var(--status-success-text, var(--status-success))' }}>
        {isStale ? `Seen ${label}` : `Live, ${label}`}
      </span>
    );
  };

  const getStatusBadge = (status: string) => (
    <span className={`fleet-chip fleet-chip--${STATUS_TONE[status] || 'neutral'}`}>{formatStatus(status)}</span>
  );

  // Summary figures: only what changes a decision today.
  const readyCount = vehicles.filter(v => v.status === 'AVAILABLE' || v.status === 'ACTIVE').length;
  const onJobCount = vehicles.filter(v => v.status === 'IN_USE').length;
  const maintenanceCount = vehicles.filter(v => v.status === 'MAINTENANCE').length;
  const deliveredRevenue = vehicles.reduce((sum, v) => sum + (Number(v.revenue_generated) || 0), 0);
  const deliveredLoads = vehicles.reduce((sum, v) => sum + (Number(v.total_trips) || 0), 0);
  const notEarning = vehicles.filter(v => !Number(v.total_trips)).length;

  return (
    <div className="fleet-page">
      <SectionHeader
        eyebrow="Fleet"
        title="Fleet"
        tabs={FLEET_TABS}
        actions={<>
          <button data-fleet-control className="fleet-header-secondary" onClick={() => navigate('/fleet/heatmap')}>Activity heatmap</button>
          <button data-fleet-control
            className="fleet-header-secondary"
            onClick={() => setShowImport(true)}
            disabled={isDemo}
            title={isDemo ? 'Fixed in demo mode' : 'Paste a fleet list from Excel'}
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
      <StaleDataNotice updatedAt={dataUpdatedAt} refreshFailed={isRefetchError} onRetry={() => refetch()} />

      {/* Fleet summary: separate tiles, same geometry as Drivers so switching
          tabs never moves the page. Hidden when there is no fleet yet; the
          table's empty state carries the next action instead of zeros. */}
      {!failed && (loading || vehicles.length > 0) && (
        <section className="ops-tiles" aria-label="Fleet summary" aria-busy={loading}>
          <div className="ops-tile">
            <h2 className="ops-tile__label">Available now</h2>
            <div className="ops-tile__value">{loading ? '—' : readyCount}{!loading && <span className="ops-tile__of">of {vehicles.length}</span>}</div>
            <div className="ops-tile__sub" title={`${onJobCount} on a job, ${maintenanceCount} in maintenance`}>{loading ? 'Loading' : `${onJobCount} on a job, ${maintenanceCount} in maintenance`}</div>
          </div>
          <div className="ops-tile">
            <h2 className="ops-tile__label">
              Delivered revenue
              <InfoTip>Value of delivered loads per vehicle, summed across the fleet. All time.</InfoTip>
            </h2>
            <div className="ops-tile__value">{loading ? '—' : formatZAR(deliveredRevenue)}</div>
            <div className="ops-tile__sub">{loading ? 'Loading' : `${deliveredLoads} ${deliveredLoads === 1 ? 'load' : 'loads'}, all time`}</div>
          </div>
          <div className="ops-tile">
            <h2 className="ops-tile__label">Not earning yet</h2>
            <div className="ops-tile__value">{loading ? '—' : notEarning}{!loading && <span className="ops-tile__of">of {vehicles.length}</span>}</div>
            <div className="ops-tile__sub">{loading ? 'Loading' : notEarning > 0 ? 'No delivered load yet' : 'Every vehicle has earned'}</div>
          </div>
        </section>
      )}

      {/* Search + status filter toolbar */}
      <div className="fleet-toolbar">
        <input data-fleet-control
          type="text"
          aria-label="Search vehicles"
          placeholder="Search VIN, plate, make or model"
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
      {failed ? (
        <LoadError
          what="vehicles"
          error={fleetQuery.error ?? fleetQuery.failureReason}
          busy={fleetQuery.isFetching}
          onRetry={() => refetch()}
        />
      ) : (
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
              {COLUMNS.map(c => (
                <th key={c.label || 'actions'} className={c.numeric ? 'is-numeric' : undefined}>
                  {c.label || <span className="sr-only">Actions</span>}
                </th>
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
                        className="fleet-header-secondary"
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
            ) : sorted.map((v) => {
              const vehicleName = [v.make, v.model].filter(Boolean).join(' ');
              const lastSeen = formatLastSeen(v);
              return (
                <tr
                  key={v.id}
                  className="is-clickable"
                  {...rowLink(() => navigate(`/fleet/vehicles/${v.id}`))}
                  onClick={() => navigate(`/fleet/vehicles/${v.id}`)}
                >
                  <td className="fleet-table__select">
                    <RowCheckbox
                      checked={selected.includes(v.id)}
                      onChange={on => toggleOne(v.id, on)}
                    />
                  </td>
                  <td>
                    <span className="fleet-table__id">{v.plate || v.registration || '—'}</span>
                    {lastSeen}
                  </td>
                  <td className="is-primary" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={vehicleName}>
                    {vehicleName || '—'}
                  </td>
                  <td>
                    {v.vehicle_type_name || '—'}
                    {v.vehicle_type_capacity != null && (
                      <span style={{ marginLeft: 4, color: 'var(--text-tertiary)' }}>
                        · {v.vehicle_type_capacity}t
                      </span>
                    )}
                  </td>
                  <td>{(v as any).driver_name || <span style={{ color: 'var(--text-tertiary)' }}>Unassigned</span>}</td>
                  <td>{getStatusBadge(v.status)}</td>
                  <td className="is-numeric" style={{ color: v.revenue_generated ? 'var(--text-primary)' : undefined }}>
                    {v.revenue_generated ? formatZAR(v.revenue_generated) : '—'}
                  </td>
                  <td className="is-numeric">
                    {v.total_trips ?? 0}
                  </td>
                  <td className="is-numeric" title="Composite of maintenance, uptime, fuel and age scores">
                    {v.ai_health_score ? Math.round(v.ai_health_score) : '—'}
                  </td>
                  <td className="fleet-table__actions">
                    <RowActions
                      label={v.plate || v.registration || 'vehicle'}
                      items={[
                        { label: 'Edit', onSelect: () => setEditVehicle(v), disabled: isDemo, title: isDemo ? 'Fixed in demo mode' : undefined },
                        {
                          label: 'Delete',
                          danger: true,
                          disabled: isDemo, title: isDemo ? 'Fixed in demo mode' : undefined,
                          onSelect: () => setConfirmOpts({
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
                          }),
                        },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

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
