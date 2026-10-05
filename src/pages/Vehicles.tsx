import './fleet-vehicles-brand.css';
import { formatDate, formatMoneyWhole, formatWeight, sentenceCaseLabel } from '@/lib/formatters';
import { SkeletonRows } from '@/components/fleet-detail/ContentSkeleton';
import StaleDataNotice from '@/components/data/StaleDataNotice';
import './table-heading-roles.css';
import { Plus, Truck as EmptyFleetIcon } from 'lucide-react';
import { useEffect, useState, useRef, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fleetMenuItems, useFleetPhoneHead } from '@/components/fleet-detail/fleetHead';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
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
import { capacityTonnes } from '@/components/fleet-detail/parts';
import { staleWork, staleLabel } from '@/lib/staleWork';
import { TablePager } from '@/components/ui/TablePager';

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
     Marked in use   status In use (a status, not work: the note says how
                     many are on a current order)
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
const TILE_LABEL: Record<TileKey, string> = { job: 'Marked in use', free: 'Available', shop: 'In maintenance' };

// The API sends amounts as decimal strings; coerce before formatting.
const formatZAR = (v: number | string | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? formatMoneyWhole(n) : '—';
};


const PAGE_SIZE = 20;

/** An open order as the Vehicles list sends it (core.services.vehicle_list). */
interface ActiveLoad {
  id: number; load_number?: string; status: string; vehicle: number;
  delivery_city?: string; delivery_location?: string; customer_name?: string; driver_name?: string | null;
  delivery_date?: string | null; pickup_date?: string | null; created_at?: string | null;
}
type FleetRow = Vehicle & { delivered_revenue?: number; delivered_loads?: number; active_load?: ActiveLoad | null; holding_open?: boolean };
interface FleetSummary {
  total: number; job: number; free: number; shop: number; out_of_service: number;
  job_no_order: number; free_on_order: number; shop_on_order: number; free_holding: number;
  delivered: { revenue: number; loads: number; no_vehicle_revenue: number; no_vehicle_loads: number };
}
interface FleetPage { count: number; results: FleetRow[]; summary: FleetSummary }

// One page of trucks, server-side: search, tile filter and the revenue
// order go to the API. Each row carries its open order and delivered work,
// and the list carries the tiles, so the page never loads every load.
function loadFleet(q: string, tile: FilterKey | null, page: number): Promise<FleetPage> {
  const params = new URLSearchParams({ view: 'fleet', page: String(page), page_size: String(PAGE_SIZE), sort: 'revenue' });
  if (q) params.set('search', q);
  if (tile) params.set('tile', tile);
  return fetchData(`api/v1/vehicles/?${params}`);
}

export default function Vehicles() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  // Shared public demo account — creation/edit/delete controls are fixed off,
  // viewing/filtering/search stay fully live.
  const isDemo = !!authUser?.is_demo;
  // ?tile=job|free|shop opens the list already filtered (Home's "vehicles idle" link).
  const [tileFilter, setTileFilter] = useState<FilterKey | null>(() => {
    const t = new URLSearchParams(window.location.search).get('tile');
    return t === 'job' || t === 'free' || t === 'shop' ? t : null;
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [page, setPage] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const phoneHead = useFleetPhoneHead();
  // Drivers' phone "⋯" ("Vehicles: import from Excel") sends the owner here with ?import=1.
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
    // Search, tile filter and page all go to the server.
    queryKey: ['vehicles-page', debouncedSearch, tileFilter, page],
    queryFn: () => loadFleet(debouncedSearch, tileFilter, page),
    // A new search keeps the current rows on screen until its results land
    // (no blank list while typing); the search box shows it's working.
    placeholderData: keepPreviousData,
  });
  const { data, refetch, dataUpdatedAt, isRefetchError } = fleetQuery;
  // Failed (or failing and retrying) with nothing to show: say so, never "No vehicles yet".
  const failed = loadFailed(fleetQuery);
  const loading = fleetQuery.isLoading && !failed;

  // This page of trucks (sorted by delivered revenue on the server); the
  // tiles count every truck matching the search.
  const rows: FleetRow[] = data?.results ?? [];
  const summary = data?.summary;
  const fleetTotal = summary?.total ?? 0;
  const matchCount = data?.count ?? rows.length;
  // A delete can empty the last page: step back to the new last page.
  useEffect(() => {
    if (data && page > 1 && (page - 1) * PAGE_SIZE >= data.count) setPage(Math.max(1, Math.ceil(data.count / PAGE_SIZE)));
  }, [data, page]);

  // Mirror the typed-search value into the debounced value (300ms) used by the query key.
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(val), 300);
  };

  useAutoRefresh(refetch);

  const activeLoadByVehicle: Record<number, ActiveLoad> = {};
  for (const v of rows) if (v.active_load) activeLoadByVehicle[v.id] = v.active_load;
  // Filtered (tile) and sorted (delivered revenue) on the server.
  const sorted = rows;

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

  // One amber mark per row (R7): a truck with an order left open carries the
  // amber stale dot, so its status chip reads neutral beside it.
  const getStatusBadge = (v: Vehicle) => (
    <StatusChip status={v.status} size="sm" tone={staleWork(activeLoadByVehicle[v.id]) ? 'neutral' : undefined} />
  );

  // Summary figures: only what changes a decision today (server-side, over
  // every truck matching the search).
  const onJobCount = summary?.job ?? 0;
  const freeCount = summary?.free ?? 0;
  const shopCount = summary?.shop ?? 0;
  const onJobNoOrder = summary?.job_no_order ?? 0;
  const freeOnOrder = summary?.free_on_order ?? 0;
  // Available but still holding an order left open (stale, src/lib/staleWork.ts):
  // not free to take a load in practice. The same count as Home's idle row
  // ("3 hold an order left open", overview/signals.ts idleSignal).
  const freeHolding = summary?.free_holding ?? 0;
  const holdingText = freeHolding === 0 ? '' : freeHolding === freeCount
    ? (freeHolding === 1 ? 'It holds an order left open' : 'All hold an order left open')
    : `${freeHolding} ${freeHolding === 1 ? 'holds' : 'hold'} an order left open`;
  const freeNoteText = !freeCount ? 'Every truck is busy' : [
    freeOnOrder > 0 ? `${freeOnOrder} on a current order` : '',
    holdingText,
  ].filter(Boolean).join(' · ') || 'Free to take a load';
  // Phones keep the short form ("3 left open", the rows' own words) so the
  // note never ends in an ellipsis; the full sentence is the tooltip.
  const freeNote = freeOnOrder === 0 && freeHolding > 0 && freeHolding < freeCount
    ? <span title={freeNoteText}>{freeHolding} <span className="fleet-kpi-long">{freeHolding === 1 ? 'holds' : 'hold'} an order </span>left open</span>
    : freeNoteText;
  const outOfService = summary?.out_of_service ?? 0;
  const shopOnOrder = summary?.shop_on_order ?? 0;
  const mismatchCount = onJobNoOrder + freeOnOrder + shopOnOrder;
  const deliveredRevenue = summary?.delivered.revenue ?? 0;
  const deliveredLoads = summary?.delivered.loads ?? 0;
  const noVehicleLoads = summary?.delivered.no_vehicle_loads ?? 0;
  const reviewing = tileFilter === 'mismatch';

  // What the truck is doing, from the open order that names it. A status that
  // the orders contradict is flagged calmly, never shown as normal.
  const doingNow = (v: Vehicle): ReactNode => {
    const l = activeLoadByVehicle[v.id];
    const driver = v.driver_name || l?.driver_name;
    const stale = staleWork(l);
    if (l && stale) {
      // Left open (R6 shared rule): not current work. Neutral text, one amber
      // dot, two lines; the order and its actions are on the truck's page.
      return <>
        <span className="fleet-doing--stale"><i className="fleet-doing__dot" aria-hidden="true" />{driver ? `${driver} · ` : ''}order left open</span>
        <span className="fleet-table__sub fleet-stale-sub">
          {staleLabel(stale).text}{' · '}
          <Link className="fleet-stale-link" to={`/bookings/${l.id}`} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} aria-label={`Open order ${l.load_number || ''}`.trim()}>Open order</Link>
        </span>
      </>;
    }
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
      ? <StatusChip tone="warning" size="sm" label="Marked in use · no current order" />
      : <span className="fleet-doing--mismatch">Marked in use · no current order</span>;
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
    onClick: () => { setTileFilter(f => (f === key ? null : key)); setPage(1); },
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
      {!failed && (loading || fleetTotal > 0) && (
        <KpiRow className="fleet-kpis fleet-kpis--filter">
          <KpiTile
            {...tileProps('job')}
            label="Marked in use"
            figure={loading ? skelFigure : <>{onJobCount}<span className="tw-kpi__of"> of {fleetTotal}</span></>}
            note={loading ? 'Loading' : !onJobCount ? 'None marked in use' : onJobNoOrder === onJobCount ? 'None on a current order' : onJobNoOrder > 0 ? `${onJobCount - onJobNoOrder} on a current order, ${onJobNoOrder} not` : 'All on a current order'}
          />
          <KpiTile
            {...tileProps('free')}
            label="Available"
            figure={loading ? skelFigure : freeCount}
            note={loading ? 'Loading' : freeNote}
          />
          <KpiTile
            {...tileProps('shop')}
            label="In maintenance"
            figure={loading ? skelFigure : shopCount}
            note={loading ? 'Loading' : shopCount ? (outOfService ? `${outOfService} out of service` : 'In the workshop') : 'None in the workshop'}
          />
          <KpiTile
            aria-label="Delivered revenue"
            label="Delivered revenue"
            aside={<InfoTip align="end">Order value of every delivered or invoiced load, all time: the same total as History and Reports. {noVehicleLoads > 0 ? `${noVehicleLoads} of them (${formatZAR(summary?.delivered.no_vehicle_revenue ?? 0)}) have no vehicle recorded, so they are in this total but in no row below.` : 'Every one has a vehicle, so the rows add up to it.'}</InfoTip>}
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
            <span className="fleet-review" title={[onJobNoOrder ? `${onJobNoOrder} marked in use with no current order` : '', freeOnOrder ? `${freeOnOrder} available but on a current order` : '', shopOnOrder ? `${shopOnOrder} in maintenance but on a current order` : ''].filter(Boolean).join(', ')}>
              <i className="fleet-review__dot" aria-hidden="true" />
              <span className="fleet-review__text">{mismatchCount} don’t match their orders</span>
              <button type="button" className="fleet-review__btn" aria-pressed={reviewing} onClick={() => { setTileFilter(f => (f === 'mismatch' ? null : 'mismatch')); setPage(1); }}>
                {reviewing ? 'Show all' : 'Review'}
              </button>
            </span>
          )}
          <span className="fleet-toolbar__count" aria-live="polite">
            {/* A non-empty line while loading, so the count never pushes the table down on phones. */}
            {loading ? 'Loading vehicles' : tileFilter ? (
              <>
                {matchCount} {tileFilter === 'mismatch' ? 'to review' : TILE_LABEL[tileFilter].toLowerCase()} of {fleetTotal}
                {tileFilter !== 'mismatch' && <button type="button" className="fleet-toolbar__clear" onClick={() => { setTileFilter(null); setPage(1); }}>Show all</button>}
              </>
            ) : `${fleetTotal} ${fleetTotal === 1 ? 'vehicle' : 'vehicles'}`}
          </span>
      </>}>
        <SearchInput
          aria-label="Search vehicles"
          busy={search !== debouncedSearch || (fleetQuery.isFetching && fleetQuery.isPlaceholderData)}
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
              fleetTotal === 0 && !debouncedSearch ? (
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
              const done = v.delivered_revenue ? { revenue: v.delivered_revenue, loads: v.delivered_loads ?? 0 } : undefined;
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
                    <span className="fleet-table__sub fleet-only-narrow">
                      {getStatusBadge(v)}
                      {staleWork(activeLoadByVehicle[v.id]) && (
                        <Link className="fleet-stale-narrow fleet-stale-link" to={`/bookings/${activeLoadByVehicle[v.id].id}`} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} aria-label={`Order left open: open ${activeLoadByVehicle[v.id].load_number || 'the order'}`}>
                          <i className="fleet-doing__dot" aria-hidden="true" />Left open
                        </Link>
                      )}
                    </span>
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
                  <td className="fleet-col-status">{getStatusBadge(v)}</td>
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
        <TablePager page={page} pageSize={PAGE_SIZE} count={matchCount} onPage={setPage}
          busy={fleetQuery.isFetching && fleetQuery.isPlaceholderData} />
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
