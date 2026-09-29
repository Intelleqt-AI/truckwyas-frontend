import './fleet-vehicles-brand.css';
import { fetchAllPages } from '@/components/insights/findings';
import { formatDate, formatMoneyWhole } from '@/lib/formatters';
import { SkeletonRows } from '@/components/fleet-detail/ContentSkeleton';
import { localDateISO } from '@/lib/dates';
import StaleDataNotice from '@/components/data/StaleDataNotice';
import './table-heading-roles.css';
import { Plus, UserRound as EmptyDriversIcon } from 'lucide-react';
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from '@tanstack/react-query';
import { fetchData, postData, patchData, deleteData } from '../lib/Api';
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/Loader';
import SectionHeader, { FLEET_TABS } from '@/components/layout/SectionHeader';
import { useAuth } from '@/lib/AuthContext';
import RowActions from '@/components/ui/RowActions';
import { InfoTip } from '@/components/ui/InfoTip';
import './ops-tiles.css';
import { StatusChip } from '@/components/ui/StatusChip';
import { Segmented } from '@/components/ui/Segmented';
import { Toolbar, SearchInput } from '@/components/ui/Toolbar';
import { KpiRow, KpiTile } from '@/components/ui/KpiTile';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import { rowLink } from '@/lib/rowLink';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';

interface Driver {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  status: string;
  total_trips?: number;
  revenue_generated?: number | string; // API sends a decimal string
  efficiency_score?: number;
  phone?: string;
  license_number?: string;
  license_expiry?: string;
  license_state?: string;
  medical_card_expiry?: string;
  hire_date?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  user_details?: {
    id: number;
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
}

interface DriverOverview {
  total_drivers: number;
  active_drivers: number;
  avg_revenue_per_driver: number;
}

interface LeaderboardEntry {
  driver_id: number;
  driver_name: string;
  revenue: number;
  trips: number;
  efficiency_score: number;
  rank: number;
}

// total_trips is the all-time count of delivered or invoiced loads
// (DriverSerializer.get_total_trips), so it is not labelled "MTD".
const NUMERIC_COLUMNS = new Set(['Completed loads', 'Revenue']);
// Column priority: Name and Status always show; the rest drop as the card narrows.
const DRIVER_COL_CLASS: Record<string, string> = { Licence: 'fleet-col-opt', 'Licence expires': 'fleet-col-phone', 'Completed loads': 'fleet-col-phone', Efficiency: 'fleet-col-opt2' };

const DAY_MS = 24 * 60 * 60 * 1000;
const formatDay = (iso?: string) =>
  iso ? formatDate(iso) : '—';

// The API sends amounts as decimal strings; coerce before formatting.
const formatZAR = (v: number | string | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? formatMoneyWhole(n) : '—';
};

// Sentence-case a status token for display: "ON_LEAVE" → "On leave".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

const getDriverName = (d: Driver) => {
  if (d.first_name && d.last_name) return `${d.first_name} ${d.last_name}`;
  if (d.name) return d.name;
  if (d.first_name) return d.first_name;
  return `Driver ${d.id}`;
};

export default function Drivers() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  // Shared public demo account — creation/edit/delete controls are fixed off,
  // viewing/filtering/search stay fully live.
  const isDemo = !!authUser?.is_demo;
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  // Only what's actually required to create a usable driver record, plus a
  // couple of clearly useful extras (phone/email for contact). Address,
  // medical card expiry, emergency contact, and vehicle assignment are all
  // still editable afterward from the Edit Driver panel — deferring them here
  // keeps this form from asking for everything up front.
  const [addForm, setAddForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    license_number: '', license_expiry: '', license_state: 'GP',
    hire_date: localDateISO(), status: 'ACTIVE',
  });
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  // Slide-outs: focus moves in, Tab stays inside, focus returns on close.
  useFocusTrap(latestModal, showAddForm);
  useFocusTrap(latestModal, !!editDriver);
  const [editForm, setEditForm] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmOpts, setConfirmOpts] = useState<{
    title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);

  // Debounce search into the queryKey so typing doesn't refire on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const didMountDrivers = useRef(false);
  useEffect(() => {
    if (!didMountDrivers.current) { didMountDrivers.current = true; setDebouncedSearch(search); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const driversQuery = useQuery({
    queryKey: ['drivers-page', debouncedSearch],
    queryFn: async () => {
      const q = debouncedSearch;
      const driversUrl = q
        ? `api/v1/drivers/?search=${encodeURIComponent(q)}`
        : 'api/v1/drivers/';
      const [driversData, overviewData, leaderboardData, vehicleData] = await Promise.all([
        fetchAllPages<any>(driversUrl).then(r => r.rows),
        fetchData('api/v1/drivers/overview/').catch(() => null),
        fetchData('api/v1/drivers/leaderboard/').catch(() => null),
        fetchAllPages<any>('api/v1/vehicles/').then(r => r.rows).catch(() => null),
      ]);

      const vehicleList = Array.isArray(vehicleData) ? vehicleData : (vehicleData?.results || []);
      const vehicles = vehicleList.map((v: any) => ({
        id: v.id,
        plate: v.plate || v.registration || `Vehicle ${v.id}`,
        make: v.make,
        model: v.model,
        driver_id: v.driver ?? null,
      }));
      const driverList: any[] = driversData;

      // Parse leaderboard data
      const lbData = Array.isArray(leaderboardData) ? leaderboardData : (leaderboardData?.data || []);
      const leaderboardEntries = lbData.map((d: any, i: number) => ({
        driver_id: d.id || d.driver_id || i,
        driver_name: d.driver_name || d.name || `Driver ${d.id}`,
        revenue: d.revenue || d.revenue_generated || 0,
        trips: d.trips || d.trips_completed || 0,
        efficiency_score: d.efficiency_score || d.on_time_percentage || 0,
        rank: d.rank || i + 1,
      }));

      // Flatten user_details into driver and merge leaderboard data
      const drivers = driverList.map((driver: any) => {
        const ud = driver.user_details || {};
        const flattened: Driver = {
          ...driver,
          first_name: driver.first_name || ud.first_name || '',
          last_name: driver.last_name || ud.last_name || '',
          name: driver.name || ud.name || (ud.first_name ? `${ud.first_name} ${ud.last_name || ''}`.trim() : ''),
          phone: driver.phone || ud.phone || '',
        };
        const leaderboardEntry = leaderboardEntries.find((lb: LeaderboardEntry) => lb.driver_id === driver.id);
        if (leaderboardEntry && !flattened.efficiency_score) {
          return { ...flattened, efficiency_score: leaderboardEntry.efficiency_score };
        }
        return flattened;
      });

      let overview: DriverOverview;
      if (overviewData?.kpi_cards) {
        const cards = overviewData.kpi_cards as any[];
        const findVal = (kw: string) => {
          const c = cards.find((c: any) => (c.key || c.label || '').toString().toLowerCase().includes(kw));
          return parseFloat(c?.value) || 0;
        };
        overview = {
          total_drivers: findVal('total') || driverList.length,
          active_drivers: findVal('active') || driverList.filter((d: any) => d.status === 'ACTIVE').length,
          avg_revenue_per_driver: findVal('revenue') || findVal('avg') || 0,
        };
      } else if (overviewData) {
        overview = overviewData;
      } else {
        overview = {
          total_drivers: driverList.length,
          active_drivers: driverList.filter((d: any) => d.status === 'ACTIVE').length,
          avg_revenue_per_driver: 0,
        };
      }

      return { drivers, vehicles, overview, leaderboard: leaderboardEntries };
    },
  });
  const { data, refetch, dataUpdatedAt, isRefetchError } = driversQuery;
  // Failed (or failing and retrying) with nothing to show: say so, never "No drivers yet".
  const failed = loadFailed(driversQuery);
  const loading = driversQuery.isLoading && !failed;

  const drivers: Driver[] = data?.drivers ?? [];

  // Opens the Edit panel for one driver (row menu, or ?edit=<id> from the driver page).
  const openEdit = (d: Driver) => {
    setEditDriver(d);
    const dUd: any = d.user_details || {};
    setEditForm({
      first_name: d.first_name || '',
      last_name: d.last_name || '',
      email: dUd.email || '',
      phone: dUd.phone || '',
      address: dUd.address || '',
      license_number: d.license_number || '',
      license_expiry: d.license_expiry || '',
      medical_card_expiry: d.medical_card_expiry || '',
      hire_date: d.hire_date || '',
      status: d.status || 'ACTIVE',
      license_state: d.license_state || 'GP',
      emergency_contact: d.emergency_contact || d.emergency_phone || '',
      vehicle: vehicles.find(v => v.driver_id === d.id)?.id?.toString() ?? '',
    });
  };

  // The driver page's "Add" and "Assign" rows land here with ?edit=<id>:
  // open that driver's Edit panel, and go back to their page when it closes.
  const [searchParams, setSearchParams] = useSearchParams();
  const [returnTo, setReturnTo] = useState<string | null>(null);
  useEffect(() => {
    const want = Number(searchParams.get('edit'));
    if (!want || !data) return;
    const d = drivers.find(x => x.id === want);
    const next = new URLSearchParams(searchParams); next.delete('edit');
    setSearchParams(next, { replace: true });
    if (d && !isDemo) { openEdit(d); setReturnTo(`/fleet/drivers/${d.id}`); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, data]);
  useEffect(() => {
    if (!editDriver && returnTo) { const to = returnTo; setReturnTo(null); navigate(to); }
  }, [editDriver, returnTo, navigate]);

  const vehicles: { id: number; plate: string; make?: string; model?: string; driver_id?: number | null }[] = data?.vehicles ?? [];
  const overview: DriverOverview | null = data?.overview ?? null;

  useAutoRefresh(refetch);

  const filtered = drivers.filter(d => statusFilter === 'All' || d.status === statusFilter);

  // Summary figures: availability, work done, and the next compliance date.
  const activeCount = overview?.active_drivers ?? drivers.filter(d => d.status === 'ACTIVE').length;
  const inactiveCount = drivers.filter(d => d.status === 'INACTIVE').length;
  const onLeaveCount = drivers.filter(d => d.status === 'ON_LEAVE').length;
  const completedLoads = drivers.reduce((sum, d) => sum + (Number(d.total_trips) || 0), 0);
  const now = Date.now();
  const withExpiry = drivers.filter(d => d.license_expiry).map(d => ({ d, t: new Date(d.license_expiry as string).getTime() }));
  const expired = withExpiry.filter(x => x.t < now);
  const nextRenewal = withExpiry.filter(x => x.t >= now).sort((a, b) => a.t - b.t)[0];
  // Renewals due in the next 90 days: a count the owner can act on (a date is not a KPI).
  const renewSoon = withExpiry.filter(x => x.t >= now && x.t - now <= 90 * DAY_MS).length;
  // Score and revenue columns only appear once the driver stats job has
  // produced them; a column of dashes answers nothing.
  const hasEfficiency = drivers.some(d => (d.efficiency_score || 0) > 0);
  const hasRevenue = drivers.some(d => Number(d.revenue_generated) > 0);
  const colCount = 6 + (hasEfficiency ? 1 : 0) + (hasRevenue ? 1 : 0);
  const availabilityNote = [
    inactiveCount ? `${inactiveCount} inactive` : '',
    onLeaveCount ? `${onLeaveCount} on leave` : '',
  ].filter(Boolean).join(', ');

  return (
    <div className="fleet-page">
      <SectionHeader
        eyebrow="Fleet"
        title="Fleet"
        tabs={FLEET_TABS}
        actions={
          <button data-fleet-control
            className="btn-action"
            onClick={() => setShowAddForm(true)}
            disabled={isDemo}
            title={isDemo ? 'Fixed in demo mode' : undefined}
            style={isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          ><Plus size={16} aria-hidden="true" /> Add driver</button>
        }
      />
      <StaleDataNotice updatedAt={dataUpdatedAt} refreshFailed={isRefetchError} onRetry={() => refetch()} />

      {/* Driver summary: separate tiles, same geometry as Vehicles so
          switching tabs never moves the page. Hidden when there are no drivers. */}
      {!failed && (loading || drivers.length > 0) && (
        <KpiRow className="fleet-kpis">
          <KpiTile
            aria-label="Active drivers"
            label="Active drivers"
            figure={loading ? <span className="ops-skel" style={{ display: 'inline-block', width: 96, height: 28 }} /> : <>{activeCount}<span className="tw-kpi__of"> of {overview?.total_drivers ?? drivers.length}</span></>}
            note={loading ? 'Loading' : availabilityNote ? availabilityNote.replace(/^./, c => c.toUpperCase()) : 'Everyone is active'}
          />
          <KpiTile
            aria-label="Completed loads"
            label="Completed loads"
            aside={<InfoTip>Loads delivered or invoiced with a driver recorded, all time. Delivered loads with no driver are not counted here.</InfoTip>}
            figure={loading ? <span className="ops-skel" style={{ display: 'inline-block', width: 96, height: 28 }} /> : completedLoads}
            note={loading ? 'Loading' : 'All time'}
          />
          {(() => {
            const hasExpired = expired.length > 0;
            const note = loading ? 'Loading'
              : hasExpired ? `${expired.slice(0, 2).map(x => getDriverName(x.d)).join(', ')}${expired.length > 2 ? ` and ${expired.length - 2} more` : ''}`
              : nextRenewal ? `Next: ${getDriverName(nextRenewal.d)}, in ${Math.ceil((nextRenewal.t - now) / DAY_MS)} days`
              : 'No expiry dates recorded';
            // Never a big zero: with nothing due in 90 days the tile names the
            // next renewal instead, and with no dates at all it is left out.
            if (!loading && !hasExpired && renewSoon === 0) {
              if (!nextRenewal) return null;
              const days = Math.ceil((nextRenewal.t - now) / DAY_MS);
              return (
                <KpiTile
                  aria-label="Next licence renewal"
                  label="Next licence renewal"
                  figure={<>{days}<span className="tw-kpi__of"> days</span></>}
                  note={`${getDriverName(nextRenewal.d)}, ${formatDate(new Date(nextRenewal.t))}`}
                />
              );
            }
            return (
              <KpiTile
                aria-label={hasExpired ? 'Expired licences' : 'Licence renewals'}
                label={hasExpired ? 'Expired licences' : 'Renewals in 90 days'}
                figure={loading ? <span className="ops-skel" style={{ display: 'inline-block', width: 96, height: 28 }} /> : hasExpired ? expired.length : renewSoon}
                note={note}
                tone={hasExpired ? 'danger' : 'neutral'}
              />
            );
          })()}
        </KpiRow>
      )}

      {/* Search + status filter toolbar */}
      <Toolbar className="fleet-toolbar" end={
        <Segmented
          label="Driver status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={['All', 'ACTIVE', 'INACTIVE', 'ON_LEAVE'].map(status => ({
            value: status,
            label: status === 'All' ? 'All' : formatStatus(status),
          }))}
        />
      }>
        <SearchInput
          aria-label="Search drivers"
          placeholder="Search name, licence or username"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </Toolbar>

      {/* Table */}
      {failed ? (
        <LoadError
          what="drivers"
          error={driversQuery.error ?? driversQuery.failureReason}
          busy={driversQuery.isFetching}
          onRetry={() => refetch()}
        />
      ) : (
      <div className="card fleet-table-region" role="region" aria-label="Drivers table" tabIndex={0}>
        <table className="table-heading-roles fleet-table">
          <thead>
            <tr>
              {['Name', 'Licence', 'Licence expires', 'Status', 'Completed loads', ...(hasRevenue ? ['Revenue'] : []), ...(hasEfficiency ? ['Efficiency'] : []), ''].map(h => (
                <th key={h || 'actions'} className={[NUMERIC_COLUMNS.has(h) || h === 'Efficiency' ? 'is-numeric' : '', DRIVER_COL_CLASS[h] ?? ''].filter(Boolean).join(' ') || undefined}>
                  {h || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows rows={10} cols={colCount} />
            ) : filtered.length === 0 ? (
              drivers.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="fleet-table__state-cell">
                    <div className="fleet-empty">
                      <div className="fleet-empty__icon"><EmptyDriversIcon size={40} aria-hidden="true" /></div>
                      <h2 className="fleet-empty__title">No drivers yet</h2>
                      <p className="fleet-empty__text">Add a driver so you can assign them to loads.</p>
                      <div className="fleet-empty__actions">
                      <button data-fleet-control
                        onClick={() => setShowAddForm(true)}
                        className="btn-action"
                        disabled={isDemo}
                        title={isDemo ? 'Fixed in demo mode' : undefined}
                        style={isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                      >
                        Add driver
                      </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr><td colSpan={colCount} className="fleet-table__no-match">No drivers match your filters</td></tr>
              )
            ) : filtered.map((d) => {
              const efficiencyScore = d.efficiency_score || 0;
              const expiryT = d.license_expiry ? new Date(d.license_expiry).getTime() : null;
              const isExpired = expiryT != null && expiryT < now;
              // The driver stats job fills revenue_generated; until it runs the API
              // sends 0.00 even for drivers with completed loads, so a zero is
              // shown as missing rather than as a real R 0.
              const revenue = Number(d.revenue_generated) || 0;

              return (
                <tr
                  key={d.id}
                  className="is-clickable"
                  {...rowLink(() => navigate(`/fleet/drivers/${d.id}`))}
                  onClick={() => navigate(`/fleet/drivers/${d.id}`)}
                >
                  <td className="is-primary" style={{ fontWeight: 500 }}>
                    {getDriverName(d)}
                  </td>
                  <td className="fleet-col-opt">
                    <span className="fleet-table__id">{d.license_number || '—'}</span>
                  </td>
                  <td className="fleet-col-phone" style={{ color: isExpired ? 'var(--status-danger-text)' : undefined }}>
                    {formatDay(d.license_expiry)}{isExpired ? ', expired' : ''}
                  </td>
                  <td>
                    <StatusChip status={d.status} size="sm" />
                  </td>
                  <td className="is-numeric fleet-col-phone">
                    {d.total_trips ?? 0}
                  </td>
                  {hasRevenue && (
                    <td className="is-numeric" style={{ color: revenue ? 'var(--text-primary)' : undefined }}>
                      {revenue ? formatZAR(revenue) : '—'}
                    </td>
                  )}
                  {hasEfficiency && (
                    <td className="is-numeric fleet-col-opt2">{efficiencyScore > 0 ? efficiencyScore : '—'}</td>
                  )}
                  <td className="fleet-table__actions">
                    <RowActions
                      label={getDriverName(d)}
                      items={[
                        {
                          label: 'Edit',
                          disabled: isDemo, title: isDemo ? 'Fixed in demo mode' : undefined,
                          onSelect: () => {
                            openEdit(d);
                          },
                        },
                        {
                          label: 'Delete',
                          danger: true,
                          disabled: isDemo, title: isDemo ? 'Fixed in demo mode' : undefined,
                          onSelect: () => {
                            setConfirmOpts({
                              title: 'Delete driver',
                              message: `Remove ${getDriverName(d)} from your team? This cannot be undone.`,
                              confirmLabel: 'Delete',
                              danger: true,
                              onConfirm: async () => {
                                try {
                                  await deleteData({ url: `api/v1/drivers/${d.id}/` });
                                  toast.success('Driver deleted');
                                  refetch();
                                } catch (err: any) {
                                  toast.error(err?.message || 'Failed to delete driver');
                                }
                              },
                            });
                          },
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

      {/* Add Driver Slide-out */}
      {showAddForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setShowAddForm(false)} />
          <div role="dialog" aria-modal="true" aria-label="Add driver" style={{ position: 'relative', width: 440, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Add driver</h2>
              <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            {/* Required fields first (Name through License Province), optional
                fields (Phone, Email, Status) after. */}
            {[
              { key: 'first_name', label: 'First name', placeholder: 'e.g. Riaan', required: true },
              { key: 'last_name', label: 'Last name', placeholder: 'e.g. Venter', required: true },
              { key: 'license_number', label: 'Licence number', placeholder: 'e.g. DRV-2024-001', required: true },
              { key: 'license_expiry', label: 'Licence expiry', type: 'date', required: true },
              { key: 'hire_date', label: 'Hire date', type: 'date', required: true },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {f.label}{f.required && <span style={{ color: 'var(--status-danger-text)' }}> *</span>}
                </label>
                {f.type === 'date' ? (
                  <DatePicker
                    value={(addForm as any)[f.key]}
                    onChange={val => setAddForm(prev => ({ ...prev, [f.key]: val }))}
                  />
                ) : (
                  <input
                    type={f.type || 'text'}
                    placeholder={f.placeholder}
                    value={(addForm as any)[f.key]}
                    onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '9px 12px', minHeight: 40, borderRadius: 'var(--radius-control, 8px)', fontSize: 14, lineHeight: '20px', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            ))}
            {[
              { key: 'license_state', label: 'Licence province', options: ['GP', 'WC', 'KZN', 'EC', 'MP', 'LP', 'NW', 'FS', 'NC'], required: true },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {f.label}{f.required && <span style={{ color: 'var(--status-danger-text)' }}> *</span>}
                </label>
                <Select value={(addForm as any)[f.key]} onValueChange={val => setAddForm(prev => ({ ...prev, [f.key]: val }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map(o => <SelectItem key={o} value={o}>{o.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {[
              { key: 'phone', label: 'Phone', placeholder: 'e.g. 082 123 4567' },
              { key: 'email', label: 'Email', placeholder: 'e.g. riaan@truckwys.co.za', type: 'email' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {f.label}
                </label>
                <input
                  type={f.type || 'text'}
                  placeholder={f.placeholder}
                  value={(addForm as any)[f.key]}
                  onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '9px 12px', minHeight: 40, borderRadius: 'var(--radius-control, 8px)', fontSize: 14, lineHeight: '20px', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            {[
              { key: 'status', label: 'Status', options: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {f.label}
                </label>
                <Select value={(addForm as any)[f.key]} onValueChange={val => setAddForm(prev => ({ ...prev, [f.key]: val }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map(o => <SelectItem key={o} value={o}>{o.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              * Required. Address, medical card, emergency contact, and vehicle assignment can be added afterward from Edit.
            </div>
            {(() => {
              const canCreate = !!(addForm.first_name && addForm.last_name && addForm.license_number && addForm.license_expiry && addForm.license_state && addForm.hire_date);
              return (
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                disabled={saving || !canCreate}
                onClick={async () => {
                  setSaving(true);
                  try {
                    // Create user first, then driver
                    const username = `${addForm.first_name.toLowerCase()}.${addForm.last_name.toLowerCase()}`.replace(/\s+/g, '');
                    const user = await postData({ url: 'api/v1/users/', data: {
                      username,
                      email: addForm.email || `${username}@truckwys.co.za`,
                      first_name: addForm.first_name,
                      last_name: addForm.last_name,
                      phone: addForm.phone,
                      password: 'TruckWys2026!',
                      role: 'DRIVER',
                    }});
                    await postData({ url: 'api/v1/drivers/', data: {
                      user: user.id,
                      license_number: addForm.license_number,
                      license_expiry: addForm.license_expiry,
                      license_state: addForm.license_state,
                      hire_date: addForm.hire_date,
                      status: addForm.status,
                    }});
                    setShowAddForm(false);
                    setAddForm({ first_name: '', last_name: '', email: '', phone: '', license_number: '', license_expiry: '', license_state: 'GP', hire_date: localDateISO(), status: 'ACTIVE' });
                    // Refresh
                    refetch();
                  } catch (e: any) { toast.error(e?.message || 'Failed to create driver'); }
                  setSaving(false);
                }}
                style={{ flex: 1, padding: '8px 16px', minHeight: 40, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', letterSpacing: 'normal', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', border: 'none', borderRadius: 'var(--radius-control, 8px)', cursor: saving ? 'wait' : canCreate ? 'pointer' : 'not-allowed', fontWeight: 500, opacity: canCreate ? 1 : 0.5 }}
              >
                {saving ? 'Saving…' : 'Create driver'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                style={{ padding: '8px 20px', minHeight: 40, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-control, 8px)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Edit Driver Slide-out */}
      {editDriver && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setEditDriver(null)} />
          <div role="dialog" aria-modal="true" aria-label="Edit driver" style={{ position: 'relative', width: 440, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Edit driver</h2>
              <button onClick={() => setEditDriver(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            {error && (
              <div style={{ padding: 12, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: 'var(--radius-control, 8px)', marginBottom: 16, fontSize: 13, lineHeight: '20px' }}>
                {error}
              </div>
            )}
            {/* Required fields first (Name through Hire Date, then License
                Province), optional fields after. */}
            {[
              { key: 'first_name', label: 'First name', placeholder: 'e.g. Riaan', required: true },
              { key: 'last_name', label: 'Last name', placeholder: 'e.g. Venter', required: true },
              { key: 'license_number', label: 'Licence number', placeholder: 'e.g. DRV-2024-001', required: true },
              { key: 'license_expiry', label: 'Licence expiry', type: 'date', required: true },
              { key: 'hire_date', label: 'Hire date', type: 'date', required: true },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {f.label}{f.required && <span style={{ color: 'var(--status-danger-text)' }}> *</span>}
                </label>
                {f.type === 'date' ? (
                  <DatePicker
                    value={(editForm as any)[f.key] ?? ''}
                    onChange={val => setEditForm((prev: any) => ({ ...prev, [f.key]: val }))}
                  />
                ) : (
                  <input
                    type={f.type || 'text'}
                    placeholder={f.placeholder}
                    value={(editForm as any)[f.key] ?? ''}
                    onChange={e => setEditForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '9px 12px', minHeight: 40, borderRadius: 'var(--radius-control, 8px)', fontSize: 14, lineHeight: '20px', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            ))}
            {[
              { key: 'license_state', label: 'Licence province', options: ['GP', 'WC', 'KZN', 'EC', 'MP', 'LP', 'NW', 'FS', 'NC'], required: true },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {f.label}{f.required && <span style={{ color: 'var(--status-danger-text)' }}> *</span>}
                </label>
                <Select value={(editForm as any)[f.key]} onValueChange={val => setEditForm((prev: any) => ({ ...prev, [f.key]: val }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map(o => <SelectItem key={o} value={o}>{o.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {[
              { key: 'email', label: 'Email', placeholder: 'e.g. riaan@truckwys.co.za', type: 'email' },
              { key: 'phone', label: 'Phone', placeholder: 'e.g. 082 123 4567' },
              { key: 'address', label: 'Address', placeholder: 'e.g. 12 Main Street, Cape Town' },
              { key: 'medical_card_expiry', label: 'Medical card expiry', type: 'date' },
              { key: 'emergency_contact', label: 'Emergency contact', placeholder: 'e.g. Jane Doe or 082 123 4567' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {f.label}
                </label>
                {f.type === 'date' ? (
                  <DatePicker
                    value={(editForm as any)[f.key] ?? ''}
                    onChange={val => setEditForm((prev: any) => ({ ...prev, [f.key]: val }))}
                  />
                ) : (
                  <input
                    type={f.type || 'text'}
                    placeholder={f.placeholder}
                    value={(editForm as any)[f.key] ?? ''}
                    onChange={e => setEditForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '9px 12px', minHeight: 40, borderRadius: 'var(--radius-control, 8px)', fontSize: 14, lineHeight: '20px', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            ))}
            {[
              { key: 'status', label: 'Status', options: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {f.label}
                </label>
                <Select value={(editForm as any)[f.key]} onValueChange={val => setEditForm((prev: any) => ({ ...prev, [f.key]: val }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map(o => <SelectItem key={o} value={o}>{o.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', marginBottom: 6 }}>Assigned vehicle</label>
              <Select value={editForm.vehicle ?? ''} onValueChange={val => setEditForm((prev: any) => ({ ...prev, vehicle: val }))}>
                <SelectTrigger>
                  <SelectValue placeholder="No vehicle assigned" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.plate}{v.make || v.model ? ` · ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              * Required.
            </div>
            {(() => {
              const canUpdate = !!(editForm.first_name && editForm.last_name && editForm.license_number && editForm.license_expiry && editForm.license_state && editForm.hire_date);
              return (
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                disabled={saving || !canUpdate}
                onClick={async () => {
                  setSaving(true);
                  setError(null);
                  try {
                    const { first_name, last_name, email, phone, address, vehicle, ...driverFields } = editForm;
                    await patchData({ url: `api/v1/drivers/${editDriver.id}/`, data: driverFields });

                    if (editDriver.user_details?.id) {
                      await patchData({
                        url: `api/v1/users/${editDriver.user_details.id}/`,
                        data: { first_name, last_name, email, phone, address }
                      });
                    }

                    // Handle vehicle assignment change
                    const prevVehicle = vehicles.find(v => v.driver_id === editDriver.id);
                    if (vehicle && String(prevVehicle?.id) !== vehicle) {
                      if (prevVehicle) await patchData({ url: `api/v1/vehicles/${prevVehicle.id}/`, data: { driver: null } });
                      await patchData({ url: `api/v1/vehicles/${vehicle}/`, data: { driver: editDriver.id } });
                    } else if (!vehicle && prevVehicle) {
                      await patchData({ url: `api/v1/vehicles/${prevVehicle.id}/`, data: { driver: null } });
                    }

                    setEditDriver(null);
                    setEditForm({});

                    // Refresh
                    refetch();
                  } catch (e: any) {
                    setError(e?.message || 'Failed to update driver');
                  }
                  setSaving(false);
                }}
                style={{ flex: 1, padding: '8px 16px', minHeight: 40, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', letterSpacing: 'normal', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', border: 'none', borderRadius: 'var(--radius-control, 8px)', cursor: saving ? 'wait' : canUpdate ? 'pointer' : 'not-allowed', fontWeight: 500, opacity: canUpdate ? 1 : 0.5 }}
              >
                {saving ? 'Saving…' : 'Update driver'}
              </button>
              <button
                onClick={() => setEditDriver(null)}
                style={{ padding: '8px 20px', minHeight: 40, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-control, 8px)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
              );
            })()}
          </div>
        </div>
      )}

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
