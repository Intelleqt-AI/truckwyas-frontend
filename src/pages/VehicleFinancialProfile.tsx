import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, patchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const VEHICLE_STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE'] as const;

const ScoreBar = ({ label, value, max = 100, color = 'var(--accent-primary)' }: any) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 13, color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{value ?? '—'}</span>
    </div>
    <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2 }}>
      <div style={{ height: 4, width: `${Math.min(100, ((value ?? 0) / max) * 100)}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
    </div>
  </div>
);

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'var(--status-success)',
  IN_USE: 'var(--status-warning)',
  MAINTENANCE: 'var(--status-danger)',
  OUT_OF_SERVICE: 'var(--text-tertiary)',
};

export default function VehicleFinancialProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isFinancial = location.pathname.endsWith('/financial');
  const [updating, setUpdating] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => fetchData(`api/v1/vehicles/${id}/`),
    enabled: !!id,
  });

  const { data: loadsData } = useQuery({
    queryKey: ['vehicle-loads', id],
    queryFn: () => fetchData(`api/v1/loads/?vehicle=${id}&page_size=50`),
    enabled: !!id,
  });

  const { data: vtData } = useQuery({
    queryKey: ['vehicle-types'],
    queryFn: () => fetchData('api/v1/vehicle-types/'),
  });
  const vehicleTypesList: { id: number; name: string }[] = ((Array.isArray(vtData) ? vtData : vtData?.results) || []).map((vt: any) => ({ id: vt.id, name: vt.name }));
  const vehicleTypeNames: string[] = vehicleTypesList.map(vt => vt.name);

  const { data: driversData } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: () => fetchData('api/v1/drivers/'),
  });
  const driversList: { id: number; name: string }[] = ((Array.isArray(driversData) ? driversData : driversData?.results) || []).map((d: any) => {
    const ud = d.user_details || {};
    const fn = d.first_name || ud.first_name || '';
    const ln = d.last_name || ud.last_name || '';
    return { id: d.id, name: fn && ln ? `${fn} ${ln}` : fn || ln || `Driver ${d.id}` };
  });

  if (isLoading) return (
    <div style={{ padding: 40, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</div>
  );
  if (!vehicle) return (
    <div style={{ padding: 40 }}>
      <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Vehicle not found.</div>
      <button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate('/fleet')}>← BACK TO FLEET</button>
    </div>
  );

  const loads = Array.isArray(loadsData) ? loadsData : (loadsData?.results || []);
  const delivered = loads.filter((l: any) => l.status === 'DELIVERED');
  const totalRevenue = delivered.reduce((s: number, l: any) => s + parseFloat(l.total_amount || '0'), 0);
  const avgRevPerTrip = delivered.length > 0 ? totalRevenue / delivered.length : 0;
  const totalDistance = delivered.reduce((s: number, l: any) => s + parseFloat(l.distance || '0'), 0);
  const revPerKm = totalDistance > 0 ? totalRevenue / totalDistance : 0;

  const healthScore = vehicle.ai_health_score ?? 0;

  const nextServiceKm = (vehicle.service_interval_km && vehicle.last_service_mileage)
    ? parseFloat(vehicle.last_service_mileage) + Number(vehicle.service_interval_km)
    : null;
  const kmUntilService = (nextServiceKm !== null && vehicle.mileage)
    ? nextServiceKm - parseFloat(vehicle.mileage)
    : null;

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
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => navigate('/fleet')}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}
        >← BACK TO FLEET</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>VEHICLE</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {vehicle.plate}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
              {vehicle.make} {vehicle.model} · {vehicle.vehicle_type_name} · {vehicle.year} · {vehicle.fuel_type}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={() => {
                setShowEditForm(true);
                setEditForm({
                  vin: vehicle.vin || '',
                  plate: vehicle.plate || '',
                  make: vehicle.make || '',
                  model: vehicle.model || '',
                  year: vehicle.year || '',
                  capacity: vehicle.capacity ? String(Number(vehicle.capacity) / 1000) : '',
                  mileage: vehicle.mileage || '',
                  type: vehicle.vehicle_type_name || '',
                  fuel_type: vehicle.fuel_type || 'Diesel',
                  status: vehicle.status || 'AVAILABLE',
                  registration_expiry: vehicle.registration_expiry?.slice(0, 10) || '',
                  last_maintenance_date: vehicle.last_maintenance_date?.slice(0, 10) || '',
                  service_interval_km: vehicle.service_interval_km || '',
                  last_service_mileage: vehicle.last_service_mileage || '',
                  driver: vehicle.driver ?? '',
                });
              }}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--text-secondary)',
                background: 'transparent',
                padding: '6px 12px',
                border: `1px solid var(--border-subtle)`, borderRadius: 2,
                cursor: 'pointer',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                transition: 'all 0.15s ease',
              }}
            >
              EDIT
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
            {VEHICLE_STATUSES.map(s => {
              const isCurrentStatus = vehicle.status === s;
              const btnColor = STATUS_COLOR[s] || 'var(--text-tertiary)';
              return (
                <button
                  key={s}
                  disabled={isCurrentStatus || updating}
                  onClick={async () => {
                    setUpdating(true);
                    try {
                      await patchData({ url: `api/v1/vehicles/${id}/`, data: { status: s } });
                      queryClient.invalidateQueries({ queryKey: ['vehicle', id] });
                    } catch (e) { console.error(e); }
                    setUpdating(false);
                  }}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: isCurrentStatus ? 'var(--bg-deep)' : btnColor,
                    background: isCurrentStatus ? btnColor : 'transparent',
                    padding: '6px 12px',
                    border: `1px solid ${btnColor}`, borderRadius: 2,
                    cursor: isCurrentStatus || updating ? 'default' : 'pointer',
                    opacity: updating && !isCurrentStatus ? 0.5 : 1,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {s.replace('_', ' ')}
                </button>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 24, display: 'flex' }}>
        <button style={tabStyle(!isFinancial)} onClick={() => navigate(`/fleet/vehicles/${id}`)}>Overview</button>
        <button style={tabStyle(isFinancial)} onClick={() => navigate(`/fleet/vehicles/${id}/financial`)}>Financial Profile</button>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {!isFinancial && (
        <>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'AI Health Score', value: vehicle.ai_health_score ?? 0, suffix: '/100', color: healthScore >= 80 ? 'var(--status-success)' : healthScore >= 60 ? 'var(--status-warning)' : 'var(--status-danger)' },
              { label: 'Fuel Efficiency', value: vehicle.fuel_efficiency_score ?? 0, suffix: '/100' },
              { label: 'Uptime', value: parseFloat(vehicle.uptime_percentage || '0').toFixed(1), suffix: '%' },
              { label: 'Mileage', value: parseFloat(vehicle.mileage || '0').toLocaleString('en-ZA'), suffix: ' km' },
            ].map(m => (
              <div key={m.label} className="card metric-card">
                <div className="card-header"><span className="card-title">{m.label}</span></div>
                <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: m.color || 'var(--text-primary)' }}>
                  {m.value}<span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{m.suffix}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Specs */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>SPECIFICATIONS</div>
              {[
                { label: 'VIN', value: vehicle.vin },
                { label: 'PLATE', value: vehicle.plate },
                { label: 'TYPE', value: vehicle.vehicle_type_name || '—' },
                { label: 'CAPACITY', value: vehicle.capacity ? `${(parseFloat(vehicle.capacity) / 1000).toFixed(1)} ton` : '—' },
                { label: 'FUEL TYPE', value: vehicle.fuel_type },
                { label: 'YEAR', value: vehicle.year },
                { label: 'DRIVER', value: vehicle.driver_name || '—' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{r.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value ?? '—'}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Economics */}
              <div className="card" style={{ padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>ECONOMICS</div>
                {[
                  { label: 'COST PER KM', value: `R ${parseFloat(vehicle.cost_per_km || '0').toFixed(2)}` },
                  { label: 'MARGIN PER TRIP', value: formatCurrency(parseFloat(vehicle.margin_per_trip || '0')) },
                  { label: 'FUEL CONSUMPTION', value: `${parseFloat(vehicle.fuel_consumption_per_km || '0').toFixed(2)} L/km` },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{r.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Maintenance */}
              <div className="card" style={{ padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>MAINTENANCE</div>
                {[
                  { label: 'LAST MAINTENANCE', value: vehicle.last_maintenance_date?.slice(0, 10) || '—' },
                  { label: 'SERVICE INTERVAL', value: vehicle.service_interval_km ? `${Number(vehicle.service_interval_km).toLocaleString('en-ZA')} km` : '—' },
                  { label: 'NEXT SERVICE AT', value: nextServiceKm ? `${nextServiceKm.toLocaleString('en-ZA')} km` : '—' },
                  { label: 'KM UNTIL SERVICE', value: kmUntilService !== null ? (kmUntilService > 0 ? `${Math.round(kmUntilService).toLocaleString('en-ZA')} km` : 'OVERDUE') : '—' },
                  { label: 'REGISTRATION EXPIRY', value: vehicle.registration_expiry?.slice(0, 10) || '—' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{r.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── FINANCIAL TAB ── */}
      {isFinancial && (
        <>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Revenue Generated</span></div>
              <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                {formatCurrency(totalRevenue)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{delivered.length} completed trips</div>
            </div>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Avg Revenue / Trip</span></div>
              <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(avgRevPerTrip)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Delivered loads</div>
            </div>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Revenue / km</span></div>
              <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)' }}>
                R {(revPerKm || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{(totalDistance || 0).toFixed(0)} km total</div>
            </div>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">AI Health Score</span></div>
              <div className="metric-value" style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: healthScore >= 80 ? 'var(--status-success)' : healthScore >= 60 ? 'var(--status-warning)' : 'var(--status-danger)' }}>
                {healthScore}/100
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Fleet intelligence</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Performance Scores */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 20 }}>PERFORMANCE SCORES</div>
              <ScoreBar label="AI HEALTH SCORE" value={healthScore} color={healthScore >= 80 ? 'var(--status-success)' : 'var(--status-warning)'} />
              <ScoreBar label="UPTIME SCORE" value={vehicle.uptime_score ?? 0} color="var(--accent-primary)" />
              <ScoreBar label="FUEL EFFICIENCY" value={vehicle.fuel_efficiency_score ?? 0} />
              <ScoreBar label="MAINTENANCE SCORE" value={vehicle.maintenance_score ?? 0} color="var(--status-success)" />
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>UPTIME</span>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {parseFloat(vehicle.uptime_percentage || '0').toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Cost Analysis */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>COST ANALYSIS</div>
              {[
                { label: 'COST PER KM', value: vehicle.cost_per_km ? `R ${parseFloat(vehicle.cost_per_km).toFixed(2)}` : '—' },
                { label: 'MARGIN PER TRIP', value: vehicle.margin_per_trip ? formatCurrency(parseFloat(vehicle.margin_per_trip)) : '—' },
                { label: 'FUEL CONSUMPTION', value: vehicle.fuel_consumption_per_km ? `${vehicle.fuel_consumption_per_km} L/km` : '—' },
                { label: 'CAPACITY', value: vehicle.capacity ? `${(parseFloat(vehicle.capacity) / 1000).toFixed(1)} ton` : '—' },
                { label: 'FUEL TYPE', value: vehicle.fuel_type || '—' },
                { label: 'MILEAGE', value: vehicle.mileage ? `${parseFloat(vehicle.mileage).toLocaleString('en-ZA')} km` : '—' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{r.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* Compliance */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>COMPLIANCE & MAINTENANCE</div>
              {[
                { label: 'LAST MAINTENANCE', value: vehicle.last_maintenance_date?.slice(0, 10) || '—', alert: false },
                { label: 'SERVICE INTERVAL', value: vehicle.service_interval_km ? `${Number(vehicle.service_interval_km).toLocaleString('en-ZA')} km` : '—', alert: false },
                { label: 'NEXT SERVICE AT', value: nextServiceKm ? `${nextServiceKm.toLocaleString('en-ZA')} km` : '—', alert: false },
                { label: 'KM UNTIL SERVICE', value: kmUntilService !== null ? (kmUntilService > 0 ? `${Math.round(kmUntilService).toLocaleString('en-ZA')} km` : 'OVERDUE') : '—', alert: kmUntilService !== null && kmUntilService <= 0 },
                { label: 'REGISTRATION EXPIRY', value: vehicle.registration_expiry?.slice(0, 10) || '—', alert: !!(vehicle.registration_expiry && new Date(vehicle.registration_expiry) < new Date()) },
                { label: 'VIN', value: vehicle.vin || '—', alert: false },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: r.alert ? 'var(--status-danger)' : 'var(--text-primary)' }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* Recent Loads */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>RECENT LOADS ({loads.length})</div>
              {loads.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '20px 0', textAlign: 'center' }}>No loads recorded</div>
              ) : loads.slice(0, 8).map((load: any) => (
                <div
                  key={load.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-row)', cursor: 'pointer' }}
                  onClick={() => navigate(`/bookings/${load.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{load.load_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{load.pickup_city} → {load.delivery_city}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{formatCurrency(parseFloat(load.total_amount || '0'))}</div>
                    <div style={{ fontSize: 10, color: load.status === 'DELIVERED' || load.status === 'INVOICED' ? 'var(--status-success)' : 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{load.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Edit Vehicle Slide-out */}
      {showEditForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--modal-backdrop)' }} onClick={() => setShowEditForm(false)} />
          <div style={{ position: 'relative', width: 440, background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', padding: 28, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Edit Vehicle</div>
              <button onClick={() => setShowEditForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
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
              { key: 'capacity', label: 'Capacity (ton)', placeholder: 'e.g. 30', type: 'number' },
              { key: 'mileage', label: 'Mileage (km)', placeholder: 'e.g. 150000', type: 'number' },
              { key: 'registration_expiry', label: 'Registration Expiry', type: 'date' },
              { key: 'last_maintenance_date', label: 'Last Maintenance Date', type: 'date' },
              { key: 'service_interval_km', label: 'Service Interval (km)', placeholder: 'e.g. 10000', type: 'number' },
              { key: 'last_service_mileage', label: 'Last Service Odometer (km)', placeholder: 'e.g. 145000', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>{f.label}</label>
                <input
                  type={f.type || 'text'}
                  placeholder={f.placeholder}
                  value={editForm[f.key] ?? ''}
                  onChange={e => setEditForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            {[
              { key: 'type', label: 'Vehicle Type', options: vehicleTypeNames.length > 0 ? vehicleTypeNames : ['Rigid Truck', 'Semi-Trailer Truck', 'Flatbed Truck', 'Tanker', 'Refrigerated Truck', 'Tautliner', 'Box Truck'] },
              { key: 'fuel_type', label: 'Fuel Type', options: ['Diesel', 'Petrol', 'Electric', 'Hybrid'] },
              { key: 'status', label: 'Status', options: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE', 'OUT_OF_SERVICE'] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>{f.label}</label>
                <Select
                  value={editForm[f.key] ?? ''}
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
                value={String(editForm.driver ?? '')}
                onValueChange={val => setEditForm((prev: any) => ({ ...prev, driver: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— No driver assigned —" />
                </SelectTrigger>
                <SelectContent>
                  {driversList.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
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
                    const vehicleTypeId = vehicleTypesList.find(vt => vt.name === type)?.id;
                    const payload = {
                      ...formWithoutType,
                      year: editForm.year ? Number(editForm.year) : undefined,
                      capacity: editForm.capacity ? Number(editForm.capacity) * 1000 : undefined,
                      mileage: editForm.mileage ? Number(editForm.mileage) : undefined,
                      service_interval_km: editForm.service_interval_km ? Number(editForm.service_interval_km) : null,
                      last_service_mileage: editForm.last_service_mileage ? Number(editForm.last_service_mileage) : null,
                      driver: editForm.driver !== '' && editForm.driver != null ? Number(editForm.driver) : null,
                      ...(vehicleTypeId ? { vehicle_type: vehicleTypeId } : {}),
                    };
                    await patchData({ url: `api/v1/vehicles/${id}/`, data: payload });
                    queryClient.invalidateQueries({ queryKey: ['vehicle', id] });
                    setShowEditForm(false);
                    setEditForm({});
                  } catch (e: any) {
                    setError(e?.message || 'Failed to update vehicle');
                  }
                  setSaving(false);
                }}
                style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', background: 'var(--accent-primary)', color: 'var(--bg-deep)', border: 'none', borderRadius: 2, cursor: saving ? 'wait' : 'pointer', fontWeight: 600, textTransform: 'uppercase' }}
              >
                {saving ? 'SAVING...' : 'UPDATE VEHICLE'}
              </button>
              <button
                onClick={() => setShowEditForm(false)}
                style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
