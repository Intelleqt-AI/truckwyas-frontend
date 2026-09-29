import './fleet-vehicles-brand.css';
import { fetchAllPages } from '@/components/insights/findings';
import { formatDate, formatMoneyWhole, formatWeight, sentenceCaseLabel } from '@/lib/formatters';
import { SkeletonRows } from '@/components/fleet-detail/ContentSkeleton';
import StaleDataNotice from '@/components/data/StaleDataNotice';
import './table-heading-roles.css';
import { Plus, Truck as EmptyFleetIcon } from 'lucide-react';
import { useEffect, useState, useRef, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fleetMenuItems, useFleetPhoneHead } from '@/components/fleet-detail/fleetHead';
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
import { StatusChip } from '@/components/ui/StatusChip';
import { KpiRow, KpiTile } from '@/components/ui/KpiTile';
import { Toolbar, SearchInput } from '@/components/ui/Toolbar';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import { rowLink } from '@/lib/rowLink';
import { DELIVERED } from '@/components/reports/data';
import { capacityTonnes } from '@/components/fleet-detail/parts';

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
  driver_name?: string | null;
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
// Column headings. The API's revenue_generated / total_trips are all-time
// sums over DELIVERED loads (see VehicleSerializer), so they are labelled as
// such rather than "MTD". Health is the rule-based composite score
// (maintenance, uptime, fuel, age), not a model output, so it is not called AI.
// Make, model and type share one "Truck" column so Status and the money
// columns stay in view at laptop widths; Driver drops first when narrow.
// "Doing now" replaces the old Driver column (vehicle.driver is rarely set, so
// it read "Unassigned" on every row): it comes from the open order naming the
// truck, like the retired Fleet status page did.
const COLUMNS: { label: string; numeric?: boolean; cls?: string; tip?: ReactNode }[] = [
  { label: 'Registration' },
  { label: 'Truck', cls: 'fleet-col-phone' },
  { label: 'Doing now', cls: 'fleet-col-opt' },
  { label: 'Status', cls: 'fleet-col-status' },
  { label: 'Revenue', numeric: true },
  { label: 'Health', numeric: true, cls: 'fleet-col-opt2', tip: <>A rule-based score out of 100 from maintenance, uptime, fuel use and age. 80 or more is good, 60 to 79 fair, 40 to 59 low; below 40 needs action.</> },
  { label: '' },
];

// Open orders: the ones that put a truck and a driver on the road.
const ACTIVE_LOAD = ['ASSIGNED', 'LOADING', 'IN_TRANSIT'];
const SOON_DAYS = 30;
const DAY = 86_400_000;
const daysUntil = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / DAY);
};

/* Status tiles double as the list filter. Definitions (shared with Home's
   "Vehicles idle" note, which counts status Available):
     On a job        status In use
     Available       status Available (or Active)
     In maintenance  status Maintenance or Out of service */
type TileKey = 'job' | 'free' | 'shop';
/** Tiles, plus the "status doesn't match the orders" review filter. */
type FilterKey = TileKey | 'mismatch';
const TILE_MATCH: Record<TileKey, (s: string) => boolean> = {
  job: s => s === 'IN_USE',
  free: s => s === 'AVAILABLE' || s === 'ACTIVE',
  shop: s => s === 'MAINTENANCE' || s === 'OUT_OF_SERVICE',
};
const TILE_LABEL: Record<TileKey, string> = { job: 'On a job', free: 'Available', shop: 'In maintenance' };

// The API sends amounts as decimal strings; coerce before formatting.
const formatZAR = (v: number | string | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? formatMoneyWhole(n) : '—';
};


// Fetches all fleet data + derives lists. Lives in the queryFn so the result is
// cached by TanStack Query (keyed by search below) and survives navigation —
// revisiting the page no longer refires these requests until the cache goes stale.
async function loadFleet(q: string) {
  const vehiclesUrl = q
    ? `api/v1/vehicles/?search=${encodeURIComponent(q)}`
    : 'api/v1/vehicles/';
  const [vehData, overviewData, insightsData, vtData, driverData, loadRows] = await Promise.all([
    // Every page (the API returns 20 at a time), so "of 23" matches Insights.
    fetchAllPages<Vehicle>(vehiclesUrl).then(r => r.rows),
    fetchData('api/v1/fleet/overview/'),
    fetchData('api/v1/fleet/intelligence/'),
    fetchData('api/v1/vehicle-types/'),
    fetchData('api/v1/drivers/'),
    // Every load, so "Doing now" can name the open order for each truck.
    fetchAllPages<any>('api/v1/loads/').then(r => r.rows).catch(() => [] as any[]),
  ]);

  const vehicles: Vehicle[] = vehData;

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

  const activeLoadByVehicle: Record<number, any> = {};
  for (const l of loadRows) if (l.vehicle != null && ACTIVE_LOAD.includes(l.status)) activeLoadByVehicle[l.vehicle] = l;

  // Delivered work on the Reports definition (delivered, invoiced, completed,
  // paid), from every load: the same total as History and Reports. Rows show
  // each truck's share; loads with no vehicle recorded belong to no row.
  const delivered = { revenue: 0, loads: 0, noVehicleRevenue: 0, noVehicleLoads: 0 };
  const deliveredByVehicle: Record<number, { revenue: number; loads: number }> = {};
  for (const l of loadRows) {
    if (!DELIVERED.has(String(l.status || '').toUpperCase())) continue;
    const amt = Number(l.total_amount) || 0;
    delivered.revenue += amt; delivered.loads += 1;
    if (l.vehicle == null) { delivered.noVehicleRevenue += amt; delivered.noVehicleLoads += 1; continue; }
    const row = deliveredByVehicle[l.vehicle] ?? (deliveredByVehicle[l.vehicle] = { revenue: 0, loads: 0 });
    row.revenue += amt; row.loads += 1;
  }

  return { vehicles, overview, insights, vehicleTypes, drivers, activeLoadByVehicle, delivered, deliveredByVehicle };
}

export default function Vehicles() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  // Shared public demo account — creation/edit/delete controls are fixed off,
  // viewing/filtering/search stay fully live.
  const isDemo = !!authUser?.is_demo;
  const [tileFilter, setTileFilter] = useState<FilterKey | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [sortBy, setSortBy] = useState('revenue');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const phoneHead = useFleetPhoneHead();
  // Drivers' phone "⋯" sends "Import vehicles from Excel" here with ?import=1.
  const [importParams, setImportParams] = useSearchParams();
  useEffect(() => {
    if (importParams.get('import') !== '1') return;
    const next = new URLSearchParams(importParams); next.delete('import');
    setImportParams(next, { replace: true });
    if (!isDemo) setShowImport(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importParams]);
  const [selected, setSelected] = useState<number[]>([]);
  const toggleOne = (id: number, on: boolean) =>
    setSelected(prev => (on ? [...prev, id] : prev.filter(x => x !== id)));
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [confirmOpts, setConfirmOpts] = useState<{
    title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);

  const fleetQuery = useQuery({
    // search drives the vehicles fetch URL (server-side search), so it must be
    // part of the key — the tile filter / sortBy are applied client-side in render.
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
  const activeLoadByVehicle = data?.activeLoadByVehicle ?? {};
  const deliveredByVehicle = data?.deliveredByVehicle ?? {};
  const revenueOf = (v: Vehicle) => deliveredByVehicle[v.id]?.revenue ?? 0;
  // A status the open orders contradict: on a job with no order, or free / in the workshop while on one.
  const mismatch = (v: Vehicle) => (activeLoadByVehicle[v.id] != null) !== TILE_MATCH.job(v.status);
  const filtered = tileFilter === 'mismatch' ? vehicles.filter(mismatch) : tileFilter ? vehicles.filter(v => TILE_MATCH[tileFilter](v.status)) : vehicles;

  // Sort vehicles
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'revenue') {
      return revenueOf(b) - revenueOf(a);
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
      <span className="fleet-table__sub" style={{ color: isStale ? 'var(--text-tertiary)' : 'var(--status-success-text)' }}>
        {isStale ? `Seen ${label}` : `Live, ${label}`}
      </span>
    );
  };

  const getStatusBadge = (status: string) => (
    <StatusChip status={status} size="sm" />
  );

  // Summary figures: only what changes a decision today.
  const onJob = vehicles.filter(v => TILE_MATCH.job(v.status));
  const free = vehicles.filter(v => TILE_MATCH.free(v.status));
  const shop = vehicles.filter(v => TILE_MATCH.shop(v.status));
  const hasOrder = (v: Vehicle) => activeLoadByVehicle[v.id] != null;
  const onJobNoOrder = onJob.filter(v => !hasOrder(v)).length;
  const freeOnOrder = free.filter(hasOrder).length;
  const outOfService = shop.filter(v => v.status === 'OUT_OF_SERVICE').length;
  const shopOnOrder = shop.filter(hasOrder).length;
  const mismatchCount = onJobNoOrder + freeOnOrder + shopOnOrder;
  const deliveredRevenue = data?.delivered.revenue ?? 0;
  const deliveredLoads = data?.delivered.loads ?? 0;
  const noVehicleLoads = data?.delivered.noVehicleLoads ?? 0;
  const reviewing = tileFilter === 'mismatch';

  // What the truck is doing, from the open order that names it. A status that
  // the orders contradict is flagged calmly, never shown as normal.
  const doingNow = (v: Vehicle): ReactNode => {
    const l = activeLoadByVehicle[v.id];
    const driver = v.driver_name || l?.driver_name;
    if (l) {
      const to = l.delivery_city || l.delivery_location;
      const sub = [to ? `to ${to}` : '', l.customer_name].filter(Boolean).join(' · ');
      if (!TILE_MATCH.job(v.status)) {
        // Status and orders disagree: worded as a mismatch in neutral text;
        // amber only while the owner is reviewing these rows.
        const as = TILE_MATCH.shop(v.status) ? 'In maintenance' : 'Marked available';
        const text = `${as} · on ${l.load_number || 'an open order'}`;
        return <>{reviewing ? <StatusChip tone="warning" size="sm" label={text} /> : <span className="fleet-doing--mismatch">{text}</span>}{sub && <span className="fleet-table__sub">{sub}</span>}</>;
      }
      return <>
        <span className={driver ? 'is-primary' : 'fleet-doing--mismatch'}>{driver || 'No driver on the order'}</span>
        {sub && <span className="fleet-table__sub">{sub}</span>}
      </>;
    }
    if (TILE_MATCH.job(v.status)) return reviewing
      ? <StatusChip tone="warning" size="sm" label="On a job · no open order" />
      : <span className="fleet-doing--mismatch">On a job · no open order</span>;
    if (TILE_MATCH.shop(v.status)) return <span>{v.status === 'OUT_OF_SERVICE' ? 'Out of service' : v.last_maintenance_date ? `In the workshop since ${formatDate(v.last_maintenance_date)}` : 'In the workshop'}</span>;
    if (TILE_MATCH.free(v.status)) return <span>{driver ? `Free, ${driver} assigned` : 'Free'}</span>;
    return <span>—</span>;
  };

  // A registration or insurance renewal due within 30 days, or already past.
  const renewal = (v: Vehicle) => {
    const due = ([['Licence disc', v.registration_expiry], ['Insurance', v.insurance_expiry]] as const)
      .map(([what, iso]) => ({ what, d: daysUntil(iso) }))
      .filter((x): x is { what: 'Licence disc' | 'Insurance'; d: number } => x.d != null && x.d <= SOON_DAYS)
      .sort((a, b) => a.d - b.d)[0];
    if (!due) return null;
    const txt = due.d < 0 ? `${due.what} expired` : due.d === 0 ? `${due.what} expires today` : `${due.what} due in ${due.d} ${due.d === 1 ? 'day' : 'days'}`;
    return <span className="fleet-table__sub fleet-table__sub--warn">{txt}</span>;
  };

  const healthCell = (score?: number) => {
    if (!score) return '—';
    const n = Math.round(score);
    // "Low" is a neutral word; colour only below the action threshold (40), as on the vehicle page.
    return (
      <span className="fleet-health" title={`${n} out of 100`}>
        {n < 60 && <span className={`fleet-health__low${n < 40 ? ' is-action' : ''}`}>{n < 40 ? 'Needs action' : 'Low'}</span>}
        <span className="fleet-health__track" aria-hidden="true"><span className={`fleet-health__fill${n < 40 ? ' is-low' : ''}`} style={{ width: `${Math.min(100, n)}%` }} /></span>
        <span className="fleet-health__n">{n}</span>
      </span>
    );
  };

  const tileProps = (key: TileKey) => ({
    onClick: () => setTileFilter(f => (f === key ? null : key)),
    className: tileFilter === key ? 'is-selected' : undefined,
    'aria-label': `${TILE_LABEL[key]}: ${tileFilter === key ? 'showing only these, press to show all' : 'show only these'}`,
  });
  const skelFigure = <span className="ops-skel" style={{ display: 'inline-block', width: 96, height: 28 }} />;

  return (
    <div className="fleet-page">
      <SectionHeader
        eyebrow="Fleet"
        title="Fleet"
        tabs={FLEET_TABS}
        menuItems={fleetMenuItems({ phone: phoneHead, openActivity: () => navigate('/fleet/heatmap'), openImport: () => setShowImport(true), importDisabled: isDemo })}
        actions={<>
          <button data-fleet-control className="fleet-header-secondary" onClick={() => navigate('/fleet/heatmap')}>Activity</button>
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
          ><Plus size={16} aria-hidden="true" /> Add vehicle</button>
        </>}
      />
      <StaleDataNotice updatedAt={dataUpdatedAt} refreshFailed={isRefetchError} onRetry={() => refetch()} />

      {/* Fleet summary: separate tiles, same geometry as Drivers so switching
          tabs never moves the page. Hidden when there is no fleet yet; the
          table's empty state carries the next action instead of zeros. */}
      {!failed && (loading || vehicles.length > 0) && (
        <KpiRow className="fleet-kpis fleet-kpis--filter">
          <KpiTile
            {...tileProps('job')}
            label="On a job"
            figure={loading ? skelFigure : <>{onJob.length}<span className="tw-kpi__of"> of {vehicles.length}</span></>}
            note={loading ? 'Loading' : onJobNoOrder > 0 ? `${onJobNoOrder} with no open order` : onJob.length ? 'All on an open order' : 'No truck is out'}
          />
          <KpiTile
            {...tileProps('free')}
            label="Available"
            figure={loading ? skelFigure : free.length}
            note={loading ? 'Loading' : freeOnOrder > 0 ? `${freeOnOrder} on an open order` : free.length ? 'Free to take a load' : 'Every truck is busy'}
          />
          <KpiTile
            {...tileProps('shop')}
            label="In maintenance"
            figure={loading ? skelFigure : shop.length}
            note={loading ? 'Loading' : shop.length ? (outOfService ? `${outOfService} out of service` : 'In the workshop') : 'None in the workshop'}
          />
          <KpiTile
            aria-label="Delivered revenue"
            label="Delivered revenue"
            aside={<InfoTip align="end">Order value of every delivered or invoiced load, all time: the same total as History and Reports. {noVehicleLoads > 0 ? `${noVehicleLoads} of them (${formatZAR(data?.delivered.noVehicleRevenue ?? 0)}) have no vehicle recorded, so they are in this total but in no row below.` : 'Every one has a vehicle, so the rows add up to it.'}</InfoTip>}
            figure={loading ? skelFigure : formatZAR(deliveredRevenue)}
            note={loading ? 'Loading' : `${deliveredLoads} ${deliveredLoads === 1 ? 'load' : 'loads'}${noVehicleLoads ? ` · ${noVehicleLoads} no truck` : ', all time'}`}
          />
        </KpiRow>
      )}

      {/* Search + status filter toolbar */}
      <Toolbar className="fleet-toolbar" end={<>
          {/* One calm flag for every status the open orders contradict; it
              filters the list. It lives in the toolbar row (reserved while
              loading), so it never pushes the table down when it arrives. */}
          {!loading && !failed && mismatchCount > 0 && (
            <span className="fleet-review" title={[onJobNoOrder ? `${onJobNoOrder} on a job with no open order` : '', freeOnOrder ? `${freeOnOrder} available but on an open order` : '', shopOnOrder ? `${shopOnOrder} in maintenance but on an open order` : ''].filter(Boolean).join(', ')}>
              <i className="fleet-review__dot" aria-hidden="true" />
              <span className="fleet-review__text">{mismatchCount} don’t match their orders</span>
              <button type="button" className="fleet-review__btn" aria-pressed={reviewing} onClick={() => setTileFilter(f => (f === 'mismatch' ? null : 'mismatch'))}>
                {reviewing ? 'Show all' : 'Review'}
              </button>
            </span>
          )}
          <span className="fleet-toolbar__count" aria-live="polite">
            {/* A non-empty line while loading, so the count never pushes the table down on phones. */}
            {loading ? 'Loading vehicles' : tileFilter ? (
              <>
                {sorted.length} {tileFilter === 'mismatch' ? 'to review' : TILE_LABEL[tileFilter].toLowerCase()} of {vehicles.length}
                {tileFilter !== 'mismatch' && <button type="button" className="fleet-toolbar__clear" onClick={() => setTileFilter(null)}>Show all</button>}
              </>
            ) : `${vehicles.length} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'}`}
          </span>
      </>}>
        <SearchInput
          aria-label="Search vehicles"
          placeholder="Search VIN, plate, make or model"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
        />
      </Toolbar>

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
                <th key={c.label || 'actions'} className={[c.numeric ? 'is-numeric' : '', c.cls ?? ''].filter(Boolean).join(' ') || undefined}>
                  {c.tip ? <span className="fleet-th-tip">{c.label}<InfoTip label="What the health score means" align="end">{c.tip}</InfoTip></span> : c.label || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows rows={10} cols={COLUMNS.length + 1} skipFirst />
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
              const tonnes = capacityTonnes(v);
              const done = deliveredByVehicle[v.id];
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
                    {renewal(v)}
                    {/* Phone: the Status column steps aside so Revenue stays in view; the chip rides here. */}
                    <span className="fleet-table__sub fleet-only-narrow">{getStatusBadge(v.status)}</span>
                  </td>
                  <td className="is-primary fleet-col-truck fleet-col-phone" title={[vehicleName, v.vehicle_type_name, tonnes ? formatWeight(tonnes) : ''].filter(Boolean).join(', ')}>
                    {vehicleName || 'Not recorded'}
                    {(v.vehicle_type_name || tonnes) && (
                      <span className="fleet-table__sub">
                        {[v.vehicle_type_name ? sentenceCaseLabel(v.vehicle_type_name) : '', tonnes ? formatWeight(tonnes) : ''].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="fleet-col-opt fleet-col-doing">{doingNow(v)}</td>
                  <td className="fleet-col-status">{getStatusBadge(v.status)}</td>
                  <td className="is-numeric" style={{ color: done?.revenue ? 'var(--text-primary)' : undefined }}>
                    {done?.revenue ? <>
                      {formatZAR(done.revenue)}
                      <span className="fleet-table__sub">{done.loads} {done.loads === 1 ? 'load' : 'loads'}</span>
                    </> : '—'}
                  </td>
                  <td className="is-numeric fleet-col-opt2">
                    {healthCell(v.ai_health_score)}
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
