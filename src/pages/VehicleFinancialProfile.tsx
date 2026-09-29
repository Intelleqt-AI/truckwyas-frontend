import './fleet-detail.css';
import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchData, patchData } from '@/lib/Api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DetailSkeleton, RecordState, randCents, InfoTip, Panel, RecordHeader, StatusChip, StatusControl,
  capacityTonnes, dateText, formatStatus, isNotFound, kmText, num, plural, randWhole,
} from '@/components/fleet-detail/parts';
import {
  ComplianceCard, ConditionCard, FactsCard, LinkCard, LoadLink, NowLine, PerformanceCard,
  daysSince, fleetPerKm, isDelivered, isOpenLoad, latest, perfFigures, perfLine, performance, dateToDo, staleWork, staleSentence, StaleOrderButton, type ToDo,
} from '@/components/fleet-detail/record';
import { useBalancedColumns } from '@/components/fleet-detail/useBalancedColumns';
import { formatNumber, formatPercent, formatWeight, sentenceCaseLabel } from '@/lib/formatters';
import { LoadsTable } from '@/components/fleet-detail/LoadsTable';
import { useStickyRail } from '@/components/fleet-detail/useStickyRail';
import { useLedger } from '@/components/reports/data';
import { loadFailed } from '@/components/data/LoadError';
import { useFocusTrap, latestModal } from '@/hooks/useFocusTrap';
import { Link } from 'react-router-dom';

const VEHICLE_STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE'] as const;

/** The model default for `fuel_consumption_per_km` (core/models/vehicle.py). */
const DEFAULT_L_PER_KM = 0.35;
/** Warn this many km before a service falls due. */
const SERVICE_SOON_KM = 1000;

/* One page per truck (owner redesign, round 4). The head says what it is
   (plate, make and model, type, year, payload) and what it is doing now;
   the main column says what it earns (Performance, then its loads with
   money); the rail holds what the owner acts on (Compliance to-dos), its
   condition, and the facts. /fleet/vehicles/:id and /:id/financial both
   land here. Figures come from this truck's loads and the Reports expense
   ledger only. */
export default function VehicleFinancialProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const railRef = useStickyRail<HTMLElement>();
  const [showEditForm, setShowEditForm] = useState(false);
  useFocusTrap(latestModal, showEditForm);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vehicleQuery = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => fetchData(`api/v1/vehicles/${id}/`),
    enabled: !!id,
    // A missing record is final; only retry transient failures.
    retry: (count: number, err: unknown) => !isNotFound(err) && count < 2,
  });
  const { data: vehicle, isLoading, error: queryError, refetch } = vehicleQuery;
  const loadError = queryError ?? vehicleQuery.failureReason;
  // Failing (even while retrying) with nothing to show: say so straight away.
  const isError = loadFailed(vehicleQuery);

  const { data: loadsData, isLoading: loadsLoading } = useQuery({
    queryKey: ['vehicle-loads', id],
    queryFn: () => fetchData(`api/v1/loads/?vehicle=${id}&page_size=50`),
    enabled: !!id,
  });

  // Costs logged on this truck, from the same expense ledger as the P&L; every
  // load, for the fleet's revenue per km (the comparison).
  const ledger = useLedger(['expenses', 'loads']);

  // The driver and facts may drop into the main column so the two columns end
  // within 48px of each other (R5). Condition always stays in the rail, so it
  // has one layout on every truck (R7).
  const bal = useBalancedColumns({ toMain: ['driver', 'facts'] }, `${id}-${isLoading}-${loadsLoading}-${ledger.loading}`);
  const sideRef = useCallback((n: HTMLElement | null) => { railRef(n); bal.sideRef.current = n; }, [railRef, bal.sideRef]);

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

  // Error states keep the head ("Vehicle") and the breadcrumb (R7): a 404 says
  // the truck is not there; anything else is a load error with Retry.
  const stateProps = { type: 'Vehicle', crumb: 'Vehicles', crumbTo: '/fleet/vehicles', what: 'this vehicle',
    missingTitle: 'There is no vehicle at this link', missingHint: 'It may have been removed, or the link is out of date.', backLabel: 'All vehicles' };
  if (isError && !isNotFound(loadError)) return (
    <RecordState kind="error" {...stateProps} error={loadError} busy={vehicleQuery.isFetching} onRetry={() => refetch()} />
  );
  // Loads and the cost ledger decide the cards: wait for them so nothing jumps.
  // A failed ledger does not block the page; the margin figure is left out.
  if ((isLoading || loadsLoading || ledger.loading) && !isError) return <DetailSkeleton crumb="Vehicles" crumbTo="/fleet/vehicles" />;
  if (!vehicle) return <RecordState kind="missing" {...stateProps} />;

  const loads: any[] = Array.isArray(loadsData) ? loadsData : (loadsData?.results || []);
  const loadsTotal: number = loadsData?.count ?? loads.length;
  const partial = loadsTotal > loads.length;
  const vid = Number(id);
  const expenses = ledger.data ? ledger.data.expenses.filter((e: any) => e.vehicle === vid) : null;
  const perf = performance(loads, expenses);
  const deliveredCount = perf.delivered.length;
  const thin = deliveredCount > 0 && deliveredCount < 3;

  const lPerKm = num(vehicle.fuel_consumption_per_km);
  const defaultFuel = Math.abs(lPerKm - DEFAULT_L_PER_KM) < 0.001;

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

  const setStatus = async (s: string) => {
    setUpdating(true);
    try {
      await patchData({ url: `api/v1/vehicles/${id}/`, data: { status: s } });
      queryClient.invalidateQueries({ queryKey: ['vehicle', id] });
    } catch (e) { console.error(e); }
    setUpdating(false);
  };

  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const tonnes = capacityTonnes(vehicle);
  // Year steps aside on phones so the subtitle keeps one line (content at 146).
  const metaParts = [
    makeModel && { k: 'mm', v: makeModel },
    vehicle.vehicle_type_name && { k: 'type', v: sentenceCaseLabel(vehicle.vehicle_type_name) },
    vehicle.year && { k: 'year', v: String(vehicle.year), phoneHide: true },
    tonnes && { k: 't', v: formatWeight(tonnes) },
  ].filter(Boolean) as { k: string; v: string; phoneHide?: boolean }[];
  const meta = metaParts.length ? <>{metaParts.map((m, i) => (
    <span key={m.k} className={m.phoneHide ? 'fd-hide-phone' : undefined}>{i > 0 ? ' · ' : ''}{m.v}</span>
  ))}</> : null;
  const title = vehicle.plate || vehicle.registration || `Vehicle ${id}`;
  const status = String(vehicle.status || '').toUpperCase();

  // ---- Now: from the open order that names this truck, else its status.
  const openLoad = loads.filter(isOpenLoad).sort((a, b) => String(b.pickup_date || '').localeCompare(String(a.pickup_date || '')))[0];
  const lastDelivered = latest(loads.filter(isDelivered));
  const lastWhen = lastDelivered ? dateText(lastDelivered.delivery_date || lastDelivered.pickup_date) : null;
  const idleDays = lastDelivered ? daysSince(lastDelivered.delivery_date || lastDelivered.pickup_date) : null;
  const openOrders = <button type="button" className="fd-ghost" onClick={() => navigate('/bookings/orders')}>Open orders</button>;
  let now: JSX.Element;
  const stale = staleWork(openLoad);
  if (openLoad && stale) {
    // Stale work (R5/R7): an order left open is not current work. One short
    // fact line (neutral, one amber dot) and one action; the load number is in
    // the Loads card and the driver in the Driver card, so neither repeats here.
    now = (
      <NowLine dot action={<StaleOrderButton load={openLoad} />}>
        {staleSentence(openLoad, stale)}
      </NowLine>
    );
  } else if (openLoad) {
    const to = openLoad.delivery_city || openLoad.delivery_location;
    const driverName = vehicle.driver_name || openLoad.driver_name;
    const flag = status === 'AVAILABLE' ? 'Marked available' : status === 'MAINTENANCE' || status === 'OUT_OF_SERVICE' ? `Marked ${formatStatus(status).toLowerCase()}` : undefined;
    now = (
      <NowLine flag={flag}>
        <strong>{({ IN_TRANSIT: 'In transit', LOADING: 'Loading', ASSIGNED: 'Assigned' } as Record<string, string>)[String(openLoad.status).toUpperCase()] ?? 'On an order'}</strong>{': '}
        {driverName ? driverName : <span className="fd-now__warn">no driver on the order</span>}
        {to ? <> to {to}</> : null}
        {openLoad.customer_name ? <> for {openLoad.customer_name}</> : null}
        {' · '}<LoadLink load={openLoad} />
      </NowLine>
    );
  } else if (status === 'IN_USE') {
    now = (
      <NowLine flag="No current order" action={openOrders}>
        {/* The head chip already says "In use"; the flag says what contradicts it. */}
        {lastWhen ? <>Last delivery <span className="fd-nowrap">{lastWhen}</span></> : 'No loads yet'}
      </NowLine>
    );
  } else if (status === 'MAINTENANCE') {
    now = <NowLine>In maintenance{vehicle.last_maintenance_date ? ` since ${dateText(vehicle.last_maintenance_date)}` : ''}</NowLine>;
  } else if (status === 'OUT_OF_SERVICE' || status === 'INACTIVE') {
    now = <NowLine>{formatStatus(status)}</NowLine>;
  } else if (lastDelivered && idleDays !== null) {
    now = (
      <NowLine action={openOrders}>
        <strong>Idle {plural(Math.max(0, idleDays), 'day')}</strong>, last delivery <span className="fd-nowrap">{lastWhen}</span>
        {lastDelivered.delivery_city ? <> in <span className="fd-nowrap">{lastDelivered.delivery_city}</span></> : null}
      </NowLine>
    );
  } else {
    now = <NowLine>{status === 'IN_USE' ? 'Marked in use, no loads yet' : 'Available, no loads yet'}</NowLine>;
  }

  // ---- Compliance: what the owner acts on.
  const addEdit = (what: string) => ({ label: 'Add', onClick: openEdit, aria: `Add ${what}` });
  const todos: ToDo[] = [];
  if (kmUntilService !== null) {
    todos.push(kmUntilService <= 0
      ? { key: 'service', tone: 'danger', title: 'Service overdue', detail: `${kmText(-kmUntilService)} over · due at ${kmText(nextServiceKm!)}` }
      : { key: 'service', tone: kmUntilService <= SERVICE_SOON_KM ? 'warning' : 'ok', title: `Service due in ${kmText(kmUntilService)}`, detail: `At ${kmText(nextServiceKm!)}` });
  } else {
    todos.push({ key: 'service', tone: 'missing', title: 'Service interval', detail: vehicle.service_interval_km ? 'Last service odometer not recorded' : 'Not recorded', action: addEdit('service interval') });
  }
  [
    dateToDo('reg', 'Licence disc', vehicle.registration_expiry, 30, addEdit('licence disc expiry')),
    dateToDo('ins', 'Insurance', vehicle.insurance_expiry, 30),
  ].forEach(t => { if (t) todos.push(t); });
  const maintDays = vehicle.next_maintenance_due ? daysSince(vehicle.next_maintenance_due) : null;
  if (maintDays !== null) {
    todos.push(maintDays > 0
      ? { key: 'maint', tone: 'danger', title: 'Maintenance overdue', detail: `${plural(maintDays, 'day')} · ${dateText(vehicle.next_maintenance_due)}` }
      : { key: 'maint', tone: -maintDays <= 14 ? 'warning' : 'ok', title: maintDays === 0 ? 'Maintenance due today' : `Maintenance due in ${plural(-maintDays, 'day')}`, detail: dateText(vehicle.next_maintenance_due) });
  }

  // ---- Performance
  const fleetKm = fleetPerKm(ledger.data?.loads);
  const basis = <>
    Delivered and invoiced loads on this truck, counted in the month of delivery, over the last 12 months (the Reports definition).
    {' '}Margin after truck costs: revenue less approved expenses logged on this truck (fuel, tolls, maintenance, insurance) in the same months; expenses waiting for approval are not deducted, as in the P&L, and the line under the margin shows what it becomes if they are approved.
    {perf.costCount > 0 ? ` Approved costs in these months: ${randWhole(perf.costs)}${perf.pending > 0 ? `; ${randWhole(perf.pending)} more is waiting for approval` : ''}.` : ''}
    {' '}Revenue per km uses loads with a distance{perf.km > 0 ? ` (${kmText(perf.km)} here)` : ''}; the fleet figure{fleetKm ? ` (${randCents(fleetKm.perKm)} per km)` : ''} is every delivered load with a distance over the same 12 months, the basis Insights uses. Days on a job count calendar days from pickup to delivery.
    {partial ? ` Based on the latest ${loads.length} of ${loadsTotal} loads.` : ''}
    {perf.older > 0 ? ` ${plural(perf.older, 'older delivered load')} fall outside the 12 months.` : ''}
  </>;
  const figures = perfFigures(perf, { revenueLabel: 'Revenue', thin, costs: true, costsKnown: expenses !== null, fleetKm });

  // ---- Condition
  const overall = Number(vehicle.ai_health_score) || null;
  const uptimePct = Number(vehicle.uptime_percentage) ? formatPercent(parseFloat(vehicle.uptime_percentage), 1) : null;

  // ---- Driver
  const driverId = vehicle.driver ?? null;
  const driverName = vehicle.driver_name || null;
  const noLoads = loads.length === 0;
  // The driver on the vehicle record, else the driver on its open order
  // (named as the Now line does: "On LOAD-… with Riaan Venter"), else none.
  const openDriver = openLoad && !(driverId && driverName) ? (openLoad.driver_name || null) : null;
  // Said once, here (R7): the driver on the open order is marked inactive.
  const openDriverInactive = !!openLoad?.driver && String(((Array.isArray(driversData) ? driversData : driversData?.results) || [])
    .find((d: any) => d.id === openLoad.driver)?.status || '').toUpperCase() === 'INACTIVE';
  const driverCard = driverId && driverName ? (
    <LinkCard title="Driver" className="fd-o-driver"
      primary={<Link className="fd-inline-link" to={`/fleet/drivers/${driverId}`}>{driverName}</Link>}
      secondary="Assigned to this truck" />
  ) : openLoad && openDriver ? (
    <LinkCard title="Driver" className="fd-o-driver"
      primary={openLoad.driver ? <Link className="fd-inline-link" to={`/fleet/drivers/${openLoad.driver}`}>{openDriver}</Link> : openDriver}
      secondary={openDriverInactive ? 'Marked inactive · no regular driver' : 'On the open order · no regular driver'} />
  ) : noLoads ? null : (
    <LinkCard title="Driver" className="fd-o-driver" primary={<span className="fd-muted">No driver assigned</span>}
      action={<button type="button" className="fd-ghost" onClick={openEdit}>Assign</button>} />
  );

  // A truck with no loads: one "Getting started" card (its first load, its
  // driver, then the compliance to-dos) in place of three empty cards. The
  // rail and the facts stay where they are on every other truck.
  const firstSteps: ToDo[] = noLoads ? [
    { key: 'first-load', tone: 'missing', title: 'First load', detail: 'Performance fills in once it delivers', action: { label: 'Open orders', onClick: () => navigate('/bookings/orders') } },
    ...(!(driverId && driverName) ? [{ key: 'driver', tone: 'missing' as const, title: 'Driver', detail: 'Not assigned', action: { label: 'Assign', onClick: openEdit, aria: 'Assign a driver' } }] : []),
  ] : [];

  // Head subtitle already says make and model, type, year and payload: the
  // facts card lists only what the head does not (year returns on phones,
  // where the subtitle drops it).
  const factsCard = (
    <FactsCard className="fd-o-facts" wide={bal.inMain('facts')} title="Vehicle" facts={[
                { label: 'VIN', value: vehicle.vin, mono: true, add: openEdit },
                { label: 'Year', value: vehicle.year, phoneOnly: true },
                { label: 'Fuel', value: vehicle.fuel_type ? formatStatus(vehicle.fuel_type) : null },
                {
                  label: 'Fuel use',
                  value: lPerKm ? <>{formatNumber(lPerKm, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L/km{defaultFuel ? <span className="fd-row__note fd-muted">default</span> : null}</> : null,
                },
                { label: 'Odometer', value: Number(vehicle.mileage) ? kmText(parseFloat(vehicle.mileage)) : null, add: openEdit },
                { label: 'Last maintenance', value: dateText(vehicle.last_maintenance_date), add: openEdit },
                ...(!makeModel ? [{ label: 'Make and model', value: null, add: openEdit }] : []),
                ...(!tonnes ? [{ label: 'Payload', value: null, add: openEdit }] : []),
              ]} />
  );

  const conditionCard = (overall || !noLoads) ? (
    <ConditionCard
      className="fd-o-condition"
      overall={overall}
      info={<>Rule-based, not a prediction: maintenance 35%, uptime 25%, fuel use 25% and age 15%, each out of 100. A factor with no data scores a neutral value. 80 or more is good, 60 to 79 fair, 40 to 59 low; below 40 needs action.</>}
      parts={[
        { label: 'Maintenance', score: Number(vehicle.maintenance_score) || null },
        { label: 'Fuel efficiency', score: Number(vehicle.fuel_efficiency_score) || null },
        { label: 'Uptime', score: Number(vehicle.uptime_score) || null, note: uptimePct ? `${uptimePct} of the time` : undefined },
      ]}
    />
  ) : null;

  return (
    <div className="fleet-detail">
      <RecordHeader
        crumb="Vehicles"
        crumbTo="/fleet/vehicles"
        title={title}
        chip={<StatusChip status={vehicle.status} />}
        meta={meta || undefined}
        actions={<>
          <button type="button" className="fd-button fd-head-secondary" onClick={openEdit}>Edit vehicle</button>
          <StatusControl label="Set vehicle status" subject={title} options={VEHICLE_STATUSES} current={vehicle.status} busy={updating} onPick={setStatus} />
        </>}
      />

      {now}

      <div className="fd-record">
        <div className="fd-main" ref={bal.mainRef}>
          {noLoads ? (
            <ComplianceCard
              className="fd-o-todo"
              title="Getting started"
              lead={firstSteps}
              items={todos}
            />
          ) : (
            // With loads but none delivered in the window, Performance has one
            // sentence: it becomes the Loads card's sub line (R6).
            deliveredCount > 0 ? (
              <PerformanceCard
                className="fd-o-perf"
                perf={perf}
                figures={figures}
                basis={basis}
                thinLine={perfLine(perf)}
              />
            ) : null
          )}

          {!noLoads && (
            <Panel
              title="Loads"
              sub={deliveredCount > 0
                ? (loadsTotal > 1 ? plural(loadsTotal, 'load') : undefined)
                : `${plural(loadsTotal, 'load')} · none delivered in the last 12 months${perf.older > 0 ? ` (${perf.older} earlier)` : ''}`}
              flush
              className="fd-o-loads"
            >
              <LoadsTable loads={loads} />
            </Panel>
          )}

          {bal.inMain('driver') && driverCard}
          {bal.inMain('facts') && factsCard}
        </div>

        <aside ref={sideRef} className="fd-side">
          {!noLoads && <ComplianceCard className="fd-o-todo" items={todos} />}
          {!bal.inMain('driver') && driverCard}
          {!bal.inMain('facts') && factsCard}
          {conditionCard}
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
