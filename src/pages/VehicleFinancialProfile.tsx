import './fleet-detail.css';
import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, patchData } from '@/lib/Api';
import { formatCurrency } from '@/lib/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/Loader';
import SectionHeader from '@/components/layout/SectionHeader';

const VEHICLE_STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE'] as const;

// Sentence-case a status token for display: "IN_USE" → "In use".
const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';

const ScoreBar = ({ label, value, max = 100, color = 'var(--accent-primary)' }: any) => (
  <div className="fd-score">
    <div className="fd-score__row">
      <span className="fd-row__label">{label}</span>
      <span className="fd-row__value">{value ?? '—'}</span>
    </div>
    <div className="fd-score__track" aria-hidden="true">
      <div style={{ height: 4, width: `${Math.min(100, ((value ?? 0) / max) * 100)}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
    </div>
  </div>
);

/** Label/value row used by every detail card. `mono` only for identifiers. */
const DetailRow = ({ label, value, mono, alert }: { label: string; value: any; mono?: boolean; alert?: boolean }) => (
  <div className="fd-row">
    <span className="fd-row__label">{label}</span>
    <span className={`fd-row__value${mono ? ' fd-id' : ''}`} style={alert ? { color: 'var(--status-danger-text, var(--status-danger))' } : undefined}>{value ?? '—'}</span>
  </div>
);

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'var(--status-success-text, var(--status-success))',
  IN_USE: 'var(--status-warning-text, var(--status-warning))',
  MAINTENANCE: 'var(--status-danger-text, var(--status-danger))',
  OUT_OF_SERVICE: 'var(--text-secondary)',
};

const healthColor = (score: number) =>
  score >= 80 ? 'var(--status-success-text, var(--status-success))'
    : score >= 60 ? 'var(--status-warning-text, var(--status-warning))'
    : 'var(--status-danger-text, var(--status-danger))';

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

  if (isLoading) return <Loader fullScreen />;
  if (!vehicle) return (
    <div className="fleet-detail">
      <SectionHeader eyebrow="Fleet" title="Vehicle not found" description="This vehicle may have been removed, or the link is out of date." />
      <button className="btn-action" onClick={() => navigate('/fleet/vehicles')}>Back to vehicles</button>
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

  const openEdit = () => {
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
  };

  const subtitle = [
    [vehicle.make, vehicle.model].filter(Boolean).join(' '),
    vehicle.vehicle_type_name, vehicle.year, vehicle.fuel_type,
  ].filter(Boolean).join(' · ');

  return (
    <div className="fleet-detail">
      <button className="fd-back" onClick={() => navigate('/fleet/vehicles')}>← Back to vehicles</button>

      <SectionHeader
        eyebrow="Vehicle"
        title={vehicle.plate || vehicle.registration || `Vehicle ${id}`}
        description={subtitle || undefined}
        tabs={[
          { label: 'Overview', to: `/fleet/vehicles/${id}`, end: true },
          { label: 'Financial profile', to: `/fleet/vehicles/${id}/financial` },
        ]}
        actions={<>
          <button className="fd-button" onClick={openEdit}>Edit</button>
          <div className="fd-status-group" role="group" aria-label="Vehicle status">
            {VEHICLE_STATUSES.map(s => {
              const isCurrentStatus = vehicle.status === s;
              const btnColor = STATUS_COLOR[s] || 'var(--text-secondary)';
              return (
                <button
                  key={s}
                  className="fd-button fd-status"
                  aria-pressed={isCurrentStatus}
                  disabled={isCurrentStatus || updating}
                  onClick={async () => {
                    setUpdating(true);
                    try {
                      await patchData({ url: `api/v1/vehicles/${id}/`, data: { status: s } });
                      queryClient.invalidateQueries({ queryKey: ['vehicle', id] });
                    } catch (e) { console.error(e); }
                    setUpdating(false);
                  }}
                  style={isCurrentStatus ? { color: btnColor, borderColor: btnColor } : { opacity: updating ? 0.5 : 1 }}
                >
                  {formatStatus(s)}
                </button>
              );
            })}
          </div>
        </>}
      />

      {/* ── Overview tab ── */}
      {!isFinancial && (
        <>
          <div className="fd-metrics">
            {[
              { label: 'AI health score', value: vehicle.ai_health_score ?? 0, suffix: '/100', color: healthColor(healthScore) },
              { label: 'Fuel efficiency', value: vehicle.fuel_efficiency_score ?? 0, suffix: '/100' },
              { label: 'Uptime', value: parseFloat(vehicle.uptime_percentage || '0').toFixed(1), suffix: '%' },
              { label: 'Mileage', value: parseFloat(vehicle.mileage || '0').toLocaleString('en-ZA'), suffix: ' km' },
            ].map(m => (
              <div key={m.label} className="card metric-card">
                <div className="card-header"><span className="card-title">{m.label}</span></div>
                <div className="metric-value" style={{ color: m.color || 'var(--text-primary)' }}>
                  {m.value}<span className="fd-suffix">{m.suffix}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="fd-grid">
            <section className="card fd-card">
              <h2 className="fd-card__title">Specifications</h2>
              <DetailRow label="VIN" value={vehicle.vin} mono />
              <DetailRow label="Registration" value={vehicle.plate} mono />
              <DetailRow label="Type" value={vehicle.vehicle_type_name || '—'} />
              <DetailRow label="Capacity" value={vehicle.capacity ? `${(parseFloat(vehicle.capacity) / 1000).toFixed(1)} ton` : '—'} />
              <DetailRow label="Fuel type" value={vehicle.fuel_type} />
              <DetailRow label="Year" value={vehicle.year} />
              <DetailRow label="Driver" value={vehicle.driver_name || '—'} />
            </section>

            <div className="fd-stack">
              <section className="card fd-card">
                <h2 className="fd-card__title">Economics</h2>
                <DetailRow label="Cost per km" value={`R ${parseFloat(vehicle.cost_per_km || '0').toFixed(2)}`} />
                <DetailRow label="Margin per trip" value={formatCurrency(parseFloat(vehicle.margin_per_trip || '0'))} />
                <DetailRow label="Fuel consumption" value={`${parseFloat(vehicle.fuel_consumption_per_km || '0').toFixed(2)} L/km`} />
              </section>

              <section className="card fd-card">
                <h2 className="fd-card__title">Maintenance</h2>
                <DetailRow label="Last maintenance" value={vehicle.last_maintenance_date?.slice(0, 10) || '—'} />
                <DetailRow label="Service interval" value={vehicle.service_interval_km ? `${Number(vehicle.service_interval_km).toLocaleString('en-ZA')} km` : '—'} />
                <DetailRow label="Next service at" value={nextServiceKm ? `${nextServiceKm.toLocaleString('en-ZA')} km` : '—'} />
                <DetailRow label="Km until service" value={kmUntilService !== null ? (kmUntilService > 0 ? `${Math.round(kmUntilService).toLocaleString('en-ZA')} km` : 'Overdue') : '—'} />
                <DetailRow label="Registration expiry" value={vehicle.registration_expiry?.slice(0, 10) || '—'} />
              </section>
            </div>
          </div>
        </>
      )}

      {/* ── Financial tab ── */}
      {isFinancial && (
        <>
          <div className="fd-metrics">
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Revenue generated</span></div>
              <div className="metric-value">{formatCurrency(totalRevenue)}</div>
              <div className="fd-metric-sub">{delivered.length} completed trips</div>
            </div>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Avg revenue per trip</span></div>
              <div className="metric-value">{formatCurrency(avgRevPerTrip)}</div>
              <div className="fd-metric-sub">Delivered loads</div>
            </div>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">Revenue per km</span></div>
              <div className="metric-value">R {(revPerKm || 0).toFixed(2)}</div>
              <div className="fd-metric-sub">{(totalDistance || 0).toFixed(0)} km total</div>
            </div>
            <div className="card metric-card">
              <div className="card-header"><span className="card-title">AI health score</span></div>
              <div className="metric-value" style={{ color: healthColor(healthScore) }}>{healthScore}<span className="fd-suffix">/100</span></div>
              <div className="fd-metric-sub">Fleet intelligence</div>
            </div>
          </div>

          <div className="fd-grid">
            <section className="card fd-card">
              <h2 className="fd-card__title">Performance scores</h2>
              <ScoreBar label="AI health score" value={healthScore} color={healthScore >= 80 ? 'var(--status-success)' : 'var(--status-warning)'} />
              <ScoreBar label="Uptime score" value={vehicle.uptime_score ?? 0} color="var(--accent-primary)" />
              <ScoreBar label="Fuel efficiency" value={vehicle.fuel_efficiency_score ?? 0} />
              <ScoreBar label="Maintenance score" value={vehicle.maintenance_score ?? 0} color="var(--status-success)" />
              <div className="fd-divider" />
              <DetailRow label="Uptime" value={`${parseFloat(vehicle.uptime_percentage || '0').toFixed(1)}%`} />
            </section>

            <section className="card fd-card">
              <h2 className="fd-card__title">Cost analysis</h2>
              <DetailRow label="Cost per km" value={vehicle.cost_per_km ? `R ${parseFloat(vehicle.cost_per_km).toFixed(2)}` : '—'} />
              <DetailRow label="Margin per trip" value={vehicle.margin_per_trip ? formatCurrency(parseFloat(vehicle.margin_per_trip)) : '—'} />
              <DetailRow label="Fuel consumption" value={vehicle.fuel_consumption_per_km ? `${vehicle.fuel_consumption_per_km} L/km` : '—'} />
              <DetailRow label="Capacity" value={vehicle.capacity ? `${(parseFloat(vehicle.capacity) / 1000).toFixed(1)} ton` : '—'} />
              <DetailRow label="Fuel type" value={vehicle.fuel_type || '—'} />
              <DetailRow label="Mileage" value={vehicle.mileage ? `${parseFloat(vehicle.mileage).toLocaleString('en-ZA')} km` : '—'} />
            </section>

            <section className="card fd-card">
              <h2 className="fd-card__title">Compliance and maintenance</h2>
              <DetailRow label="Last maintenance" value={vehicle.last_maintenance_date?.slice(0, 10) || '—'} />
              <DetailRow label="Service interval" value={vehicle.service_interval_km ? `${Number(vehicle.service_interval_km).toLocaleString('en-ZA')} km` : '—'} />
              <DetailRow label="Next service at" value={nextServiceKm ? `${nextServiceKm.toLocaleString('en-ZA')} km` : '—'} />
              <DetailRow label="Km until service" value={kmUntilService !== null ? (kmUntilService > 0 ? `${Math.round(kmUntilService).toLocaleString('en-ZA')} km` : 'Overdue') : '—'} alert={kmUntilService !== null && kmUntilService <= 0} />
              <DetailRow label="Registration expiry" value={vehicle.registration_expiry?.slice(0, 10) || '—'} alert={!!(vehicle.registration_expiry && new Date(vehicle.registration_expiry) < new Date())} />
              <DetailRow label="VIN" value={vehicle.vin || '—'} mono />
            </section>

            <section className="card fd-card">
              <h2 className="fd-card__title">Recent loads ({loads.length})</h2>
              {loads.length === 0 ? (
                <div className="fd-empty">No loads recorded</div>
              ) : loads.slice(0, 8).map((load: any) => (
                <div
                  key={load.id}
                  className="fd-row fd-row--link"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/bookings/${load.id}`)}
                  onKeyDown={e => { if (e.key === 'Enter') navigate(`/bookings/${load.id}`); }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="fd-id" style={{ color: 'var(--text-primary)' }}>{load.load_number}</div>
                    <div className="fd-row__label">{load.pickup_city} → {load.delivery_city}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="fd-row__value">{formatCurrency(parseFloat(load.total_amount || '0'))}</div>
                    <div className="fd-row__label" style={{ color: load.status === 'DELIVERED' || load.status === 'INVOICED' ? 'var(--status-success-text, var(--status-success))' : undefined }}>{formatStatus(load.status)}</div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        </>
      )}

      {/* Edit Vehicle Slide-out */}
      {showEditForm && (
        <div className="fd-drawer" role="dialog" aria-modal="true" aria-labelledby="fd-edit-vehicle-title" onKeyDown={e => { if (e.key === 'Escape') setShowEditForm(false); }}>
          <div className="fd-drawer__backdrop" onClick={() => setShowEditForm(false)} />
          <div className="fd-drawer__panel">
            <div className="fd-drawer__head">
              <h2 id="fd-edit-vehicle-title" className="fd-card__title" style={{ margin: 0 }}>Edit vehicle</h2>
              <button className="fd-icon-button" aria-label="Close" onClick={() => setShowEditForm(false)}>✕</button>
            </div>
            {error && (
              <div className="fd-error" role="alert">
                {error}
              </div>
            )}
            {[
              { key: 'vin', label: 'VIN', placeholder: 'e.g. WDB9634031L123456' },
              { key: 'make', label: 'Make', placeholder: 'e.g. Mercedes-Benz' },
              { key: 'model', label: 'Model', placeholder: 'e.g. Actros 2645' },
              { key: 'year', label: 'Year', placeholder: '2024', type: 'number' },
              { key: 'plate', label: 'Registration plate', placeholder: 'e.g. GP 567 ZAB' },
              { key: 'capacity', label: 'Capacity (ton)', placeholder: 'e.g. 30', type: 'number' },
              { key: 'mileage', label: 'Mileage (km)', placeholder: 'e.g. 150000', type: 'number' },
              { key: 'registration_expiry', label: 'Registration expiry', type: 'date' },
              { key: 'last_maintenance_date', label: 'Last maintenance date', type: 'date' },
              { key: 'service_interval_km', label: 'Service interval (km)', placeholder: 'e.g. 10000', type: 'number' },
              { key: 'last_service_mileage', label: 'Last service odometer (km)', placeholder: 'e.g. 145000', type: 'number' },
            ].map(f => (
              <div key={f.key} className="fd-field">
                <label className="fd-label" htmlFor={`fd-edit-${f.key}`}>{f.label}</label>
                <input
                  id={`fd-edit-${f.key}`}
                  className="fd-input"
                  type={f.type || 'text'}
                  placeholder={f.placeholder}
                  value={editForm[f.key] ?? ''}
                  onChange={e => setEditForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            {[
              { key: 'type', label: 'Vehicle type', options: vehicleTypeNames.length > 0 ? vehicleTypeNames : ['Rigid Truck', 'Semi-Trailer Truck', 'Flatbed Truck', 'Tanker', 'Refrigerated Truck', 'Tautliner', 'Box Truck'] },
              { key: 'fuel_type', label: 'Fuel type', options: ['Diesel', 'Petrol', 'Electric', 'Hybrid'] },
              { key: 'status', label: 'Status', options: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE', 'OUT_OF_SERVICE'] },
            ].map(f => (
              <div key={f.key} className="fd-field">
                <label className="fd-label">{f.label}</label>
                <Select
                  value={editForm[f.key] ?? ''}
                  onValueChange={val => setEditForm((prev: any) => ({ ...prev, [f.key]: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map(o => <SelectItem key={o} value={o}>{f.key === 'status' ? formatStatus(o) : o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="fd-field">
              <label className="fd-label">Assigned driver</label>
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
            <div className="fd-drawer__actions">
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
                className="btn-action"
                style={{ flex: 1, cursor: saving ? 'wait' : 'pointer' }}
              >
                {saving ? 'Saving…' : 'Update vehicle'}
              </button>
              <button
                onClick={() => setShowEditForm(false)}
                className="fd-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
