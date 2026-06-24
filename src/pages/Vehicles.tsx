import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchData, postData, patchData, deleteData } from '../lib/Api';
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { LiveBadge } from "@/components/LiveBadge";
import { toast } from '@/lib/toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

export default function Vehicles() {
  const navigate = useNavigate();
  const location = useLocation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<{ id: number; name: string }[]>([]);
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([]);
  const [overview, setOverview] = useState<FleetOverview | null>(null);
  const [insights, setInsights] = useState<FleetInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const searchRef = useRef('');
  searchRef.current = search;
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const didMountVehicles = useRef(false);
  const [sortBy, setSortBy] = useState('revenue');
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    vin: '', make: '', model: '', year: new Date().getFullYear(), plate: '',
    type: 'Rigid Truck', capacity: '', mileage: '', fuel_type: 'Diesel', status: 'AVAILABLE',
    insurance_expiry: '', registration_expiry: '', last_maintenance_date: '', next_maintenance_due: '',
    driver: '',
  });
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [confirmOpts, setConfirmOpts] = useState<{
    title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);

  const load = useCallback(() => {
    const q = searchRef.current;
    const vehiclesUrl = q
      ? `api/v1/vehicles/?search=${encodeURIComponent(q)}`
      : 'api/v1/vehicles/';
    return Promise.all([
      fetchData(vehiclesUrl),
      fetchData('api/v1/fleet/overview/'),
      fetchData('api/v1/fleet/intelligence/'),
      fetchData('api/v1/vehicle-types/'),
      fetchData('api/v1/drivers/'),
    ])
      .then(([vehData, overviewData, insightsData, vtData, driverData]) => {
        const vehiclesArray = Array.isArray(vehData) ? vehData : (vehData?.results || []);
        setVehicles(vehiclesArray);

        setOverview(overviewData);

        const insightsArray = Array.isArray(insightsData) ? insightsData : (insightsData?.opportunities || []);
        setInsights(insightsArray);

        const vtList = Array.isArray(vtData) ? vtData : (vtData?.results || []);
        setVehicleTypes(vtList.map((vt: any) => ({ id: vt.id, name: vt.name })));

        const driverList = Array.isArray(driverData) ? driverData : (driverData?.results || []);
        setDrivers(driverList.map((d: any) => {
          const ud = d.user_details || {};
          const fn = d.first_name || ud.first_name || '';
          const ln = d.last_name || ud.last_name || '';
          const name = fn && ln ? `${fn} ${ln}` : fn || ln || d.name || `Driver ${d.id}`;
          return { id: d.id, name };
        }));

        setError(null);
      })
      .catch(() => {
        setError('Failed to load fleet data');
        setVehicles([]);
        setOverview(null);
        setInsights([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  useEffect(() => {
    if (!didMountVehicles.current) { didMountVehicles.current = true; return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(load, 300);
    return () => clearTimeout(searchTimer.current);
  }, [search, load]);

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

  const getStatusBadge = (status: string) => {
    const color = STATUS_COLOR[status] || 'var(--text-secondary)';
    return (
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color,
        padding: '2px 6px',
        background: 'var(--bg-surface-hover)',
        borderRadius: 2,
        textTransform: 'uppercase'
      }}>
        {status.replace('_', ' ')}
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
    fontWeight: active ? 600 : 400,
    textTransform: 'uppercase', padding: '12px 0', marginRight: 24, cursor: 'pointer', marginBottom: -1,
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
            <button onClick={() => navigate('/fleet/heatmap')} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '8px 14px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.06em' }}>HEATMAP</button>
            <button className="btn-action" onClick={() => setShowAddForm(true)}>+ ADD VEHICLE</button>
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
              onChange={e => setSearch(e.target.value)}
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
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {status === 'All' ? 'ALL' : status.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                            ADD VEHICLE
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
                      <td style={{ padding: '12px 20px 12px 32px', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
                        {v.plate || v.registration || '—'}
                      </td>
                      <td style={{ padding: '12px 20px 12px 32px', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td style={{ padding: '12px 20px 12px 32px', fontSize: 12, color: 'var(--text-secondary)' }}>
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
                      <td style={{ padding: '12px 20px 12px 32px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {v.revenue_generated ? formatZAR(v.revenue_generated) : '—'}
                      </td>
                      <td style={{ padding: '12px 20px 12px 32px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {v.total_trips ?? 0}
                      </td>
                      <td style={{ padding: '12px 20px 12px 32px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {v.fuel_efficiency_score ? `${parseFloat(v.fuel_efficiency_score as any).toFixed(0)}/100` : '—'}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditVehicle(v);
                              setEditForm({
                                vin: v.vin || '',
                                make: v.make || '',
                                model: v.model || '',
                                year: v.year || new Date().getFullYear(),
                                plate: v.plate || v.registration || '',
                                type: v.vehicle_type_name || '',
                                capacity: v.capacity || '',
                                fuel_type: v.fuel_type || 'Diesel',
                                status: v.status || 'AVAILABLE',
                                mileage: v.mileage || '',
                                insurance_expiry: v.insurance_expiry || '',
                                registration_expiry: v.registration_expiry || '',
                                last_maintenance_date: v.last_maintenance_date || '',
                                next_maintenance_due: v.next_maintenance_due || '',
                                driver: v.driver ?? '',
                              });
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
                                    const d = await fetchData('api/v1/vehicles/');
                                    setVehicles(Array.isArray(d) ? d : d?.results || []);
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

      {/* Add Vehicle Slide-out */}
      {showAddForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setShowAddForm(false)} />
          <div style={{ position: 'relative', width: 440, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Add Vehicle</div>
              <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            {[
              { key: 'vin', label: 'VIN Number', placeholder: 'e.g. WDB9634031L123456' },
              { key: 'make', label: 'Make', placeholder: 'e.g. Mercedes-Benz' },
              { key: 'model', label: 'Model', placeholder: 'e.g. Actros 2645' },
              { key: 'year', label: 'Year', placeholder: '2024', type: 'number' },
              { key: 'plate', label: 'Registration Plate', placeholder: 'e.g. GP 567 ZAB' },
              { key: 'capacity', label: 'Capacity (kg)', placeholder: 'e.g. 30000', type: 'number' },
              { key: 'mileage', label: 'Mileage (km)', placeholder: 'e.g. 150000', type: 'number' },
              { key: 'insurance_expiry', label: 'Insurance Expiry', type: 'date' },
              { key: 'registration_expiry', label: 'Registration Expiry', type: 'date' },
              { key: 'last_maintenance_date', label: 'Last Maintenance', type: 'date' },
              { key: 'next_maintenance_due', label: 'Next Maintenance Due', type: 'date' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>{f.label}</label>
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
              { key: 'type', label: 'Vehicle Type', options: vehicleTypes.length > 0 ? vehicleTypes.map(vt => vt.name) : ['Rigid Truck', 'Semi-Trailer Truck', 'Flatbed Truck', 'Tanker', 'Refrigerated Truck', 'Tautliner', 'Box Truck'] },
              { key: 'fuel_type', label: 'Fuel Type', options: ['Diesel', 'Petrol', 'Electric', 'Hybrid'] },
              { key: 'status', label: 'Status', options: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE', 'OUT_OF_SERVICE'] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>{f.label}</label>
                <Select
                  value={(addForm as any)[f.key]}
                  onValueChange={val => setAddForm(prev => ({ ...prev, [f.key]: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>Assigned Driver</label>
              <Select
                value={addForm.driver}
                onValueChange={val => setAddForm(prev => ({ ...prev, driver: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— No driver assigned —" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const vehicleTypeId = vehicleTypes.find(vt => vt.name === addForm.type)?.id;
                    const { type: _t, ...addFormWithoutType } = addForm;
                    await postData({
                      url: 'api/v1/vehicles/',
                      data: {
                        ...addFormWithoutType,
                        year: Number(addForm.year),
                        capacity: Number(addForm.capacity) || 0,
                        mileage: addForm.mileage ? Number(addForm.mileage) : undefined,
                        driver: addForm.driver ? Number(addForm.driver) : null,
                        ...(vehicleTypeId ? { vehicle_type: vehicleTypeId } : {}),
                      },
                    });
                    setShowAddForm(false);
                    setAddForm({ vin: '', make: '', model: '', year: new Date().getFullYear(), plate: '', type: 'Rigid Truck', capacity: '', mileage: '', fuel_type: 'Diesel', status: 'AVAILABLE', insurance_expiry: '', registration_expiry: '', last_maintenance_date: '', next_maintenance_due: '', driver: '' });
                    // Refresh
                    const d = await fetchData('api/v1/vehicles/');
                    setVehicles(Array.isArray(d) ? d : d?.results || []);
                  } catch (e: any) { toast.error(e?.message || 'Failed to create vehicle'); }
                  setSaving(false);
                }}
                style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 2, cursor: saving ? 'wait' : 'pointer', fontWeight: 600 }}
              >
                {saving ? 'SAVING...' : 'CREATE VEHICLE'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, cursor: 'pointer' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vehicle Slide-out */}
      {editVehicle && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setEditVehicle(null)} />
          <div style={{ position: 'relative', width: 440, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Edit Vehicle</div>
              <button onClick={() => setEditVehicle(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            {error && (
              <div style={{ padding: 12, background: 'var(--status-danger)', color: 'var(--bg-deep)', borderRadius: 2, marginBottom: 16, fontSize: 12 }}>
                {error}
              </div>
            )}
            {[
              { key: 'vin', label: 'VIN Number', placeholder: 'e.g. WDB9634031L123456' },
              { key: 'make', label: 'Make', placeholder: 'e.g. Mercedes-Benz' },
              { key: 'model', label: 'Model', placeholder: 'e.g. Actros 2645' },
              { key: 'year', label: 'Year', placeholder: '2024', type: 'number' },
              { key: 'plate', label: 'Registration Plate', placeholder: 'e.g. GP 567 ZAB' },
              { key: 'capacity', label: 'Capacity (kg)', placeholder: 'e.g. 30000', type: 'number' },
              { key: 'mileage', label: 'Mileage (km)', placeholder: 'e.g. 150000', type: 'number' },
              { key: 'insurance_expiry', label: 'Insurance Expiry', type: 'date' },
              { key: 'registration_expiry', label: 'Registration Expiry', type: 'date' },
              { key: 'last_maintenance_date', label: 'Last Maintenance', type: 'date' },
              { key: 'next_maintenance_due', label: 'Next Maintenance Due', type: 'date' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>{f.label}</label>
                {f.type === 'date' ? (
                  <DatePicker
                    value={(editForm as any)[f.key]}
                    onChange={val => setEditForm((prev: any) => ({ ...prev, [f.key]: val }))}
                  />
                ) : (
                  <input
                    type={f.type || 'text'}
                    placeholder={f.placeholder}
                    value={(editForm as any)[f.key]}
                    onChange={e => setEditForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            ))}
            {[
              { key: 'type', label: 'Vehicle Type', options: vehicleTypes.length > 0 ? vehicleTypes.map(vt => vt.name) : ['Rigid Truck', 'Semi-Trailer Truck', 'Flatbed Truck', 'Tanker', 'Refrigerated Truck', 'Tautliner', 'Box Truck'] },
              { key: 'fuel_type', label: 'Fuel Type', options: ['Diesel', 'Petrol', 'Electric', 'Hybrid'] },
              { key: 'status', label: 'Status', options: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE', 'OUT_OF_SERVICE'] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>{f.label}</label>
                <Select
                  value={(editForm as any)[f.key]}
                  onValueChange={val => setEditForm((prev: any) => ({ ...prev, [f.key]: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>Assigned Driver</label>
              <Select
                value={editForm.driver != null && editForm.driver !== '' ? String(editForm.driver) : ''}
                onValueChange={val => setEditForm((prev: any) => ({ ...prev, driver: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— No driver assigned —" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setError(null);
                  try {
                    const { type, ...formWithoutType } = editForm;
                    const vehicleTypeId = vehicleTypes.find(vt => vt.name === type)?.id;
                    const payload = {
                      ...formWithoutType,
                      year: editForm.year ? Number(editForm.year) : undefined,
                      capacity: editForm.capacity ? Number(editForm.capacity) : undefined,
                      mileage: editForm.mileage ? Number(editForm.mileage) : undefined,
                      driver: editForm.driver !== '' && editForm.driver != null ? Number(editForm.driver) : null,
                      ...(vehicleTypeId ? { vehicle_type: vehicleTypeId } : {}),
                    };
                    await patchData({ url: `api/v1/vehicles/${editVehicle.id}/`, data: payload });
                    setEditVehicle(null);
                    setEditForm({});
                    const d = await fetchData('api/v1/vehicles/');
                    setVehicles(Array.isArray(d) ? d : d?.results || []);
                  } catch (e: any) {
                    setError(e?.message || 'Failed to update vehicle');
                  }
                  setSaving(false);
                }}
                style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 2, cursor: saving ? 'wait' : 'pointer', fontWeight: 600 }}
              >
                {saving ? 'SAVING...' : 'UPDATE VEHICLE'}
              </button>
              <button
                onClick={() => setEditVehicle(null)}
                style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, cursor: 'pointer' }}
              >
                CANCEL
              </button>
            </div>
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
