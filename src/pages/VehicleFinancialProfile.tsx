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

// Every score bar is the same 0 to 100 scale in one neutral accent; the
// number carries the meaning, not a traffic-light colour.
const ScoreBar = ({ label, value, max = 100, color = 'var(--accent-primary)' }: any) => (
  <div className="fd-score">
    <div className="fd-score__row">
      <span className="fd-row__label">{label}</span>
      <span className="fd-row__value">{value ?? '—'}</span>
    </div>
    <div className="fd-score__track" aria-hidden="true">
      <div style={{ height: 6, width: `${Math.min(100, ((value ?? 0) / max) * 100)}%`, background: color, borderRadius: 3 }} />
    </div>
  </div>
);

/** Label/value row used by every detail card. `mono` only for identifiers. */
const DetailRow = ({ label, value, mono, alert }: { label: string; value: any; mono?: boolean; alert?: boolean }) => (
  <div className="fd-row">
    <span className="fd-row__label">{label}</span>
    <span className={`fd-row__value${mono ? ' fd-id' : ''}`} style={alert ? { color: 'var(--status-danger-text, var(--status-danger))' } : undefined}>{value == null || value === '' ? '—' : value}</span>
  </div>
);

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  AVAILABLE: 'success',
  ACTIVE: 'success',
  IN_USE: 'info',
  MAINTENANCE: 'warning',
  OUT_OF_SERVICE: 'neutral',
  INACTIVE: 'neutral',
};

const km = (n: number) => `${Math.round(n).toLocaleString('en-ZA')} km`;

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

  // Shown as missing (not R 0.00) until the vehicle stats job has computed them.
  const money = (v: any) => (Number(v) ? formatCurrency(parseFloat(v)) : '—');
  const perKm = (v: any) => (Number(v) ? `R ${parseFloat(v).toFixed(2)}` : '—');
  const loadsBasis = delivered.length === 1 ? '1 delivered load' : `${delivered.length} delivered loads`;

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
        titleAdornment={<span className={`fd-chip fd-chip--${STATUS_TONE[vehicle.status] || 'neutral'}`}>{formatStatus(vehicle.status)}</span>}
        description={subtitle || undefined}
        tabs={[
          { label: 'Overview', to: `/fleet/vehicles/${id}`, end: true },
          { label: 'Financial profile', to: `/fleet/vehicles/${id}/financial` },
        ]}
        actions={<>
          <div className="fd-status-group" role="group" aria-label="Set vehicle status">
            {VEHICLE_STATUSES.map(s => {
              const isCurrentStatus = vehicle.status === s;
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
                  style={isCurrentStatus ? undefined : { opacity: updating ? 0.5 : 1 }}
                >
                  {formatStatus(s)}
                </button>
              );
            })}
          </div>
          <button className="fd-button" onClick={openEdit}>Edit vehicle</button>
        </>}
      />

      {/* ── Overview tab ── */}
      {!isFinancial && (
        <>
          {/* Key figure first: what this truck has earned, then its condition. */}
          <section className="card fd-kpis" aria-label="Vehicle summary">
            <div className="fd-kpi fd-kpi--lead">
              <div className="fd-kpi__label">Delivered revenue</div>
              <div className="fd-kpi__value">{delivered.length > 0 ? formatCurrency(totalRevenue) : '—'}</div>
              <div className="fd-kpi__note">{delivered.length > 0 ? `From ${loadsBasis}, ${formatCurrency(avgRevPerTrip)} per load.` : 'No delivered loads on this vehicle yet.'}</div>
            </div>
            <div className="fd-kpi">
              <div className="fd-kpi__label">Health score</div>
              <div className="fd-kpi__value">{healthScore ? <>{healthScore}<span className="fd-kpi__of">of 100</span></> : '—'}</div>
              <div className="fd-kpi__note">{healthScore ? 'Maintenance, uptime, fuel use and age combined.' : 'Not scored yet.'}</div>
            </div>
            <div className="fd-kpi">
              <div className="fd-kpi__label">Odometer</div>
              <div className="fd-kpi__value">{Number(vehicle.mileage) ? km(parseFloat(vehicle.mileage)) : '—'}</div>
              <div className="fd-kpi__note">
                {kmUntilService !== null
                  ? (kmUntilService > 0 ? `Next service in ${km(kmUntilService)}.` : 'Service is overdue.')
                  : 'Set a service interval to track the next service.'}
              </div>
            </div>
          </section>

          <div className="fd-grid">
            <section className="card fd-card">
              <h2 className="fd-card__title">Specifications</h2>
              <DetailRow label="VIN" value={vehicle.vin} mono />
              <DetailRow label="Registration" value={vehicle.plate} mono />
              <DetailRow label="Type" value={vehicle.vehicle_type_name || '—'} />
              <DetailRow label="Capacity" value={vehicle.capacity ? `${(parseFloat(vehicle.capacity) / 1000).toFixed(1)} t` : '—'} />
              <DetailRow label="Fuel type" value={vehicle.fuel_type} />
              <DetailRow label="Year" value={vehicle.year} />
              <DetailRow label="Driver" value={vehicle.driver_name || '—'} />
            </section>

            <div className="fd-stack">
              <section className="card fd-card">
                <h2 className="fd-card__title">What does it cost to run?</h2>
                <DetailRow label="Cost per km" value={perKm(vehicle.cost_per_km)} />
                <DetailRow label="Margin per load" value={money(vehicle.margin_per_trip)} />
                <DetailRow label="Fuel consumption" value={Number(vehicle.fuel_consumption_per_km) ? `${parseFloat(vehicle.fuel_consumption_per_km).toFixed(2)} L/km` : '—'} />
              </section>

              <section className="card fd-card">
                <h2 className="fd-card__title">When is it due?</h2>
                <DetailRow label="Last maintenance" value={vehicle.last_maintenance_date?.slice(0, 10) || '—'} />
                <DetailRow label="Service interval" value={vehicle.service_interval_km ? `${Number(vehicle.service_interval_km).toLocaleString('en-ZA')} km` : '—'} />
                <DetailRow label="Next service at" value={nextServiceKm ? `${nextServiceKm.toLocaleString('en-ZA')} km` : '—'} />
                <DetailRow label="Km until service" value={kmUntilService !== null ? (kmUntilService > 0 ? `${Math.round(kmUntilService).toLocaleString('en-ZA')} km` : 'Overdue') : '—'} alert={kmUntilService !== null && kmUntilService <= 0} />
                <DetailRow label="Registration expiry" value={vehicle.registration_expiry?.slice(0, 10) || '—'} alert={!!(vehicle.registration_expiry && new Date(vehicle.registration_expiry) < new Date())} />
              </section>
            </div>
          </div>
        </>
      )}

      {/* ── Financial tab ── */}
      {isFinancial && (
        <>
          <section className="card fd-kpis" aria-label="Earnings summary">
            <div className="fd-kpi fd-kpi--lead">
              <div className="fd-kpi__label">Delivered revenue</div>
              <div className="fd-kpi__value">{delivered.length > 0 ? formatCurrency(totalRevenue) : '—'}</div>
              <div className="fd-kpi__note">{delivered.length > 0 ? `From ${loadsBasis}.` : 'No delivered loads on this vehicle yet.'}</div>
            </div>
            <div className="fd-kpi">
              <div className="fd-kpi__label">Revenue per load</div>
              <div className="fd-kpi__value">{delivered.length > 0 ? formatCurrency(avgRevPerTrip) : '—'}</div>
              <div className="fd-kpi__note">Average across delivered loads.</div>
            </div>
            <div className="fd-kpi">
              <div className="fd-kpi__label">Revenue per km</div>
              <div className="fd-kpi__value">{revPerKm > 0 ? `R ${revPerKm.toFixed(2)}` : '—'}</div>
              <div className="fd-kpi__note">{totalDistance > 0 ? `Over ${km(totalDistance)} of delivered loads.` : 'No distance recorded on delivered loads.'}</div>
            </div>
          </section>

          <div className="fd-grid">
            <section className="card fd-card">
              <h2 className="fd-card__title">How healthy is it?</h2>
              <p className="fd-card__desc">Scores out of 100. The health score weights maintenance 35%, uptime 25%, fuel 25% and age 15%.</p>
              <ScoreBar label="Health score" value={healthScore || null} />
              <ScoreBar label="Uptime score" value={vehicle.uptime_score || null} />
              <ScoreBar label="Fuel efficiency" value={vehicle.fuel_efficiency_score || null} />
              <ScoreBar label="Maintenance score" value={vehicle.maintenance_score || null} />
              <div className="fd-divider" />
              <DetailRow label="Uptime" value={`${parseFloat(vehicle.uptime_percentage || '0').toFixed(1)}%`} />
            </section>

            <section className="card fd-card">
              <h2 className="fd-card__title">What does it cost to run?</h2>
              <DetailRow label="Cost per km" value={perKm(vehicle.cost_per_km)} />
              <DetailRow label="Margin per load" value={money(vehicle.margin_per_trip)} />
              <DetailRow label="Fuel consumption" value={vehicle.fuel_consumption_per_km ? `${vehicle.fuel_consumption_per_km} L/km` : '—'} />
              <DetailRow label="Capacity" value={vehicle.capacity ? `${(parseFloat(vehicle.capacity) / 1000).toFixed(1)} t` : '—'} />
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
                    <div className="fd-row__label">{formatStatus(load.status)}</div>
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
                  <SelectValue placeholder="No driver assigned" />
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
