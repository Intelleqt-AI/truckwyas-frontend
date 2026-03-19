import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, patchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';

const VEHICLE_STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE'] as const;

const ScoreBar = ({ label, value, max = 100, color = 'var(--accent-primary)' }: any) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 12, color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{value ?? '—'}</span>
    </div>
    <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2 }}>
      <div style={{ height: 4, width: `${Math.min(100, ((value ?? 0) / max) * 100)}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
    </div>
  </div>
);

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'var(--accent-primary)',
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
  const statusColor = STATUS_COLOR[vehicle.status] || 'var(--text-tertiary)';

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none',
    borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
    textTransform: 'uppercase', padding: '10px 18px', cursor: 'pointer', marginBottom: -1,
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => navigate('/fleet')}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8, padding: 0 }}
        >← BACK TO FLEET</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Vehicle</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>
              {vehicle.make} {vehicle.model}{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{vehicle.plate}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              {vehicle.vehicle_type_name} · {vehicle.year} · {vehicle.fuel_type}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={() => {
                setShowEditForm(true);
                setEditForm({
                  plate: vehicle.plate || '',
                  make: vehicle.make || '',
                  model: vehicle.model || '',
                  year: vehicle.year || '',
                  status: vehicle.status || 'AVAILABLE',
                  fuel_type: vehicle.fuel_type || 'DIESEL',
                  capacity: vehicle.capacity || '',
                });
              }}
              className="btn-action"
              style={{ fontSize: 10, padding: '6px 12px' }}
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
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: isCurrentStatus ? 'var(--bg-deep)' : btnColor,
                    background: isCurrentStatus ? btnColor : 'transparent',
                    padding: '5px 10px',
                    border: `1px solid ${btnColor}`, borderRadius: 2,
                    cursor: isCurrentStatus || updating ? 'default' : 'pointer',
                    opacity: updating && !isCurrentStatus ? 0.5 : 1,
                    letterSpacing: '0.04em',
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
              { label: 'AI Health Score', value: vehicle.ai_health_score ?? 0, suffix: '/100' },
              { label: 'Fuel Efficiency', value: vehicle.fuel_efficiency_score ?? 0, suffix: '/100' },
              { label: 'Uptime', value: parseFloat(vehicle.uptime_percentage || '0').toFixed(1), suffix: '%' },
              { label: 'Mileage', value: parseFloat(vehicle.mileage || '0').toLocaleString('en-ZA'), suffix: ' km' },
            ].map(m => (
              <div key={m.label} className="card metric-card">
                <div className="card-header"><span className="card-title">{m.label}</span></div>
                <div className="metric-value" style={{ fontSize: 24 }}>
                  {m.value}<span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{m.suffix}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Specs */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Specifications</div>
              {[
                { label: 'VIN', value: vehicle.vin },
                { label: 'Plate', value: vehicle.plate },
                { label: 'Type', value: vehicle.vehicle_type_name || vehicle.type },
                { label: 'Capacity', value: vehicle.capacity ? `${parseFloat(vehicle.capacity).toFixed(0)} kg` : '—' },
                { label: 'Fuel Type', value: vehicle.fuel_type },
                { label: 'Year', value: vehicle.year },
                { label: 'Driver', value: vehicle.driver_name || '—' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value ?? '—'}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Economics */}
              <div className="card" style={{ padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Economics</div>
                {[
                  { label: 'Cost per km', value: `R ${parseFloat(vehicle.cost_per_km || '0').toFixed(2)}` },
                  { label: 'Margin per trip', value: formatCurrency(parseFloat(vehicle.margin_per_trip || '0')) },
                  { label: 'Fuel consumption', value: `${parseFloat(vehicle.fuel_consumption_per_km || '0').toFixed(2)} L/km` },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Maintenance */}
              <div className="card" style={{ padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Maintenance</div>
                {[
                  { label: 'Last Maintenance', value: vehicle.last_maintenance_date?.slice(0, 10) || '—' },
                  { label: 'Next Due', value: vehicle.next_maintenance_due?.slice(0, 10) || '—' },
                  { label: 'Insurance Expiry', value: vehicle.insurance_expiry?.slice(0, 10) || '—' },
                  { label: 'Registration Expiry', value: vehicle.registration_expiry?.slice(0, 10) || '—' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
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
            <div className="card metric-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8 }}>REVENUE GENERATED</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--accent-primary)' }}>{formatCurrency(totalRevenue)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{delivered.length} completed trips</div>
            </div>
            <div className="card metric-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8 }}>AVG REVENUE / TRIP</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>{formatCurrency(avgRevPerTrip)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Delivered loads</div>
            </div>
            <div className="card metric-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8 }}>REVENUE / KM</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>R {revPerKm.toFixed(2)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{totalDistance.toFixed(0)} km total</div>
            </div>
            <div className="card metric-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8 }}>AI HEALTH SCORE</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: healthScore >= 80 ? 'var(--status-success)' : healthScore >= 60 ? 'var(--status-warning)' : 'var(--status-danger)' }}>
                {healthScore}/100
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Fleet intelligence</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Performance Scores */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 20 }}>PERFORMANCE SCORES</div>
              <ScoreBar label="AI Health Score" value={healthScore} color={healthScore >= 80 ? 'var(--status-success)' : 'var(--status-warning)'} />
              <ScoreBar label="Uptime Score" value={vehicle.uptime_score ?? 0} color="var(--accent-primary)" />
              <ScoreBar label="Fuel Efficiency" value={vehicle.fuel_efficiency_score ?? 0} />
              <ScoreBar label="Maintenance Score" value={vehicle.maintenance_score ?? 0} color="var(--status-success)" />
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Uptime</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {parseFloat(vehicle.uptime_percentage || '0').toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Cost Analysis */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 20 }}>COST ANALYSIS</div>
              {[
                { label: 'Cost per km', value: vehicle.cost_per_km ? `R ${parseFloat(vehicle.cost_per_km).toFixed(2)}` : '—' },
                { label: 'Margin per trip', value: vehicle.margin_per_trip ? formatCurrency(parseFloat(vehicle.margin_per_trip)) : '—' },
                { label: 'Fuel consumption', value: vehicle.fuel_consumption_per_km ? `${vehicle.fuel_consumption_per_km} L/km` : '—' },
                { label: 'Capacity', value: vehicle.capacity ? `${parseFloat(vehicle.capacity).toFixed(0)} kg` : '—' },
                { label: 'Fuel type', value: vehicle.fuel_type || '—' },
                { label: 'Mileage', value: vehicle.mileage ? `${parseFloat(vehicle.mileage).toLocaleString('en-ZA')} km` : '—' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border-row)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* Compliance */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 20 }}>COMPLIANCE & MAINTENANCE</div>
              {[
                { label: 'Last Maintenance', value: vehicle.last_maintenance_date || '—', alert: false },
                { label: 'Next Due', value: vehicle.next_maintenance_due || '—', alert: vehicle.next_maintenance_due && new Date(vehicle.next_maintenance_due) < new Date() },
                { label: 'Insurance Expiry', value: vehicle.insurance_expiry || '—', alert: vehicle.insurance_expiry && new Date(vehicle.insurance_expiry) < new Date() },
                { label: 'Registration Expiry', value: vehicle.registration_expiry || '—', alert: vehicle.registration_expiry && new Date(vehicle.registration_expiry) < new Date() },
                { label: 'VIN', value: vehicle.vin || '—', alert: false },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border-row)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: r.alert ? 'var(--status-danger)' : 'var(--text-primary)' }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* Recent Loads */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 16 }}>RECENT LOADS ({loads.length})</div>
              {loads.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '20px 0', textAlign: 'center' }}>No loads recorded</div>
              ) : loads.slice(0, 8).map((load: any) => (
                <div
                  key={load.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-row)', cursor: 'pointer' }}
                  onClick={() => navigate(`/bookings/${load.id}`)}
                >
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{load.load_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{load.pickup_city} → {load.delivery_city}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{formatCurrency(parseFloat(load.total_amount || '0'))}</div>
                    <div style={{ fontSize: 10, color: load.status === 'DELIVERED' || load.status === 'INVOICED' ? 'var(--accent-primary)' : 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{load.status}</div>
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
              { key: 'plate', label: 'Registration / Plate', placeholder: 'e.g. ABC123GP' },
              { key: 'make', label: 'Make', placeholder: 'e.g. Volvo' },
              { key: 'model', label: 'Model', placeholder: 'e.g. FH16' },
              { key: 'year', label: 'Year', placeholder: 'e.g. 2022', type: 'number' },
              { key: 'capacity', label: 'Capacity (kg)', placeholder: 'e.g. 30000', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>{f.label}</label>
                <input
                  type={f.type || 'text'}
                  placeholder={f.placeholder}
                  value={editForm[f.key]}
                  onChange={e => setEditForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            {[
              { key: 'status', label: 'Status', options: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE'] },
              { key: 'fuel_type', label: 'Fuel Type', options: ['DIESEL', 'PETROL', 'ELECTRIC', 'HYBRID'] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>{f.label}</label>
                <select
                  value={editForm[f.key]}
                  onChange={e => setEditForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
                >
                  {f.options.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setError(null);
                  try {
                    await patchData({ url: `api/v1/vehicles/${id}/`, data: editForm });
                    queryClient.invalidateQueries({ queryKey: ['vehicle', id] });
                    setShowEditForm(false);
                    setEditForm({});
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
                onClick={() => setShowEditForm(false)}
                style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 2, cursor: 'pointer' }}
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
