import './fleet-detail.css';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, patchData } from '@/lib/Api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertsPanel, DetailMessage, MiniStats, DetailSkeleton, Group, InfoTip, Kpi, KpiStrip, Panel, RecordHeader, Row, StatusChip,
  StatusControl, Tag, dateText, daysUntil, expiryAlert, formatStatus, isNotFound, kmText, monthlySeries, num, plural,
  randCents, randWhole, type AlertItem, type Tone,
} from '@/components/fleet-detail/parts';
import { MonthlyBars } from '@/components/fleet-detail/MonthlyBars';
import { LoadsTable } from '@/components/fleet-detail/LoadsTable';

const VEHICLE_STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE'] as const;

const STATUS_TONE: Record<string, Tone> = {
  AVAILABLE: 'success',
  ACTIVE: 'success',
  IN_USE: 'info',
  MAINTENANCE: 'warning',
  OUT_OF_SERVICE: 'neutral',
  INACTIVE: 'neutral',
};

/** The model default for `fuel_consumption_per_km` (core/models/vehicle.py). */
const DEFAULT_L_PER_KM = 0.35;
/** Warn this many km before a service falls due. */
const SERVICE_SOON_KM = 1000;

/* One page per truck: identity and actions, the money strip, revenue by
   month and recent loads on the left, every stored field and real alerts on
   the right. /fleet/vehicles/:id and /fleet/vehicles/:id/financial both land
   here. Figures the backend models (cost per km, margin after fuel, the
   condition scores) are tagged as such; cost per km is withheld while it can
   only be the default-consumption fallback. */
export default function VehicleFinancialProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: vehicle, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => fetchData(`api/v1/vehicles/${id}/`),
    enabled: !!id,
    // A missing record is final; only retry transient failures.
    retry: (count: number, err: unknown) => !isNotFound(err) && count < 2,
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

  if (isLoading) return <DetailSkeleton />;
  if (isError && !isNotFound(loadError)) return (
    <DetailMessage
      title="Vehicle did not load"
      body="Check your connection and try again."
      primary={{ label: 'Try again', onClick: () => refetch() }}
      secondary={{ label: 'Back to vehicles', onClick: () => navigate('/fleet/vehicles') }}
    />
  );
  if (!vehicle) return (
    <DetailMessage
      title="Vehicle not found"
      body="It may have been removed, or the link is out of date."
      primary={{ label: 'Back to vehicles', onClick: () => navigate('/fleet/vehicles') }}
    />
  );

  const loads: any[] = Array.isArray(loadsData) ? loadsData : (loadsData?.results || []);
  const loadsTotal: number = loadsData?.count ?? loads.length;
  const delivered = loads.filter((l: any) => l.status === 'DELIVERED');
  const totalRevenue = delivered.reduce((s: number, l: any) => s + num(l.total_amount), 0);
  const avgRevPerTrip = delivered.length > 0 ? totalRevenue / delivered.length : 0;
  const totalDistance = delivered.reduce((s: number, l: any) => s + num(l.distance), 0);
  const revPerKm = totalDistance > 0 ? totalRevenue / totalDistance : 0;
  const months = monthlySeries(delivered);
  const monthLabels = months.map(m => m.label);
  const partial = loadsTotal > loads.length;

  // Stored economics. cost_per_km is modelled fuel (L/km × settings diesel)
  // plus logged maintenance; with no km, or with the 0.35 L/km model default,
  // it is the fallback, so it is withheld rather than shown as a fact.
  const lPerKm = num(vehicle.fuel_consumption_per_km);
  const defaultFuel = Math.abs(lPerKm - DEFAULT_L_PER_KM) < 0.001;
  const storedCostPerKm = num(vehicle.cost_per_km);
  const costPerKmReal = storedCostPerKm > 0 && totalDistance > 0 && !defaultFuel;
  const marginPerTrip = num(vehicle.margin_per_trip);

  const healthScore = vehicle.ai_health_score ?? 0;

  const nextServiceKm = (vehicle.service_interval_km && vehicle.last_service_mileage)
    ? parseFloat(vehicle.last_service_mileage) + Number(vehicle.service_interval_km)
    : null;
  const kmUntilService = (nextServiceKm !== null && vehicle.mileage)
    ? nextServiceKm - parseFloat(vehicle.mileage)
    : null;

  const alerts = [
    kmUntilService !== null && kmUntilService <= 0
      ? { key: 'service', tone: 'danger', text: 'Service overdue', when: `${kmText(-kmUntilService)} over` } as AlertItem
      : kmUntilService !== null && kmUntilService <= SERVICE_SOON_KM
        ? { key: 'service', tone: 'warning', text: `Service due in ${kmText(kmUntilService)}`, when: nextServiceKm ? `at ${kmText(nextServiceKm)}` : null } as AlertItem
        : null,
    expiryAlert('maint', 'Maintenance', vehicle.next_maintenance_due, 14),
    expiryAlert('reg', 'Registration', vehicle.registration_expiry, 30),
    expiryAlert('ins', 'Insurance', vehicle.insurance_expiry, 30),
  ].filter(Boolean) as AlertItem[];
  // "Maintenance expired" reads wrong; a past due date is "overdue".
  alerts.forEach(a => { if (a.key === 'maint') a.text = a.text.replace('expired', 'overdue').replace('expires', 'due'); });

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

  const setStatus = async (s: string) => {
    setUpdating(true);
    try {
      await patchData({ url: `api/v1/vehicles/${id}/`, data: { status: s } });
      queryClient.invalidateQueries({ queryKey: ['vehicle', id] });
    } catch (e) { console.error(e); }
    setUpdating(false);
  };

  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const meta = [makeModel, vehicle.vehicle_type_name, vehicle.year].filter(Boolean).join(' · ');
  const title = vehicle.plate || vehicle.registration || `Vehicle ${id}`;
  const score = (v: any) => (Number(v) ? `${v}` : null);
  const regDays = daysUntil(vehicle.registration_expiry);

  return (
    <div className="fleet-detail">
      <RecordHeader
        crumb="Vehicles"
        crumbTo="/fleet/vehicles"
        title={title}
        chip={<StatusChip tone={STATUS_TONE[vehicle.status] || 'neutral'}>{formatStatus(vehicle.status)}</StatusChip>}
        meta={meta || undefined}
        actions={<>
          <StatusControl label="Set vehicle status" options={VEHICLE_STATUSES} current={vehicle.status} busy={updating} onPick={setStatus} />
          <button type="button" className="fd-button" onClick={openEdit}>Edit vehicle</button>
        </>}
      />

      <KpiStrip label="Truck economics">
        <Kpi
          label="Revenue"
          value={delivered.length > 0 ? randWhole(totalRevenue) : null}
          empty="No delivered loads"
          sub={delivered.length > 0 ? <>{randWhole(avgRevPerTrip)} per load</> : undefined}
          info={<>Delivered loads on this truck{partial ? `, latest ${loads.length} of ${loadsTotal}` : ''}. Invoiced and in-progress loads are not counted.</>}
          spark={delivered.length > 0 ? { values: months.map(m => m.revenue), labels: monthLabels, format: randWhole, ariaLabel: 'Delivered revenue by month, last 12 months' } : undefined}
        />
        <Kpi
          label="Cost per km"
          value={costPerKmReal ? randCents(storedCostPerKm) : null}
          tag={costPerKmReal ? <Tag>Modelled</Tag> : undefined}
          sub={revPerKm > 0 ? <>Earns {randCents(revPerKm)} per km</> : undefined}
          info={costPerKmReal
            ? <>Modelled: fuel at {lPerKm.toFixed(2)} L/km times the diesel price in settings, plus maintenance logged on this truck, over delivered km.</>
            : <>Needs this truck's own fuel use{totalDistance > 0 ? '' : ' and delivered km'}. The stored {storedCostPerKm ? randCents(storedCostPerKm) : 'figure'} uses the {DEFAULT_L_PER_KM} L/km default, so it is not shown.{revPerKm > 0 ? ` Earnings per km are from ${kmText(totalDistance)} of delivered loads.` : ''}</>}
        />
        <Kpi
          label="Margin after fuel"
          value={marginPerTrip && delivered.length > 0 ? randWhole(marginPerTrip) : null}
          empty={delivered.length > 0 ? 'Not calculated' : 'No delivered loads'}
          tag={marginPerTrip && delivered.length > 0 ? <Tag>Modelled</Tag> : undefined}
          sub={marginPerTrip && delivered.length > 0 ? 'Per load' : undefined}
          info={<>Average revenue per completed load less modelled fuel (distance × {lPerKm ? lPerKm.toFixed(2) : DEFAULT_L_PER_KM} L/km{defaultFuel ? ', the default' : ''} × settings diesel). Tolls, driver and fixed costs are not deducted.</>}
        />
        <Kpi
          label="Loads delivered"
          value={delivered.length.toLocaleString('en-ZA')}
          sub={<>of {plural(loads.length, 'load')}{partial ? ` (latest of ${loadsTotal})` : ''}</>}
        />
      </KpiStrip>

      <div className="fd-body">
        <div className="fd-main">
          <Panel
            title="Revenue by month"
            sub="Delivered loads, last 12 months"
            info={<>Each load counts in the month of its delivery date (pickup or created date when missing).{partial ? ` Based on the latest ${loads.length} of ${loadsTotal} loads.` : ''}</>}
            aside={delivered.length > 0 ? <span className="fd-aside-figure">{randWhole(months.reduce((s, m) => s + m.revenue, 0))}</span> : undefined}
          >
            {delivered.length > 0
              ? <MonthlyBars data={months} caption="Delivered revenue by month" />
              : <p className="fd-empty">No delivered loads yet.</p>}
            <MiniStats items={[
              { label: 'Revenue per load', value: delivered.length > 0 ? randWhole(avgRevPerTrip) : null },
              { label: 'Revenue per km', value: revPerKm > 0 ? randCents(revPerKm) : null },
              { label: 'Delivered distance', value: totalDistance > 0 ? kmText(totalDistance) : null },
              { label: 'Fuel use', value: lPerKm ? `${lPerKm.toFixed(2)} L/km` : null, note: defaultFuel ? <Tag>Default</Tag> : undefined },
            ]} />
          </Panel>

          <Panel title="Recent loads" sub={loads.length ? plural(loadsTotal, 'load') : undefined} flush>
            <LoadsTable loads={loads} />
          </Panel>
        </div>

        <aside className="fd-side">
          <AlertsPanel items={alerts} />

          <Panel title="Details">
            <Group title="Vehicle" onAdd={openEdit} rows={[
              { label: 'Registration', value: vehicle.plate, mono: true },
              { label: 'VIN', value: vehicle.vin, mono: true },
              { label: 'Make and model', value: makeModel || null },
              { label: 'Type', value: vehicle.vehicle_type_name },
              { label: 'Year', value: vehicle.year },
              { label: 'Capacity', value: vehicle.capacity ? `${(parseFloat(vehicle.capacity) / 1000).toFixed(1)} t` : null },
              { label: 'Fuel type', value: vehicle.fuel_type ? formatStatus(vehicle.fuel_type) : null },
              { label: 'Driver', value: vehicle.driver_name },
            ]} />

            <Group title="Service and compliance" onAdd={openEdit} rows={[
              { label: 'Odometer', value: Number(vehicle.mileage) ? kmText(parseFloat(vehicle.mileage)) : null },
              { label: 'Last maintenance', value: dateText(vehicle.last_maintenance_date) },
              { label: 'Service interval', value: vehicle.service_interval_km ? kmText(Number(vehicle.service_interval_km)) : null },
              { label: 'Last service odometer', value: vehicle.last_service_mileage ? kmText(parseFloat(vehicle.last_service_mileage)) : null },
              { label: 'Next service at', value: nextServiceKm ? kmText(nextServiceKm) : null, derived: true },
              {
                label: 'Km until service',
                value: kmUntilService !== null ? (kmUntilService > 0 ? kmText(kmUntilService) : 'Overdue') : null,
                tone: kmUntilService !== null && kmUntilService <= 0 ? 'danger' : kmUntilService !== null && kmUntilService <= SERVICE_SOON_KM ? 'warning' : undefined,
                derived: true,
              },
              {
                label: 'Registration expiry',
                value: dateText(vehicle.registration_expiry),
                tone: regDays !== null && regDays < 0 ? 'danger' : regDays !== null && regDays <= 30 ? 'warning' : undefined,
              },
              { label: 'Insurance expiry', value: dateText(vehicle.insurance_expiry), derived: !vehicle.insurance_expiry },
            ]} />

            <Group
              title="Condition scores"
              missingText={healthScore ? undefined : 'Not scored yet'}
              extra={<>
                <Tag>Rule-based</Tag>
                <InfoTip label="condition scores">Out of 100, from a fixed formula: maintenance 35%, uptime 25%, fuel 25%, age 15%. A factor with no data scores a neutral value, so treat these as indicative.</InfoTip>
              </>}
              rows={[
                { label: 'Health score', value: score(healthScore) },
                { label: 'Uptime score', value: score(vehicle.uptime_score) },
                { label: 'Fuel efficiency', value: score(vehicle.fuel_efficiency_score) },
                { label: 'Maintenance score', value: score(vehicle.maintenance_score) },
                { label: 'Uptime', value: Number(vehicle.uptime_percentage) ? `${parseFloat(vehicle.uptime_percentage).toFixed(1)}%` : null },
              ]}
            />
          </Panel>
        </aside>
      </div>

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
