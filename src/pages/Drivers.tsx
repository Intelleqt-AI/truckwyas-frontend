import './fleet-vehicles-brand.css';
import './table-heading-roles.css';
import { UserRound as EmptyDriversIcon } from 'lucide-react';
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from '@tanstack/react-query';
import { fetchData, postData, patchData, deleteData } from '../lib/Api';
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { LiveBadge } from "@/components/LiveBadge";
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/Loader';
import { useAuth } from '@/lib/AuthContext';

interface Driver {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  status: string;
  total_trips?: number;
  revenue_generated?: number;
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

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'var(--accent-primary)',
  INACTIVE: 'var(--text-tertiary)',
  ON_LEAVE: 'var(--status-warning)',
};

const formatZAR = (v: number) =>
  'R ' + (v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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
  const location = useLocation();
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
    hire_date: new Date().toISOString().slice(0, 10), status: 'ACTIVE',
  });
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
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

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ['drivers-page', debouncedSearch],
    queryFn: async () => {
      const q = debouncedSearch;
      const driversUrl = q
        ? `api/v1/drivers/?search=${encodeURIComponent(q)}`
        : 'api/v1/drivers/';
      const [driversData, overviewData, leaderboardData, vehicleData] = await Promise.all([
        fetchData(driversUrl),
        fetchData('api/v1/drivers/overview/').catch(() => null),
        fetchData('api/v1/drivers/leaderboard/').catch(() => null),
        fetchData('api/v1/vehicles/').catch(() => null),
      ]);

      const vehicleList = Array.isArray(vehicleData) ? vehicleData : (vehicleData?.results || []);
      const vehicles = vehicleList.map((v: any) => ({
        id: v.id,
        plate: v.plate || v.registration || `Vehicle ${v.id}`,
        make: v.make,
        model: v.model,
        driver_id: v.driver ?? null,
      }));
      const driverList = Array.isArray(driversData) ? driversData : (driversData?.results || []);

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
          total_drivers: findVal('total') || driversData?.count || driverList.length,
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

  const drivers: Driver[] = data?.drivers ?? [];
  const vehicles: { id: number; plate: string; make?: string; model?: string; driver_id?: number | null }[] = data?.vehicles ?? [];
  const overview: DriverOverview | null = data?.overview ?? null;

  useAutoRefresh(refetch);

  const filtered = drivers.filter(d => statusFilter === 'All' || d.status === statusFilter);

  const rankColor = (rank: number) => {
    if (rank === 1) return 'var(--accent-primary)';
    if (rank === 2) return 'var(--status-warning)';
    return 'var(--text-secondary)';
  };

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

  if (loading) return <Loader fullScreen />;

  return (
    <div className="fleet-page">
      {/* Page header */}
      <div className="fleet-header-row" style={{ marginBottom: 24, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)', letterSpacing: 'normal', textTransform: 'none', marginBottom: 4 }}>Fleet</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="fleet-page-title">Fleet</h1>
            <LiveBadge />
          </div>
        </div>
        <button data-fleet-control
          className="btn-action"
          onClick={() => setShowAddForm(true)}
          disabled={isDemo}
          title={isDemo ? 'Fixed in demo mode' : undefined}
          style={isDemo ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >+ Add driver</button>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 24, display: 'flex', overflowX: 'auto' }}>
        <button style={tabStyle(false)} onClick={() => navigate('/fleet/vehicles')}>Vehicles</button>
        <button style={tabStyle(true)}>Drivers</button>
      </div>

      {/* KPI strip */}
      <div className="fleet-summary fleet-summary--3">
        {[
          { label: 'Total drivers', value: overview?.total_drivers ?? drivers.length, color: 'var(--text-primary)' },
          { label: 'Active', value: overview?.active_drivers ?? drivers.filter(d => d.status === 'ACTIVE').length, color: 'var(--accent-primary)' },
          { label: 'Avg revenue per driver', value: formatZAR(overview?.avg_revenue_per_driver ?? 0), color: 'var(--text-primary)' },
        ].map(k => (
          <div key={k.label} className="card metric-card">
            <div className="card-header"><span className="card-title">{k.label}</span></div>
            <div className="metric-value" style={{ fontSize: 28, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Search + Status Filter Toolbar */}
      <div className="fleet-toolbar">
        <input data-fleet-control
          type="text"
          aria-label="Search drivers"
          placeholder="Search name, license, username..."
          value={search}
          onChange={e => setSearch(e.target.value)}
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
          {['All', 'ACTIVE', 'INACTIVE', 'ON_LEAVE'].map(status => {
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

      {/* Table */}
      <div className="card fleet-table-region" role="region" aria-label="Drivers table" tabIndex={0} style={{ padding: 0, overflowX: 'auto', minWidth: 0, maxWidth: '100%' }}>
        <table className="table-heading-roles" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name', 'License', 'Status', 'Trips MTD', 'Revenue generated', 'Performance', ''].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left',
                  borderBottom: '1px solid var(--border-subtle)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              drivers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 0 }}>
                    <div style={{ padding: '48px var(--fleet-card-inset)', textAlign: 'center' }}>
                      <div style={{ marginBottom: 16, opacity: 0.3 }}><EmptyDriversIcon size={40} aria-hidden="true" /></div>
                      <div style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                        No drivers yet
                      </div>
                      <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', marginBottom: 20 }}>
                        Get started by adding your first driver to your team
                      </div>
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
                  </td>
                </tr>
              ) : (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40, fontSize: 13 }}>No drivers match your filters</td></tr>
              )
            ) : filtered.map((d, idx) => {
              const statusDotColor = d.status === 'ACTIVE' ? 'var(--status-success)' : d.status === 'ON_LEAVE' ? 'var(--status-warning)' : 'var(--text-tertiary)';
              const efficiencyScore = d.efficiency_score || 0;

              return (
                <tr
                  key={d.id}
                  style={{ cursor: 'pointer', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-row)' : 'none' }}
                  onClick={() => navigate(`/fleet/drivers/${d.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: statusDotColor,
                        flexShrink: 0
                      }} />
                      {getDriverName(d)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {d.license_number || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block', whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px',
                      color: STATUS_COLOR[d.status] || 'var(--text-secondary)',
                    }}>
                      {formatStatus(d.status)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {d.total_trips ?? 0}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {d.revenue_generated ? formatZAR(d.revenue_generated) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {efficiencyScore > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, maxWidth: 120, height: 6, background: 'var(--bg-surface-hover)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(efficiencyScore, 100)}%`,
                            height: '100%',
                            background: 'var(--accent-primary)',
                            borderRadius: 3,
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
                          {efficiencyScore}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button data-fleet-control
                        onClick={(e) => {
                          e.stopPropagation();
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
                        }}
                        disabled={isDemo}
                        title={isDemo ? 'Fixed in demo mode' : undefined}
                        style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: 6, cursor: isDemo ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', letterSpacing: 'normal', opacity: isDemo ? 0.5 : 1 }}
                      >Edit</button>
                      <button data-fleet-control
                        onClick={(e) => {
                          e.stopPropagation();
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

      {/* Add Driver Slide-out */}
      {showAddForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setShowAddForm(false)} />
          <div style={{ position: 'relative', width: 440, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Add Driver</div>
              <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            {/* Required fields first (Name through License Province), optional
                fields (Phone, Email, Status) after. */}
            {[
              { key: 'first_name', label: 'First Name', placeholder: 'e.g. Riaan', required: true },
              { key: 'last_name', label: 'Last Name', placeholder: 'e.g. Venter', required: true },
              { key: 'license_number', label: 'License Number', placeholder: 'e.g. DRV-2024-001', required: true },
              { key: 'license_expiry', label: 'License Expiry', type: 'date', required: true },
              { key: 'hire_date', label: 'Hire Date', type: 'date', required: true },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>
                  {f.label}{f.required && <span style={{ color: 'var(--status-danger)' }}> *</span>}
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
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            ))}
            {[
              { key: 'license_state', label: 'License Province', options: ['GP', 'WC', 'KZN', 'EC', 'MP', 'LP', 'NW', 'FS', 'NC'], required: true },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>
                  {f.label}{f.required && <span style={{ color: 'var(--status-danger)' }}> *</span>}
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
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>
                  {f.label}
                </label>
                <input
                  type={f.type || 'text'}
                  placeholder={f.placeholder}
                  value={(addForm as any)[f.key]}
                  onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            {[
              { key: 'status', label: 'Status', options: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>
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
                    setAddForm({ first_name: '', last_name: '', email: '', phone: '', license_number: '', license_expiry: '', license_state: 'GP', hire_date: new Date().toISOString().slice(0, 10), status: 'ACTIVE' });
                    // Refresh
                    refetch();
                  } catch (e: any) { toast.error(e?.message || 'Failed to create driver'); }
                  setSaving(false);
                }}
                style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 2, cursor: saving ? 'wait' : canCreate ? 'pointer' : 'not-allowed', fontWeight: 500, opacity: canCreate ? 1 : 0.5 }}
              >
                {saving ? 'Saving…' : 'Create driver'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, cursor: 'pointer' }}
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
          <div style={{ position: 'relative', width: 440, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Edit Driver</div>
              <button onClick={() => setEditDriver(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            {error && (
              <div style={{ padding: 12, background: 'var(--status-danger)', color: 'var(--bg-deep)', borderRadius: 2, marginBottom: 16, fontSize: 12 }}>
                {error}
              </div>
            )}
            {/* Required fields first (Name through Hire Date, then License
                Province), optional fields after. */}
            {[
              { key: 'first_name', label: 'First Name', placeholder: 'e.g. Riaan', required: true },
              { key: 'last_name', label: 'Last Name', placeholder: 'e.g. Venter', required: true },
              { key: 'license_number', label: 'License Number', placeholder: 'e.g. DRV-2024-001', required: true },
              { key: 'license_expiry', label: 'License Expiry', type: 'date', required: true },
              { key: 'hire_date', label: 'Hire Date', type: 'date', required: true },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>
                  {f.label}{f.required && <span style={{ color: 'var(--status-danger)' }}> *</span>}
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
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            ))}
            {[
              { key: 'license_state', label: 'License Province', options: ['GP', 'WC', 'KZN', 'EC', 'MP', 'LP', 'NW', 'FS', 'NC'], required: true },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>
                  {f.label}{f.required && <span style={{ color: 'var(--status-danger)' }}> *</span>}
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
              { key: 'medical_card_expiry', label: 'Medical Card Expiry', type: 'date' },
              { key: 'emergency_contact', label: 'Emergency Contact', placeholder: 'e.g. Jane Doe or 082 123 4567' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>
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
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            ))}
            {[
              { key: 'status', label: 'Status', options: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>
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
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>Assigned Vehicle</label>
              <Select value={editForm.vehicle ?? ''} onValueChange={val => setEditForm((prev: any) => ({ ...prev, vehicle: val }))}>
                <SelectTrigger>
                  <SelectValue placeholder="— No vehicle assigned —" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.plate}{v.make || v.model ? ` — ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}
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
                style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 2, cursor: saving ? 'wait' : canUpdate ? 'pointer' : 'not-allowed', fontWeight: 500, opacity: canUpdate ? 1 : 0.5 }}
              >
                {saving ? 'Saving…' : 'Update driver'}
              </button>
              <button
                onClick={() => setEditDriver(null)}
                style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, cursor: 'pointer' }}
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
